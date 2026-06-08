import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { findDemoAccount, getDemoOtpSecret } from '@/lib/demoAccounts';

const CODE_RE = /^\d{6}$/;
const MAX_VERIFY_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const { email, institutionId, code } = await request.json();
    if (!email || typeof email !== 'string' || !institutionId || typeof institutionId !== 'string' || !code) {
      return NextResponse.json({ error: 'Email, campus, and code are required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = String(code).trim();
    if (!CODE_RE.test(normalizedCode)) {
      return NextResponse.json({ error: 'Enter the 6-digit code from your email' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Auth is not configured' }, { status: 500 });
    }

    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignored — called from a context where cookies can't be set directly
            }
          },
        },
      }
    );

    // Pre-seeded demo/reviewer accounts (created by demo_otp_accounts.sql) can
    // sign in with a fixed code instead of a real emailed one — but only when
    // the operator has privately configured DEMO_OTP_SECRET (a server-only env
    // var, never committed). Without it, these addresses behave like any other
    // and simply fail the institutional-domain check below.
    const demoAccount = findDemoAccount(normalizedEmail);
    const demoSecret = getDemoOtpSecret();
    const isDemoLogin = Boolean(demoAccount && demoSecret);

    let institution: { id: string; name: string; email_domain: string } | null = null;
    if (!isDemoLogin) {
      const { data: institutionRow } = await serviceClient
        .from('institutions')
        .select('id, name, email_domain')
        .eq('id', institutionId)
        .single();
      institution = institutionRow;

      if (!institution || !normalizedEmail.endsWith(`@${institution.email_domain.toLowerCase()}`)) {
        return NextResponse.json(
          { error: 'Use your institutional email address for the selected campus' },
          { status: 400 }
        );
      }
    }

    // Throttle brute-force guessing of the 6-digit code (applies to both real
    // and demo logins alike): lock the address out after too many wrong
    // attempts, forcing a fresh code request.
    const { data: rateRow } = await serviceClient
      .from('otp_requests')
      .select('failed_attempts')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (rateRow && rateRow.failed_attempts >= MAX_VERIFY_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many incorrect attempts. Request a new code and try again.' },
        { status: 429 }
      );
    }

    if (isDemoLogin) {
      if (normalizedCode !== demoSecret) {
        await serviceClient
          .from('otp_requests')
          .update({ failed_attempts: (rateRow?.failed_attempts ?? 0) + 1 })
          .eq('email', normalizedEmail);
        return NextResponse.json({ error: 'That code is invalid or has expired' }, { status: 400 });
      }

      // Mint a real one-time code server-side for the pre-seeded account and
      // immediately redeem it — the same mechanism send-otp uses to issue
      // real codes, just without relaying it through email. This establishes
      // a genuine Supabase session with no password ever stored or compared,
      // so there's nothing secret-derived in the database (or in
      // demo_otp_accounts.sql) for an offline attacker to crack.
      const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail,
      });
      if (linkError || !linkData?.properties?.email_otp) {
        console.error('Demo account sign-in failed (was demo_otp_accounts.sql run?):', linkError);
        return NextResponse.json({ error: 'Demo account is not provisioned yet' }, { status: 500 });
      }

      const { error: demoSignInError } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: linkData.properties.email_otp,
        type: 'email',
      });
      if (demoSignInError) {
        console.error('Demo account sign-in failed:', demoSignInError);
        return NextResponse.json({ error: 'Demo account is not provisioned yet' }, { status: 500 });
      }

      await serviceClient.from('otp_requests').delete().eq('email', normalizedEmail);
      return NextResponse.json({ verified: true });
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedCode,
      type: 'email',
    });

    if (error || !data?.user) {
      await serviceClient
        .from('otp_requests')
        .update({ failed_attempts: (rateRow?.failed_attempts ?? 0) + 1 })
        .eq('email', normalizedEmail);
      return NextResponse.json({ error: 'That code is invalid or has expired' }, { status: 400 });
    }

    // Clear the rate-limit record on a successful verification.
    await serviceClient.from('otp_requests').delete().eq('email', normalizedEmail);

    const { data: existingUser } = await serviceClient
      .from('users')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!existingUser && institution) {
      const { error: insertError } = await serviceClient.from('users').insert({
        id: data.user.id,
        institution_id: institution.id,
        name: data.user.user_metadata?.full_name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        avatar_url: data.user.user_metadata?.avatar_url || null,
        role: 'student',
      });
      if (insertError) console.error('Failed to create user record:', insertError);
    }

    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error('verify-otp error:', err);
    return NextResponse.json({ error: 'Failed to verify code' }, { status: 500 });
  }
}
