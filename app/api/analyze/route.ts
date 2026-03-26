import { NextRequest } from "next/server";

/* ─── Constants ─── */
const RATE_LIMIT = 2;
const RATE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_PHOTOS_TO_ANALYZE = 5;
const MAX_SCRAPE_TEXT_LENGTH = 8000;
const MAX_DATA_BLOCK_LENGTH = 15000;
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";
const ANTHROPIC_MAX_TOKENS = 16000;

/* ─── CORS ─── */
const ALLOWED_ORIGINS = [
  "https://www.votrephotographeimmo.com",
  "https://votrephotographeimmo.com",
];

function getCorsHeaders(origin: string): Record<string, string> {
  const isDev = process.env.NODE_ENV === "development";
  const corsOrigin =
    isDev || ALLOWED_ORIGINS.some((o) => origin.startsWith(o))
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/* ─── Rate Limiting (2 req / 2 hours, unlimited for owner IP) ─── */
const rateMap = new Map<string, { count: number; resetAt: number }>();
const OWNER_IPS = (process.env.OWNER_IPS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function cleanupRateMap() {
  const now = Date.now();
  for (const [ip, entry] of rateMap) {
    if (now > entry.resetAt) rateMap.delete(ip);
  }
}

function isRateLimited(ip: string): boolean {
  if (OWNER_IPS.includes(ip)) return false;

  // Cleanup expired entries periodically
  if (rateMap.size > 100) cleanupRateMap();

  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

/* ─── Score color utility ─── */
export function getScoreColor(percent: number): {
  color: string;
  bgColor: string;
} {
  if (percent >= 70) return { color: "#2D8C5A", bgColor: "#E8F5EE" };
  if (percent >= 45) return { color: "#D4872E", bgColor: "#FFF3E0" };
  return { color: "#B33A3A", bgColor: "#FDECEC" };
}

/* ─── Photo extraction ─── */
function extractPhotoUrls(html: string): string[] {
  const seen = new Set<string>();
  const photoUrls: string[] = [];

  const addUrl = (url: string) => {
    // Normalize: strip query params & size suffixes to deduplicate
    const clean = url.split("?")[0];
    // Extract a unique key: the last path segment (filename)
    const key = clean.replace(/.*\//, "").replace(/\.(jpeg|jpg|png|webp)$/i, "");
    if (key && !seen.has(key)) {
      seen.add(key);
      photoUrls.push(clean);
    }
  };

  // 1. Broad pattern: any muscache.com image URL with common photo paths
  //    Covers: /im/pictures/, /im/ml-photo-proc/, /im/pictures/miso/, /im/pictures/hosting/, /im/pictures/prohost-api/, etc.
  const broadPattern =
    /https:\/\/a0\.muscache\.com\/im\/(?:pictures|ml-photo-proc)\/[^\s"'<>]+?\.(?:jpeg|jpg|png|webp)/gi;
  let match;
  while ((match = broadPattern.exec(html)) !== null) {
    addUrl(match[0]);
  }

  // 2. JSON-LD structured data (photo array or image field)
  const jsonLdMatches = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
  );
  if (jsonLdMatches) {
    for (const jmatch of jsonLdMatches) {
      const jsonContent = jmatch
        .replace(/<script type="application\/ld\+json">/, "")
        .replace(/<\/script>/, "");
      try {
        const parsed = JSON.parse(jsonContent);
        const images: string[] = [];
        if (parsed.photo && Array.isArray(parsed.photo)) {
          for (const p of parsed.photo) {
            const u = p.contentUrl || p.url;
            if (u) images.push(u);
          }
        }
        if (parsed.image) {
          const imgArr = Array.isArray(parsed.image) ? parsed.image : [parsed.image];
          for (const img of imgArr) {
            const u = typeof img === "string" ? img : img.url || img.contentUrl;
            if (u) images.push(u);
          }
        }
        for (const imgUrl of images) {
          addUrl(imgUrl);
        }
      } catch {
        // skip invalid JSON-LD
      }
    }
  }

  // 3. Deferred state / inline JSON data blocks may contain photo arrays
  const jsonPhotoPattern =
    /"(?:baseUrl|url|pictureUrl|picture)":\s*"(https:\/\/a0\.muscache\.com\/im\/[^\s"]+?\.(?:jpeg|jpg|png|webp))/gi;
  while ((match = jsonPhotoPattern.exec(html)) !== null) {
    addUrl(match[1]);
  }

  return photoUrls;
}

/* ─── Airbnb Scraper ─── */
interface ScrapeResult {
  textContent: string;
  photoUrls: string[];
  totalPhotoCount: number;
}

async function scrapeAirbnb(url: string): Promise<ScrapeResult> {
  const cleanUrl = url.split("?")[0];
  const roomIdMatch = cleanUrl.match(/rooms\/(\d+)/);
  const roomId = roomIdMatch ? roomIdMatch[1] : null;
  const errors: string[] = [];

  // Approach 1: Fetch the Airbnb page directly
  try {
    const response = await fetch(cleanUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
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
      const extractedData: string[] = [];

      // 1. JSON-LD structured data
      const jsonLdMatches = html.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
      );
      if (jsonLdMatches) {
        for (const m of jsonLdMatches) {
          const jsonContent = m
            .replace(/<script type="application\/ld\+json">/, "")
            .replace(/<\/script>/, "");
          try {
            const parsed = JSON.parse(jsonContent);
            extractedData.push(
              "JSON-LD DATA:\n" + JSON.stringify(parsed, null, 2)
            );
          } catch {
            // skip
          }
        }
      }

      // 2. __NEXT_DATA__
      const nextDataMatch = html.match(
        /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
      );
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const pageProps = nextData?.props?.pageProps;
          if (pageProps) {
            extractedData.push(
              "NEXT_DATA (pageProps):\n" +
                JSON.stringify(pageProps, null, 2).substring(
                  0,
                  MAX_DATA_BLOCK_LENGTH
                )
            );
          }
        } catch {
          // skip
        }
      }

      // 3. Bootstrapped data (Airbnb specific)
      const bootstrapMatches = html.match(
        /<!--\s*(\{[\s\S]*?\})\s*-->/g
      );
      if (bootstrapMatches) {
        for (const m of bootstrapMatches.slice(0, 3)) {
          const content = m
            .replace(/<!--\s*/, "")
            .replace(/\s*-->/, "");
          try {
            const parsed = JSON.parse(content);
            if (
              parsed.listing ||
              parsed.pdpData ||
              parsed.niobeMinimalClientData
            ) {
              extractedData.push(
                "BOOTSTRAP DATA:\n" +
                  JSON.stringify(parsed, null, 2).substring(
                    0,
                    MAX_DATA_BLOCK_LENGTH
                  )
              );
            }
          } catch {
            // skip
          }
        }
      }

      // 4. Deferred data script tags
      const deferredDataMatches = html.match(
        /<script[^>]*data-deferred-state[^>]*>([\s\S]*?)<\/script>/g
      );
      if (deferredDataMatches) {
        for (const m of deferredDataMatches.slice(0, 3)) {
          const content = m
            .replace(/<script[^>]*>/, "")
            .replace(/<\/script>/, "");
          try {
            const parsed = JSON.parse(content);
            extractedData.push(
              "DEFERRED STATE DATA:\n" +
                JSON.stringify(parsed, null, 2).substring(
                  0,
                  MAX_DATA_BLOCK_LENGTH
                )
            );
          } catch {
            // skip
          }
        }
      }

      // 5. Meta tags
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

      // 6. Page title
      const titleMatch = html.match(
        /<title[^>]*>([\s\S]*?)<\/title>/
      );
      if (titleMatch) {
        extractedData.push("PAGE TITLE: " + titleMatch[1].trim());
      }

      // 7. Visible text content
      const textContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (textContent.length > 100) {
        extractedData.push(
          "PAGE TEXT CONTENT (extrait):\n" +
            textContent.substring(0, MAX_SCRAPE_TEXT_LENGTH)
        );
      }

      if (extractedData.length > 0) {
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
    errors.push(
      `Fetch direct: ${e instanceof Error ? e.message : "erreur inconnue"}`
    );
  }

  // Approach 2: Try Airbnb API endpoint
  if (roomId) {
    try {
      const apiUrl = `https://www.airbnb.fr/api/v3/StaysPdpSections/${roomId}?operationName=StaysPdpSections&locale=fr&currency=EUR`;
      const apiResponse = await fetch(apiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "application/json",
          "X-Airbnb-API-Key":
            process.env.AIRBNB_API_KEY || "d306zoyjsyarp7ifhu67rjxn52tv0t20",
        },
      });

      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        return {
          textContent:
            "AIRBNB API DATA:\n" +
            JSON.stringify(apiData, null, 2).substring(
              0,
              MAX_DATA_BLOCK_LENGTH * 2
            ),
          photoUrls: [],
          totalPhotoCount: 0,
        };
      } else {
        errors.push(`API Airbnb: HTTP ${apiResponse.status}`);
      }
    } catch (e) {
      errors.push(
        `API Airbnb: ${e instanceof Error ? e.message : "erreur inconnue"}`
      );
    }
  }

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
Tu reçois les 3 premières photos de l'annonce. Analyse-les avec un REGARD TRÈS EXIGEANT de photographe professionnel immobilier.

