'use client';

import { Shield, Verified, Clock, MapPin, Lock, User, ArrowLeft, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

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
  reporter: { name: string; email: string } | null;
}

export default function ItemDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [item, setItem] = useState<ItemData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItem = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('items')
        .select('*, reporter:users!reporter_id(name, email)')
        .eq('id', id)
        .single();

      if (error) {
        toast.error('Failed to load item details');
        console.error(error);
      } else {
        setItem(data as unknown as ItemData);
      }
      setLoading(false);
    };
    fetchItem();
  }, [id]);

  const isHighValue = item?.ai_tags && typeof item.ai_tags === 'object' && 'high_value' in item.ai_tags
    ? Boolean(item.ai_tags.high_value)
    : false;

  const getRelativeTime = (dateString: string) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const deltaSeconds = Math.round((new Date(dateString).getTime() - Date.now()) / 1000);
    const cutoffs = [60, 3600, 86400, 86400 * 7, 86400 * 30, 86400 * 365, Infinity];
    const units: Intl.RelativeTimeFormatUnit[] = ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'];
    const unitIndex = cutoffs.findIndex((c) => c > Math.abs(deltaSeconds));
    const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;
    return rtf.format(Math.floor(deltaSeconds / divisor), units[unitIndex]);
  };

  const aiTags = item?.ai_tags as Record<string, unknown> | null;
  const tagChips = aiTags
    ? [
        aiTags.category && { label: 'Category', value: String(aiTags.category) },
        aiTags.color && { label: 'Color', value: String(aiTags.color) },
        aiTags.brand && { label: 'Brand', value: String(aiTags.brand) },
      ].filter(Boolean) as { label: string; value: string }[]
    : [];

  if (loading) {
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
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      </div>
    );
  }

  if (!item) {
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
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <Search className="text-outline-variant" size={48} />
          <h2 className="text-xl font-semibold text-on-surface">Item Not Found</h2>
          <p className="text-on-surface-variant text-center">This item may have been claimed or removed from the ledger.</p>
          <Link href="/feed" className="mt-4 bg-primary text-on-primary px-6 py-2.5 rounded-lg font-semibold hover:bg-primary-container transition-colors">
            Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen flex flex-col relative">
      <header className="bg-surface w-full border-b border-outline-variant flex justify-between items-center px-4 md:px-6 h-16 max-w-7xl mx-auto z-50 sticky top-0">
        <div className="flex items-center gap-2">
          <Link href="/feed" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-2xl font-bold text-primary">CampusFind</h1>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          item.status === 'lost' ? 'bg-[#fffbeb] text-[#d97706]' : 'bg-secondary-container text-on-secondary-container'
        }`}>
          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex-grow pb-[88px] overflow-y-auto no-scrollbar"
      >
        {/* Image Section */}
        <section className="relative w-full aspect-square md:aspect-video bg-surface-container-highest overflow-hidden">
          {item.image_url ? (
            <div
              className="absolute inset-0 bg-cover bg-center scale-105"
              style={{ backgroundImage: `url('${item.image_url}')`, filter: isHighValue ? 'blur(8px)' : 'none' }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-container">
              <Search className="text-outline-variant" size={64} />
            </div>
          )}
          {isHighValue && (
            <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-background/80 via-background/20 to-transparent">
              <div className="flex items-start gap-3 bg-inverse-surface/90 backdrop-blur-sm p-4 rounded-xl border border-outline-variant/30">
                <Shield className="text-warning mt-0.5" fill="currentColor" />
                <div>
                  <p className="text-sm text-inverse-on-surface font-medium mb-1">Security Blur Active</p>
                  <p className="text-xs text-surface-dim opacity-90 leading-relaxed">Image selectively blurred for campus security. Verify specific details below.</p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Content Section */}
        <div className="px-4 py-6 max-w-3xl mx-auto flex flex-col gap-6">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col gap-3"
          >
            <div className="flex justify-between items-start gap-4">
              <h2 className="text-2xl md:text-3xl font-semibold text-on-surface">{item.title}</h2>
              <div className="bg-surface-variant text-primary px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shrink-0 mt-1">
                <Verified size={16} />
                Verified
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <Clock size={18} />
              <span>Reported {getRelativeTime(item.created_at)}</span>
            </div>

            {tagChips.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tagChips.map((tag, i) => (
                  <span key={i} className="bg-surface-container-low border border-outline-variant text-on-surface px-3 py-1.5 rounded-lg text-xs font-semibold">
                    {tag.label}: {tag.value}
                  </span>
                ))}
              </div>
            )}
          </motion.section>

          {item.description && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <h3 className="text-base font-semibold text-on-surface mb-2">Description</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed bg-surface-container-low rounded-lg p-4 border border-border">
                {item.description}
              </p>
            </motion.section>
          )}

          <hr className="border-border" />

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-4"
          >
            <h3 className="text-base font-semibold text-on-surface">Inspection Details</h3>
            <div className="bg-background border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="flex gap-4 p-4 border-b border-border items-center">
                <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary shrink-0">
                  <MapPin size={20} />
                </div>
                <div className="flex-grow">
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-0.5">Campus Location</p>
                  <p className="text-base text-on-surface font-medium">{item.location_found}</p>
                </div>
              </div>

              <div className="flex gap-4 p-4 border-b border-border items-center">
                <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-primary-fixed-variant shrink-0">
                  <Lock size={20} />
                </div>
                <div className="flex-grow">
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-0.5">Storage Status</p>
                  <p className="text-base text-on-surface font-medium">
                    {item.status === 'handover_to_admin' ? 'Secured by Admin' :
                     item.status === 'claimed' ? 'Item Claimed' : 'Awaiting Admin Pickup'}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 items-center">
                <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant shrink-0">
                  <User size={20} />
                </div>
                <div className="flex-grow">
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider mb-0.5">Reported By</p>
                  <p className="text-base text-on-surface font-medium">
                    {item.reporter?.name || 'Anonymous Reporter'}
                  </p>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </motion.main>

      {item.status !== 'claimed' && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-0 left-0 w-full bg-background border-t border-border p-4 pb-safe z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
        >
          <div className="max-w-3xl mx-auto">
            <Link
              href={`/claim/${item.id}`}
              className="w-full bg-primary hover:bg-primary-container text-on-primary active:scale-[0.98] transition-all duration-200 rounded-lg py-3.5 px-6 flex items-center justify-center gap-2 shadow-sm font-semibold"
            >
              <Shield size={20} />
              File an Ownership Claim
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
