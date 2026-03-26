import { NextRequest } from "next/server";

/* ─── Rate Limiting (2 req / 2 hours, unlimited for owner IP) ─── */
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 2;
const RATE_WINDOW = 2 * 60 * 60 * 1000; // 2 hours
const OWNER_IPS = (process.env.OWNER_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);

function isRateLimited(ip: string): boolean {
  // Owner IPs bypass rate limiting
  if (OWNER_IPS.includes(ip)) return false;

  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

/* ─── Photo extraction ─── */
function extractPhotoUrls(html: string): string[] {
  const urls: string[] = [];

  // 1. From JSON-LD (most reliable)
  const jsonLdMatches = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
  );
  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      const jsonContent = match
        .replace(/<script type="application\/ld\+json">/, "")
        .replace(/<\/script>/, "");
      try {
        const parsed = JSON.parse(jsonContent);
        // VacationRental has "photo" array
        if (parsed.photo && Array.isArray(parsed.photo)) {
          for (const p of parsed.photo) {
            const imgUrl = p.contentUrl || p.url;
            if (imgUrl) urls.push(imgUrl);
          }
        }
        // Or "image" field
        if (parsed.image) {
          const images = Array.isArray(parsed.image)
            ? parsed.image
            : [parsed.image];
          for (const img of images) {
            const imgUrl = typeof img === "string" ? img : img.url || img.contentUrl;
            if (imgUrl) urls.push(imgUrl);
          }
        }
      } catch {
        // skip
      }
    }
  }

  // 2. From og:image meta tags
  const ogImageMatches = html.match(
    /property="og:image"[^>]*content="([^"]+)"/g
  );
  if (ogImageMatches) {
    for (const match of ogImageMatches) {
      const urlMatch = match.match(/content="([^"]+)"/);
      if (urlMatch && !urls.includes(urlMatch[1])) {
        urls.push(urlMatch[1]);
      }
    }
  }

  // 3. From Airbnb image URLs in the HTML
  const airbnbImgMatches = html.match(
    /https:\/\/a0\.muscache\.com\/im\/pictures\/[^"'\s)]+/g
  );
  if (airbnbImgMatches) {
    for (const imgUrl of airbnbImgMatches) {
      // Avoid duplicates and tiny images
      const cleanImgUrl = imgUrl.split("?")[0];
      if (!urls.some((u) => u.includes(cleanImgUrl))) {
        urls.push(imgUrl);
      }
    }
  }

  // Aggressive deduplication: normalize URLs to catch size variants and duplicates
  const seen = new Set<string>();
  return urls.filter((u) => {
    // Remove query params
    let key = u.split("?")[0];
    // Remove size suffixes like /w_1200/ or _720x480 or im/pictures/hosting/ vs im/pictures/
    key = key.replace(/\/w_\d+/, "").replace(/_\d+x\d+/, "");
    // Extract just the unique image ID (the filename part)
    const filenameMatch = key.match(/([a-f0-9-]{20,}|[^/]+\.(jpg|jpeg|png|webp))/i);
    if (filenameMatch) {
      key = filenameMatch[1].split(".")[0]; // Remove extension for comparison
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ─── Airbnb Scraper ─── */
interface ScrapeResult {
  textContent: string;
  photoUrls: string[];
  totalPhotoCount: number;
}

async function scrapeAirbnb(url: string): Promise<ScrapeResult> {
  // Clean URL - remove query params
  const cleanUrl = url.split("?")[0];

  // Extract room ID
  const roomIdMatch = cleanUrl.match(/rooms\/(\d+)/);
  const roomId = roomIdMatch ? roomIdMatch[1] : null;

  // Try multiple approaches to get listing data
  const errors: string[] = [];

  // Approach 1: Fetch the Airbnb page directly with browser-like headers
  try {
    const response = await fetch(cleanUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });

    if (response.ok) {
      const html = await response.text();

      // Extract data from various sources in the HTML
      const extractedData: string[] = [];

      // 1. Look for JSON-LD structured data
      const jsonLdMatches = html.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
      );
      if (jsonLdMatches) {
        for (const match of jsonLdMatches) {
          const jsonContent = match
            .replace(/<script type="application\/ld\+json">/, "")
            .replace(/<\/script>/, "");
          try {
            const parsed = JSON.parse(jsonContent);
            extractedData.push(
              "JSON-LD DATA:\n" + JSON.stringify(parsed, null, 2)
            );
          } catch {
            // not valid JSON, skip
          }
        }
      }

      // 2. Look for __NEXT_DATA__ or bootstrapData
      const nextDataMatch = html.match(
        /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
      );
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          // Extract relevant page props
          const pageProps = nextData?.props?.pageProps;
          if (pageProps) {
            extractedData.push(
              "NEXT_DATA (pageProps):\n" +
                JSON.stringify(pageProps, null, 2).substring(0, 15000)
            );
          }
        } catch {
          // skip
        }
      }

      // 3. Look for bootstrapped data (Airbnb specific)
      const bootstrapMatches = html.match(
        /<!--\s*(\{[\s\S]*?\})\s*-->/g
      );
      if (bootstrapMatches) {
        for (const match of bootstrapMatches.slice(0, 3)) {
          const content = match.replace(/<!--\s*/, "").replace(/\s*-->/, "");
          try {
            const parsed = JSON.parse(content);
            if (
              parsed.listing ||
              parsed.pdpData ||
              parsed.niobeMinimalClientData
            ) {
              extractedData.push(
                "BOOTSTRAP DATA:\n" +
                  JSON.stringify(parsed, null, 2).substring(0, 15000)
              );
            }
          } catch {
            // skip
          }
        }
      }

      // 4. Look for deferred data script tags
      const deferredDataMatches = html.match(
        /<script[^>]*data-deferred-state[^>]*>([\s\S]*?)<\/script>/g
      );
      if (deferredDataMatches) {
        for (const match of deferredDataMatches.slice(0, 3)) {
          const content = match
            .replace(/<script[^>]*>/, "")
            .replace(/<\/script>/, "");
          try {
            const parsed = JSON.parse(content);
            extractedData.push(
              "DEFERRED STATE DATA:\n" +
                JSON.stringify(parsed, null, 2).substring(0, 15000)
            );
          } catch {
            // skip
          }
        }
      }

      // 5. Extract meta tags
      const metaTags: string[] = [];
      const metaMatches = html.match(/<meta[^>]+>/g);
      if (metaMatches) {
        for (const meta of metaMatches) {
          const nameMatch = meta.match(
            /(?:name|property)="([^"]+)".*?content="([^"]+)"/
          );
          if (nameMatch) {
            metaTags.push(`${nameMatch[1]}: ${nameMatch[2]}`);
          }
        }
        if (metaTags.length > 0) {
          extractedData.push("META TAGS:\n" + metaTags.join("\n"));
        }
      }

      // 6. Extract title
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/);
      if (titleMatch) {
        extractedData.push("PAGE TITLE: " + titleMatch[1].trim());
      }

      // 7. Try to extract visible text content (descriptions, amenities)
      // Remove scripts and styles, then get text
      const textContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // Get meaningful text chunks (avoid very short ones)
      if (textContent.length > 100) {
        extractedData.push(
          "PAGE TEXT CONTENT (extrait):\n" +
            textContent.substring(0, 8000)
        );
      }

      if (extractedData.length > 0) {
        // Extract photos from the full HTML
        const photoUrls = extractPhotoUrls(html);
        return {
          textContent: extractedData.join("\n\n---\n\n"),
          photoUrls,
          totalPhotoCount: photoUrls.length,
        };
      }
    } else {
      errors.push(`Fetch direct: HTTP ${response.status}`);
    }
  } catch (e) {
    errors.push(`Fetch direct: ${e instanceof Error ? e.message : "erreur"}`);
  }

  // Approach 2: Try Airbnb API endpoint if we have a room ID
  if (roomId) {
    try {
      const apiUrl = `https://www.airbnb.fr/api/v3/StaysPdpSections/${roomId}?operationName=StaysPdpSections&locale=fr&currency=EUR`;
      const apiResponse = await fetch(apiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "application/json",
          "X-Airbnb-API-Key": "d306zoyjsyarp7ifhu67rjxn52tv0t20",
        },
      });

      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        return {
          textContent:
            "AIRBNB API DATA:\n" +
            JSON.stringify(apiData, null, 2).substring(0, 20000),
          photoUrls: [],
          totalPhotoCount: 0,
        };
      } else {
        errors.push(`API Airbnb: HTTP ${apiResponse.status}`);
      }
    } catch (e) {
      errors.push(
        `API Airbnb: ${e instanceof Error ? e.message : "erreur"}`
      );
    }
  }

  // If all approaches failed, return what we know
  return {
    textContent: `ÉCHEC DU SCRAPING - Tentatives: ${errors.join("; ")}. Room ID: ${roomId || "non trouvé"}. URL: ${cleanUrl}`,
    photoUrls: [],
    totalPhotoCount: 0,
  };
}

