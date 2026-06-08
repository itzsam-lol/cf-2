'use client';

import { MapPin, EyeOff, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

export interface ItemCardProps {
  id: string;
  title: string;
  status: 'lost' | 'found' | string;
  location: string;
  category: string;
  imageUrl?: string | null;
  createdAt: string;
  isHighValue?: boolean;
  tags?: { label: string; value: string }[];
}

function getRelativeTime(dateString: string) {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const timeMs = new Date(dateString).getTime();
  const deltaSeconds = Math.round((timeMs - Date.now()) / 1000);
  const cutoffs = [
    60,
    3600,
    86400,
    86400 * 7,
    86400 * 30,
    86400 * 365,
    Infinity,
  ];
  const units: Intl.RelativeTimeFormatUnit[] = [
    'second',
    'minute',
    'hour',
    'day',
    'week',
    'month',
    'year',
  ];
  const unitIndex = cutoffs.findIndex((cutoff) => cutoff > Math.abs(deltaSeconds));
  const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;
  return rtf.format(Math.floor(deltaSeconds / divisor), units[unitIndex]);
}

export default function ItemCard({
  id,
  title,
  status,
  location,
  category,
  imageUrl,
  createdAt,
  isHighValue,
  tags = [],
}: ItemCardProps) {
  return (
    <Link href={`/item/${id}`} className="block">
      <motion.article 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.3 }}
        className="masonry-item bg-surface border border-border rounded-xl overflow-hidden hover:shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] transition-shadow duration-200"
      >
        <div className="p-4 border-b border-border flex justify-between items-center">
          {status === 'lost' ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#fffbeb] text-[#d97706]">
              Lost
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-secondary-container text-on-secondary-container">
              Found
            </span>
          )}
          <span className="text-label-md text-outline">
            {getRelativeTime(createdAt)}
          </span>
        </div>

        {imageUrl ? (
          <div className="relative aspect-video border-b border-border bg-surface-container-low">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('${imageUrl}')` }}
            />
            {isHighValue && (
              <div className="absolute inset-0 blur-overlay flex items-center justify-center flex-col">
                <EyeOff className="text-primary mb-2" size={32} />
                <span className="text-xs font-semibold text-on-surface bg-background/80 px-3 py-1 rounded-full">
                  High Value Item - Details Hidden
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="relative aspect-video border-b border-border bg-surface-container-low flex items-center justify-center">
            <Package className="text-outline-variant" size={48} />
          </div>
        )}

        <div className="p-4">
          <h3 className="text-body-md font-semibold text-on-surface truncate mb-2">
            {title}
          </h3>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 rounded-md bg-surface-container-high text-on-surface-variant text-xs font-semibold"
                >
                  {tag.label}: {tag.value}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 text-outline">
            <MapPin size={14} />
            <span className="text-xs font-semibold">{location}</span>
          </div>
        </div>
      </motion.article>
    </Link>
  );
}
