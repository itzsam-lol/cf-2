'use client';

import { Shield, Clock, MapPin, User, ArrowLeft, Search, Loader2, Pencil, Trash2, X, CheckCircle2, MessageCircle, KeyRound, ScanLine, QrCode, Flag } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import AccuracyMeter from '@/components/AccuracyMeter';
import ChatPanel from '@/components/ChatPanel';
import PickupScannerModal from '@/components/PickupScannerModal';

interface ItemData {
  id: string;
  title: string;
  status: string;
  category: string;
  image_url: string | null;
  created_at: string;
  location_found: string;
  description: string;
  ai_tags: Record<string, unknown> | null;
  reporter_id: string;
  secret_hint: string | null;
  returned_at: string | null;
  reporter: { name: string; email: string } | null;
}

interface ClaimRow {
  id: string;
  claimant_id: string;
  verification_proof: string;
  status: string;
  ai_match_score: number | null;
  ai_analysis: string | null;
  created_at: string;
  claimant?: { name: string } | null;
}

interface DisputeRow {
  id: string;
  status: string;
  reason: string;
  reporter_id: string;
  receiver_id: string | null;
  finder_id: string;
  created_at: string;
  reporter?: { name: string } | null;
  receiver?: { name: string } | null;
  finder?: { name: string } | null;
}

const RETURN_WINDOW_MS = 24 * 60 * 60 * 1000;

const CATEGORIES = ['Electronics', 'Identification', 'Personal Items', 'Documents', 'Keys'];