/* ─── System Prompt ─── */
const SYSTEM_PROMPT = `Tu es un expert en optimisation d'annonces de locations saisonnières (Airbnb, Booking, etc.). Tu analyses les annonces de manière professionnelle avec un regard critique mais constructif.

Tu dois analyser une annonce Airbnb et produire un rapport d'audit complet basé sur les données extraites de l'annonce qui te sont fournies.

IMPORTANT: Réponds UNIQUEMENT en JSON valide. Pas de texte avant ou après. Pas de backticks. Juste le JSON.

Structure JSON exacte requise:
{
  "listing_title": "titre exact de l'annonce",
  "location": "ville ou zone géographique",
  "property_type": "type de bien (maison, appartement, gîte, etc.)",
  "score_global": <number 0-100>,
  "verdict": "phrase résumé 1-2 lignes sur l'état général de l'annonce",
  "points_forts": ["point fort 1", "point fort 2", "point fort 3"],
  "points_critiques": ["point faible 1", "point faible 2", "point faible 3"],
  "categories": [
    {
      "name": "Impact Visuel & Photos",
      "icon": "📸",
      "score": <number 0-25>,
      "max": 25,
      "detail": "explication de la note en 2-3 phrases",
      "suggestions": ["suggestion concrète 1", "suggestion concrète 2", "suggestion concrète 3"]
    },
    {
      "name": "Titre & Accroche",
      "icon": "✍️",
      "score": <number 0-15>,
      "max": 15,
      "detail": "explication de la note en 2-3 phrases",
      "suggestions": ["suggestion concrète 1", "suggestion concrète 2"]
    },
    {
      "name": "Description & Storytelling",
      "icon": "📝",
      "score": <number 0-20>,
      "max": 20,
      "detail": "explication de la note en 2-3 phrases",
      "suggestions": ["suggestion concrète 1", "suggestion concrète 2", "suggestion concrète 3"]
    },
    {
      "name": "Équipements & Services",
      "icon": "🏠",
      "score": <number 0-15>,
      "max": 15,
      "detail": "explication de la note en 2-3 phrases",
      "suggestions": ["suggestion concrète 1", "suggestion concrète 2"]
    },
    {
      "name": "Positionnement Tarifaire",
      "icon": "💰",
      "score": <number 0-10>,
      "max": 10,
      "detail": "explication de la note en 2-3 phrases",
      "suggestions": ["suggestion concrète 1"]
    },
    {
      "name": "Avis & Réputation",
      "icon": "⭐",
      "score": <number 0-10>,
      "max": 10,
      "detail": "explication de la note en 2-3 phrases",
      "suggestions": ["suggestion concrète 1"]
    },
    {
      "name": "Check-in & Accueil",
      "icon": "🔑",
      "score": <number 0-5>,
      "max": 5,
      "detail": "explication de la note en 1-2 phrases",
      "suggestions": ["suggestion concrète 1"]
    }
  ],
  "recommandation_visuelle": "Un paragraphe de 3-4 phrases personnalisé à cette annonce expliquant comment des photos professionnelles et une meilleure présentation visuelle pourraient améliorer les performances de réservation. Cite des statistiques crédibles (ex: selon les données Airbnb, les annonces avec photos professionnelles reçoivent 40% de réservations en plus et peuvent augmenter leur tarif de 20%). Sois spécifique au bien analysé."
}

GRILLE DE NOTATION DÉTAILLÉE:

1. IMPACT VISUEL & PHOTOS (/25):
Tu reçois les 3 premières photos de l'annonce. Analyse-les visuellement avec un oeil de photographe professionnel :
- Nombre total de photos (moins de 10 = insuffisant, 10-25 = idéal, 26-35 = léger excès qui dilue l'impact, plus de 35 = trop de photos, pénaliser car cela noie le voyageur et montre un manque de sélection): /3
- Photo de couverture : attractive, donne envie de cliquer, bien cadrée: /4
- Horizontalité et angles : les lignes sont-elles droites ? L'horizon est-il penché ? Les verticales sont-elles respectées ?: /4
- Luminosité : lumière naturelle, pas de zones sombres, pas de contre-jour, blanc équilibré: /3
- Cadrage et composition : bonne utilisation de l'espace, pas d'objets coupés, pas de miroirs avec reflet du photographe: /3
- Diversité des pièces : les photos montrent-elles des espaces différents ou répètent-elles la même pièce sous des angles similaires ?: /3
- Mise en scène et propreté : pièces rangées, décoration soignée, pas d'objets personnels encombrants: /3
- Qualité technique globale : netteté, résolution, absence de bruit/grain, colorimétrie naturelle: /2
Déduis le niveau général (amateur vs semi-pro vs professionnel) à partir de l'échantillon et extrapole aux autres photos.

2. TITRE & ACCROCHE (/15):
- Clarté et compréhension immédiate du bien: /5
- Présence de mots-clés recherchés (piscine, vue, calme, etc.): /5
- Différenciation et émotion (pas générique): /5

3. DESCRIPTION & STORYTELLING (/20):
- Qualité rédactionnelle et orthographe: /4
- Informations pratiques complètes (accès, parking, distance commerces): /5
- Mise en avant des atouts uniques du bien: /4
- Capacité à projeter le voyageur (émotion, ambiance): /4
- Structure et lisibilité (paragraphes, pas un pavé): /3

4. ÉQUIPEMENTS & SERVICES (/15):
- Nombre d'équipements listés (plus est mieux): /4
- Équipements premium (WiFi fibre, climatisation, piscine, parking privé): /4
- Équipements cuisine complète: /3
- Équipements famille/bébé/animaux/accessibilité: /4

5. POSITIONNEMENT TARIFAIRE (/10):
- Cohérence prix vs prestation/taille/localisation: /5
- Compétitivité vs marché local similaire: /5

6. AVIS & RÉPUTATION (/10):
- Note moyenne (idéal > 4.7): /4
- Nombre d'avis (plus = crédibilité): /3
- Réponses de l'hôte aux avis: /3

7. CHECK-IN & ACCUEIL (/5):
- Arrivée autonome proposée: /2
- Informations d'arrivée claires: /2
- Flexibilité horaires: /1

RÈGLES:
- Sois honnête et exigeant mais constructif
- Chaque suggestion doit être concrète et actionnable
- Le score_global DOIT être la SOMME exacte de toutes les catégories
- Adapte le ton au bien analysé (pas de réponse générique copier-coller)
- Si tu ne trouves pas certaines infos dans les données fournies, note-le et pénalise légèrement
- MÊME si les données sont partielles, tu DOIS produire le JSON complet. Ne réponds JAMAIS en texte libre. Toujours du JSON.
- Analyse les données extraites de la page avec attention : meta tags, texte visible, données structurées, etc.`;

