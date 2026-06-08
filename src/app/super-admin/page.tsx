'use client';

import { ArrowLeft, Rocket, AtSign, MapPin, Database, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function SuperAdminPage() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [step, setStep] = useState(1);
  const [entityName, setEntityName] = useState('');
  const [emailDomain, setEmailDomain] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!userData || userData.role !== 'super_admin') {
        toast.error('Unauthorized access. Super-admin privileges required.');
        window.location.href = '/feed';
        return;
      }

      setCheckingAccess(false);
    }
    checkAccess();
  }, []);

  const handleProvision = async () => {
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('institutions').insert({
        name: entityName,
        email_domain: emailDomain,
        locker_coordinates: coordinates || null,
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to provision tenant');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkingAccess) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center text-on-surface-variant">
        Verifying access…
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen flex flex-col text-on-surface antialiased">
      {/* Header */}
      <header className="w-full max-w-5xl mx-auto px-4 md:px-10 py-6 flex items-center justify-between z-10">
        <Link href="/feed" className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors rounded p-1">
          <ArrowLeft size={20} />
          <span className="text-xs font-semibold tracking-wide">Return to Dashboard</span>
        </Link>
        <div className="flex items-center gap-4 bg-background border border-border px-3 py-1.5 rounded-full shadow-sm">
          <div className="w-6 h-6 rounded-full bg-iiitd-navy flex items-center justify-center text-on-primary text-[10px] font-semibold">GF</div>
          <span className="text-xs font-semibold text-on-surface">Global Foundation Admin</span>
        </div>
      </header>

      {/* Main Wizard */}
      <main className="w-full max-w-3xl mx-auto px-4 md:px-0 pb-8 flex-1 flex flex-col pt-2">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 relative px-8">
          <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-px bg-border z-0"></div>
          {[
            { num: 1, label: 'Identity & Access' },
            { num: 2, label: 'Policy Rules' },
            { num: 3, label: 'Review & Deploy' },
          ].map((s) => (
            <div key={s.num} className="relative z-10 flex flex-col items-center gap-2 bg-surface px-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shadow-[0_0_0_4px_#F8FAFC] transition-all duration-300 ${
                step >= s.num
                  ? 'bg-primary text-on-primary'
                  : 'bg-background text-outline-variant border border-border'
              }`}>
                {s.num}
              </div>
              <span className={`text-xs font-semibold transition-colors ${step >= s.num ? 'text-primary' : 'text-on-surface-variant'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-background border border-border rounded-lg p-6 md:p-8 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] flex flex-col gap-8">
          <div className="border-b border-border pb-4">
            <h1 className="text-[32px] font-semibold text-on-surface mb-2 leading-[40px] tracking-[-0.02em]">Provision Campus Infrastructure</h1>
            <p className="text-base text-on-surface-variant">Configure the foundational parameters to establish a new secure tenant environment.</p>
          </div>

          {/* Step 1: Identity */}
          <div className={`flex flex-col gap-6 transition-all duration-300 ${step === 1 ? 'opacity-100' : 'hidden'}`}>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface flex items-center gap-2" htmlFor="entityName">
                <Building2 size={14} className="text-primary" />
                University Legal Entity Name
                <span className="text-error">*</span>
              </label>
              <input
                className="w-full px-4 py-3 rounded border border-outline-variant bg-surface focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none text-base text-on-surface transition-colors"
                id="entityName"
                placeholder="e.g. Delhi Technological University"
                type="text"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface flex items-center gap-2" htmlFor="domainWhitelist">
                <AtSign size={14} className="text-primary" />
                Authorized Email Sub-domain Whitelist
                <span className="text-error">*</span>
              </label>
              <p className="text-sm text-outline mb-1">The primary email domain for this institution.</p>
              <input
                className="w-full px-4 py-3 rounded border border-outline-variant bg-surface focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none text-base text-on-surface transition-colors font-mono text-sm"
                id="domainWhitelist"
                placeholder="e.g. dtu.ac.in"
                type="text"
                value={emailDomain}
                onChange={(e) => setEmailDomain(e.target.value)}
              />
            </div>
            <div className="flex justify-end pt-4 border-t border-border">
              <button
                onClick={() => setStep(2)}
                disabled={!entityName || !emailDomain}
                className="bg-primary text-on-primary px-6 py-3 rounded-lg font-semibold hover:bg-primary-container transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                Continue to Policy Rules
                <ArrowLeft size={16} className="rotate-180" />
              </button>
            </div>
          </div>

          {/* Step 2: Coordinates */}
          <div className={`flex flex-col gap-6 transition-all duration-300 ${step === 2 ? 'opacity-100' : 'hidden'}`}>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-on-surface flex items-center gap-2" htmlFor="coordinates">
                <MapPin size={14} className="text-primary" />
                Physical Campus Locker Coordinates
                <span className="text-outline-variant font-normal ml-1">(Latitude, Longitude)</span>
              </label>
              <input
                className="w-full px-4 py-3 rounded border border-outline-variant bg-surface focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none text-base text-on-surface transition-colors font-mono text-sm"
                id="coordinates"
                placeholder="28.7500, 77.1175"
                type="text"
                value={coordinates}
                onChange={(e) => setCoordinates(e.target.value)}
              />
            </div>
            <div className="flex justify-between pt-4 border-t border-border">
              <button
                onClick={() => setStep(1)}
                className="text-on-surface-variant px-6 py-3 rounded-lg font-semibold hover:bg-surface-container-low transition-colors border border-border"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="bg-primary text-on-primary px-6 py-3 rounded-lg font-semibold hover:bg-primary-container transition-colors flex items-center gap-2"
              >
                Review &amp; Deploy
                <ArrowLeft size={16} className="rotate-180" />
              </button>
            </div>
          </div>

          {/* Step 3: Review */}
          <div className={`flex flex-col gap-6 transition-all duration-300 ${step === 3 ? 'opacity-100' : 'hidden'}`}>
            {submitted ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-16 h-16 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
                  <Rocket className="text-success" size={32} />
                </div>
                <h2 className="text-2xl font-semibold text-on-surface">Tenant Provisioned!</h2>
                <p className="text-sm text-on-surface-variant text-center max-w-sm">
                  The new campus environment for <strong>{entityName}</strong> is now live.
                  Users with <code className="bg-surface-container px-1 py-0.5 rounded text-xs">@{emailDomain}</code> can now sign up.
                </p>
              </div>
            ) : (
              <>
                {/* Live Preview Table */}
                <div className="bg-background border border-border rounded-lg overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
                  <div className="bg-surface-container-low px-6 py-3 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database size={16} className="text-primary" />
                      <span className="text-xs font-semibold text-on-surface uppercase tracking-wider">Live Simulation Preview</span>
                    </div>
                    <span className="px-2.5 py-1 bg-surface text-outline rounded-full text-[10px] font-semibold border border-border flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                      Dry Run Active
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-surface border-b border-border text-xs font-semibold text-on-surface-variant">
                          <th className="px-6 py-3 uppercase tracking-wider">Entity Record</th>
                          <th className="px-6 py-3 uppercase tracking-wider">Access Rules</th>
                          <th className="px-6 py-3 uppercase tracking-wider">Hardware Node</th>
                          <th className="px-6 py-3 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm text-on-surface">
                        <tr className="hover:bg-surface-container-lowest transition-colors">
                          <td className="px-6 py-4 font-medium">{entityName || '—'}</td>
                          <td className="px-6 py-4">
                            <span className="bg-surface-container-high py-0.5 px-1.5 rounded text-on-surface-variant font-mono text-[11px] border border-border">
                              @{emailDomain || '—'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-[13px]">{coordinates || 'Not set'}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-warning/10 text-warning text-[11px] font-semibold border border-warning/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-warning"></span> Validated
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t border-border">
                  <button
                    onClick={() => setStep(2)}
                    className="text-on-surface-variant px-6 py-3 rounded-lg font-semibold hover:bg-surface-container-low transition-colors border border-border"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleProvision}
                    disabled={isSubmitting}
                    className="bg-primary hover:bg-primary-container text-on-primary py-4 px-8 rounded-lg shadow-[0_2px_4px_0_rgba(0,0,0,0.1)] hover:shadow-[0_4px_6px_0_rgba(0,0,0,0.1)] transition-all duration-200 flex items-center justify-center gap-3 group font-semibold disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Provisioning...' : 'Provision New Campus Tenant Infrastructure'}</span>
                    <Rocket size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 mt-auto">
        <p className="text-sm text-outline-variant">Secure infrastructure provisioning powered by CampusFind Enterprise.</p>
      </footer>
    </div>
  );
}
