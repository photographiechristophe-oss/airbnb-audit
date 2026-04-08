import { NextRequest } from "next/server";

/* ─── CORS ─── */
const ALLOWED_ORIGINS = [
  "https://www.votrephotographeimmo.com",
  "https://votrephotographeimmo.com",
];

function getCorsHeaders(origin: string): Record<string, string> {
  const isDev = process.env.NODE_ENV === "development";
  const corsOrigin =
    isDev || ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

/* ─── Rate Limiting (5 req / hour per IP) ─── */
const emailRateMap = new Map<string, { count: number; resetAt: number }>();
const EMAIL_RATE_LIMIT = 5;
const EMAIL_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/* ─── POST: Collect email before PDF download ─── */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const entry = emailRateMap.get(ip);
  if (entry && now < entry.resetAt) {
    if (entry.count >= EMAIL_RATE_LIMIT) {
      return Response.json(
        { error: "Trop de requêtes. Réessayez plus tard." },
        { status: 429, headers: corsHeaders }
      );
    }
    entry.count++;
  } else {
    emailRateMap.set(ip, { count: 1, resetAt: now + EMAIL_RATE_WINDOW_MS });
  }

  let email: string;
  let firstName: string;
  let listingTitle: string;

  try {
    const body = await request.json();
    email = String(body.email || "").slice(0, 254);
    firstName = String(body.firstName || "").slice(0, 100);
    listingTitle = String(body.listingTitle || "").slice(0, 500);
  } catch {
    return Response.json(
      { error: "Requête invalide." },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return Response.json(
      { error: "Email invalide." },
      { status: 400, headers: corsHeaders }
    );
  }

  // Log the lead server-side (masked for privacy)
  const maskedEmail = email.replace(/(.{2}).*(@.*)/, "$1***$2");
  console.log(
    `[LEAD] ${new Date().toISOString()} | ${firstName} | ${maskedEmail} | Annonce: ${listingTitle}`
  );

  // Send to Brevo if configured
  const brevoKey = process.env.BREVO_API_KEY;
  const brevoListId = process.env.BREVO_LIST_ID;
  if (brevoKey && brevoListId) {
    try {
      await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": brevoKey,
        },
        body: JSON.stringify({
          email,
          attributes: { PRENOM: firstName, ANNONCE: listingTitle },
          listIds: [parseInt(brevoListId, 10)],
          updateEnabled: true,
        }),
      });
    } catch (e) {
      console.error("Brevo API error:", e);
    }
  }

  return Response.json({ success: true }, { headers: corsHeaders });
}

/* ─── OPTIONS (CORS preflight) ─── */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}
