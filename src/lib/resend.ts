const RESEND_API_URL = 'https://api.resend.com/emails';

function otpEmailHtml(code: string, institutionName: string) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px 24px; color: #1c1b1f;">
      <p style="font-size: 14px; color: #49454f; margin: 0 0 8px;">CampusFind · ${institutionName}</p>
      <h1 style="font-size: 22px; margin: 0 0 16px;">Your verification code</h1>
      <p style="font-size: 14px; color: #49454f; margin: 0 0 24px;">
        Enter this code to sign in to your campus Lost &amp; Found ledger. It will expire shortly and can only be used once.
      </p>
      <div style="font-size: 36px; font-weight: 700; letter-spacing: 0.3em; text-align: center; padding: 16px; background: #f3edf7; border-radius: 12px; color: #1c1b1f;">
        ${code}
      </div>
      <p style="font-size: 12px; color: #79747e; margin: 24px 0 0;">
        If you didn't request this code, you can safely ignore this email.
      </p>
    </div>
  `;
}

export async function sendOtpEmail(to: string, code: string, institutionName: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  // The sender MUST be an address on a domain you've verified in Resend to
  // deliver to real recipients. The default `onboarding@resend.dev` is Resend's
  // sandbox sender and ONLY delivers to your own Resend account email — so set
  // OTP_FROM_EMAIL (e.g. "CampusFind <noreply@yourdomain.com>") in production
  // once your domain is verified.
  const from = process.env.OTP_FROM_EMAIL || 'CampusFind <onboarding@resend.dev>';

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: `${code} is your CampusFind verification code`,
      html: otpEmailHtml(code, institutionName),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // Surface Resend's reason in server logs so misconfiguration (unverified
    // domain / sandbox sender) is obvious.
    console.error(`Resend delivery failed (${res.status}) from="${from}" to="${to}": ${body}`);
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}
