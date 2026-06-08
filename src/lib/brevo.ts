const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Sender. Must be a verified sender (or domain) in your Brevo account, else
// Brevo rejects the send. Overridable via env without a code change.
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'campusfind@outlook.com';
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'CampusFind';

function otpEmailHtml(code: string, institutionName: string) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f1f4f9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f4f9;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="468" cellpadding="0" cellspacing="0" style="max-width:468px;width:100%;background:#ffffff;border:1px solid #e3e8ef;border-radius:12px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td style="padding:30px 36px 0;">
                <div style="font-size:18px;font-weight:700;color:#1E3A8A;letter-spacing:-0.2px;">CampusFind</div>
                <div style="font-size:12px;color:#6b7280;margin-top:3px;">${institutionName}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 36px 0;">
                <div style="font-size:16px;font-weight:600;color:#111827;">Verification code</div>
                <p style="font-size:14px;line-height:22px;color:#4b5563;margin:10px 0 0;">
                  Use the code below to sign in to your campus lost &amp; found account. It is valid for a limited time and can be used only once.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 36px 0;">
                <div style="border:1px solid #e3e8ef;border-radius:10px;background:#f8fafc;padding:18px 12px;text-align:center;font-size:30px;font-weight:700;letter-spacing:10px;text-indent:10px;color:#111827;">${code}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 36px 30px;">
                <p style="font-size:13px;line-height:20px;color:#6b7280;margin:0;">
                  If you did not request this code, no action is needed. Your account remains secure and you can disregard this message.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 36px;border-top:1px solid #eef2f7;background:#fbfcfe;">
                <p style="font-size:11px;line-height:18px;color:#9ca3af;margin:0;">
                  This is an automated message sent for account verification. Please do not reply to this email.
                </p>
              </td>
            </tr>
          </table>
          <div style="font-size:11px;color:#9ca3af;margin-top:16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            CampusFind &middot; Campus Lost &amp; Found
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function otpEmailText(code: string, institutionName: string) {
  return [
    `CampusFind — ${institutionName}`,
    '',
    'Verification code',
    '',
    'Use this code to sign in to your campus lost & found account:',
    '',
    `    ${code}`,
    '',
    'It is valid for a limited time and can be used only once.',
    'If you did not request this code, no action is needed.',
    '',
    'This is an automated message sent for account verification. Please do not reply.',
  ].join('\n');
}

// Sends the OTP via Brevo's transactional email API.
export async function sendOtpEmail(to: string, code: string, institutionName: string) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to }],
      subject: `${code} is your CampusFind verification code`,
      htmlContent: otpEmailHtml(code, institutionName),
      textContent: otpEmailText(code, institutionName),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    // Surface Brevo's reason in server logs (e.g. unverified sender, quota).
    console.error(`Brevo delivery failed (${res.status}) from="${SENDER_EMAIL}" to="${to}": ${body}`);
    throw new Error(`Brevo API error (${res.status}): ${body}`);
  }
}
