'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try { localStorage.setItem('cf-theme', theme); } catch {}
}

// Compact segmented Light/Dark switch for the settings/preferences screen.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); setTheme(currentTheme()); }, []);

  const choose = (t: Theme) => { setTheme(t); applyTheme(t); };

  if (!mounted) {
    return <div className="h-10 w-[168px] rounded-full bg-surface-container-low animate-pulse" />;
  }

  return (
    <div className="inline-flex p-1 rounded-full bg-surface-container-low border border-outline-variant">
      <button
        onClick={() => choose('light')}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
          theme === 'light' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
        }`}
        aria-pressed={theme === 'light'}
      >
        <Sun size={16} /> Light
      </button>
      <button
        onClick={() => choose('dark')}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
          theme === 'dark' ? 'bg-surface-container-high shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
        }`}
        aria-pressed={theme === 'dark'}
      >
        <Moon size={16} /> Dark
      </button>
    </div>
  );
}
