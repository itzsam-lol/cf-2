'use client';

import { ArrowLeft, Lock, HelpCircle, LogOut, Trash2, Bell, BellOff, User } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
  student: 'Standard Node',
  campus_admin: 'Admin Node',
  super_admin: 'Root Node',
};

export default function SettingsPage() {
  const router = useRouter();
  const [toggleAiMatch, setToggleAiMatch] = useState(true);
  const [toggleAdminDesk, setToggleAdminDesk] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: userData } = await supabase
        .from('users')
        .select('*, institutions(name)')
        .eq('id', authUser.id)
        .single();

      setUser(userData);
    }
    loadUser();
  }, []);

  const cryptoId = user?.id
    ? `0x${user.id.replace(/-/g, '').slice(0, 4).toUpperCase()}...${user.id.replace(/-/g, '').slice(-4).toUpperCase()}`
    : '—';
  const accessLevel = user?.role ? (ROLE_LABELS[user.role] || user.role) : '—';

  const handleLogout = async () => {
    setIsLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      toast.success('Offline cache cleared');
    } catch (err) {
      console.error(err);
      toast.error('Failed to clear cache');
    } finally {
      setIsClearingCache(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface font-sans min-h-screen pb-20 md:pb-0">
      {/* TopAppBar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 md:px-10 h-16 bg-surface border-b border-border transition-colors duration-200">
        <div className="flex items-center gap-4 text-primary">
          <Link href="/profile" className="hover:bg-surface-container-low transition-colors duration-200 rounded-full p-1">
            <ArrowLeft size={24} />
          </Link>
        </div>
        <div className="text-2xl font-bold text-primary tracking-[-0.01em]">CampusFind Settings</div>
        <div className="flex items-center gap-4 text-primary">
          <Link href="/help" className="hover:bg-surface-container-low transition-colors duration-200 rounded-full p-1">
            <HelpCircle size={24} />
          </Link>
        </div>
      </header>

      <main className="pt-[88px] px-4 md:px-10 max-w-4xl mx-auto flex flex-col gap-8 pb-8">
        {/* Module 1: Institutional Identity */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Institutional Identity</h2>
          <div className="bg-surface-container-lowest rounded-xl border border-border p-6 flex flex-col gap-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-primary-container">
                  <User size={24} />
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-semibold">{user?.name || 'Student'}</span>
                  <span className="text-sm text-on-surface-variant">{user?.email || '—'}</span>
                </div>
              </div>
              <Lock size={24} className="text-outline" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-on-surface-variant">Cryptographic ID</span>
                <span className="text-sm font-mono text-secondary">{cryptoId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-on-surface-variant">Access Level</span>
                <div className="bg-secondary-container text-on-secondary-container px-2 py-1 rounded-full text-xs font-semibold tracking-wide inline-block">
                  {accessLevel}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Module 2: Notification Management */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Notification Management</h2>
          <div className="bg-surface-container-lowest rounded-xl border border-border flex flex-col shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">
            {/* Toggle 1: AI Match */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-primary shrink-0" />
                <div className="flex flex-col">
                  <span className="text-base font-semibold">Instant AI Match Alert</span>
                  <span className="text-sm text-on-surface-variant">Get notified immediately when AI finds a potential match.</span>
                </div>
              </div>
              <button
                onClick={() => setToggleAiMatch(!toggleAiMatch)}
                className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  toggleAiMatch ? 'bg-primary-container' : 'bg-surface-container'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    toggleAiMatch ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {/* Toggle 2: Admin Desk */}
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-3">
                <BellOff size={20} className="text-outline shrink-0" />
                <div className="flex flex-col">
                  <span className="text-base font-semibold">Admin Desk Ledger Status Updates</span>
                  <span className="text-sm text-on-surface-variant">Updates when items move to physical admin desk.</span>
                </div>
              </div>
              <button
                onClick={() => setToggleAdminDesk(!toggleAdminDesk)}
                className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  toggleAdminDesk ? 'bg-primary-container' : 'bg-surface-container'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    toggleAdminDesk ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Module 3: Storage */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Storage</h2>
          <button
            onClick={handleClearCache}
            disabled={isClearingCache}
            className="w-full bg-surface-container-lowest rounded-xl border border-border p-6 flex items-center justify-between shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] hover:bg-surface-container-low transition-colors duration-200 cursor-pointer disabled:opacity-50 text-left"
          >
            <div className="flex items-center gap-6 text-secondary">
              <Trash2 size={24} />
              <span className="text-base font-semibold">Clear Offline Assets Cached Memory</span>
            </div>
            <span className="text-sm text-on-surface-variant">{isClearingCache ? 'Clearing…' : 'Clear'}</span>
          </button>
        </section>

        {/* Danger Zone */}
        <section className="flex flex-col gap-4 mt-6 pt-8 border-t border-border">
          <h2 className="text-xs font-semibold text-critical uppercase tracking-wider">Danger Zone</h2>
          <div className="flex flex-col gap-4">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full bg-transparent border border-critical text-critical text-base font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-error-container transition-colors duration-200 disabled:opacity-50"
            >
              <LogOut size={20} />
              {isLoggingOut ? 'Logging out...' : 'Logout from Institutional Node'}
            </button>
            <button className="w-full bg-transparent border border-critical text-critical text-base font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-error-container transition-colors duration-200">
              <Trash2 size={20} />
              Delete Account Ledger History
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
