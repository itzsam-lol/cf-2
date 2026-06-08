import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/feed';

  if (code) {
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
              // Ignored in server component context
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user?.email) {
        const emailDomain = user.email.split('@')[1];

        // Check if the email domain belongs to a registered institution
        const { data: institution } = await supabase
          .from('institutions')
          .select('id, name')
          .eq('email_domain', emailDomain)
          .single();

        if (!institution) {
          // SECURITY: Domain not authorized — delete the auth user and reject
          // Need to use service role key for admin operations
          if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const adminClient = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY,
              { auth: { autoRefreshToken: false, persistSession: false } }
            );
            await adminClient.auth.admin.deleteUser(user.id);
          }
          await supabase.auth.signOut();

          return NextResponse.redirect(
            `${origin}/login?error=unauthorized_domain`
          );
        }

        // Upsert user record in public.users table
        const { error: upsertError } = await supabase
          .from('users')
          .upsert(
            {
              id: user.id,
              institution_id: institution.id,
              name: user.user_metadata?.full_name || user.email.split('@')[0],
              email: user.email,
              avatar_url: user.user_metadata?.avatar_url || null,
              role: 'student',
            },
            { onConflict: 'id' }
          );

        if (upsertError) {
          console.error('Failed to upsert user:', upsertError);
        }

        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // OAuth flow failed
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
