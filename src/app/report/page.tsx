'use client';

import { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, Sparkles, AlertCircle, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, Loader2, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import BottomNav from '@/components/BottomNav';

export default function ReportPage() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [status, setStatus] = useState<'lost' | 'found'>('found');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [secret, setSecret] = useState('');
  const [isHighValue, setIsHighValue] = useState(false);
  
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      setStep(2);
    }
  };

  const handleProcessAI = async () => {
    if (!description) {
      toast.error('Please enter a description to process');
      return;
    }
    
    setIsProcessingAI(true);
    try {
      const res = await fetch('/api/extract-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });
      
      if (!res.ok) throw new Error('AI processing failed');
      
      const data = await res.json();
      setAiResult(data);
      
      // Auto-fill form
      if (data.category && !category) setCategory(data.category);
      if (data.brand && !brand) setBrand(data.brand);
      if (data.color && !color) setColor(data.color);
      
      toast.success('AI successfully extracted item details');
    } catch (err) {
      toast.error('AI Processing Failed');
      console.error(err);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleSubmit = async () => {
    if (!category || !location) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      
      // 1. Get user and institution
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: userData } = await supabase
        .from('users')
        .select('institution_id')
        .eq('id', user.id)
        .single();
        
      if (!userData?.institution_id) throw new Error('User has no institution');

      // 2. Upload Image
      let uploadedUrl = null;
      let originalImageUrl = null;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('isHighValue', String(isHighValue));

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!uploadRes.ok) throw new Error('Image upload failed');
        const uploadData = await uploadRes.json();
        uploadedUrl = uploadData.url;
        // For high-value items the public url is pre-blurred; keep the
        // original around (admin-only) for physical verification.
        if (isHighValue) originalImageUrl = uploadData.originalUrl;
      }

      // 3. Insert into Database
      const title = `${brand || ''} ${category} - ${color || ''}`.trim() || category;
      const aiTags: Record<string, unknown> = {
        ...(aiResult || {}),
        brand: brand || aiResult?.brand || null,
        color: color || aiResult?.color || null,
        high_value: isHighValue,
      };
      if (originalImageUrl) aiTags.original_image_url = originalImageUrl;

      const { data: inserted, error } = await supabase.from('items').insert({
        institution_id: userData.institution_id,
        reporter_id: user.id,
        title,
        description,
        ai_tags: aiTags,
        category,
        image_url: uploadedUrl,
        location_found: location,
        // Private detail only the finder knows — never shown publicly; the AI
        // uses it to score how well a claimant's answer matches.
        secret_hint: status === 'found' && secret.trim() ? secret.trim() : null,
        status
      }).select('id').single();

      if (error) throw error;

      // 4. Trigger proactive matching for newly reported "found" items
      if (status === 'found' && inserted?.id) {
        fetch('/api/match-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: inserted.id })
        }).catch((e) => console.error('Matching engine trigger failed:', e));
      }

      toast.success('Item successfully reported to ledger');
      setTimeout(() => window.location.href = '/feed', 2000);

    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
      console.error(err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface font-sans antialiased min-h-screen flex flex-col">
      <main className="flex-1 pb-24 md:pb-8 pt-8 md:pt-10 px-4 md:px-6 max-w-5xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold text-on-surface mb-2 tracking-tight">Report an Item</h1>
          <p className="text-base text-on-surface-variant max-w-2xl">Submit details for a lost or found item to enter it into the ledger.</p>
        </div>

        <div className="bg-background rounded-xl border border-border shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[600px]">
          {/* Main Form Area */}
          <div className="flex-1 flex flex-col relative">
            
            {/* Step Indicators */}
            <div className="flex gap-2 p-6 border-b border-border bg-surface-container-lowest shrink-0">
              {[1, 2, 3].map((s) => (
                <div 
                  key={s} 
                  className={`h-2 flex-1 rounded-full transition-colors duration-300 ${step >= s ? 'bg-primary' : 'bg-surface-container'}`}
                />
              ))}
            </div>

            <div className="p-6 md:p-8 flex-1 flex flex-col relative overflow-hidden">
              <AnimatePresence mode="wait">
                
                {/* STEP 1: UPLOAD */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col h-full justify-center"
                  >
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-outline-variant rounded-xl p-8 flex flex-col items-center justify-center min-h-[300px] hover:bg-surface-container-low transition-colors cursor-pointer group"
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        accept="image/*" 
                        className="hidden" 
                      />
                      <div className="w-20 h-20 bg-surface-container-high rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                        <Camera size={36} className="text-primary" />
                      </div>
                      <h2 className="text-2xl font-semibold text-on-surface mb-3">Snap or Upload Photo</h2>
                      <p className="text-sm text-on-surface-variant text-center max-w-sm mb-8 leading-relaxed">
                        High-value identifiers are automatically blurred by backend AI models to protect privacy before entry into the public ledger.
                      </p>
                      <button className="bg-primary hover:bg-primary-container text-on-primary font-semibold px-6 py-2.5 rounded-lg flex items-center gap-2 transition-colors">
                        <Upload size={18} />
                        Select File
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: DETAILS */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col h-full space-y-6 overflow-y-auto no-scrollbar pb-10"
                  >
                    <div className="flex gap-4">
                      {previewUrl && (
                        <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0 border border-border">
                          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <h2 className="text-2xl font-semibold text-on-surface">Item Details</h2>
                        <p className="text-sm text-on-surface-variant">Provide context for the ledger entry.</p>
                      </div>
                    </div>

                    <div className="flex bg-surface-container-low p-1 rounded-lg">
                      <button 
                        onClick={() => setStatus('found')}
                        className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${status === 'found' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
                      >
                        I Found This
                      </button>
                      <button 
                        onClick={() => setStatus('lost')}
                        className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${status === 'lost' ? 'bg-surface shadow-sm text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}`}
                      >
                        I Lost This
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-on-surface uppercase tracking-wider">Category <span className="text-error">*</span></label>
                        <select 
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2.5 text-sm text-on-surface focus:ring-2 focus:ring-primary outline-none"
                        >
                          <option value="">Select category...</option>
                          <option value="Electronics">Electronics</option>
                          <option value="Identification">Identification</option>
                          <option value="Personal Items">Personal Items</option>
                          <option value="Documents">Documents</option>
                          <option value="Keys">Keys</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-on-surface uppercase tracking-wider">Location <span className="text-error">*</span></label>
                        <input 
                          type="text" 
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g. Mechanical Lab 2" 
                          className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2.5 text-sm text-on-surface focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-on-surface uppercase tracking-wider">Brand</label>
                        <input 
                          type="text" 
                          value={brand}
                          onChange={(e) => setBrand(e.target.value)}
                          placeholder="e.g. Apple" 
                          className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2.5 text-sm text-on-surface focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-on-surface uppercase tracking-wider">Color</label>
                        <input 
                          type="text" 
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          placeholder="e.g. Space Grey" 
                          className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2.5 text-sm text-on-surface focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-on-surface uppercase tracking-wider">Description</label>
                      <textarea 
                        rows={3} 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe any distinguishing features..."
                        className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary outline-none resize-none"
                      />
                      <button 
                        onClick={handleProcessAI}
                        disabled={isProcessingAI || !description}
                        className="text-primary text-xs font-semibold flex items-center gap-1.5 mt-2 hover:text-primary-fixed-variant transition-colors disabled:opacity-50"
                      >
                        {isProcessingAI ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {isProcessingAI ? 'Analyzing...' : 'Auto-extract details with AI'}
                      </button>
                    </div>

                    <label className="flex items-start gap-3 p-4 border border-outline-variant rounded-lg bg-surface-container-lowest cursor-pointer hover:bg-surface-container-low transition-colors">
                      <div className="pt-0.5">
                        <input 
                          type="checkbox" 
                          checked={isHighValue}
                          onChange={(e) => setIsHighValue(e.target.checked)}
                          className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary" 
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle size={16} className="text-warning" />
                          <span className="text-sm font-semibold text-on-surface">Flag as High-Value</span>
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">Images will be automatically blurred to prevent false claims. Specific details will be hidden from the public feed.</p>
                      </div>
                    </label>

                    {status === 'found' && (
                      <div className="space-y-1.5 p-4 border border-primary/30 rounded-lg bg-primary-fixed/40">
                        <div className="flex items-center gap-2 mb-1">
                          <ShieldCheck size={16} className="text-primary" />
                          <label className="text-xs font-semibold text-on-surface uppercase tracking-wider">
                            Private verification secret
                          </label>
                          <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">AI-protected</span>
                        </div>
                        <textarea
                          rows={2}
                          value={secret}
                          onChange={(e) => setSecret(e.target.value)}
                          placeholder="A detail only the real owner would know (e.g. 'cracked top-left corner', 'lock screen is a husky', sticker on the back)…"
                          className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary outline-none resize-none"
                        />
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          Never shown publicly. When someone claims this item, our AI compares their answer to your secret and gives you a match-accuracy score.
                        </p>
                      </div>
                    )}

                    <div className="flex justify-between pt-4 mt-auto">
                      <button
                        onClick={() => setStep(1)}
                        className="px-6 py-2.5 rounded-lg font-semibold text-on-surface-variant border border-outline-variant hover:bg-surface-container-low transition-colors"
                      >
                        Back
                      </button>
                      <button 
                        onClick={() => setStep(3)}
                        className="px-6 py-2.5 rounded-lg font-semibold bg-primary text-on-primary hover:bg-primary-container transition-colors flex items-center gap-2"
                      >
                        Review
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP 3: REVIEW */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col h-full"
                  >
                    <div className="flex flex-col items-center text-center mb-8">
                      <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 size={32} className="text-success" />
                      </div>
                      <h2 className="text-2xl font-semibold text-on-surface mb-2">Review Entry</h2>
                      <p className="text-sm text-on-surface-variant max-w-xs">Verify details before committing to the immutable ledger.</p>
                    </div>

                    <div className="bg-surface-container-lowest border border-border rounded-xl p-4 space-y-4 mb-8">
                      <div className="flex items-center justify-between pb-4 border-b border-border">
                        <div>
                          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Status</p>
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${status === 'lost' ? 'bg-[#fffbeb] text-[#d97706]' : 'bg-secondary-container text-on-secondary-container'}`}>
                            {status.toUpperCase()}
                          </span>
                        </div>
                        {isHighValue && (
                          <div className="flex items-center gap-1.5 text-warning bg-warning/10 px-2.5 py-1 rounded-md">
                            <ShieldCheck size={16} />
                            <span className="text-xs font-semibold">High Value Protection</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-y-4">
                        <div>
                          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Category</p>
                          <p className="text-sm font-medium text-on-surface">{category || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Location</p>
                          <p className="text-sm font-medium text-on-surface">{location || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Brand</p>
                          <p className="text-sm font-medium text-on-surface">{brand || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Color</p>
                          <p className="text-sm font-medium text-on-surface">{color || '—'}</p>
                        </div>
                      </div>

                      {aiResult && (
                        <div className="pt-4 border-t border-border mt-4">
                           <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1"><Sparkles size={12}/> AI Extracted Metadata</p>
                           <div className="flex flex-wrap gap-2">
                             {Object.entries(aiResult).map(([k, v]) => (
                               <span key={k} className="px-2 py-1 rounded bg-surface-container-high text-xs text-on-surface-variant font-mono">
                                 {k}: {String(v)}
                               </span>
                             ))}
                           </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 mt-auto">
                      <button 
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="w-full py-3.5 rounded-lg font-semibold bg-primary text-on-primary hover:bg-primary-container transition-colors shadow-[0_2px_4px_rgba(0,0,0,0.1)] flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                        {isSubmitting ? 'Committing to Ledger...' : 'Submit to Ledger'}
                      </button>
                      <button 
                        onClick={() => setStep(2)}
                        disabled={isSubmitting}
                        className="w-full py-3.5 rounded-lg font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors border border-transparent"
                      >
                        Edit Details
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Desktop Sidebar */}
          <div className="hidden md:block w-80 border-l border-border bg-surface p-6">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-6">Intake Protocol</h3>
            <div className="space-y-4">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-sm relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                <h4 className="text-sm font-bold text-on-surface mb-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">verified_user</span>
                  Accountability
                </h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  All ledger entries are immutably tied to your verified institution handle. False reporting violates the student code of conduct.
                </p>
              </div>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-sm relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-warning"></div>
                <h4 className="text-sm font-bold text-on-surface mb-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-warning text-[18px]">security</span>
                  Physical Handover
                </h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  High-value items must be physically surrendered to the central security desk within 2 hours of reporting found.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <BottomNav />
    </div>
  );
}
