'use client';

import { ChevronDown, AlertTriangle, Send, Clock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const FAQ_DATA = [
  {
    question: 'Where is the physical storage locker?',
    answer:
      'The primary physical storage locker for high-value items is located in the Central Security Office (Building A, Ground Floor, Room 014). For general items, check the designated lost-and-found bins at the respective building\'s main reception desk.',
  },
  {
    question: 'How long are unverified items held?',
    answer:
      'Items are held securely for a period of 30 days from the date they are logged into the system. After 30 days, unclaimed items are processed for donation or responsible disposal in accordance with campus policy.',
  },
  {
    question: 'What constitutes valid proof of ownership?',
    answer:
      'Valid proof can include specific identifying details not visible in the public listing (e.g., lock screen wallpaper, serial numbers, specific scratches), purchase receipts, or photographic evidence of you with the item.',
  },
  {
    question: 'How does the AI matching system work?',
    answer:
      'When you report a lost item, our AI engine automatically extracts key attributes (brand, color, category) and cross-references them against the database of found items. You will be notified when a high-confidence match is detected.',
  },
  {
    question: 'Can I appeal a rejected claim?',
    answer:
      'Yes. You can file an escalation report using the form on this page. Select "Appeal Rejected Claim" as the issue type and provide additional evidence. An administrator will review your case within 48 business hours.',
  },
];

export default function HelpPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be signed in to file an escalation.');
        return;
      }

      const { error } = await supabase.from('disputes').insert({
        user_id: user.id,
        issue_type: issueType,
        description,
      });
      if (error) throw error;

      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      setIssueType('');
      setDescription('');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit escalation report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-background min-h-screen text-on-surface font-sans antialiased">
      {/* TopAppBar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 h-16 bg-surface border-b border-border transition-colors duration-200">
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-full hover:bg-surface-container-low transition-colors duration-200 flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-primary">fingerprint</span>
          </button>
        </div>
        <div className="flex-1 flex justify-center">
          <span className="text-2xl font-bold text-primary tracking-[-0.01em]">CampusFind</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/profile" className="p-2 rounded-full hover:bg-surface-container-low transition-colors duration-200 flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined">person</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-8 px-4 md:px-10 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-[28px] md:text-[32px] font-semibold text-on-surface mb-2 leading-[36px] md:leading-[40px] tracking-[-0.02em]">Help &amp; Dispute Resolution</h1>
          <p className="text-base text-on-surface-variant max-w-2xl">Find answers to common operational questions or escalate an issue requiring administrative intervention.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* FAQ Accordion */}
          <section className="lg:col-span-7 flex flex-col gap-3">
            <h2 className="text-2xl font-semibold text-on-surface tracking-[-0.01em] mb-2">Frequently Asked Questions</h2>
            {FAQ_DATA.map((faq, index) => (
              <div
                key={index}
                className={`bg-surface-container-lowest border rounded-lg overflow-hidden shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] transition-all duration-200 ${
                  openIndex === index ? 'border-outline-variant' : 'border-border'
                }`}
              >
                <button
                  onClick={() => handleToggle(index)}
                  className="flex justify-between items-center p-4 cursor-pointer hover:bg-surface-bright transition-colors w-full text-left"
                >
                  <span className="text-base font-semibold text-on-surface">{faq.question}</span>
                  <ChevronDown
                    size={24}
                    className={`text-on-surface-variant transition-transform duration-200 shrink-0 ${
                      openIndex === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    openIndex === index ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="p-4 pt-0 text-sm text-on-surface-variant leading-relaxed bg-surface-bright">
                    {faq.answer}
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* Escalation Form */}
          <section className="lg:col-span-5 relative">
            <div className="bg-surface-container-lowest border border-border rounded-xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.05)] lg:sticky lg:top-24">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={24} className="text-warning" fill="currentColor" />
                <h2 className="text-2xl font-semibold text-on-surface tracking-[-0.01em]">File an Escalation Report</h2>
              </div>
              <p className="text-sm text-on-surface-variant mb-6">
                Use this form to initiate a formal dispute or report a critical platform issue to the administrative team.
              </p>

              {submitted && (
                <div className="mb-4 bg-success/10 border border-success/20 text-success rounded-lg p-3 text-sm font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Escalation submitted. An administrator will review your case.
                </div>
              )}

              <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface tracking-wide" htmlFor="escalation-type">
                    Issue Classification
                  </label>
                  <div className="relative">
                    <select
                      className="w-full appearance-none bg-surface border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                      id="escalation-type"
                      value={issueType}
                      onChange={(e) => setIssueType(e.target.value)}
                      required
                    >
                      <option disabled value="">Select an issue type...</option>
                      <option value="false-claim">Report False Claim</option>
                      <option value="appeal-rejected">Appeal Rejected Claim</option>
                      <option value="tech-malfunction">Technical Malfunction</option>
                    </select>
                    <ChevronDown size={20} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-on-surface tracking-wide" htmlFor="escalation-desc">
                    Detailed Description
                  </label>
                  <textarea
                    className="w-full bg-surface border border-outline-variant rounded px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow resize-y"
                    id="escalation-desc"
                    placeholder="Provide relevant transaction IDs, dates, and a clear chronological account of the issue..."
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>
                <div className="mt-2">
                  <button
                    className="w-full bg-primary text-on-primary text-xs font-semibold px-4 py-3 rounded-lg hover:bg-primary-container transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Escalation'}
                    <Send size={16} />
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Clock size={18} />
            <span className="text-sm">Operational Desk: Mon - Fri, 09:00 - 17:00</span>
          </div>
          <div className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
            <Mail size={18} />
            <span className="text-sm font-semibold">support@campusfind.edu</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
