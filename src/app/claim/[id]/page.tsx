'use client';

import { useState, use } from 'react';
import { Camera, AlertCircle, ArrowLeft, Send, Loader2, ShieldCheck, CheckCircle2, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import AccuracyMeter from '@/components/AccuracyMeter';

export default function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [proof, setProof] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proof.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/claims/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: id, proof }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          toast('You already filed a claim for this item.');
          setIsSubmitted(true);
          setScore(null);
          return;
        }
        throw new Error(data?.error || 'Failed to submit claim');
      }
      setScore(typeof data.score === 'number' ? data.score : null);
      setIsSubmitted(true);
      toast.success('Claim submitted — AI verified your answer.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit claim.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="bg-surface text-on-surface antialiased min-h-screen flex flex-col">
        <header className="bg-surface w-full border-b border-outline-variant flex justify-between items-center px-4 md:px-6 h-16 max-w-7xl mx-auto z-50 sticky top-0">
          <div className="flex items-center gap-2">
            <Link href="/feed" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-2xl font-bold text-primary">CampusFind</h1>
          </div>
        </header>

        <main className="flex-1 max-w-md mx-auto w-full px-4 md:px-6 py-12 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 size={40} className="text-success" />
          </div>
          <h2 className="text-3xl font-semibold text-on-surface mb-3">Claim Submitted</h2>
          {score !== null && (
            <div className="w-full bg-surface-container-lowest border border-border rounded-xl p-5 mb-6">
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-3">AI match confidence</p>
              <AccuracyMeter score={score} />
              <p className="text-xs text-on-surface-variant mt-3">
                The finder can see this score and will review your claim. Use chat to coordinate the handover.
              </p>
            </div>
          )}
          <p className="text-base text-on-surface-variant mb-8 max-w-md">
            The student who found this item has been notified. You can message them directly to arrange a safe handover on campus.
          </p>
          <div className="flex flex-col gap-3 w-full">
            <Link href={`/item/${id}`} className="bg-primary hover:bg-primary-container text-on-primary font-semibold px-8 py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
              <MessageCircle size={18} /> Open chat &amp; track claim
            </Link>
            <Link href="/feed" className="text-on-surface-variant font-semibold px-8 py-3 rounded-lg hover:bg-surface-container-low transition-colors">
              Return to Feed
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen flex flex-col">
      {/* TopAppBar */}
      <header className="bg-surface w-full border-b border-outline-variant flex justify-between items-center px-4 md:px-6 h-16 max-w-7xl mx-auto z-50 sticky top-0">
        <div className="flex items-center gap-2">
          <Link href={`/item/${id}`} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-2xl font-bold text-primary">CampusFind</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 md:px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="text-primary" size={28} />
            <h1 className="text-3xl md:text-4xl font-semibold text-on-surface tracking-tight">Identity Verification</h1>
          </div>
          <p className="text-base text-on-surface-variant max-w-xl">
            To prevent false claims and protect the original owner, you must provide specific, non-public details about this item.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="bg-background border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-start gap-4 mb-6 p-4 rounded-lg bg-surface-container-lowest border border-outline-variant">
              <AlertCircle className="text-warning shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="text-sm font-bold text-on-surface mb-1">What constitutes valid proof?</h3>
                <ul className="text-xs text-on-surface-variant space-y-1 list-disc list-inside">
                  <li>Specific scratches or dents not visible in the public photo</li>
                  <li>Serial numbers or IMEI codes</li>
                  <li>Unique lock-screen wallpapers or account names</li>
                  <li>Receipts or invoice copies matching the exact item</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="proof-desc" className="text-sm font-semibold text-on-surface uppercase tracking-wider">
                Written Evidence <span className="text-error">*</span>
              </label>
              <textarea
                id="proof-desc"
                rows={5}
                value={proof}
                onChange={(e) => setProof(e.target.value)}
                placeholder="Describe specific unique identifiers (e.g. 'It has a small scratch near the charging port, and the lock screen is a picture of a golden retriever')..."
                className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary outline-none resize-none transition-shadow"
                required
              />
            </div>
            
            <div className="mt-6 border-t border-border pt-6">
              <label className="text-sm font-semibold text-on-surface uppercase tracking-wider block mb-3">
                Photographic Evidence (Optional)
              </label>
              <div className="border-2 border-dashed border-outline-variant rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-surface-container-low transition-colors cursor-pointer group">
                <div className="w-12 h-12 bg-surface-container-high rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Camera size={20} className="text-on-surface-variant" />
                </div>
                <p className="text-sm font-semibold text-on-surface mb-1">Upload a receipt or prior photo</p>
                <p className="text-xs text-on-surface-variant">PNG, JPG, or PDF up to 5MB</p>
                <span className="mt-4 px-4 py-1.5 rounded-full bg-surface-container text-xs font-semibold text-on-surface-variant">Currently disabled in beta</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pb-8">
            <p className="text-xs text-on-surface-variant max-w-sm text-center sm:text-left">
              By submitting this claim, you attest that you are the lawful owner. False claims may result in disciplinary action.
            </p>
            <button
              type="submit"
              disabled={isSubmitting || !proof}
              className="w-full sm:w-auto bg-primary hover:bg-primary-container text-on-primary font-semibold px-8 py-3.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Submit Claim
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
