'use client';

import { useState, useEffect } from 'react';
import { LogOut, User as UserIcon, Shield, Settings, History, Package, CheckCircle2, Hourglass, LayoutDashboard, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ itemsReported: 0, successfulReturns: 0, activeClaims: 0 });

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('*, institutions(name)')
            .eq('id', user.id)
            .single();

          setUser(userData);

          const [reportedRes, returnedRes, claimsRes] = await Promise.all([
            supabase.from('items').select('id', { count: 'exact', head: true }).eq('reporter_id', user.id),
            supabase.from('items').select('id', { count: 'exact', head: true }).eq('reporter_id', user.id).eq('status', 'claimed'),
            supabase.from('claims').select('id', { count: 'exact', head: true }).eq('claimant_id', user.id).eq('status', 'pending'),
          ]);

          setStats({
            itemsReported: reportedRes.count || 0,
            successfulReturns: returnedRes.count || 0,
            activeClaims: claimsRes.count || 0,
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    window.location.href = '/login';
  };

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen flex flex-col pb-24 md:pb-10">
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant px-4 h-16 flex items-center justify-between max-w-7xl mx-auto w-full">
        <h1 className="text-xl md:text-2xl font-bold text-primary">My Profile</h1>
        <Link
          href="/settings"
          aria-label="Settings"
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant"
        >
          <Settings size={20} />
        </Link>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        {loading ? (
          <div className="animate-pulse flex flex-col gap-6">
            <div className="h-24 bg-surface-container rounded-xl"></div>
            <div className="h-40 bg-surface-container rounded-xl"></div>
          </div>
        ) : (
          <>
            <div className="bg-surface-container-lowest border border-border rounded-xl p-6 mb-6 flex items-center gap-6 shadow-sm">
              <div className="w-20 h-20 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center text-2xl font-bold">
                {user?.name?.substring(0,2).toUpperCase() || 'ST'}
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-on-surface mb-1">{user?.name || 'Student'}</h2>
                <p className="text-sm text-on-surface-variant flex items-center gap-2">
                  <Shield size={14} className="text-primary" />
                  {(user?.institutions as any)?.name || 'Campus Member'}
                </p>
                <span className="inline-block mt-2 px-2.5 py-0.5 bg-surface-container-high rounded text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  {user?.role || 'student'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-surface-container-lowest border border-border rounded-xl p-4 flex flex-col items-center text-center gap-1 shadow-sm">
                <Package size={20} className="text-primary" />
                <span className="text-xl font-bold text-on-surface">{stats.itemsReported}</span>
                <span className="text-xs text-on-surface-variant">Items Reported</span>
              </div>
              <div className="bg-surface-container-lowest border border-border rounded-xl p-4 flex flex-col items-center text-center gap-1 shadow-sm">
                <CheckCircle2 size={20} className="text-success" />
                <span className="text-xl font-bold text-on-surface">{stats.successfulReturns}</span>
                <span className="text-xs text-on-surface-variant">Successful Returns</span>
              </div>
              <div className="bg-surface-container-lowest border border-border rounded-xl p-4 flex flex-col items-center text-center gap-1 shadow-sm">
                <Hourglass size={20} className="text-warning" />
                <span className="text-xl font-bold text-on-surface">{stats.activeClaims}</span>
                <span className="text-xs text-on-surface-variant">Active Claims</span>
              </div>
            </div>

            {(user?.role === 'campus_admin' || user?.role === 'super_admin') && (
              <div className="space-y-4 mb-8">
                <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Administration</h3>

                <Link href="/admin" className="w-full flex items-center justify-between p-4 bg-primary-container/30 border border-primary/20 rounded-xl hover:bg-primary-container/50 transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <LayoutDashboard size={20} className="text-primary" />
                    <span className="font-semibold text-on-surface">Admin Dashboard</span>
                  </div>
                  <ChevronRight size={18} className="text-on-surface-variant" />
                </Link>

                {user?.role === 'super_admin' && (
                  <Link href="/super-admin" className="w-full flex items-center justify-between p-4 bg-primary-container/30 border border-primary/20 rounded-xl hover:bg-primary-container/50 transition-colors text-left">
                    <div className="flex items-center gap-3">
                      <Shield size={20} className="text-primary" />
                      <span className="font-semibold text-on-surface">Super Admin Console</span>
                    </div>
                    <ChevronRight size={18} className="text-on-surface-variant" />
                  </Link>
                )}
              </div>
            )}

            <div className="space-y-4 mb-8">
              <h3 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Account Settings</h3>

              <Link href="/settings" className="w-full flex items-center justify-between p-4 bg-surface-container-lowest border border-outline-variant rounded-xl hover:bg-surface-container-low transition-colors text-left">
                <div className="flex items-center gap-3">
                  <UserIcon size={20} className="text-on-surface-variant" />
                  <span className="font-semibold text-on-surface">Personal Information</span>
                </div>
              </Link>

              <Link href="/ledger" className="w-full flex items-center justify-between p-4 bg-surface-container-lowest border border-outline-variant rounded-xl hover:bg-surface-container-low transition-colors text-left">
                <div className="flex items-center gap-3">
                  <History size={20} className="text-on-surface-variant" />
                  <span className="font-semibold text-on-surface">Activity History</span>
                </div>
              </Link>

              <Link href="/settings" className="w-full flex items-center justify-between p-4 bg-surface-container-lowest border border-outline-variant rounded-xl hover:bg-surface-container-low transition-colors text-left">
                <div className="flex items-center gap-3">
                  <Settings size={20} className="text-on-surface-variant" />
                  <span className="font-semibold text-on-surface">Preferences</span>
                </div>
              </Link>
            </div>

            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 p-4 bg-error-container text-on-error-container font-semibold rounded-xl hover:bg-error hover:text-on-error transition-colors"
            >
              <LogOut size={20} />
              Log Out
            </button>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