IMPORTANT - COMMENT DISTINGUER AMATEUR vs PROFESSIONNEL :
- AMATEUR/SMARTPHONE : pièces sombres (surtout chambres), lits/meubles coupés par le cadrage, angles de prise de vue étroits (pas de grand angle), distorsion de perspective, horizon penché, ombres portées du flash, couleurs jaunâtres ou bleutées, bruit/grain visible, reflets dans les miroirs/vitres, objets personnels visibles, photos prises debout (pas à hauteur de poitrine), pièces qui paraissent plus petites qu'en réalité
- PROFESSIONNEL : grand angle maîtrisé (pièces paraissent spacieuses sans déformation excessive), lumière naturelle abondante et homogène, lignes parfaitement droites (verticales ET horizontales), colorimétrie neutre et chaude, mise en scène soignée, chaque pièce photographiée depuis le meilleur angle, HDR subtil pour équilibrer intérieur/extérieur

Sois SÉVÈRE : si tu vois ne serait-ce qu'un lit coupé, une pièce sombre, ou un angle de travers, c'est du smartphone amateur. Ne mets PAS "semi-pro" par complaisance.

Sous-critères :
- Nombre total de photos (moins de 10 = insuffisant, 10-25 = idéal, 26-35 = léger excès qui dilue l'impact, plus de 35 = trop de photos, pénaliser car cela noie le voyageur et montre un manque de sélection): /3
- Photo de couverture : attractive, donne envie de cliquer, bien cadrée, lumineuse: /4
- Horizontalité et angles : lignes droites, horizon droit, verticales respectées, pas de distorsion smartphone: /4
- Luminosité : lumière naturelle abondante, pas de zones sombres (chambres notamment), pas de contre-jour, pas de flash visible: /3
- Cadrage et composition : meubles NON coupés (lits, canapés, tables complets dans le cadre), bonne utilisation de l'espace, pas de reflet du photographe: /3
- Diversité des pièces : photos d'espaces différents, pas la même pièce sous des angles similaires: /3
- Mise en scène et propreté : pièces rangées, décoration soignée, pas d'objets personnels: /3
- Qualité technique globale : netteté, résolution, absence de bruit/grain, colorimétrie naturelle (pas jaunâtre): /2
Déduis le niveau général (amateur smartphone / semi-pro / professionnel) à partir de l'échantillon. En cas de doute entre deux niveaux, choisis le PLUS BAS.

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
  const origin = request.headers.get("origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  /* Rate limit */
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return Response.json(
      { error: "Trop de requêtes. Veuillez réessayer dans quelques minutes." },
      { status: 429, headers: corsHeaders }
    );
  }

  /* Validate body */
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

  /* Check API key */
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Clé API non configurée côté serveur." },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    /* Step 1: Scrape */
    const { textContent: scrapedContent, photoUrls, totalPhotoCount } =
      await scrapeAirbnb(url);

    /* Step 2: Build multimodal content with up to 3 photos */
    // Sample photos across the gallery: cover + evenly spaced picks
    // This ensures we see exterior (start), rooms/bedrooms (middle), and amenities (end)
    const photosToAnalyze: string[] = [];
    if (photoUrls.length > 0) {
      photosToAnalyze.push(photoUrls[0]); // Always include cover photo
      if (photoUrls.length > 1) {
        const remaining = MAX_PHOTOS_TO_ANALYZE - 1;
        const step = Math.max(1, Math.floor((photoUrls.length - 1) / remaining));
        for (let i = step; photosToAnalyze.length < MAX_PHOTOS_TO_ANALYZE && i < photoUrls.length; i += step) {
          photosToAnalyze.push(photoUrls[i]);
        }
      }
    }
    const userContent: unknown[] = [];

    userContent.push({
      type: "text",
      text: `Voici les données extraites de l'annonce Airbnb (${url}).
NOMBRE EXACT DE PHOTOS SUR L'ANNONCE : ${totalPhotoCount}. UTILISE STRICTEMENT CE CHIFFRE pour la notation, ne l'estime pas toi-même.
${photosToAnalyze.length > 0 ? `Je t'envoie ${photosToAnalyze.length} photos échantillonnées à travers toute la galerie (couverture + photos réparties début/milieu/fin) pour avoir une vue représentative. Analyse-les avec un regard très exigeant.` : "Aucune photo n'a pu être extraite."}

Analyse les données ET les photos, puis produis le rapport d'audit JSON complet :

${scrapedContent}`,
    });

    for (let i = 0; i < photosToAnalyze.length; i++) {
      const photoIndex = photoUrls.indexOf(photosToAnalyze[i]) + 1;
      const label = i === 0
        ? `Photo ${photoIndex}/${totalPhotoCount} (couverture)`
        : `Photo ${photoIndex}/${totalPhotoCount}`;
      userContent.push({
        type: "text",
        text: `\n--- ${label} ---`,
      });
      userContent.push({
        type: "image",
        source: { type: "url", url: photosToAnalyze[i] },
      });
    }

    /* Step 3: Call Claude API */
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: ANTHROPIC_MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      console.error("Anthropic API error:", response.status);
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

    /* Extract and validate JSON */
    let jsonStr = textBlock.text.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    try {
      const audit = JSON.parse(jsonStr);
      if (
        !audit.listing_title ||
        !audit.categories ||
        audit.score_global === undefined
      ) {
        return Response.json(
          { error: "Le rapport d'audit est incomplet. Veuillez réessayer." },
          { status: 500, headers: corsHeaders }
        );
      }
      return Response.json(audit, { headers: corsHeaders });
    } catch {
      return Response.json(
        { error: "Erreur lors de l'analyse de la réponse. Veuillez réessayer." },
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    return Response.json(
      { error: "Une erreur inattendue est survenue. Veuillez réessayer." },
      { status: 500, headers: corsHeaders }
    );
  }
}

/* ─── OPTIONS (CORS preflight) ─── */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}