export default function ItemDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [myClaim, setMyClaim] = useState<ClaimRow | null>(null);
  const [myToken, setMyToken] = useState<{ token: string; expires_at: string; used_at: string | null } | null>(null);
  const [editing, setEditing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [reporting, setReporting] = useState(false);

  const isOwner = !!item && !!userId && item.reporter_id === userId;
  const isHighValue = item?.ai_tags && typeof item.ai_tags === 'object' && 'high_value' in item.ai_tags
    ? Boolean(item.ai_tags.high_value) : false;

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const { data, error } = await supabase
      .from('items')
      .select('*, reporter:users!reporter_id(name, email)')
      .eq('id', id)
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }
    const itemData = data as unknown as ItemData;
    setItem(itemData);

    if (user) {
      if (itemData.reporter_id === user.id) {
        const { data: claimRows } = await supabase
          .from('claims')
          .select('id, claimant_id, verification_proof, status, ai_match_score, ai_analysis, created_at, claimant:users!claims_claimant_id_fkey(name)')
          .eq('item_id', id)
          .order('ai_match_score', { ascending: false, nullsFirst: false });
        setClaims((claimRows as unknown as ClaimRow[]) || []);
      } else {
        const { data: mine } = await supabase
          .from('claims')
          .select('id, claimant_id, verification_proof, status, ai_match_score, ai_analysis, created_at')
          .eq('item_id', id)
          .eq('claimant_id', user.id)
          .maybeSingle();
        const mineClaim = (mine as unknown as ClaimRow) || null;
        setMyClaim(mineClaim);
        // Once approved, the receiver gets a signed pickup QR to show the finder.
        if (mineClaim && mineClaim.status === 'approved') {
          const { data: tok } = await supabase
            .from('pickup_tokens')
            .select('token, expires_at, used_at')
            .eq('claim_id', mineClaim.id)
            .maybeSingle();
          setMyToken((tok as { token: string; expires_at: string; used_at: string | null }) || null);
        } else {
          setMyToken(null);
        }
      }

      // Disputes on this item that the viewer can see (participant or admin).
      const { data: disputeRows } = await supabase
        .from('claim_disputes')
        .select('id, status, reason, reporter_id, receiver_id, finder_id, created_at, reporter:users!reporter_id(name), receiver:users!receiver_id(name), finder:users!finder_id(name)')
        .eq('item_id', id)
        .order('created_at', { ascending: false });
      setDisputes((disputeRows as unknown as DisputeRow[]) || []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const handleDelete = async () => {
    if (!confirm('Delete this item permanently? This cannot be undone.')) return;
    const supabase = createClient();
    const { error } = await supabase.from('items').delete().eq('id', id);
    if (error) { toast.error('Failed to delete item'); return; }
    toast.success('Item deleted');
    router.push('/ledger');
  };

  const handleResolve = async (claim: ClaimRow, approve: boolean) => {
    if (approve) {
      // Approve + mint the receiver's pickup QR (item is marked returned only
      // once the finder scans that QR at the physical handover).
      const res = await fetch(`/api/claims/${claim.id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error(data?.error || 'Failed to approve claim'); return; }
      toast.success('Approved — scan the receiver’s QR at handover to complete the return.');
      load();
    } else {
      const supabase = createClient();
      const { error } = await supabase
        .from('claims')
        .update({ status: 'rejected', processed_by: userId })
        .eq('id', claim.id);
      if (error) { toast.error('Failed to update claim'); return; }
      toast('Claim rejected');
      load();
    }
  };

  const closeDispute = async (disputeId: string) => {
    const res = await fetch(`/api/disputes/${disputeId}/close`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { toast.error(data?.error || 'Failed to close dispute'); return; }
    toast.success('Dispute resolved — transaction finalized.');
    load();
  };

  const getRelativeTime = (dateString: string) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const deltaSeconds = Math.round((new Date(dateString).getTime() - Date.now()) / 1000);
    const cutoffs = [60, 3600, 86400, 86400 * 7, 86400 * 30, 86400 * 365, Infinity];
    const units: Intl.RelativeTimeFormatUnit[] = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'];
    const unitIndex = cutoffs.findIndex((c) => c > Math.abs(deltaSeconds));
    const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;
    return rtf.format(Math.floor(deltaSeconds / divisor), units[unitIndex]);
  };

  if (loading) {
    return (
      <div className="bg-surface min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="bg-surface text-on-surface min-h-screen flex flex-col items-center justify-center gap-4 p-8">
        <Search className="text-outline-variant" size={48} />
        <h2 className="text-xl font-semibold">Item Not Found</h2>
        <Link href="/feed" className="mt-2 bg-primary text-on-primary px-6 py-2.5 rounded-lg font-semibold">Back to Feed</Link>
      </div>
    );
  }

  const aiTags = item.ai_tags as Record<string, unknown> | null;
  const tagChips = aiTags
    ? [aiTags.category && { label: 'Category', value: String(aiTags.category) },
       aiTags.color && { label: 'Color', value: String(aiTags.color) },
       aiTags.brand && { label: 'Brand', value: String(aiTags.brand) }].filter(Boolean) as { label: string; value: string }[]
    : [];

  const returnedAtMs = item.returned_at ? new Date(item.returned_at).getTime() : null;
  const withinReturnWindow = returnedAtMs !== null && now - returnedAtMs < RETURN_WINDOW_MS;
  const iAmReceiver = !!myClaim && myClaim.status === 'approved';
  const alreadyReported = disputes.some((d) => d.reporter_id === userId);
  const canReport = !!userId && item.status === 'claimed' && withinReturnWindow && !isOwner && !iAmReceiver && !alreadyReported;
  const windowHoursLeft = returnedAtMs !== null ? Math.max(0, Math.ceil((RETURN_WINDOW_MS - (now - returnedAtMs)) / (60 * 60 * 1000))) : 0;

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen flex flex-col relative pb-24">
      <header className="bg-surface w-full border-b border-outline-variant flex justify-between items-center px-4 md:px-6 h-16 max-w-5xl mx-auto w-full z-50 sticky top-0">
        <div className="flex items-center gap-2">
          <Link href="/feed" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low text-on-surface-variant">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-2xl font-bold text-primary">CampusFind</h1>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          item.status === 'claimed' ? 'bg-success/15 text-success'
            : item.status === 'lost' ? 'bg-[#fffbeb] text-[#d97706]' : 'bg-secondary-container text-on-secondary-container'
        }`}>
          {item.status === 'claimed' ? 'Returned' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </div>
      </header>

      <main className="flex-grow max-w-5xl mx-auto w-full">
        {/* Image */}
        <section className="relative w-full aspect-video bg-surface-container-highest overflow-hidden">
          {item.image_url ? (
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${item.image_url}')`, filter: isHighValue && !isOwner ? 'blur(8px)' : 'none' }} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-container"><Search className="text-outline-variant" size={64} /></div>
          )}
          {isHighValue && !isOwner && (
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 bg-inverse-surface/90 backdrop-blur-sm p-3 rounded-xl">
              <Shield className="text-warning" size={18} />
              <p className="text-xs text-inverse-on-surface">Security blur active — verify details to claim.</p>
            </div>
          )}
        </section>

        <div className="px-4 py-6 flex flex-col gap-6">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold">{item.title}</h2>
              <div className="flex items-center gap-2 text-sm text-on-surface-variant mt-1">
                <Clock size={16} /><span>Reported {getRelativeTime(item.created_at)}</span>
              </div>
            </div>
            {isOwner && (
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setEditing(true)} className="w-10 h-10 rounded-full border border-outline-variant flex items-center justify-center hover:bg-surface-container-low" title="Edit">
                  <Pencil size={18} />
                </button>
                <button onClick={handleDelete} className="w-10 h-10 rounded-full border border-error/30 text-error flex items-center justify-center hover:bg-error/10" title="Delete">
                  <Trash2 size={18} />
                </button>
              </div>
            )}
          </div>

          {tagChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tagChips.map((tag, i) => (
                <span key={i} className="bg-surface-container-low border border-outline-variant px-3 py-1.5 rounded-lg text-xs font-semibold">{tag.label}: {tag.value}</span>
              ))}
            </div>
          )}

          {item.description && (
            <section>
              <h3 className="text-base font-semibold mb-2">Description</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed bg-surface-container-low rounded-lg p-4 border border-border">{item.description}</p>
            </section>
          )}

          <section className="bg-background border border-border rounded-xl overflow-hidden">
            <div className="flex gap-4 p-4 border-b border-border items-center">
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary shrink-0"><MapPin size={20} /></div>
              <div><p className="text-xs text-on-surface-variant uppercase tracking-wider mb-0.5">Location</p><p className="text-base font-medium">{item.location_found}</p></div>
            </div>
            <div className="flex gap-4 p-4 items-center">
              <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant shrink-0"><User size={20} /></div>
              <div><p className="text-xs text-on-surface-variant uppercase tracking-wider mb-0.5">Reported By</p><p className="text-base font-medium">{item.reporter?.name || 'Anonymous'}</p></div>
            </div>
          </section>

          {/* Returned banner + report-this-claim (24h window) */}
          {item.status === 'claimed' && item.returned_at && (
            <section className={`rounded-xl p-4 border ${withinReturnWindow ? 'bg-success/5 border-success/20' : 'bg-surface-container-low border-border'}`}>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-success mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-on-surface">Item returned {getRelativeTime(item.returned_at)}</p>
                  {withinReturnWindow ? (
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      This post stays visible for ~{windowHoursLeft}h. If the wrong person received this item, you can report it during this window.
                    </p>
                  ) : (
                    <p className="text-xs text-on-surface-variant mt-0.5">The reporting window has closed and this return is final.</p>
                  )}
                  {canReport && (
                    <button onClick={() => setReporting(true)} className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-error/40 text-error text-xs font-semibold hover:bg-error/5">
                      <Flag size={14} /> Report this claim
                    </button>
                  )}
                  {alreadyReported && <p className="text-xs text-error mt-2 font-semibold">You’ve reported this return — see the dispute below.</p>}
                </div>
              </div>
            </section>
          )}

          {/* Dispute threads (visible to participants and admins) */}
          {disputes.map((d) => (
            <section key={d.id} className="rounded-xl border border-error/30 bg-error/5 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><Flag size={16} className="text-error" /><h3 className="text-sm font-semibold text-on-surface">Disputed return</h3></div>
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${d.status === 'open' ? 'bg-error/15 text-error' : 'bg-success/15 text-success'}`}>{d.status}</span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Reported by <span className="font-semibold">{d.reporter?.name || 'a student'}</span> · finder <span className="font-semibold">{d.finder?.name || '—'}</span> · received by <span className="font-semibold">{d.receiver?.name || '—'}</span>
              </p>
              <p className="text-sm text-on-surface bg-surface-container-lowest rounded-lg p-3 border border-border">&ldquo;{d.reason}&rdquo;</p>
              <div className="h-[320px]">
                <ChatPanel disputeId={d.id} currentUserId={userId!} readOnly={d.status === 'closed'} />
              </div>
              {d.finder_id === userId && d.status === 'open' && (
                <button onClick={() => closeDispute(d.id)} className="w-full py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container">
                  Resolve &amp; finalize transaction
                </button>
              )}
              {d.status === 'closed' && <p className="text-xs text-success font-semibold text-center">Resolved by the finder — transaction finalized.</p>}
            </section>
          ))}

          {/* Owner: their private secret */}
          {isOwner && item.secret_hint && (
            <section className="bg-primary-fixed/40 border border-primary/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1.5"><KeyRound size={16} className="text-primary" /><h3 className="text-sm font-semibold text-on-surface">Your private verification secret</h3></div>
              <p className="text-sm text-on-surface-variant">{item.secret_hint}</p>
              <p className="text-xs text-on-surface-variant/80 mt-1">Only you can see this. Claimants are scored by how well their answer matches it.</p>
            </section>
          )}

          {/* Owner: claims on this item */}
          {isOwner && (
            <section>
              <h3 className="text-lg font-semibold mb-3">Ownership claims ({claims.length})</h3>
              {claims.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-outline-variant text-center text-sm text-on-surface-variant">No one has claimed this item yet.</div>
              ) : (
                <div className="space-y-4">
                  {claims.map((claim) => (
                    <OwnerClaimCard key={claim.id} claim={claim} userId={userId!} itemClaimed={item.status === 'claimed'} onResolve={handleResolve} onScan={() => setScanning(true)} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Claimant: my claim status + pickup QR + chat */}
          {!isOwner && myClaim && (
            <section className="space-y-4">
              <div className="bg-background border border-border rounded-xl p-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-base font-semibold">Your claim</h3>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${
                    myClaim.status === 'approved' ? 'bg-success/15 text-success' : myClaim.status === 'rejected' ? 'bg-error/15 text-error' : 'bg-warning/15 text-warning'
                  }`}>{myClaim.status === 'approved' ? 'Approved' : myClaim.status}</span>
                </div>
                <AccuracyMeter score={myClaim.ai_match_score} />
              </div>

              {/* Pickup QR — shown once the finder approves; the finder scans it
                  at handover to complete the return. */}
              {myClaim.status === 'approved' && (
                <div className="bg-surface-container-lowest border border-border rounded-xl p-5 flex flex-col items-center">
                  {item.status === 'claimed' || myToken?.used_at ? (
                    <div className="w-full flex flex-col items-center gap-2 py-4 text-center">
                      <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center"><CheckCircle2 size={28} className="text-success" /></div>
                      <p className="font-semibold text-success">Handover complete</p>
                      <p className="text-xs text-on-surface-variant">This item has been returned to you. It’s now in your history.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1"><QrCode size={18} className="text-primary" /><h3 className="text-base font-semibold">Your pickup QR</h3></div>
                      <p className="text-xs text-on-surface-variant text-center mb-4 max-w-xs">Show this to the finder when you meet. They scan it to confirm the handover and record the return.</p>
                      {myToken ? (
                        <>
                          <div className="bg-white p-3 rounded-xl border border-border shadow-sm mb-3"><QRCodeSVG value={myToken.token} size={180} fgColor="#1E3A8A" /></div>
                          <PickupCountdown expiresAt={myToken.expires_at} now={now} />
                        </>
                      ) : (
                        <div className="w-[180px] h-[180px] flex items-center justify-center text-sm text-on-surface-variant text-center px-4">Generating your pickup code…</div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="h-[440px]">
                <ChatPanel claimId={myClaim.id} currentUserId={userId!} otherPartyName={item.reporter?.name} />
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Non-owner, no claim yet → file claim CTA */}
      {!isOwner && !myClaim && item.status !== 'claimed' && (
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-0 left-0 w-full bg-background border-t border-border p-4 pb-safe z-40">
          <div className="max-w-5xl mx-auto">
            <Link href={`/claim/${item.id}`} className="w-full bg-primary hover:bg-primary-container text-on-primary transition-all rounded-lg py-3.5 px-6 flex items-center justify-center gap-2 font-semibold">
              <Shield size={20} /> File an Ownership Claim
            </Link>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {editing && item && (
          <EditItemModal item={item} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
        )}
      </AnimatePresence>

      {scanning && (
        <PickupScannerModal
          onClose={() => setScanning(false)}
          onReleased={() => { setScanning(false); load(); }}
        />
      )}

      <AnimatePresence>
        {reporting && (
          <ReportDisputeModal itemId={id} onClose={() => setReporting(false)} onFiled={() => { setReporting(false); load(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function ReportDisputeModal({ itemId, onClose, onFiled }: { itemId: string; onClose: () => void; onFiled: () => void }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 10) { toast.error('Please add a bit more detail (at least 10 characters).'); return; }
    setSubmitting(true);
    const res = await fetch('/api/disputes/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, reason }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { toast.error(data?.error || 'Failed to file report'); return; }
    toast.success('Report filed — a dispute chat is now open.');
    onFiled();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-on-background/60 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }} className="bg-surface w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Flag size={18} className="text-error" /> Report this claim</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error p-1"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-sm text-on-surface-variant">
            If you believe the wrong person received this item, describe what happened. This opens a private chat with the finder and the person who received it so it can be sorted out.
          </p>
          <textarea
            rows={4} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. This is my laptop — I never received it, and the photo matches the one I lost in Block C…"
            className="edit-input resize-none"
          />
          <p className="text-xs text-on-surface-variant">False or abusive reports are tied to your verified campus identity and visible to admins.</p>
        </div>
        <div className="px-5 py-4 border-t border-outline-variant flex gap-3 bg-surface-container-lowest">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-outline-variant font-semibold hover:bg-surface-container-low">Cancel</button>
          <button onClick={submit} disabled={submitting} className="flex-1 py-2.5 rounded-lg bg-error text-on-error font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && <Loader2 size={16} className="animate-spin" />} File report
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PickupCountdown({ expiresAt, now }: { expiresAt: string; now: number }) {
  const remainingMs = new Date(expiresAt).getTime() - now;
  if (remainingMs <= 0) {
    return <span className="text-xs font-semibold text-error">This pickup code has expired — ask the finder to re-approve.</span>;
  }
  const total = Math.floor(remainingMs / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return (
    <span className="text-xs font-semibold text-on-surface-variant">
      Valid for {h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`}
    </span>
  );
}

function OwnerClaimCard({ claim, userId, itemClaimed, onResolve, onScan }: { claim: ClaimRow; userId: string; itemClaimed: boolean; onResolve: (c: ClaimRow, approve: boolean) => void; onScan: () => void; }) {
  const [showChat, setShowChat] = useState(false);
  return (
    <div className="bg-background border border-border rounded-xl p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm">
            {claim.claimant?.name?.substring(0, 2).toUpperCase() || 'ST'}
          </div>
          <div>
            <p className="text-sm font-semibold">{claim.claimant?.name || 'Student'}</p>
            <p className="text-xs text-on-surface-variant">{new Date(claim.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
          claim.status === 'approved' ? 'bg-success/15 text-success' : claim.status === 'rejected' ? 'bg-error/15 text-error' : 'bg-warning/15 text-warning'
        }`}>{claim.status === 'approved' ? 'Approved' : claim.status}</span>
      </div>

      <div className="mb-3"><AccuracyMeter score={claim.ai_match_score} /></div>

      {claim.ai_analysis && (
        <p className="text-xs text-on-surface-variant bg-surface-container-low border border-border rounded-lg p-2.5 mb-3"><span className="font-semibold text-primary">AI: </span>{claim.ai_analysis}</p>
      )}

      <p className="text-sm text-on-surface-variant bg-surface-container-lowest rounded-lg p-3 border border-border mb-3">&ldquo;{claim.verification_proof}&rdquo;</p>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setShowChat((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-outline-variant text-xs font-semibold hover:bg-surface-container-low">
          <MessageCircle size={14} /> {showChat ? 'Hide chat' : 'Chat'}
        </button>
        {claim.status === 'pending' && !itemClaimed && (
          <>
            <button onClick={() => onResolve(claim, false)} className="flex-1 py-2 rounded-lg border border-outline-variant text-xs font-semibold text-error hover:bg-error/5">Reject</button>
            <button onClick={() => onResolve(claim, true)} className="flex-1 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container">Approve handover</button>
          </>
        )}
        {claim.status === 'approved' && !itemClaimed && (
          <button onClick={onScan} className="flex-1 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-primary-container">
            <ScanLine size={14} /> Scan receiver’s QR
          </button>
        )}
        {claim.status === 'approved' && itemClaimed && (
          <span className="flex-1 py-2 rounded-lg bg-success/10 text-success text-xs font-semibold flex items-center justify-center gap-1.5">
            <CheckCircle2 size={14} /> Handover complete
          </span>
        )}
      </div>

      {showChat && (
        <div className="mt-3 h-[360px]">
          <ChatPanel claimId={claim.id} currentUserId={userId} otherPartyName={claim.claimant?.name} />
        </div>
      )}
    </div>
  );
}

function EditItemModal({ item, onClose, onSaved }: { item: ItemData; onClose: () => void; onSaved: () => void; }) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [category, setCategory] = useState(item.category);
  const [location, setLocation] = useState(item.location_found);
  const [secret, setSecret] = useState(item.secret_hint || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !category || !location.trim()) { toast.error('Title, category and location are required'); return; }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('items').update({
      title: title.trim(), description: description.trim(), category, location_found: location.trim(),
      secret_hint: secret.trim() || null, updated_at: new Date().toISOString(),
    }).eq('id', item.id);
    setSaving(false);
    if (error) { toast.error('Failed to save changes'); return; }
    toast.success('Item updated');
    onSaved();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-on-background/60 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.96, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 16 }} className="bg-surface w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
          <h3 className="text-lg font-semibold">Edit item</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error p-1"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className="edit-input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="edit-input">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} className="edit-input" /></Field>
          </div>
          <Field label="Description"><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="edit-input resize-none" /></Field>
          {item.status !== 'lost' && (
            <Field label="Private verification secret"><textarea rows={2} value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Detail only the owner would know" className="edit-input resize-none" /></Field>
          )}
        </div>
        <div className="px-5 py-4 border-t border-outline-variant flex gap-3 bg-surface-container-lowest">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-outline-variant font-semibold hover:bg-surface-container-low">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-primary text-on-primary font-semibold hover:bg-primary-container disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />} Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-on-surface uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
