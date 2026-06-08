'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, GraduationCap, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { branchesForDomain, POSTGRAD_BRANCHES } from '@/lib/branches';

export default function OnboardingPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [branch, setBranch] = useState('');
  const [ugBranches, setUgBranches] = useState<string[]>([]);
  const [institutionName, setInstitutionName] = useState('your campus');

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data: profile } = await supabase
        .from('users')
        .select('name, roll_number, branch, institutions(name, email_domain)')
        .eq('id', user.id)
        .single();

      // Already onboarded → go straight to the feed.
      if (profile?.branch) { router.replace('/feed'); return; }

      const inst = (Array.isArray(profile?.institutions) ? profile?.institutions[0] : profile?.institutions) as { name?: string; email_domain?: string } | undefined;
      setUgBranches(branchesForDomain(inst?.email_domain));
      if (inst?.name) setInstitutionName(inst.name);
      setName(profile?.name || user.user_metadata?.full_name || '');
      setRollNumber(profile?.roll_number || '');
      setChecking(false);
    }
    init();
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !rollNumber.trim() || !branch) {
      toast.error('Please fill in your name, roll number and branch.');
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/login'); return; }
    const { error } = await supabase
      .from('users')
      .update({ name: name.trim(), roll_number: rollNumber.trim(), branch })
      .eq('id', user.id);
    setSaving(false);
    if (error) { toast.error('Could not save your details. Please try again.'); return; }
    toast.success('Welcome to CampusFind!');
    router.replace('/feed');
  };

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center bg-surface"><Loader2 className="animate-spin text-primary" size={40} /></div>;
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <GraduationCap size={28} className="text-on-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Complete your profile</h1>
          <p className="text-sm text-on-surface-variant mt-1.5 max-w-xs">
            A few details so other students at {institutionName} can recognise you during a handover.
          </p>
        </div>

        <form onSubmit={submit} className="bg-surface-container-lowest border border-border rounded-2xl p-6 flex flex-col gap-5 shadow-sm">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface uppercase tracking-wider">Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aditi Sharma" className="edit-input" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface uppercase tracking-wider">Roll / enrollment number</label>
            <input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} placeholder="e.g. 2023UCS1234" className="edit-input" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface uppercase tracking-wider">Branch</label>
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className="edit-input">
              <option value="" disabled>Select your branch…</option>
              <optgroup label="Undergraduate">
                {ugBranches.map((b) => <option key={b} value={b}>{b}</option>)}
              </optgroup>
              <optgroup label="Postgraduate">
                {POSTGRAD_BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </optgroup>
            </select>
            <p className="text-xs text-on-surface-variant">M.Tech / Ph.D. students can simply pick that option.</p>
          </div>

          <button type="submit" disabled={saving} className="mt-1 w-full h-12 rounded-lg bg-primary text-on-primary font-semibold flex items-center justify-center gap-2 hover:bg-primary-container transition-colors disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={18} /> : <>Continue <ArrowRight size={18} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
