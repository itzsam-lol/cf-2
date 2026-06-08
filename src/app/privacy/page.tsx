'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicyPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-border h-16 flex items-center px-4 md:px-8 max-w-3xl mx-auto w-full">
        <button onClick={() => router.back()} aria-label="Back" className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-surface-container-low text-on-surface-variant">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-primary ml-1">Privacy Policy</h1>
      </header>

      <main className="max-w-3xl mx-auto px-5 md:px-8 py-8">
        <p className="text-sm text-on-surface-variant mb-8">Last updated: June 2026</p>

        <Section title="Overview">
          CampusFind is a lost &amp; found platform operated for verified members of a single institution. This policy explains what information we collect, why we collect it, and how it is handled.
        </Section>

        <Section title="Information we collect">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Your institutional email address, used only to verify that you belong to your campus.</li>
            <li>Profile details you provide: your name, roll/enrollment number and branch.</li>
            <li>Items you report (titles, descriptions, categories, locations and photos).</li>
            <li>Claims, messages and dispute conversations you take part in.</li>
          </ul>
        </Section>

        <Section title="How we use it">
          Your information is used to operate the service: to authenticate you, display items to your campus community, match lost and found items, verify ownership claims, and let students coordinate a safe handover. Photographs flagged as high value are blurred in the public feed.
        </Section>

        <Section title="What we never do">
          We do not sell your personal information, and we do not share it outside your institution for advertising. The private verification secret you set on a found item is never shown publicly; it is used only to score how well a claim matches.
        </Section>

        <Section title="Visibility to others">
          Items you post and your display name are visible to other verified members of your campus. Claim and dispute conversations are visible only to their participants and, for oversight, to your campus administrators.
        </Section>

        <Section title="Data retention">
          Reported items and your activity history remain available in your ledger so returns can be traced. You may edit or delete items you have reported at any time.
        </Section>

        <Section title="Security">
          Access is restricted by row-level security so you only see data belonging to your campus. Pickup hand-offs are confirmed with single-use, signed, expiring QR codes.
        </Section>

        <Section title="Contact">
          For questions about this policy or your data, contact your campus administrator through the app&apos;s help section.
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-base font-semibold text-on-surface mb-2">{title}</h2>
      <div className="text-sm leading-relaxed text-on-surface-variant">{children}</div>
    </section>
  );
}
