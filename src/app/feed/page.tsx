'use client';

import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal, PackageOpen, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import BottomNav from '@/components/BottomNav';
import ItemCard, { ItemCardProps } from '@/components/ItemCard';
import NotificationBell from '@/components/NotificationBell';

const CATEGORIES = ['All Items', 'Electronics', 'Documents', 'Keys', 'Personal Items', 'Identification'];
const STATUSES = ['All', 'Lost', 'Found'];

export default function FeedPage() {
  const [items, setItems] = useState<ItemCardProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All Items');
  const [activeStatus, setActiveStatus] = useState('All');
  const [institutionName, setInstitutionName] = useState('CampusFind');
  const [institutionInitial, setInstitutionInitial] = useState('C');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();
        
        // Get user & institution
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userData } = await supabase
            .from('users')
            .select('institution_id, role, institutions(name)')
            .eq('id', user.id)
            .single();

          if (userData?.role) setUserRole(userData.role);

          if (userData?.institutions && Array.isArray(userData.institutions)) {
             // Handle array if somehow joined differently, though single should return object. 
             // We'll just safely access it.
          } else if (userData?.institutions && typeof userData.institutions === 'object') {
            const instName = (userData.institutions as any).name;
            if (instName) {
              setInstitutionName(instName);
              setInstitutionInitial(instName.charAt(0).toUpperCase());
            }
          }
        }

        // Fetch items
        const { data: itemsData, error } = await supabase
          .from('items')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (itemsData) {
          const mappedItems: ItemCardProps[] = itemsData.map((item: any) => {
            let tags: {label: string, value: string}[] = [];
            if (item.ai_tags && typeof item.ai_tags === 'object') {
              const aiTags = item.ai_tags;
              if (aiTags.brand) tags.push({ label: 'Brand', value: aiTags.brand });
              if (aiTags.color) tags.push({ label: 'Color', value: aiTags.color });
              if (aiTags.material) tags.push({ label: 'Material', value: aiTags.material });
            }
            
            const isHighValue = item.ai_tags && typeof item.ai_tags === 'object' && 'high_value' in item.ai_tags
               ? Boolean(item.ai_tags.high_value)
               : false;

            return {
              id: item.id,
              title: item.title,
              status: item.status,
              location: item.location_found || 'Unknown Location',
              category: item.category,
              imageUrl: item.image_url,
              createdAt: item.created_at,
              isHighValue,
              tags
            };
          });
          setItems(mappedItems);
        }
      } catch (error: any) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load items. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All Items' || item.category === activeCategory;
    const matchesStatus = activeStatus === 'All' || item.status.toLowerCase() === activeStatus.toLowerCase();
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="bg-surface text-on-surface antialiased min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant">
        <div className="flex justify-between items-center w-full px-4 md:px-6 h-16 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="md:hidden h-8 w-8 bg-surface-container-high rounded-full flex items-center justify-center text-primary font-bold shadow-sm">
              {institutionInitial}
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-primary tracking-tight">
              <span className="hidden md:inline">{institutionName} Ledger</span>
              <span className="md:hidden">CampusFind</span>
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant">
              <Search size={20} />
            </button>
            {(userRole === 'campus_admin' || userRole === 'super_admin') && (
              <Link
                href="/admin"
                aria-label="Admin Dashboard"
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant"
              >
                <ShieldCheck size={20} />
              </Link>
            )}
            <NotificationBell />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-6 pb-24 md:pb-10">
        {/* Sticky Search & Filter Bar */}
        <div className="sticky top-[64px] z-30 bg-surface/90 backdrop-blur-md pb-4 pt-2 mb-6 border-b border-border shadow-sm mx-[-16px] px-4 md:mx-0 md:px-0">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant" size={18} />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
              />
            </div>
            <button className="px-3 py-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface-variant hover:text-primary hover:border-primary transition-colors flex items-center justify-center">
              <SlidersHorizontal size={18} />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => setActiveStatus(status)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    activeStatus === status
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
            
            <div className="flex overflow-x-auto no-scrollbar gap-2 pb-1">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    activeCategory === category
                      ? 'bg-secondary-container text-on-secondary-container shadow-sm'
                      : 'bg-surface border border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid Area */}
        {loading ? (
          <div className="masonry-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="masonry-item bg-surface-container-lowest border border-border rounded-xl overflow-hidden animate-pulse">
                <div className="h-12 border-b border-border bg-surface-container-low"></div>
                <div className="aspect-video bg-surface-container"></div>
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-surface-container-high rounded w-3/4"></div>
                  <div className="h-3 bg-surface-container-high rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <motion.div layout className="masonry-grid">
            <AnimatePresence mode="popLayout">
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <ItemCard {...item} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-outline-variant rounded-2xl bg-surface-container-lowest"
          >
            <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mb-4">
              <PackageOpen className="text-outline" size={32} />
            </div>
            <h3 className="text-lg font-semibold text-on-surface mb-2">No items found</h3>
            <p className="text-sm text-on-surface-variant max-w-sm">
              We couldn't find any items matching your current filters. Try adjusting your search or category selection.
            </p>
            {(searchQuery || activeCategory !== 'All Items' || activeStatus !== 'All') && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('All Items');
                  setActiveStatus('All');
                }}
                className="mt-6 px-6 py-2 bg-primary-container text-on-primary-container rounded-lg text-sm font-semibold hover:bg-primary-fixed transition-colors"
              >
                Clear all filters
              </button>
            )}
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
