'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const POLL_INTERVAL_MS = 30000;

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!cancelled) setNotifications(data || []);
    }

    loadNotifications();
    const interval = setInterval(loadNotifications, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    const supabase = createClient();
    await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)));
  };

  const handleSelect = async (notification: Notification) => {
    if (!notification.is_read) await markAsRead([notification.id]);
    setOpen(false);
    if (notification.link) router.push(notification.link);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-surface border border-outline-variant rounded-xl shadow-xl overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between bg-surface-container-lowest">
              <span className="text-sm font-semibold text-on-surface">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAsRead(notifications.filter((n) => !n.is_read).map((n) => n.id))}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  <Check size={12} />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-on-surface-variant">
                  You&apos;re all caught up.
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleSelect(notification)}
                    className={`w-full text-left px-4 py-3 border-b border-outline-variant last:border-b-0 transition-colors flex gap-3 ${
                      notification.is_read ? 'bg-surface hover:bg-surface-container-low' : 'bg-primary-container/10 hover:bg-primary-container/20'
                    }`}
                  >
                    <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      notification.type === 'ai_match' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      <Sparkles size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${notification.is_read ? 'text-on-surface-variant' : 'text-on-surface font-semibold'}`}>
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{notification.body}</p>
                      )}
                      <p className="text-[10px] text-outline mt-1">{new Date(notification.created_at).toLocaleString()}</p>
                    </div>
                    {!notification.is_read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
