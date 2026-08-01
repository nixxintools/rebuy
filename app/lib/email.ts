// Magic-link delivery. Resend when configured; otherwise the link is returned to
// the caller so the product still works before an email provider is wired up.
const FROM = process.env.EMAIL_FROM ?? "Rebuy <onboarding@resend.dev>";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMagicLink(email: string, url: string) {
  if (!emailConfigured()) {
    console.log(`[rebuy] magic link for ${email}: ${url}`);
    return { delivered: false as const, url };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      subject: "Your Rebuy sign-in link",
      html: `
<div style="font-family:Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#111827">
  <div style="font-size:22px;font-weight:700;letter-spacing:-0.02em;margin-bottom:24px">Rebuy</div>
  <p style="font-size:16px;line-height:1.6;margin:0 0 24px">Tap the button below to sign in. This link works once and expires in 15 minutes.</p>
  <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#0d9488);color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:500;font-size:16px">Sign in to Rebuy</a>
  <p style="font-size:13px;line-height:1.6;color:#6b7280;margin:28px 0 0">If you didn't request this, you can ignore this email.</p>
</div>`,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[rebuy] resend failed", res.status, body);
    return { delivered: false as const, url };
  }
  return { delivered: true as const, url: null };
}
