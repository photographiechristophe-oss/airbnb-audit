import { NextRequest } from "next/server";

/*
  Collect email before PDF download.
  - If BREVO_API_KEY is set: adds contact to Brevo list
  - Always logs the email server-side as fallback
*/

export async function POST(request: NextRequest) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

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

  if (!email || !email.includes("@")) {
    return Response.json(
      { error: "Email invalide." },
      { status: 400, headers: corsHeaders }
    );
  }

  // Always log the lead
  console.log(
    `[LEAD] ${new Date().toISOString()} | ${firstName} | ${email} | Annonce: ${listingTitle}`
  );

  // If Brevo API key is configured, send to Brevo
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    try {
      const brevoListId = parseInt(process.env.BREVO_LIST_ID || "2", 10);

      await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": brevoKey,
        },
        body: JSON.stringify({
          email,
          attributes: {
            PRENOM: firstName,
            ANNONCE: listingTitle,
          },
          listIds: [brevoListId],
          updateEnabled: true,
        }),
      });
    } catch (e) {
      console.error("Brevo API error:", e);
      // Don't block the PDF download if Brevo fails
    }
  }

  return Response.json({ success: true }, { headers: corsHeaders });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
