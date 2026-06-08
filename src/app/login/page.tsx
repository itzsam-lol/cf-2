'use client';

import { Search, Shield, ArrowLeft, Loader2, Mail, KeyRound, Building2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';
import { findDemoAccount } from '@/lib/demoAccounts';
import { toast } from 'sonner';

interface Institution {
  id: string;
  name: string;
  email_domain: string;
}

const RESEND_COOLDOWN_SECONDS = 45;

function logoSlug(domain: string) {
  return domain.split('.')[0]?.toLowerCase() || domain.toLowerCase();
}

function CampusLogo({ domain, name, size = 48 }: { domain: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold shrink-0"
        style={{ width: size, height: size }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={`/logos/${logoSlug(domain)}.png`}
      alt={`${name} logo`}
      width={size}
      height={size}
      className="rounded-full object-contain bg-white border border-border shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const [mounted, setMounted] = useState(false);

  const [step, setStep] = useState<'campus' | 'email' | 'otp'>('campus');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [selected, setSelected] = useState<Institution | null>(null);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInstitutions() {
      try {
        const supabase = createClient();
        const { data } = await supabase.from('institutions').select('id, name, email_domain').order('name');
        if (!cancelled) setInstitutions(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoadingInstitutions(false);
      }
    }
    loadInstitutions();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleSelectCampus = (institution: Institution) => {
    setSelected(institution);
    setEmail('');
    setOtp('');
    setFormError(null);
    setStep('email');
  };

  const requestCode = async (targetEmail: string, institutionId: string) => {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, institutionId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to send verification code');
  };

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setFormError(null);

    const normalized = email.trim().toLowerCase();
    // Pre-seeded demo/reviewer addresses skip the institutional-domain check
    // here too — the server applies the real gating (a private env-only
    // secret code) on the next step.
    const isDemoAddress = Boolean(findDemoAccount(normalized));
    if (!isDemoAddress && !normalized.endsWith(`@${selected.email_domain.toLowerCase()}`)) {
      setFormError(`Use your ${selected.name} email address — it must end with @${selected.email_domain}`);
      return;
    }

    setSending(true);
    try {
      await requestCode(normalized, selected.id);
      setEmail(normalized);
      setOtp('');
      setStep('otp');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success('Verification code sent — check your inbox');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (!selected || cooldown > 0 || sending) return;
    setFormError(null);
    setSending(true);
    try {
      await requestCode(email, selected.id);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success('A new code is on its way');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setFormError(null);

    const trimmedOtp = otp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      setFormError('Enter the 6-digit code from your email');
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, institutionId: selected.id, code: trimmedOtp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data?.error || 'That code is invalid or has expired');
        return;
      }
      toast.success('Welcome back!');
      window.location.href = '/feed';
    } catch (err) {
      console.error(err);
      setFormError('Network error. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, pass: string) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: demoEmail, password: pass });
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
        <div className="w-full bg-background border border-border rounded-lg shadow-sm p-6 flex flex-col gap-5">
          {step === 'campus' && (
            <>
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-primary" />
                <h2 className="font-bold text-on-surface">Select your campus</h2>
              </div>

              {loadingInstitutions ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-16 bg-surface-container rounded-lg"></div>
                  <div className="h-16 bg-surface-container rounded-lg"></div>
                </div>
              ) : institutions.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-4">
                  No campuses are registered yet. Contact your administration.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {institutions.map((inst) => (
                    <button
                      key={inst.id}
                      onClick={() => handleSelectCampus(inst)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-outline-variant hover:border-primary hover:bg-primary-container/10 transition-colors text-left"
                    >
                      <CampusLogo domain={inst.email_domain} name={inst.name} size={44} />
                      <div className="min-w-0">
                        <p className="font-semibold text-on-surface truncate">{inst.name}</p>
                        <p className="text-xs text-on-surface-variant">@{inst.email_domain}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'email' && selected && (
            <form onSubmit={handleSendCode} className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => { setStep('campus'); setFormError(null); }}
                className="flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors self-start"
              >
                <ArrowLeft size={16} />
                Change campus
              </button>

              <div className="flex items-center gap-3">
                <CampusLogo domain={selected.email_domain} name={selected.name} size={48} />
                <div className="min-w-0">
                  <p className="font-semibold text-on-surface truncate">{selected.name}</p>
                  <p className="text-xs text-on-surface-variant">Sign in with your @{selected.email_domain} email</p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-on-surface-variant flex items-center gap-1.5">
                  <Mail size={14} />
                  Institutional email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`you@${selected.email_domain}`}
                  className="w-full h-12 px-4 rounded-lg border border-outline-variant bg-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-on-surface"
                />
              </div>

              {formError && <p className="text-sm text-error font-medium">{formError}</p>}

              <button
                type="submit"
                disabled={sending}
                className="w-full h-12 rounded-lg bg-primary-container text-on-primary font-bold flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}
                {sending ? 'Sending code…' : 'Send verification code'}
              </button>
            </form>
          )}

          {step === 'otp' && selected && (
            <form onSubmit={handleVerify} className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => { setStep('email'); setOtp(''); setFormError(null); }}
                className="flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors self-start"
              >
                <ArrowLeft size={16} />
                Use a different email
              </button>

              <div>
                <p className="font-semibold text-on-surface">Enter your verification code</p>
                <p className="text-sm text-on-surface-variant">
                  We sent a 6-digit code to <span className="font-semibold text-on-surface">{email}</span>
                </p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="w-full h-14 px-4 rounded-lg border border-outline-variant bg-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-on-surface text-center text-2xl font-bold tracking-[0.5em]"
              />

              {formError && <p className="text-sm text-error font-medium">{formError}</p>}

              <button
                type="submit"
                disabled={verifying || otp.length !== 6}
                className="w-full h-12 rounded-lg bg-primary-container text-on-primary font-bold flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {verifying ? <Loader2 className="animate-spin" size={18} /> : <Shield size={18} />}
                {verifying ? 'Verifying…' : 'Verify & continue'}
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || sending}
                className="text-sm font-semibold text-primary hover:underline disabled:text-on-surface-variant disabled:no-underline disabled:cursor-not-allowed text-center"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
            </form>
          )}

          {/* Demo Logins — development only */}
          {process.env.NODE_ENV !== 'production' && step === 'campus' && (
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
              Access is restricted strictly to verified institutional email addresses for your selected campus.
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
