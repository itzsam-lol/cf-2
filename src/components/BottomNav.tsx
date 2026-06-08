'use client';

import { Home, PlusCircle, FileText, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/feed', label: 'Feed', icon: Home },
    { href: '/report', label: 'Report', icon: PlusCircle },
    { href: '/ledger', label: 'Ledger', icon: FileText },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 pb-safe bg-surface border-t border-outline-variant shadow-sm">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center px-6 py-1 transition-all duration-200 ${
              isActive
                ? 'bg-secondary-container text-on-secondary-container rounded-full scale-95 shadow-sm'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span className={`text-xs font-semibold tracking-wide mt-1 ${isActive ? 'font-bold' : ''}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
