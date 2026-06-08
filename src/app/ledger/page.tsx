'use client';

import { useState, useEffect } from 'react';
import { Package, MessageCircle, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import BottomNav from '@/components/BottomNav';
import AccuracyMeter from '@/components/AccuracyMeter';
import { motion, AnimatePresence } from 'framer-motion';

interface LedgerItem {
  id: string; title: string; status: string; location_found: string; image_url: string | null;
}
interface LedgerClaim {
  id: string; status: string; created_at: string; ai_match_score: number | null;
  items: { id: string; title: string } | null;
}

export default function LedgerPage() {
  const [activeTab, setActiveTab] = useState<'items' | 'claims'>('claims');
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [claims, setClaims] = useState<LedgerClaim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLedgerData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: itemsData } = await supabase
          .from('items').select('id, title, status, location_found, image_url')
          .eq('reporter_id', user.id).order('created_at', { ascending: false });

        const { data: claimsData } = await supabase
          .from('claims').select('id, status, created_at, ai_match_score, items(id, title)')
          .eq('claimant_id', user.id).order('created_at', { ascending: false });

        setItems((itemsData as unknown as LedgerItem[]) || []);
        setClaims((claimsData as unknown as LedgerClaim[]) || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchLedgerData();
  }, []);

  const statusPill = (status: string) => {
    const map: Record<string, string> = {
      claimed: 'bg-success/15 text-success', approved: 'bg-success/15 text-success',
      rejected: 'bg-error/15 text-error', lost: 'bg-[#fffbeb] text-[#d97706]',
      found: 'bg-secondary-container text-on-secondary-container', pending: 'bg-warning/15 text-warning',
    };
    const label = status === 'claimed' ? 'Returned' : status.charAt(0).toUpperCase() + status.slice(1);
    return <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${map[status] || 'bg-surface-container-high text-on-surface-variant'}`}>{label}</span>;
  };

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen flex flex-col pb-24 md:pb-10">
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant px-4 h-16 flex items-center justify-between max-w-7xl mx-auto w-full">
        <h1 className="text-xl md:text-2xl font-bold text-primary">My Ledger</h1>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        <div className="flex p-1 bg-surface-container-low rounded-xl mb-8">
          <button onClick={() => setActiveTab('claims')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'claims' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}>My Filed Claims</button>
          <button onClick={() => setActiveTab('items')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'items' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}>My Reported Items</button>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4"><div className="h-24 bg-surface-container rounded-xl" /><div className="h-24 bg-surface-container rounded-xl" /></div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'claims' && (
              <motion.div key="claims" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                {claims.length === 0 ? (
                  <Empty label="You haven't filed any claims yet." />
                ) : claims.map((claim) => (
                  <Link key={claim.id} href={`/item/${claim.items?.id}`} className="block bg-surface-container-lowest border border-border rounded-xl p-5 shadow-sm hover:border-primary/40 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{claim.items?.title || 'Item'}</h3>
                        <p className="text-sm text-on-surface-variant">Filed {new Date(claim.created_at).toLocaleDateString()}</p>
                      </div>
                      {statusPill(claim.status)}
                    </div>
                    <AccuracyMeter score={claim.ai_match_score} />
                    <div className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary">
                      <MessageCircle size={16} /> {claim.status === 'approved' ? 'Chat to arrange pickup' : 'Open chat & track claim'} <ChevronRight size={16} />
                    </div>
                  </Link>
                ))}
              </motion.div>
            )}

            {activeTab === 'items' && (
              <motion.div key="items" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                {items.length === 0 ? (
                  <Empty label="You haven't reported any items yet." />
                ) : items.map((item) => (
                  <Link key={item.id} href={`/item/${item.id}`} className="flex gap-4 items-center bg-surface-container-lowest border border-border rounded-xl p-4 shadow-sm hover:border-primary/40 transition-colors">
                    {item.image_url ? (
                      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0"><img src={item.image_url} alt={item.title} className="w-full h-full object-cover" /></div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-surface-container flex items-center justify-center shrink-0"><Package className="text-outline" size={22} /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{item.title}</h3>
                      <p className="text-sm text-on-surface-variant truncate">{item.location_found}</p>
                      <div className="mt-1.5">{statusPill(item.status)}</div>
                    </div>
                    <ChevronRight size={20} className="text-on-surface-variant shrink-0" />
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="text-center py-12 bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant"><p className="text-on-surface-variant">{label}</p></div>;
}
