import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM ?? "Interval <onboarding@resend.dev>";

export type BookingConfirmationParams = {
  to: string;
  creatorName: string;
  startTime: Date;
  endTime: Date;
  joinUrl: string;
  meetLink: string | null;
  amountSol: number;
};

export async function sendBookingConfirmationEmail(
  params: BookingConfirmationParams
): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn("RESEND_API_KEY not set; skipping confirmation email");
    return { ok: false, error: "Email not configured" };
  }

  const { to, creatorName, startTime, endTime, joinUrl, meetLink, amountSol } = params;

  const testOnlyEmail = process.env.RESEND_TEST_EMAIL?.trim();
  if (testOnlyEmail && to.toLowerCase() !== testOnlyEmail.toLowerCase()) {
    console.warn(`Resend: skipping email to ${to} (only ${testOnlyEmail} allowed until domain is verified)`);
    return { ok: false, error: "Sending only to test email until domain verified" };
  }
  const dateStr = startTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = `${startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })} – ${endTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;

  const priceLabel = amountSol % 1 === 0 ? amountSol.toString() : amountSol.toFixed(2);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1f2937 0%,#111827 100%);color:#fff;padding:24px;text-align:center;">
      <h1 style="margin:0;font-size:20px;font-weight:700;">Booking confirmed</h1>
      <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">You're booked with ${creatorName}</p>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.5;">Thanks for booking — we're glad you're connecting with ${creatorName}. Enjoy your call.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;">Date</td><td style="padding:8px 0;font-size:14px;color:#111827;text-align:right;">${dateStr}</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;">Time</td><td style="padding:8px 0;font-size:14px;color:#111827;text-align:right;">${timeStr}</td></tr>
        <tr><td style="padding:8px 0;font-size:14px;color:#6b7280;">Amount</td><td style="padding:8px 0;font-size:14px;color:#111827;text-align:right;">${priceLabel} SOL</td></tr>
      </table>
      <a href="${joinUrl}" style="display:block;text-align:center;background:#111827;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:14px 20px;border-radius:8px;margin:20px 0;">View booking & meeting link</a>
      ${meetLink ? `<p style="margin:12px 0 0;font-size:13px;color:#6b7280;">Or join the meeting directly: <a href="${meetLink}" style="color:#2563eb;">${meetLink}</a></p>` : ""}
      <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">This link is only for you. Do not share it.</p>
    </div>
  </div>
</body>
</html>
`.trim();

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject: `Booking confirmed with ${creatorName} – ${dateStr}`,
      html,
    });
    if (error) {
      console.error("Resend error:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    console.error("Failed to send confirmation email:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
