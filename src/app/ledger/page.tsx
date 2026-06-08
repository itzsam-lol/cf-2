'use client';

import { useState, useEffect } from 'react';
import { Package, Timer, X, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';
import BottomNav from '@/components/BottomNav';
import { motion, AnimatePresence } from 'framer-motion';

export default function LedgerPage() {
  const [activeTab, setActiveTab] = useState<'items' | 'claims'>('claims');
  const [items, setItems] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // For the pickup token modal
  const [selectedClaim, setSelectedClaim] = useState<any | null>(null);
  const [pickupToken, setPickupToken] = useState<any | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedClaim) {
      setPickupToken(null);
      return;
    }

    let cancelled = false;
    async function loadToken() {
      setLoadingToken(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('pickup_tokens')
          .select('token, expires_at, used_at')
          .eq('claim_id', selectedClaim.id)
          .single();
        if (!cancelled) setPickupToken(data || null);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoadingToken(false);
      }
    }
    loadToken();
    return () => { cancelled = true; };
  }, [selectedClaim]);

  useEffect(() => {
    if (!selectedClaim) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [selectedClaim]);

  useEffect(() => {
    async function fetchLedgerData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch user's reported items
        const { data: itemsData } = await supabase
          .from('items')
          .select('*')
          .eq('reporter_id', user.id)
          .order('created_at', { ascending: false });

        // Fetch user's filed claims
        const { data: claimsData } = await supabase
          .from('claims')
          .select('*, items(*)')
          .eq('claimant_id', user.id)
          .order('created_at', { ascending: false });

        setItems(itemsData || []);
        setClaims(claimsData || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchLedgerData();
  }, []);

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen flex flex-col pb-24 md:pb-10">
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant px-4 h-16 flex items-center justify-between max-w-7xl mx-auto w-full">
        <h1 className="text-xl md:text-2xl font-bold text-primary">My Ledger</h1>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        <div className="flex p-1 bg-surface-container-low rounded-xl mb-8">
          <button 
            onClick={() => setActiveTab('claims')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'claims' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            My Filed Claims
          </button>
          <button 
            onClick={() => setActiveTab('items')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'items' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            My Reported Items
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-surface-container rounded-xl"></div>
            <div className="h-24 bg-surface-container rounded-xl"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {activeTab === 'claims' && (
                <motion.div
                  key="claims"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {claims.length === 0 ? (
                    <div className="text-center py-12 bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant">
                      <p className="text-on-surface-variant">You haven't filed any claims yet.</p>
                    </div>
                  ) : (
                    claims.map((claim) => (
                      <div key={claim.id} className="bg-surface-container-lowest border border-border rounded-xl p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-semibold text-lg text-on-surface">{claim.items?.title}</h3>
                            <p className="text-sm text-on-surface-variant">Filed on {new Date(claim.created_at).toLocaleDateString()}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                            claim.status === 'approved' ? 'bg-success/15 text-success' :
                            claim.status === 'rejected' ? 'bg-error/15 text-error' :
                            'bg-warning/15 text-warning'
                          }`}>
                            {claim.status}
                          </span>
                        </div>
                        
                        {claim.status === 'approved' && (
                          <button 
                            onClick={() => setSelectedClaim(claim)}
                            className="w-full mt-2 bg-primary-container text-on-primary-container py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary-fixed transition-colors"
                          >
                            <Package size={18} />
                            View Pickup Token
                          </button>
                        )}
                        {claim.status === 'rejected' && (
                          <div className="mt-2 p-3 bg-error/5 border border-error/20 rounded-lg text-sm text-error flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <p>This claim was rejected by the administration. You may file an appeal at the security desk.</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === 'items' && (
                <motion.div
                  key="items"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {items.length === 0 ? (
                    <div className="text-center py-12 bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant">
                      <p className="text-on-surface-variant">You haven't reported any items yet.</p>
                    </div>
                  ) : (
                    items.map((item) => (
                      <div key={item.id} className="bg-surface-container-lowest border border-border rounded-xl p-4 shadow-sm flex gap-4">
                        {item.image_url ? (
                          <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
                            <Package className="text-outline" size={24} />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-on-surface">{item.title}</h3>
                          <p className="text-sm text-on-surface-variant">{item.location_found}</p>
                          <span className="inline-block mt-2 px-2 py-0.5 bg-surface-container-high rounded text-xs font-semibold text-on-surface-variant">
                            Status: {item.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Pickup Token Modal */}
      <AnimatePresence>
        {selectedClaim && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-on-background/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-surface w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
                <h3 className="text-lg font-semibold text-on-surface">Pickup Token</h3>
                <button onClick={() => setSelectedClaim(null)} className="text-on-surface-variant hover:text-error p-1">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 flex flex-col items-center bg-surface-bright">
                <p className="text-sm text-on-surface-variant text-center mb-6">
                  Present this cryptographically signed, single-use code to the Admin at the Main Security Desk to claim your item.
                </p>

                {loadingToken ? (
                  <div className="w-[180px] h-[180px] flex items-center justify-center mb-6">
                    <Loader2 className="animate-spin text-outline" size={32} />
                  </div>
                ) : pickupToken ? (
                  <div className="bg-white p-3 rounded-xl border border-border shadow-sm mb-6">
                    <QRCodeSVG value={pickupToken.token} size={180} fgColor="#1E3A8A" />
                  </div>
                ) : (
                  <div className="w-[180px] h-[180px] flex items-center justify-center mb-6 text-center text-sm text-on-surface-variant px-4">
                    Pickup token not available yet — check back shortly.
                  </div>
                )}

                {pickupToken?.used_at ? (
                  <div className="w-full flex items-center justify-center gap-2 bg-success/10 border border-success/20 py-2.5 px-4 rounded-lg">
                    <ShieldCheck size={18} className="text-success" />
                    <span className="text-[14px] font-medium text-success tracking-[0.01em]">Already redeemed — item released</span>
                  </div>
                ) : pickupToken && now ? (
                  <CountdownBadge expiresAt={pickupToken.expires_at} now={now} />
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}

function CountdownBadge({ expiresAt, now }: { expiresAt: string; now: number }) {
  const remainingMs = new Date(expiresAt).getTime() - now;

  if (remainingMs <= 0) {
    return (
      <div className="w-full flex items-center justify-center gap-2 bg-error/10 border border-error/20 py-2.5 px-4 rounded-lg">
        <AlertCircle size={18} className="text-error" />
        <span className="text-[14px] font-medium text-error tracking-[0.01em]">This pickup code has expired</span>
      </div>
    );
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const label = hours > 0
    ? `Expires in ${hours}h ${minutes}m`
    : `Expires in ${minutes}m ${seconds}s`;

  return (
    <div className="w-full flex items-center justify-center gap-2 bg-warning/10 border border-warning/20 py-2.5 px-4 rounded-lg">
      <Timer size={18} className="text-warning" />
      <span className="text-[14px] font-medium text-warning tracking-[0.01em]">{label}</span>
    </div>
  );
}
