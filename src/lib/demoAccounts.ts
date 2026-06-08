// Pre-seeded demo/reviewer accounts that can sign in through the normal OTP
// screen with a fixed 6-digit code instead of a real emailed one — useful
// for app-store reviewers/demos without depending on Resend delivery or real
// institutional inboxes.
//
// SECURITY: the code itself is NOT hardcoded here (this file is public on
// GitHub). It comes solely from the server-only env var DEMO_OTP_SECRET,
// which you set privately in Vercel / .env.local and never commit. If that
// env var isn't set, these emails behave like any other address — they fail
// the normal institutional-domain check and nothing special happens.
// Sign-in itself is done by minting a real Supabase OTP server-side
// (auth.admin.generateLink) for the pre-seeded account — no password is
// stored or compared, so there is nothing derived from the secret for an
// offline attacker to crack even if this file or the seed SQL is public.

export interface DemoAccount {
  email: string;
  name: string;
  role: 'student' | 'campus_admin';
  institutionDomain: 'igdtuw.ac.in' | 'iiitd.ac.in';
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: 'admin@test.igdtuw', name: 'Demo Admin (IGDTUW)', role: 'campus_admin', institutionDomain: 'igdtuw.ac.in' },
  { email: 'admin@test.iiitd', name: 'Demo Admin (IIITD)', role: 'campus_admin', institutionDomain: 'iiitd.ac.in' },
  { email: 'student01@test.igdtuw', name: 'Demo Student 01', role: 'student', institutionDomain: 'igdtuw.ac.in' },
  { email: 'student02@test.igdtuw', name: 'Demo Student 02', role: 'student', institutionDomain: 'igdtuw.ac.in' },
  { email: 'student03@test.igdtuw', name: 'Demo Student 03', role: 'student', institutionDomain: 'igdtuw.ac.in' },
  { email: 'student04@test.iiitd', name: 'Demo Student 04', role: 'student', institutionDomain: 'iiitd.ac.in' },
  { email: 'student05@test.iiitd', name: 'Demo Student 05', role: 'student', institutionDomain: 'iiitd.ac.in' },
];

export function findDemoAccount(email: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.email === email);
}

const SECRET_RE = /^\d{6}$/;

// Returns the configured demo code, or null if it's unset/malformed — in
// which case the demo bypass is fully inert.
export function getDemoOtpSecret(): string | null {
  const secret = process.env.DEMO_OTP_SECRET;
  return secret && SECRET_RE.test(secret) ? secret : null;
}
