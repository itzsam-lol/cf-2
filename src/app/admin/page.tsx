'use client';

import { Search, LayoutGrid, ShieldCheck, History, Loader2, Package, Users, CheckCircle2, MessageCircle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import AccuracyMeter from '@/components/AccuracyMeter';
import ChatPanel from '@/components/ChatPanel';

interface AdminClaim {
  id: string;
  claimant_id: string;
  verification_proof: string;
  status: string;
  ai_match_score: number | null;
  ai_analysis: string | null;
  created_at: string;
  claimant?: { name: string; email: string } | null;
  processor?: { name: string } | null;
}
interface AdminItem {
  id: string;
  title: string;
  status: string;
  category: string;
  location_found: string;
  image_url: string | null;
  created_at: string;
  reporter?: { name: string; email: string } | null;
  claims: AdminClaim[];
}

export default function AdminOversightPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [institutionName, setInstitutionName] = useState('CampusFind');
  const [view, setView] = useState<'overview' | 'claims' | 'audit'>('overview');
  const [userId, setUserId] = useState<string | null>(null);
  const [chatClaim, setChatClaim] = useState<AdminClaim | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.href = '/login'; return; }
        setUserId(user.id);

        const { data: userData } = await supabase
          .from('users').select('role, institution_id, institutions(name)').eq('id', user.id).single();

        if (!userData || (userData.role !== 'campus_admin' && userData.role !== 'super_admin')) {
          toast.error('Admin privileges required.');
          window.location.href = '/feed';
          return;
        }
        if (userData.institutions) {
          const n = Array.isArray(userData.institutions) ? userData.institutions[0]?.name : (userData.institutions as any)?.name;
          if (n) setInstitutionName(n);
        }

        const { data: itemsData, error } = await supabase
          .from('items')
          .select(`*, reporter:users!reporter_id(name, email),
            claims(id, claimant_id, verification_proof, status, ai_match_score, ai_analysis, created_at, claimant:users!claims_claimant_id_fkey(name, email), processor:users!claims_processed_by_fkey(name))`)
          .eq('institution_id', userData.institution_id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setItems((itemsData as unknown as AdminItem[]) || []);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load oversight data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const allClaims = items.flatMap((it) => (it.claims || []).map((c) => ({ ...c, item: it })));
  const activeClaims = allClaims.filter((c) => c.status === 'pending');
  const resolvedClaims = allClaims.filter((c) => c.status === 'approved' || c.status === 'rejected')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const returnedCount = items.filter((i) => i.status === 'claimed').length;

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-surface"><Loader2 className="animate-spin text-primary" size={48} /></div>;
  }

  const NavBtn = ({ v, icon: Icon, label }: { v: typeof view; icon: any; label: string }) => (
    <button onClick={() => setView(v)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-semibold text-left ${view === v ? 'bg-primary-fixed text-on-primary-fixed' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
      <Icon size={22} /><span className="text-base">{label}</span>
    </button>
  );

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col md:flex-row">
      <nav className="md:w-72 md:fixed md:h-full bg-surface-container-low border-b md:border-b-0 md:border-r border-outline-variant py-6 px-3 flex flex-col">
        <div className="px-3 mb-6">
          <span className="text-2xl font-bold text-primary block">CampusFind</span>
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">{institutionName} · Oversight</span>
        </div>
        <div className="flex md:flex-col gap-2">
          <NavBtn v="overview" icon={LayoutGrid} label="Overview" />
          <NavBtn v="claims" icon={ShieldCheck} label="Active Claims" />
          <NavBtn v="audit" icon={History} label="Audit Trail" />
        </div>
        <div className="mt-auto hidden md:block px-3 pt-6">
          <p className="text-xs text-on-surface-variant leading-relaxed">You can monitor all reports, claims and conversations. Handovers happen directly between students — admins observe only.</p>
        </div>
      </nav>

      <main className="flex-1 md:ml-72 p-6 max-w-5xl">
        {view === 'overview' && (
          <>
            <h1 className="text-3xl font-semibold mb-1">Overview</h1>
            <p className="text-on-surface-variant mb-6">A live picture of lost & found activity across {institutionName}.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Package} label="Total items" value={items.length} />
              <StatCard icon={Users} label="Active claims" value={activeClaims.length} />
              <StatCard icon={CheckCircle2} label="Returned" value={returnedCount} />
              <StatCard icon={ShieldCheck} label="Resolved" value={resolvedClaims.length} />
            </div>
            <h2 className="text-lg font-semibold mb-3">All items</h2>
            <div className="space-y-3">
              {items.length === 0 && <Empty label="No items reported yet." />}
              {items.map((it) => (
                <div key={it.id} className="bg-background border border-border rounded-xl p-4 flex items-center gap-4">
                  {it.image_url ? <img src={it.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center"><Package size={18} className="text-outline" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{it.title}</p>
                    <p className="text-xs text-on-surface-variant">{it.location_found} · by {it.reporter?.name || 'Unknown'} · {(it.claims || []).length} claim(s)</p>
                  </div>
                  <StatusPill status={it.status} />
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'claims' && (
          <>
            <h1 className="text-3xl font-semibold mb-1">Active Claims</h1>
            <p className="text-on-surface-variant mb-6">Pending ownership claims with their AI match confidence.</p>
            <div className="space-y-4">
              {activeClaims.length === 0 && <Empty label="No active claims right now." />}
              {activeClaims.map((c) => (
                <div key={c.id} className="bg-background border border-border rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold">{c.item.title}</p>
                      <p className="text-xs text-on-surface-variant">{c.claimant?.name || 'Student'} → finder {c.item.reporter?.name || 'Unknown'} · {new Date(c.created_at).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => setChatClaim(c)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-xs font-semibold hover:bg-surface-container-low"><MessageCircle size={14} /> View chat</button>
                  </div>
                  <AccuracyMeter score={c.ai_match_score} />
                  {c.ai_analysis && <p className="text-xs text-on-surface-variant bg-surface-container-low border border-border rounded-lg p-2.5 mt-3"><span className="font-semibold text-primary">AI: </span>{c.ai_analysis}</p>}
                  <p className="text-sm text-on-surface-variant bg-surface-container-lowest rounded-lg p-3 border border-border mt-3">&ldquo;{c.verification_proof}&rdquo;</p>
                </div>
              ))}
            </div>
          </>
        )}

        {view === 'audit' && (
          <>
            <h1 className="text-3xl font-semibold mb-1">Audit Trail</h1>
            <p className="text-on-surface-variant mb-6">Every resolved claim and who actioned it.</p>
            <div className="space-y-3">
              {resolvedClaims.length === 0 && <Empty label="No claims resolved yet." />}
              {resolvedClaims.map((c) => (
                <div key={c.id} className="bg-background border border-border rounded-xl p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${c.status === 'approved' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}><ShieldCheck size={18} /></div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{c.item.title} — {c.claimant?.name || 'Unknown'}</p>
                    <p className="text-xs text-on-surface-variant">{c.status === 'approved' ? 'Returned' : 'Rejected'} · finder {c.item.reporter?.name || 'Unknown'} · AI {c.ai_match_score ?? '—'}%</p>
                  </div>
                  <StatusPill status={c.status} />
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {chatClaim && userId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-on-background/60 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="bg-surface w-full max-w-md rounded-2xl overflow-hidden shadow-xl flex flex-col h-[70vh]">
            <div className="px-4 py-3 border-b border-outline-variant flex justify-between items-center">
              <span className="font-semibold text-sm">Conversation oversight</span>
              <button onClick={() => setChatClaim(null)} className="text-on-surface-variant hover:text-error p-1"><X size={20} /></button>
            </div>
            <div className="flex-1 p-3">
              <ChatPanel claimId={chatClaim.id} currentUserId={userId} readOnly />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-background border border-border rounded-xl p-4">
      <Icon size={20} className="text-primary mb-2" />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-on-surface-variant">{label}</p>
    </div>
  );
}
function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    claimed: 'bg-success/15 text-success', approved: 'bg-success/15 text-success',
    rejected: 'bg-error/15 text-error', lost: 'bg-[#fffbeb] text-[#d97706]',
    found: 'bg-secondary-container text-on-secondary-container',
  };
  const label = status === 'claimed' ? 'Returned' : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${map[status] || 'bg-surface-container-high text-on-surface-variant'}`}>{label}</span>;
}
function Empty({ label }: { label: string }) {
  return <div className="p-8 rounded-xl border border-dashed border-outline-variant text-center text-sm text-on-surface-variant">{label}</div>;
}
