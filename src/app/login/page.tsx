'use client';

import { Search, Shield } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          hd: '', // Don't restrict at Google level, we handle it ourselves
        },
      },
    });
  };

  const handleDemoLogin = async (email: string, pass: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) {
      window.location.href = '/login?error=' + encodeURIComponent(error.message);
    } else {
      window.location.href = '/feed';
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-10 bg-surface">
      <div className="max-w-md w-full flex flex-col gap-8 items-center">
        {mounted && error === 'unauthorized_domain' ? (
          <div className="w-full bg-error-container text-on-error-container p-4 rounded-lg text-sm font-semibold text-center border border-error/20">
            Your email domain is not authorized. Please use your institutional email address.
          </div>
        ) : mounted && error ? (
          <div className="w-full bg-error-container text-on-error-container p-4 rounded-lg text-sm font-semibold text-center border border-error/20">
            Authentication failed: {error}
          </div>
        ) : null}

        {/* Brand Module */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="size-16 rounded-full bg-surface-container border border-border shadow-sm flex items-center justify-center mb-2">
            <Search className="text-primary-container" size={32} />
          </div>
          <h1 className="text-4xl font-bold text-on-surface tracking-tight">CampusFind</h1>
          <p className="text-lg text-on-surface-variant font-medium">The Official Campus Lost & Found Ledger</p>
        </div>

        {/* Auth Card */}
        <div className="w-full bg-background border border-border rounded-lg shadow-sm p-6 flex flex-col gap-6">
          <button
            onClick={handleGoogleLogin}
            className="w-full h-12 rounded-lg bg-primary-container text-on-primary font-bold flex items-center justify-center gap-3 hover:bg-primary transition-colors cursor-pointer"
          >
            <svg fill="currentColor" height="20px" viewBox="0 0 256 256" width="20px" xmlns="http://www.w3.org/2000/svg">
              <path d="M224,128a96,96,0,1,1-21.95-61.09,8,8,0,1,1-12.33,10.18A80,80,0,1,0,207.6,136H128a8,8,0,0,1,0-16h88A8,8,0,0,1,224,128Z"></path>
            </svg>
            Continue with Campus Email
          </button>

          {/* Demo Logins — development only */}
          {process.env.NODE_ENV !== 'production' && (
            <div className="flex flex-col gap-2 pt-4 border-t border-border mt-2">
              <p className="text-xs font-semibold text-on-surface-variant text-center uppercase tracking-wider mb-1">Developer Test Accounts</p>
              <button
                onClick={() => handleDemoLogin('student1@iiitd.ac.in', 'password123')}
                className="w-full h-10 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-sm font-semibold transition-colors"
              >
                Login as Demo Student 1
              </button>
              <button
                onClick={() => handleDemoLogin('student2@iiitd.ac.in', 'password123')}
                className="w-full h-10 rounded bg-surface-container hover:bg-surface-container-high text-on-surface text-sm font-semibold transition-colors"
              >
                Login as Demo Student 2
              </button>
              <button
                onClick={() => handleDemoLogin('admin@iiitd.ac.in', 'password123')}
                className="w-full h-10 rounded bg-primary-container/10 hover:bg-primary-container/20 text-primary-container text-sm font-semibold transition-colors"
              >
                Login as Global Admin
              </button>
            </div>
          )}

          {/* Guardrail Info */}
          <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-outline-variant bg-surface p-4">
            <div className="flex items-center gap-2">
              <Shield className="text-primary-container" size={20} />
              <h3 className="font-bold text-on-surface">Access Restricted</h3>
            </div>
            <p className="text-sm text-on-surface-variant text-center">
              Access restricted strictly to verified institutional handles (e.g., @igdtuw.ac.in, @dtu.ac.in)
            </p>
          </div>
        </div>

        {/* Footer Links */}
        <div className="flex gap-6 text-xs font-semibold text-on-surface-variant">
          <Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link>
          <span className="text-outline-variant">•</span>
          <Link href="#" className="hover:text-primary transition-colors">Terms of Service</Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface flex items-center justify-center">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
