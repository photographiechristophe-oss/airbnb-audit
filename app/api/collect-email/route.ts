import { NextRequest } from "next/server";

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

/* ─── POST: Collect email before PDF download ─── */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  const corsHeaders = getCorsHeaders(origin);

  let email: string;
  let firstName: string;
  let listingTitle: string;

  try {
    const body = await request.json();
    email = body.email;
    firstName = body.firstName || "";
    listingTitle = body.listingTitle || "";
  } catch {
    return Response.json(
      { error: "Requête invalide." },
      { status: 400, headers: corsHeaders }
    );
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { error: "Email invalide." },
      { status: 400, headers: corsHeaders }
    );
  }

  // Log the lead server-side (always available, even without Brevo)
  console.log(
    `[LEAD] ${new Date().toISOString()} | ${firstName} | ${email} | Annonce: ${listingTitle}`
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
