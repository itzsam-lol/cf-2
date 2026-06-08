'use client';

import { Search, Inbox, Lock, History, Settings, MoreVertical, Eye, QrCode, ShieldCheck, X, Loader2, ScanLine } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import PickupScannerModal from '@/components/PickupScannerModal';

export default function AdminLedgerPage() {
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [qrValue, setQrValue] = useState('');
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState('CampusFind');
  const [view, setView] = useState<'reports' | 'lockers' | 'audit'>('reports');

  useEffect(() => {
    async function loadAdminData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          window.location.href = '/login';
          return;
        }

        const { data: userData } = await supabase
          .from('users')
          .select('role, institution_id, institutions(name)')
          .eq('id', user.id)
          .single();

        if (!userData || (userData.role !== 'campus_admin' && userData.role !== 'super_admin')) {
          toast.error('Unauthorized access. Admin privileges required.');
          window.location.href = '/feed';
          return;
        }

        setUserRole(userData.role);
        setAdminUserId(user.id);

        if (userData.institutions) {
          const instName = Array.isArray(userData.institutions) ? userData.institutions[0]?.name : (userData.institutions as any)?.name;
          if (instName) setInstitutionName(instName);
        }

        // Fetch Items with their claims and reporters
        const { data: itemsData, error } = await supabase
          .from('items')
          .select(`
            *,
            reporter:users!reporter_id(name, email),
            claims(id, claimant_id, verification_proof, status, admin_notes, processed_by, created_at, claimant:users!claims_claimant_id_fkey(name, email), processor:users!claims_processed_by_fkey(name))
          `)
          .eq('institution_id', userData.institution_id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        setItems(itemsData || []);
        if (itemsData && itemsData.length > 0) {
          setSelectedItem(itemsData[0]);
        }
      } catch (err: any) {
        console.error(err);
        toast.error('Failed to load admin data');
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, []);

  const handleApproveClaim = async (claimId: string, itemId: string) => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/claims/${claimId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to approve claim');

      setQrValue(data.token);
      setQrExpiresAt(data.expiresAt);
      setShowQrModal(true);

      // Refresh local state
      setItems(items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            status: 'claimed',
            claims: item.claims.map((c: any) => c.id === claimId ? { ...c, status: 'approved', processed_by: adminUserId } : c)
          };
        }
        return item;
      }));

      if (selectedItem?.id === itemId) {
        setSelectedItem({
          ...selectedItem,
          status: 'claimed',
          claims: selectedItem.claims.map((c: any) => c.id === claimId ? { ...c, status: 'approved', processed_by: adminUserId } : c)
        });
      }

      toast.success('Claim approved — signed pickup token issued');

    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to approve claim');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectClaim = async (claimId: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('claims')
        .update({ status: 'rejected', processed_by: adminUserId })
        .eq('id', claimId);
        
      if (error) throw error;

      // Refresh local state
      setItems(items.map(item => {
        if (item.id === selectedItem?.id) {
          return {
            ...item,
            claims: item.claims.map((c: any) => c.id === claimId ? { ...c, status: 'rejected' } : c)
          };
        }
        return item;
      }));
      
      if (selectedItem) {
        setSelectedItem({
          ...selectedItem,
          claims: selectedItem.claims.map((c: any) => c.id === claimId ? { ...c, status: 'rejected' } : c)
        });
      }
      
      toast.success('Claim rejected');

    } catch (err: any) {
      console.error(err);
      toast.error('Failed to reject claim');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="bg-surface text-on-surface font-sans h-screen w-screen overflow-hidden flex flex-col md:flex-row antialiased">
      {/* TopAppBar (Mobile/Tablet) */}
      <header className="md:hidden fixed top-0 w-full z-50 bg-surface border-b border-outline-variant flex justify-between items-center px-4 h-16">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-surface-container-high overflow-hidden border border-outline-variant flex items-center justify-center text-primary font-bold">
            {institutionName.charAt(0).toUpperCase()}
          </div>
          <span className="text-2xl font-bold text-primary">CampusFind</span>
        </div>
        <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors">
          <Search className="text-primary" size={24} />
        </button>
      </header>

      {/* NavigationDrawer (Desktop) */}
      <nav className="hidden md:flex flex-col fixed left-0 top-0 h-full w-80 z-40 bg-surface-container-low border-r border-outline-variant py-10 shadow-[1px_0_3px_0_rgba(0,0,0,0.02)]">
        <div className="px-6 mb-8 flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold text-primary block mb-1">CampusFind</span>
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{institutionName} Admin Console</span>
          </div>
        </div>

        <ul className="flex flex-col gap-2 px-2 flex-1">
          <li>
            <button
              onClick={() => setView('reports')}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg mx-2 transition-all font-semibold text-left ${
                view === 'reports' ? 'bg-primary-fixed text-on-primary-fixed opacity-100 translate-x-1' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <Inbox size={24} />
              <span className="text-base">Incoming Reports</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setView('lockers')}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg mx-2 transition-all font-semibold text-left ${
                view === 'lockers' ? 'bg-primary-fixed text-on-primary-fixed opacity-100 translate-x-1' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <Lock size={24} />
              <span className="text-base">Active Lockers</span>
            </button>
          </li>
          <li>
            <button
              onClick={() => setView('audit')}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg mx-2 transition-all font-semibold text-left ${
                view === 'audit' ? 'bg-primary-fixed text-on-primary-fixed opacity-100 translate-x-1' : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <History size={24} />
              <span className="text-base">Audit Trails</span>
            </button>
          </li>
        </ul>

        <div className="px-2 mt-auto">
          <a href="#" className="flex items-center gap-4 px-4 py-3 text-on-surface-variant hover:bg-surface-container-high transition-all rounded-lg mx-2">
            <Settings size={24} />
            <span className="text-base">Settings</span>
          </a>
        </div>
      </nav>

      {/* Main Content Canvas */}
      <main className="flex-1 ml-0 md:ml-80 pt-16 md:pt-0 h-full flex flex-col xl:flex-row bg-background overflow-y-auto">
        {view === 'lockers' && <ActiveLockersView items={items} />}
        {view === 'audit' && <AuditTrailsView items={items} />}
        {view === 'reports' && (
        <>
        {/* Center Data Grid Area */}
        <section className="flex-1 flex flex-col h-full overflow-hidden border-r border-outline-variant">
          <div className="px-6 py-6 bg-surface border-b border-outline-variant flex justify-between items-end flex-shrink-0 gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-semibold text-on-surface mb-2">Master Ledger</h1>
              <p className="text-base text-on-surface-variant">Reviewing pending verification claims and high-priority items.</p>
            </div>
            <button
              onClick={() => setShowScannerModal(true)}
              className="shrink-0 flex items-center gap-2 bg-primary text-on-primary px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-container transition-colors"
            >
              <ScanLine size={18} />
              Scan to Release
            </button>
            <div className="hidden sm:flex items-center gap-4 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2">
              <Search className="text-outline" size={20} />
              <input type="text" placeholder="Search Item ID..." className="bg-transparent border-none outline-none text-sm text-on-surface w-48 placeholder:text-outline" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-surface-bright">
            {/* Grid Headers */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-2 mb-2 text-xs font-semibold text-on-surface-variant uppercase tracking-wide border-b border-outline-variant">
              <div className="col-span-2">Item ID</div>
              <div className="col-span-3">Reporter Identity</div>
              <div className="col-span-3">Structural Status</div>
              <div className="col-span-2">Claims</div>
              <div className="col-span-2 text-right">Action Nodes</div>
            </div>

            <div className="flex flex-col gap-4">
              <AnimatePresence>
                {items.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  const shortId = item.id.substring(0, 8).toUpperCase();
                  const pendingClaimsCount = item.claims?.filter((c: any) => c.status === 'pending').length || 0;
                  
                  return (
                    <motion.article 
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className={`${isSelected ? 'bg-primary-fixed border-2 border-primary' : 'bg-surface border border-outline-variant'} rounded-xl p-4 flex flex-col lg:grid lg:grid-cols-12 lg:items-center gap-4 cursor-pointer relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all`}
                    >
                      {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>}
                      
                      <div className="col-span-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-outline text-xl">devices</span>
                        <span className={`text-base font-semibold ${isSelected ? 'text-primary' : 'text-on-surface'}`}>#{shortId}</span>
                      </div>
                      
                      <div className="col-span-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-surface border border-primary/20 text-primary' : 'bg-surface-container-high border border-outline-variant text-on-surface-variant'}`}>
                            {item.reporter?.name?.substring(0, 2).toUpperCase() || 'UN'}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${isSelected ? 'text-on-primary-fixed' : 'text-on-surface'}`}>{item.reporter?.name || 'Unknown'}</p>
                            <p className={`text-xs font-semibold ${isSelected ? 'text-primary/70' : 'text-on-surface-variant'}`}>Found: {item.location_found}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="col-span-3 flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          item.status === 'claimed' ? 'bg-success/10 text-success border-success/20' : 
                          'bg-warning/10 text-warning border-warning/20'
                        }`}>
                          {item.status === 'claimed' ? 'Claimed' : 'Pending Verification'}
                        </span>
                      </div>
                      
                      <div className="col-span-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-2xl font-bold ${isSelected ? 'text-on-primary-fixed' : 'text-on-surface'}`}>{pendingClaimsCount}</span>
                          <span className={`text-xs font-semibold uppercase ${isSelected ? 'text-primary/70' : 'text-on-surface-variant'}`}>Claims</span>
                        </div>
                      </div>
                      
                      <div className="col-span-2 flex justify-end gap-2">
                        <button className={`w-8 h-8 rounded border flex items-center justify-center transition-colors ${isSelected ? 'border-primary/20 text-primary bg-surface/50 hover:bg-surface' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container-low hover:text-primary'}`}>
                          <Eye size={16} />
                        </button>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Right Hand Detail Panel */}
        {selectedItem && (
          <aside className="w-full xl:w-[400px] h-full bg-surface border-l border-outline-variant flex flex-col flex-shrink-0 z-10 shadow-[-4px_0_12px_0_rgba(0,0,0,0.02)]">
            <div className="p-6 border-b border-outline-variant bg-surface-container-lowest">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-semibold text-primary tracking-widest uppercase mb-1">Active Selection</p>
                  <h2 className="text-2xl font-bold text-on-surface">{selectedItem.title}</h2>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-1 rounded bg-surface-container-high border border-outline-variant text-xs font-semibold text-on-surface">ID: #{selectedItem.id.substring(0,8).toUpperCase()}</span>
                {selectedItem.category && <span className="px-2 py-1 rounded bg-surface-container-high border border-outline-variant text-xs font-semibold text-on-surface">{selectedItem.category}</span>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {selectedItem.image_url ? (
                <div className="w-full aspect-video rounded-lg border border-outline-variant overflow-hidden relative group">
                  <img src={selectedItem.image_url} alt="Item Proof" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-full aspect-video rounded-lg border border-outline-variant bg-surface-container flex items-center justify-center text-outline-variant">
                  No Image Available
                </div>
              )}

              <div>
                <h3 className="text-base font-semibold text-on-surface mb-2">Pending Claims ({selectedItem.claims?.filter((c:any) => c.status === 'pending').length || 0})</h3>
                <div className="space-y-4">
                  {selectedItem.claims?.filter((c:any) => c.status === 'pending').map((claim: any) => (
                    <div key={claim.id} className="p-4 rounded-lg border border-outline-variant bg-surface-container-lowest flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center font-bold text-sm">
                            {claim.claimant?.name?.substring(0,2).toUpperCase() || 'ST'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-on-surface">{claim.claimant?.name || 'Unknown Student'}</p>
                            <p className="text-xs text-on-surface-variant">{new Date(claim.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-on-surface-variant p-3 bg-surface rounded border border-outline-variant">
                        "{claim.verification_proof}"
                      </p>
                      <div className="flex gap-2 mt-1">
                        <button 
                          onClick={() => handleRejectClaim(claim.id)}
                          className="flex-1 py-2 rounded border border-outline-variant text-xs font-semibold hover:bg-surface-container-low transition-colors text-critical"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveClaim(claim.id, selectedItem.id)}
                          disabled={isApproving}
                          className="flex-1 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors disabled:opacity-50"
                        >
                          {isApproving ? 'Issuing token…' : 'Approve'}
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {(!selectedItem.claims || selectedItem.claims.filter((c:any) => c.status === 'pending').length === 0) && (
                    <div className="p-4 rounded-lg border border-dashed border-outline-variant text-center text-sm text-on-surface-variant">
                      No pending claims for this item.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}
        </>
        )}
      </main>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-on-background/60 backdrop-blur-sm transition-opacity" onClick={() => setShowQrModal(false)}></div>
          <div className="relative w-full max-w-sm bg-surface rounded-xl shadow-2xl overflow-hidden flex flex-col border border-outline-variant z-10">
            <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
              <h3 className="text-2xl font-semibold text-on-surface">Release Authorization</h3>
              <button onClick={() => setShowQrModal(false)} className="text-on-surface-variant hover:text-critical p-1">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 flex flex-col items-center bg-surface-bright relative">
              <p className="text-sm text-on-surface-variant text-center mb-6">Have the claimant present this signed, single-use code at the Security Desk to release Item #{selectedItem?.id.substring(0,8).toUpperCase()}.</p>

              <div className="relative w-48 h-48 bg-white p-2 rounded-lg border-2 border-primary/20 shadow-inner overflow-hidden flex justify-center items-center">
                 <QRCodeSVG value={qrValue} size={160} />
                 {/* Decorative scanline */}
                 <div className="absolute top-1/2 left-0 w-full h-0.5 bg-success shadow-[0_0_8px_2px_rgba(16,185,129,0.5)]"></div>
              </div>

              <div className="mt-6 px-4 py-2 bg-primary-fixed rounded-full flex items-center gap-2">
                <ShieldCheck className="text-primary" size={18} />
                <span className="text-xs font-bold text-primary tracking-wide">CRYPTOGRAPHICALLY SIGNED · SINGLE USE</span>
              </div>
            </div>

            <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant">
              <TokenExpiryBar expiresAt={qrExpiresAt} />
            </div>
          </div>
        </div>
      )}

      {showScannerModal && (
        <PickupScannerModal
          onClose={() => setShowScannerModal(false)}
          onReleased={() => {
            setShowScannerModal(false);
            setShowQrModal(false);
            setItems((prev) => prev.map((item) => (item.id === selectedItem?.id ? { ...item, status: 'claimed' } : item)));
          }}
        />
      )}
    </div>
  );
}

function TokenExpiryBar({ expiresAt }: { expiresAt: string | null }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!expiresAt || now === null) {
    return (
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-on-surface-variant">Code Expiration</span>
        <span className="text-sm font-bold text-on-surface-variant tracking-wider font-mono">—</span>
      </div>
    );
  }

  const totalMs = 24 * 60 * 60 * 1000;
  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - now);
  const remainingSeconds = Math.floor(remainingMs / 1000);
  const hours = String(Math.floor(remainingSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(remainingSeconds % 60).padStart(2, '0');
  const percentRemaining = Math.max(2, Math.round((remainingMs / totalMs) * 100));

  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-on-surface-variant">Code Expiration</span>
        <span className="text-sm font-bold text-critical tracking-wider font-mono">{hours}:{minutes}:{seconds}</span>
      </div>
      <div className="w-full h-2 bg-outline-variant/30 rounded-full overflow-hidden">
        <div className="h-full bg-critical rounded-full shadow-[0_0_5px_rgba(225,29,72,0.4)] transition-all" style={{ width: `${percentRemaining}%` }}></div>
      </div>
    </>
  );
}

function ActiveLockersView({ items }: { items: any[] }) {
  const lockerItems = items.filter((item) => item.status === 'handover_to_admin');

  return (
    <section className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="px-6 py-6 bg-surface border-b border-outline-variant flex-shrink-0">
        <h1 className="text-3xl md:text-4xl font-semibold text-on-surface mb-2">Active Lockers</h1>
        <p className="text-base text-on-surface-variant">Items currently held in physical storage awaiting claimant pickup.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6 bg-surface-bright">
        {lockerItems.length === 0 ? (
          <div className="p-8 rounded-lg border border-dashed border-outline-variant text-center text-sm text-on-surface-variant">
            No items are currently held in the locker.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {lockerItems.map((item) => (
              <div key={item.id} className="bg-surface border border-outline-variant rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-warning/10 border border-warning/20 flex items-center justify-center text-warning">
                  <Lock size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-on-surface">{item.title}</p>
                  <p className="text-xs text-on-surface-variant">#{item.id.substring(0, 8).toUpperCase()} · Reported by {item.reporter?.name || 'Unknown'}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-warning/10 text-warning border-warning/20">
                  Awaiting Pickup
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AuditTrailsView({ items }: { items: any[] }) {
  const processedClaims = items
    .flatMap((item) => (item.claims || []).map((claim: any) => ({ ...claim, item })))
    .filter((claim) => claim.status === 'approved' || claim.status === 'rejected')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <section className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="px-6 py-6 bg-surface border-b border-outline-variant flex-shrink-0">
        <h1 className="text-3xl md:text-4xl font-semibold text-on-surface mb-2">Audit Trails</h1>
        <p className="text-base text-on-surface-variant">An unalterable record of every claim decision and the admin who processed it.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6 bg-surface-bright">
        {processedClaims.length === 0 ? (
          <div className="p-8 rounded-lg border border-dashed border-outline-variant text-center text-sm text-on-surface-variant">
            No claims have been processed yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {processedClaims.map((claim) => (
              <div key={claim.id} className="bg-surface border border-outline-variant rounded-xl p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                  claim.status === 'approved' ? 'bg-success/10 text-success border-success/20' : 'bg-error/10 text-error border-error/20'
                }`}>
                  <ShieldCheck size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-on-surface">{claim.item?.title} — {claim.claimant?.name || 'Unknown claimant'}</p>
                  <p className="text-xs text-on-surface-variant">
                    {claim.status === 'approved' ? 'Approved' : 'Rejected'} by {claim.processor?.name || 'an administrator'} · {new Date(claim.created_at).toLocaleString()}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border uppercase tracking-wider ${
                  claim.status === 'approved' ? 'bg-success/10 text-success border-success/20' : 'bg-error/10 text-error border-error/20'
                }`}>
                  {claim.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
