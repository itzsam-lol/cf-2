'use client';

import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';

// Visual confidence meter for an AI-scored ownership claim (0-100).
export default function AccuracyMeter({ score, size = 'md' }: { score: number | null; size?: 'sm' | 'md' }) {
  if (score === null || score === undefined) {
    return (
      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        <ShieldQuestion size={16} />
        <span>Not yet verified</span>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, Math.round(score)));
  const tier =
    pct >= 75 ? { label: 'Strong match', color: 'var(--color-success)', Icon: ShieldCheck }
      : pct >= 45 ? { label: 'Partial match', color: 'var(--color-warning)', Icon: ShieldAlert }
        : { label: 'Weak match', color: 'var(--color-critical)', Icon: ShieldAlert };

  const Icon = tier.Icon;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5" style={{ color: tier.color }}>
          <Icon size={size === 'sm' ? 14 : 16} />
          <span className={`font-semibold ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>{tier.label}</span>
        </div>
        <span className={`font-bold tabular-nums ${size === 'sm' ? 'text-xs' : 'text-sm'}`} style={{ color: tier.color }}>
          {pct}%
        </span>
      </div>
      <div className={`w-full ${size === 'sm' ? 'h-1.5' : 'h-2.5'} bg-surface-container-high rounded-full overflow-hidden`}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: tier.color }}
        />
      </div>
    </div>
  );
}
