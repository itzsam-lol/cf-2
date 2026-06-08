'use client';

import { ArrowLeft, Bell, BellOff, Palette, Trash2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import ThemeToggle from '@/components/ThemeToggle';
import BottomNav from '@/components/BottomNav';

export default function PreferencesPage() {
  const [aiMatch, setAiMatch] = useState(true);
  const [claimUpdates, setClaimUpdates] = useState(true);
  const [clearing, setClearing] = useState(false);

  const clearCache = async () => {
    setClearing(true);
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      toast.success('Offline cache cleared');
    } catch {
      toast.error('Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-24 md:pb-10">
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border h-16 flex items-center px-4 md:px-10 max-w-4xl mx-auto w-full">
        <Link href="/profile" className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-surface-container-low text-on-surface-variant"><ArrowLeft size={22} /></Link>
        <h1 className="text-xl font-bold text-primary ml-1">Preferences</h1>
      </header>

      <main className="px-4 md:px-10 max-w-4xl mx-auto flex flex-col gap-8 py-8">
        {/* Appearance */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Appearance</h2>
          <div className="bg-surface-container-lowest rounded-xl border border-border p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Palette size={20} className="text-primary shrink-0" />
              <div className="flex flex-col">
                <span className="text-base font-semibold">Theme</span>
                <span className="text-sm text-on-surface-variant">Switch between light and dark mode.</span>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </section>

        {/* Notifications */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Notifications</h2>
          <div className="bg-surface-container-lowest rounded-xl border border-border flex flex-col">
            <Toggle
              icon={<Bell size={20} className="text-primary shrink-0" />}
              title="Instant AI match alerts"
              subtitle="Get notified when AI finds a potential match for your item."
              on={aiMatch} onToggle={() => setAiMatch((v) => !v)} border
            />
            <Toggle
              icon={<BellOff size={20} className="text-outline shrink-0" />}
              title="Claim & chat updates"
              subtitle="Updates when someone claims your item or sends a message."
              on={claimUpdates} onToggle={() => setClaimUpdates((v) => !v)}
            />
          </div>
        </section>

        {/* Storage */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Storage</h2>
          <button onClick={clearCache} disabled={clearing} className="w-full bg-surface-container-lowest rounded-xl border border-border p-6 flex items-center justify-between hover:bg-surface-container-low transition-colors disabled:opacity-50 text-left">
            <div className="flex items-center gap-3 text-secondary">
              <Trash2 size={20} />
              <span className="text-base font-semibold">Clear offline cached assets</span>
            </div>
            <span className="text-sm text-on-surface-variant">{clearing ? 'Clearing…' : 'Clear'}</span>
          </button>
        </section>

        {/* Legal */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Legal</h2>
          <div className="bg-surface-container-lowest rounded-xl border border-border flex flex-col">
            <Link href="/privacy" className="flex items-center justify-between p-5 border-b border-border hover:bg-surface-container-low transition-colors">
              <span className="text-sm font-semibold">Privacy Policy</span><ChevronRight size={18} className="text-on-surface-variant" />
            </Link>
            <Link href="/terms" className="flex items-center justify-between p-5 hover:bg-surface-container-low transition-colors">
              <span className="text-sm font-semibold">Terms of Service</span><ChevronRight size={18} className="text-on-surface-variant" />
            </Link>
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}

function Toggle({ icon, title, subtitle, on, onToggle, border }: { icon: React.ReactNode; title: string; subtitle: string; on: boolean; onToggle: () => void; border?: boolean }) {
  return (
    <div className={`flex items-center justify-between p-6 ${border ? 'border-b border-border' : ''}`}>
      <div className="flex items-center gap-3">
        {icon}
        <div className="flex flex-col">
          <span className="text-base font-semibold">{title}</span>
          <span className="text-sm text-on-surface-variant">{subtitle}</span>
        </div>
      </div>
      <button onClick={onToggle} className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${on ? 'bg-primary-container' : 'bg-surface-container'}`}>
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${on ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
