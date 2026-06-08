// Branches offered at each campus, shown in the onboarding dropdown.
// Postgraduate students just pick "M.Tech" / "Ph.D." (no specific branch).

export const POSTGRAD_BRANCHES = ['M.Tech', 'Ph.D.'];

const IGDTUW_BRANCHES = [
  'Computer Science & Engineering (CSE)',
  'CSE — Artificial Intelligence & Machine Learning',
  'Information Technology (IT)',
  'Electronics & Communication Engineering (ECE)',
  'Mechanical & Automation Engineering (MAE)',
  'Architecture (B.Arch)',
];

const IIITD_BRANCHES = [
  'Computer Science & Engineering (CSE)',
  'Computer Science & Artificial Intelligence (CSAI)',
  'Computer Science & Applied Mathematics (CSAM)',
  'Computer Science & Design (CSD)',
  'Computer Science & Biosciences (CSB)',
  'Computer Science & Social Sciences (CSSS)',
  'Electronics & Communication Engineering (ECE)',
  'Electronics & VLSI Engineering (EVE)',
];

// Returns the undergraduate branch list for a campus by its email domain.
export function branchesForDomain(domain?: string | null): string[] {
  const d = (domain || '').toLowerCase();
  if (d.includes('igdtuw')) return IGDTUW_BRANCHES;
  if (d.includes('iiitd')) return IIITD_BRANCHES;
  // Unknown campus — offer the union so nobody is blocked.
  return Array.from(new Set([...IGDTUW_BRANCHES, ...IIITD_BRANCHES]));
}
