import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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

    // Throttle brute-force guessing of the 6-digit code: lock the address out
    // (forcing a fresh code request) after too many wrong attempts.
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

    if (!existingUser) {
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
