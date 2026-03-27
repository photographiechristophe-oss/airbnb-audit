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

/* ─── Result Cache (24h) ─── */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const resultCache = new Map<string, { data: unknown; createdAt: number }>();

function getCacheKey(url: string): string {
  // Extract room ID as cache key (ignores query params, dates, etc.)
  const match = url.match(/rooms\/(\d+)/);
  return match ? match[1] : url.split("?")[0];
}

function getCachedResult(url: string): unknown | null {
  const key = getCacheKey(url);
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    resultCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedResult(url: string, data: unknown): void {
  const key = getCacheKey(url);
  resultCache.set(key, { data, createdAt: Date.now() });
  // Cleanup old entries if cache grows
  if (resultCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of resultCache) {
      if (now - v.createdAt > CACHE_TTL_MS) resultCache.delete(k);
    }
  }
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
interface PhotoExtractionResult {
  /** Photo URLs for visual analysis */
  analysisUrls: string[];
  /** Authoritative photo count from Airbnb's pictureCount field */
  totalCount: number;
}

function extractPhotos(html: string): PhotoExtractionResult {
  const seen = new Set<string>();
  const analysisUrls: string[] = [];

  // Patterns to EXCLUDE (Airbnb UI assets, not listing photos)
  const EXCLUDED_PATTERNS = [
    /AirbnbPlatformAssets/i,
    /search-bar-icons/i,
    /UserProfile/i,
    /Favicons/i,
    /Review-AI/i,
    /icon/i,
    /logo/i,
    /avatar/i,
  ];

  const isListingPhoto = (url: string): boolean => {
    return !EXCLUDED_PATTERNS.some((pattern) => pattern.test(url));
  };

  const addUrl = (url: string) => {
    const clean = url.split("?")[0];
    if (!isListingPhoto(clean)) return; // Skip Airbnb UI assets
    const key = clean.replace(/.*\//, "").replace(/\.(jpeg|jpg|png|webp)$/i, "");
    if (key && !seen.has(key)) {
      seen.add(key);
      analysisUrls.push(clean);
    }
  };

  // --- 1. Authoritative photo count: "pictureCount":XX in Airbnb's inline data ---
  let pictureCount = 0;
  const pcMatch = html.match(/"pictureCount"\s*:\s*(\d+)/);
  if (pcMatch) {
    pictureCount = parseInt(pcMatch[1], 10);
  }

  // --- 2. Extract room ID for targeted photo search ---
  const roomIdMatch = html.match(/rooms\/(\d+)/);
  const roomId = roomIdMatch ? roomIdMatch[1] : null;

  // --- 3. Collect photo URLs for visual analysis ---
  // 3a. Targeted: photos with Hosting-XXXXX pattern (most reliable)
  // Airbnb uses two formats:
  //   - Hosting-{numericRoomId} (classic)
  //   - Hosting-{base64EncodedId} (newer, e.g. Hosting-U3RheVN1cH...==)
  // We search for BOTH patterns
  if (roomId) {
    // Pattern 1: numeric room ID (classic)
    const hostingPattern = new RegExp(
      `https://a0\\.muscache\\.com/im/pictures/(?:airflow|hosting|miso|prohost-api)/Hosting-${roomId}/original/[^\\s"'<>]+?\\.(?:jpeg|jpg|png|webp)`,
      "gi"
    );
    let match;
    while ((match = hostingPattern.exec(html)) !== null) {
      addUrl(match[0]);
    }

    // Pattern 2: base64-encoded ID (newer Airbnb format)
    const hostingBase64Pattern = /https:\/\/a0\.muscache\.com\/im\/pictures\/(?:airflow|hosting|miso|prohost-api)\/Hosting-[A-Za-z0-9+/]+=*\/original\/[^\s"'<>]+?\.(?:jpeg|jpg|png|webp)/gi;
    while ((match = hostingBase64Pattern.exec(html)) !== null) {
      addUrl(match[0]);
    }
  }

  // 3b. JSON-LD photos
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
        if (parsed.photo && Array.isArray(parsed.photo)) {
          for (const p of parsed.photo) {
            const u = p.contentUrl || p.url;
            if (u) addUrl(u);
          }
        }
        if (parsed.image) {
          const imgArr = Array.isArray(parsed.image) ? parsed.image : [parsed.image];
          for (const img of imgArr) {
            const u = typeof img === "string" ? img : img.url || img.contentUrl;
            if (u) addUrl(u);
          }
        }
      } catch {
        // skip
      }
    }
  }

  // 3c. Broad regex fallback (only if targeted search found nothing)
  if (analysisUrls.length === 0) {
    const broadPattern =
      /https:\/\/a0\.muscache\.com\/im\/(?:pictures|ml-photo-proc)\/[^\s"'<>]+?\.(?:jpeg|jpg|png|webp)/gi;
    let match;
    while ((match = broadPattern.exec(html)) !== null) {
      addUrl(match[0]);
    }
  }

  // 3d. Inline JSON fields
  if (analysisUrls.length === 0) {
    const jsonPhotoPattern =
      /"(?:baseUrl|pictureUrl|picture)":\s*"(https:\/\/a0\.muscache\.com\/im\/[^\s"]+?\.(?:jpeg|jpg|png|webp))/gi;
    let match;
    while ((match = jsonPhotoPattern.exec(html)) !== null) {
      addUrl(match[1]);
    }
  }

  return {
    analysisUrls,
    totalCount: pictureCount > 0 ? pictureCount : analysisUrls.length,
  };
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

  // Multiple User-Agents to rotate on retry
  const USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  ];

  // Approach 1: Fetch the Airbnb page directly (with retry on different User-Agents)
  for (let attempt = 0; attempt < USER_AGENTS.length; attempt++) {
  try {
    const response = await fetch(cleanUrl, {
      headers: {
        "User-Agent": USER_AGENTS[attempt],
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
        const { analysisUrls, totalCount } = extractPhotos(html);
        return {
          textContent: extractedData.join("\n\n---\n\n"),
          photoUrls: analysisUrls,
          totalPhotoCount: totalCount,
        };
      }
    } else {
      errors.push(`Fetch direct (attempt ${attempt + 1}): HTTP ${response.status}`);
      continue; // Try next User-Agent
    }
  } catch (e) {
    errors.push(
      `Fetch direct (attempt ${attempt + 1}): ${e instanceof Error ? e.message : "erreur inconnue"}`
    );
    continue; // Try next User-Agent
  }
  } // end for loop (User-Agent rotation)

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
const SYSTEM_PROMPT = `Tu es Christophe, photographe immobilier professionnel spécialisé en locations saisonnières en Provence (votrephotographeimmo.com). Tu parles à la première personne ("je", "mon avis", "je vous conseille"). Tu t'adresses directement au propriétaire comme un conseiller bienveillant qui veut l'aider à réussir.

Tu dois analyser une annonce Airbnb et produire un rapport d'audit complet basé sur les données extraites.

TON & STYLE DE COMMUNICATION :
- Tu es un outil d'audit expert, franc et bienveillant. Tu donnes la vérité, même quand ça pique, mais toujours avec respect et en proposant des solutions.
- N'utilise JAMAIS "je". Utilise des formulations neutres et professionnelles : "Cette annonce...", "Les photos montrent...", "On constate que...", "Il est recommandé de...", "Le titre pourrait...", "La description gagnerait à..."
- Pour les points positifs : sois sincère et factuel ("Un vrai atout", "Excellent point", "Très bonne pratique")
- Pour les points à améliorer : sois DIRECT mais constructif. Dis clairement le problème PUIS donne la solution. Exemples :
  * "Les photos sont clairement prises au smartphone — les pièces paraissent sombres et étroites. C'est dommage car le bien a du potentiel. Avec des photos professionnelles, les annonces gagnent jusqu'à +30% de réservations et peuvent augmenter leur tarif à la nuitée jusqu'à +20%."
  * "La description manque d'informations pratiques. Un voyageur qui hésite a besoin de savoir comment accéder au logement, où se garer, ce qu'il y a autour. Il est recommandé d'ajouter un paragraphe dédié."
- Si quelque chose est VRAIMENT problématique (photos amateur, description vide, pas d'avis), alerte fermement : "Attention, ce point fait perdre des réservations concrètement."
- ÉVITE les mots gratuitement négatifs ("nul", "catastrophique", "lamentable") mais tu PEUX dire : "insuffisant", "ça pénalise l'annonce", "il y a un vrai manque ici", "c'est en dessous de la concurrence".
- Le verdict doit être honnête. Si l'annonce est moyenne, dis-le. Mais termine toujours par ce qui est faisable pour s'améliorer.
- Les suggestions doivent être concrètes et directes : "Ajouter...", "Refaire...", "Penser à..." — pas de formulations molles.

IMPORTANT: Réponds UNIQUEMENT en JSON valide. Pas de texte avant ou après. Pas de backticks. Juste le JSON.

Structure JSON exacte requise:
{
  "listing_title": "titre exact de l'annonce",
  "location": "ville ou zone géographique",
  "property_type": "type de bien (maison, appartement, gîte, etc.)",
  "score_global": <number 0-100>,
  "verdict": "phrase résumé honnête en 1-2 lignes. Commence par un point positif, puis sois franc sur ce qui doit changer. Termine par une piste concrète d'amélioration.",
  "points_forts": ["point fort 1 (sincère et enthousiaste)", "point fort 2", "point fort 3"],
  "points_critiques": ["point faible 1 (direct et factuel, avec l'impact concret)", "point faible 2", "point faible 3"],
  "categories": [
    {
      "name": "Impact Visuel & Photos",
      "icon": "📸",
      "score": <number 0-25>,
      "max": 25,
      "detail": "Commence par ce qui est bien dans les photos, puis explique ce qui pourrait être amélioré, en 2-3 phrases bienveillantes.",
      "suggestions": ["suggestion concrète formulée positivement", "suggestion 2", "suggestion 3"]
    },
    {
      "name": "Titre & Accroche",
      "icon": "✍️",
      "score": <number 0-15>,
      "max": 15,
      "detail": "explication bienveillante en 2-3 phrases",
      "suggestions": ["suggestion positive 1", "suggestion positive 2"]
    },
    {
      "name": "Description & Storytelling",
      "icon": "📝",
      "score": <number 0-20>,
      "max": 20,
      "detail": "explication bienveillante en 2-3 phrases",
      "suggestions": ["suggestion positive 1", "suggestion positive 2", "suggestion positive 3"]
    },
    {
      "name": "Équipements & Services",
      "icon": "🏠",
      "score": <number 0-15>,
      "max": 15,
      "detail": "explication bienveillante en 2-3 phrases",
      "suggestions": ["suggestion positive 1", "suggestion positive 2"]
    },
    {
      "name": "Positionnement Tarifaire",
      "icon": "💰",
      "score": <number 0-10>,
      "max": 10,
      "detail": "explication bienveillante en 2-3 phrases",
      "suggestions": ["suggestion positive 1"]
    },
    {
      "name": "Avis & Réputation",
      "icon": "⭐",
      "score": <number 0-10>,
      "max": 10,
      "detail": "explication bienveillante en 2-3 phrases",
      "suggestions": ["suggestion positive 1"]
    },
    {
      "name": "Check-in & Accueil",
      "icon": "🔑",
      "score": <number 0-5>,
      "max": 5,
      "detail": "explication bienveillante en 1-2 phrases",
      "suggestions": ["suggestion positive 1"]
    }
  ],
  "recommandation_visuelle": "Un texte structuré de 4-6 phrases, ton neutre et professionnel (JAMAIS de 'je'), personnalisé à cette annonce. Utilise **gras** pour les mots-clés importants. Saute une ligne entre chaque idée pour aérer.\n\nSI les photos sont AMATEUR/SMARTPHONE : expliquer l'impact concret — les annonces avec **photos professionnelles** reçoivent **jusqu'à +30% de réservations** et peuvent **augmenter leur tarif à la nuitée jusqu'à +20%**. Mentionner que c'est l'investissement le plus rentable pour un propriétaire. NE PAS mentionner Christophe ni inviter à contacter quelqu'un — le bouton CTA en dessous s'en charge.\n\nSI les photos sont de BONNE QUALITÉ : reconnaître l'effort sans s'enflammer ('On sent un vrai travail sur les photos, que ce soit un professionnel ou une belle application personnelle'). NE PAS dire 'remarquable', 'exceptionnel' ou 'irréprochable'. NE PAS pousser à refaire les photos. Juste évoquer des pistes complémentaires légères (photos lifestyle, saisonnières, vidéo) et mentionner que si jamais la décoration évolue ou pour un nouveau shooting, un professionnel est toujours disponible."
}

GRILLE DE NOTATION DÉTAILLÉE:

1. IMPACT VISUEL & PHOTOS (/25):
Tu reçois 5 photos échantillonnées à travers la galerie.

⚠️ CRITIQUE — TU DOIS ANALYSER LES IMAGES, PAS DEVINER D'APRÈS LE TEXTE.
Ne déduis JAMAIS la qualité photo du type de bien ou du texte de l'annonce. Un petit appartement simple peut avoir des photos PRO. Une villa de luxe peut avoir des photos SMARTPHONE. Seule l'IMAGE compte.

Pour chaque photo envoyée, vérifie ces 6 points VISUELS dans cet ordre PRÉCIS :

1. BALANCE DES BLANCS (critère n°1, le plus révélateur) ? Regarde les murs et plafonds : s'ils sont blancs, apparaissent-ils VRAIMENT blancs dans la photo ? Blancs purs et neutres = PROFESSIONNEL (seul un appareil calibré ou retouché produit des blancs neutres). Dominante jaunâtre, orangée, grisâtre ou bleutée sur les surfaces claires = SMARTPHONE.
2. GRAND ANGLE ? Les pièces paraissent spacieuses, on voit le sol et le plafond, champ de vision large = PRO. Pièces qui paraissent étroites, champ réduit = SMARTPHONE.
3. LIGNES DROITES ? Verticales (murs, portes, fenêtres) et horizontales (plafond, meubles) parfaitement droites = PRO. Lignes penchées, murs qui convergent = SMARTPHONE.
4. LUMIÈRE HOMOGÈNE ? Toute la pièce bien éclairée, pas de zones sombres, pas de surexposition aux fenêtres = PRO. Zones sombres, flash visible, contre-jour = SMARTPHONE.
5. CADRAGE COMPLET ? Meubles entièrement visibles (lit, canapé, table pas coupés), composition pensée = PRO. Meubles tronqués, cadrage approximatif = SMARTPHONE.
6. BOKEH / PROFONDEUR DE CHAMP ? Si tu vois un arrière-plan FLOU avec un sujet NET au premier plan (effet bokeh), c'est un signe FORT de matériel professionnel. Les smartphones ne peuvent PAS produire un vrai bokeh optique avec cette qualité de flou progressif et naturel. Si une photo de détail montre un beau bokeh, c'est PRO — même si c'est un cadrage serré.

⚠️ ATTENTION AUX PHOTOS DE DÉTAILS ET LIFESTYLE : Certaines photos montrent volontairement un DÉTAIL (une lanterne, un vase, un objet déco, un élément architectural) ou une ambiance (vue depuis une fenêtre avec rideaux en cadre). Ce sont des CHOIX ARTISTIQUES de photographe pro, PAS un signe de smartphone. Un photographe pro mélange TOUJOURS :
- Des vues larges grand angle (pièces entières)
- Des photos de détails/ambiance (bokeh, mise en scène)
- Des photos lifestyle (vue depuis le balcon, coin lecture, etc.)
Si la majorité des photos de l'annonce montrent ce MIX de styles avec une qualité constante, c'est un FORT indicateur de travail professionnel. Ne confonds PAS "cadrage serré volontaire" avec "champ de vision restreint de smartphone".

⚠️ ATTENTION AUX PHOTOS D'EXTÉRIEUR : Les photos de vues (montagne, mer, paysage) prises depuis un balcon ne permettent PAS de juger si c'est pro ou smartphone car il n'y a pas de murs, pas de meubles, pas de lignes intérieures à analyser. NE BASE PAS ton diagnostic sur ces photos seules. Concentre-toi sur les photos d'INTÉRIEUR pour évaluer la qualité technique.

RÉSULTAT : 4-6 critères PRO sur la majorité des photos → PROFESSIONNEL (note 18-25/25)
2-3 critères PRO → SEMI-PRO ou MIX (note 12-17/25)
0-1 critère PRO → AMATEUR/SMARTPHONE (note 0-11/25)

⚠️ RÈGLE D'OR : Si au moins 3 photos sur 5 montrent des signes PRO clairs (balance blancs OK, grand angle, lignes droites, bokeh), le verdict DOIT être PROFESSIONNEL, même si 1-2 photos sont des vues extérieures ou des détails ambigus.

RAPPEL : tu DOIS analyser les IMAGES que tu reçois. Les photos te sont envoyées en base64, tu les vois directement. Décris ce que tu VOIS (couleurs des murs, angles, lumière) pour justifier ton diagnostic.

⚠️ BIAIS À ÉVITER ABSOLUMENT : Tu as une TENDANCE NATURELLE à dire "smartphone" trop facilement. AVANT de conclure "smartphone", vérifie que tu peux répondre OUI à au moins 3 de ces questions :
- Les murs blancs tirent-ils VISIBLEMENT vers le jaune ou le gris ? (pas juste légèrement chauds)
- Les meubles sont-ils COUPÉS par le cadre de manière non intentionnelle ?
- Vois-tu du BRUIT/GRAIN visible dans les zones sombres ?
- Les lignes verticales sont-elles CLAIREMENT penchées (pas juste un léger angle) ?
- Le champ de vision est-il VRAIMENT étroit sur les photos d'intérieur (pas les détails) ?
Si tu ne peux PAS répondre OUI à au moins 3 questions → ce n'est PAS du smartphone. En cas de DOUTE, la réponse est "semi-pro" ou "bonne application personnelle", JAMAIS "smartphone".

ENSUITE seulement, donne ton diagnostic :

- SI PROFESSIONNEL (4-5 critères OK) : Rester mesuré et honnête. Dire "On sent un vrai effort sur les photographies, que ce soit un travail professionnel ou une belle application personnelle — le résultat est là." NE PAS s'enflammer avec "remarquable", "exceptionnel", "irréprochable". Être positif mais sobre. Note élevée (18-25/25). Ne PAS recommander de refaire les photos. Suggérer plutôt des compléments légers : photos lifestyle, photos saisonnières, vidéo, ou renouvellement si la déco change.
- SI SEMI-PRO/MIX (2-3 critères OK) : "Les photos sont correctes mais on pourrait aller plus loin." Identifier les points faibles précis. Note moyenne (12-17/25). Suggérer un shooting professionnel pour gagner en impact.
- SI AMATEUR/SMARTPHONE (0-1 critère OK) : le dire explicitement ("Les photos semblent prises au smartphone"). Expliquer précisément POURQUOI (quels défauts concrets observés dans les images). Recommander un photographe professionnel et chiffrer l'impact : "les annonces avec des photos professionnelles reçoivent jusqu'à +30% de réservations en plus, avec la possibilité d'augmenter le tarif à la nuitée jusqu'à +20%". La première suggestion DOIT être un shooting pro.
- SI MIX : identifier lesquelles sont pro et lesquelles sont amateur, recommander de refaire seulement celles qui en ont besoin.
- Ne mets JAMAIS "semi-pro" par complaisance.
- Si photos amateur, NE DIS PAS que la couverture est "superbe" — incohérent.
- Si photos pro, NE DIS PAS qu'elles sont au smartphone — c'est FAUX et ça discrédite tout l'audit.

Sous-critères :
- Nombre total de photos (moins de 10 = à compléter, 10-25 = idéal, 26-35 = léger excès qui dilue l'impact, plus de 35 = trop de photos — les voyageurs se perdent, mieux vaut sélectionner les meilleures): /3
- Photo de couverture : attractive, donne envie de cliquer, bien cadrée, lumineuse: /4
- Horizontalité et angles : lignes droites, horizon droit, verticales respectées, pas de distorsion smartphone: /4
- Luminosité : lumière naturelle abondante, pas de zones sombres (chambres notamment), pas de contre-jour, pas de flash visible: /3
- Cadrage et composition : meubles NON coupés (lits, canapés, tables complets dans le cadre), bonne utilisation de l'espace, pas de reflet du photographe: /3
- Diversité des pièces : photos d'espaces différents, pas la même pièce sous des angles similaires: /3
- Mise en scène et propreté : pièces rangées, décoration soignée, pas d'objets personnels: /3
- Qualité technique globale : netteté, résolution, absence de bruit/grain, colorimétrie naturelle (pas jaunâtre): /2

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
⚠️ IMPORTANT : Les équipements sont mentionnés PARTOUT dans l'annonce — dans la description, dans la liste des équipements Airbnb, ET dans les sections "Accès des voyageurs", "Autres remarques", etc. Lis TOUTE la page attentivement avant de juger. Si la description mentionne des équipements cuisine (frigo, gazinière, cafetière, etc.), des services (petit-déjeuner inclus, restauration), ou des aménagements (bain nordique, parking, clim), il faut les COMPTER dans ta notation.
- Nombre d'équipements listés (plus est mieux): /4
- Équipements premium (WiFi fibre, climatisation, piscine, parking privé, bain nordique, etc.): /4
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
- Commence chaque "detail" de catégorie par un aspect positif SI il y en a un. Si vraiment tout est à revoir, dis-le franchement mais avec respect.
- Chaque suggestion doit être concrète, actionnable et directe ("Ajoutez...", "Refaites...", "Je vous recommande de...")
- Le score_global DOIT être la SOMME exacte de toutes les catégories
- La notation est HONNÊTE et PRÉCISE : ne gonfle JAMAIS les scores pour faire plaisir. Un score bas est mérité si l'annonce le mérite. C'est le ton qui est bienveillant, pas les notes.
- Adapte le ton au bien analysé (pas de réponse générique copier-coller)
- Si tu ne trouves pas certaines infos, dis-le clairement ("Je n'ai pas trouvé cette information dans votre annonce — c'est un manque, les voyageurs ont besoin de ça pour réserver sereinement.")
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

  /* Check cache — return stored result if same listing analyzed < 24h ago */
  const cached = getCachedResult(url);
  if (cached) {
    console.log(`[CACHE HIT] Returning cached result for ${getCacheKey(url)}`);
    return Response.json(cached, { headers: corsHeaders });
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

    /* Check if scraping actually succeeded */
    if (scrapedContent.startsWith("ÉCHEC DU SCRAPING")) {
      console.error("Scraping failed:", scrapedContent);
      return Response.json(
        {
          error:
            "Impossible d'accéder à cette annonce Airbnb pour le moment. Airbnb bloque parfois les requêtes depuis nos serveurs. Veuillez réessayer dans quelques minutes ou essayer avec un autre lien.",
        },
        { status: 503, headers: corsHeaders }
      );
    }

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
${photosToAnalyze.length > 0 ? `Je t'envoie ${photosToAnalyze.length} photos échantillonnées à travers toute la galerie (couverture + photos réparties début/milieu/fin).

⚠️ IMPORTANT : Analyse VISUELLEMENT chaque photo ci-dessous AVANT de rédiger ton diagnostic photo. Applique la checklist des 5 points (grand angle, lignes droites, lumière, cadrage, balance des blancs) sur ce que tu VOIS dans les images. Ne déduis PAS la qualité des photos du texte de l'annonce ou du type de bien.` : "Aucune photo n'a pu être extraite."}

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

      // Download photo and send as base64 to guarantee Claude sees it
      try {
        const photoRes = await fetch(photosToAnalyze[i], {
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
        });
        if (photoRes.ok) {
          const buffer = await photoRes.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          const contentType = photoRes.headers.get("content-type") || "image/jpeg";
          userContent.push({
            type: "image",
            source: {
              type: "base64",
              media_type: contentType.split(";")[0],
              data: base64,
            },
          });
        } else {
          // Fallback to URL if download fails
          userContent.push({
            type: "image",
            source: { type: "url", url: photosToAnalyze[i] },
          });
        }
      } catch {
        // Fallback to URL
        userContent.push({
          type: "image",
          source: { type: "url", url: photosToAnalyze[i] },
        });
      }
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
      // Cache the successful result for 24h
      setCachedResult(url, audit);
      console.log(`[CACHE SET] Stored result for ${getCacheKey(url)}`);
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
