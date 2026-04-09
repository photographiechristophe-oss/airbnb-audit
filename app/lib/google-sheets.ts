export async function logToSheet(row: {
  date: string;
  url: string;
  score: number;
  verdict: string;
  ville: string;
  typeBien: string;
  email?: string;
}) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  const secret = process.env.GOOGLE_SHEETS_WEBHOOK_SECRET;

  if (!webhookUrl) {
    console.warn("[SHEETS] No webhook URL configured, skipping log");
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...row, secret }),
    });
  } catch (err) {
    console.error("[SHEETS] Webhook error:", err);
  }
}
