'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsOfServicePage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-border h-16 flex items-center px-4 md:px-8 max-w-3xl mx-auto w-full">
        <button onClick={() => router.back()} aria-label="Back" className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-surface-container-low text-on-surface-variant">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-bold text-primary ml-1">Terms of Service</h1>
      </header>

      <main className="max-w-3xl mx-auto px-5 md:px-8 py-8">
        <p className="text-sm text-on-surface-variant mb-8">Last updated: June 2026</p>

        <Section title="Acceptance">
          By using CampusFind you agree to these terms. The service is provided for verified members of a single institution to report, find and return lost items.
        </Section>

        <Section title="Your account">
          You must sign in with your own institutional email and provide accurate profile details. You are responsible for activity on your account. Accounts are tied to your verified campus identity.
        </Section>

        <Section title="Acceptable use">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Report only genuine lost or found items, with truthful descriptions.</li>
            <li>File ownership claims only for items that are actually yours.</li>
            <li>Do not harass other students or misuse the chat and dispute features.</li>
            <li>Do not attempt to collect an item that is not yours.</li>
          </ul>
        </Section>

        <Section title="Claims and handovers">
          Ownership claims are scored by an automated check and reviewed by the student who found the item. A handover is completed when the finder confirms it by scanning the receiver&apos;s single-use pickup code. Filing a false claim, or collecting an item you do not own, may be reported to your institution.
        </Section>

        <Section title="Disputes">
          If you believe the wrong person received an item, you may report it within the stated window. Reports open a private conversation with the people involved and are visible to administrators. Knowingly false or abusive reports are a violation of these terms.
        </Section>

        <Section title="Content you submit">
          You keep ownership of the photos and text you submit, and grant CampusFind permission to display them to your campus community for the purpose of recovering lost items. Do not upload content you do not have the right to share.
        </Section>

        <Section title="Availability and liability">
          CampusFind helps students coordinate returns but does not take physical custody of items and is not responsible for the conduct of users or for items that are lost, damaged or not returned. The service is provided on an &ldquo;as is&rdquo; basis.
        </Section>

        <Section title="Changes">
          These terms may be updated as the service evolves. Continued use after an update means you accept the revised terms.
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