/* ─── Anthropic API types ─── */
interface ContentBlock {
  type: string;
  text?: string;
}

/* ─── POST Handler ─── */
export async function POST(request: NextRequest) {
  /* --- CORS --- */
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = [
    "https://www.votrephotographeimmo.com",
    "https://votrephotographeimmo.com",
  ];
  const isDev = process.env.NODE_ENV === "development";
  const corsOrigin =
    isDev || allowedOrigins.some((o) => origin.startsWith(o))
      ? origin
      : allowedOrigins[0];

  const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  /* --- Rate limit --- */
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return Response.json(
      {
        error:
          "Trop de requêtes. Veuillez réessayer dans quelques minutes.",
      },
      { status: 429, headers: corsHeaders }
    );
  }

  /* --- Validate body --- */
  let url: string;
  try {
    const body = await request.json();
    url = body.url;
  } catch {
    return Response.json(
      { error: "Requête invalide." },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!url || !url.toLowerCase().includes("airbnb")) {
    return Response.json(
      {
        error:
          'Veuillez fournir un lien Airbnb valide (l\'URL doit contenir "airbnb").',
      },
      { status: 400, headers: corsHeaders }
    );
  }

  /* --- Check API key --- */
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Clé API non configurée côté serveur." },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    /* --- Step 1: Scrape the Airbnb listing --- */
    console.log("Scraping Airbnb listing:", url);
    const { textContent: scrapedContent, photoUrls, totalPhotoCount } =
      await scrapeAirbnb(url);
    console.log(
      "Scraped content length:",
      scrapedContent.length,
      "chars,",
      "Photos found:",
      totalPhotoCount
    );
    console.log(
      "Scraped content preview:",
      scrapedContent.substring(0, 300)
    );

    /* --- Step 2: Build message content with up to 3 photos --- */
    const MAX_PHOTOS = 3;
    const photosToAnalyze = photoUrls.slice(0, MAX_PHOTOS);

    // Build multimodal content array
    const userContent: unknown[] = [];

    // Add text first
    userContent.push({
      type: "text",
      text: `Voici les données extraites de l'annonce Airbnb (${url}).
NOMBRE EXACT DE PHOTOS SUR L'ANNONCE : ${totalPhotoCount}. UTILISE STRICTEMENT CE CHIFFRE pour la notation, ne l'estime pas toi-même.
${photosToAnalyze.length > 0 ? `Je t'envoie les ${photosToAnalyze.length} premières photos pour analyse visuelle. Déduis la qualité globale des visuels à partir de cet échantillon.` : "Aucune photo n'a pu être extraite."}

Analyse les données ET les photos, puis produis le rapport d'audit JSON complet :

${scrapedContent}`,
    });

    // Add photos as image_url blocks
    for (let i = 0; i < photosToAnalyze.length; i++) {
      userContent.push({
        type: "text",
        text: `\n--- Photo ${i + 1}${i === 0 ? " (photo de couverture)" : ""} ---`,
      });
      userContent.push({
        type: "image",
        source: {
          type: "url",
          url: photosToAnalyze[i],
        },
      });
    }

    /* --- Step 3: Send to Claude for analysis --- */
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return Response.json(
        {
          error: `Erreur API Anthropic (${response.status}). Réessayez dans quelques instants.`,
        },
        { status: 502, headers: corsHeaders }
      );
    }

    const data = await response.json();

    const textBlock = data.content?.find(
      (b: ContentBlock) => b.type === "text"
    );
    if (!textBlock?.text) {
      return Response.json(
        { error: "Aucune réponse textuelle reçue de l'IA." },
        { status: 500, headers: corsHeaders }
      );
    }

    /* Extract JSON from the response */
    let jsonStr = textBlock.text.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    try {
      const audit = JSON.parse(jsonStr);
      /* Basic validation */
      if (
        !audit.listing_title ||
        !audit.categories ||
        audit.score_global === undefined
      ) {
        return Response.json(
          {
            error:
              "Le rapport d'audit est incomplet. Veuillez réessayer.",
          },
          { status: 500, headers: corsHeaders }
        );
      }
      return Response.json(audit, { headers: corsHeaders });
    } catch {
      console.error("JSON parse error:", jsonStr.substring(0, 500));
      return Response.json(
        {
          error:
            "Erreur lors de l'analyse de la réponse. Veuillez réessayer.",
        },
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    return Response.json(
      {
        error:
          "Une erreur inattendue est survenue. Veuillez réessayer.",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

/* ─── OPTIONS (CORS preflight) ─── */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = [
    "https://www.votrephotographeimmo.com",
    "https://votrephotographeimmo.com",
  ];
  const isDev = process.env.NODE_ENV === "development";
  const corsOrigin =
    isDev || allowedOrigins.some((o) => origin.startsWith(o))
      ? origin
      : allowedOrigins[0];

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
