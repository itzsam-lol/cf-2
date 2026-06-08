import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendOtpEmail } from '@/lib/resend';
import { findDemoAccount, getDemoOtpSecret } from '@/lib/demoAccounts';

const COOLDOWN_MS = 45 * 1000;
const MAX_PER_WINDOW = 6;
const WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const { email, institutionId } = await request.json();
    if (!email || typeof email !== 'string' || !institutionId || typeof institutionId !== 'string') {
      return NextResponse.json({ error: 'Email and campus are required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }

    // Pre-seeded demo/reviewer accounts sign in with a fixed code entered on
    // the same screen — but only when the operator has privately configured
    // DEMO_OTP_SECRET (never committed). No email is sent, no rate-limit row
    // touched. Without that env var these addresses fall through to the
    // normal institutional-domain check below and are rejected like any
    // other non-institutional address.
    if (findDemoAccount(normalizedEmail) && getDemoOtpSecret()) {
      return NextResponse.json({ sent: true });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Auth is not configured' }, { status: 500 });
    }

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: institution } = await serviceClient
      .from('institutions')
      .select('id, name, email_domain')
      .eq('id', institutionId)
      .single();

    if (!institution || !normalizedEmail.endsWith(`@${institution.email_domain.toLowerCase()}`)) {
      return NextResponse.json(
        { error: 'Use your institutional email address for the selected campus' },
        { status: 400 }
      );
    }

    // Per-email rate limiting: a short cooldown between sends, and a cap per
    // rolling hour window — protects against email-bombing a victim address.
    const now = Date.now();
    const { data: existing } = await serviceClient
      .from('otp_requests')
      .select('last_sent_at, send_count, window_start')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing) {
      const lastSentMs = new Date(existing.last_sent_at).getTime();
      if (now - lastSentMs < COOLDOWN_MS) {
        const waitSeconds = Math.ceil((COOLDOWN_MS - (now - lastSentMs)) / 1000);
        return NextResponse.json(
          { error: `Please wait ${waitSeconds}s before requesting another code` },
          { status: 429 }
        );
      }

      const windowStartMs = new Date(existing.window_start).getTime();
      const windowExpired = now - windowStartMs > WINDOW_MS;

      if (!windowExpired && existing.send_count >= MAX_PER_WINDOW) {
        return NextResponse.json(
          { error: 'Too many codes requested for this address. Try again later.' },
          { status: 429 }
        );
      }

      await serviceClient
        .from('otp_requests')
        .update({
          last_sent_at: new Date(now).toISOString(),
          send_count: windowExpired ? 1 : existing.send_count + 1,
          window_start: windowExpired ? new Date(now).toISOString() : existing.window_start,
        })
        .eq('email', normalizedEmail);
    } else {
      await serviceClient.from('otp_requests').insert({
        email: normalizedEmail,
        last_sent_at: new Date(now).toISOString(),
        send_count: 1,
        window_start: new Date(now).toISOString(),
      });
    }

    // Supabase mints and tracks the OTP itself (expiry, single-use, etc.) —
    // we just relay the raw code through our own branded email via Resend.
    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
    });

    if (linkError || !linkData?.properties?.email_otp) {
      console.error('Failed to generate OTP:', linkError);
      return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
    }

    await sendOtpEmail(normalizedEmail, linkData.properties.email_otp, institution.name);

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error('send-otp error:', err);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}
