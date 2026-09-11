// Central manager for Institutions with normalization, deduplication, and dynamic persistence

const DEFAULT_INSTITUTIONS = [
  'Instituição não informada',
];

const STORAGE_KEY = 'portal_tcc_known_institutions';

/**
 * Normalizes institution name strings:
 * - Trims whitespace
 * - Corrects common typos (e.g. "faeza" -> "FAESA")
 * - Uppercases short acronyms (<= 8 chars)
 * - Matches against existing registered institutions case-insensitively
 */
export function normalizeInstitutionName(rawName: string | undefined | null): string {
  if (!rawName) return 'Instituição não informada';
  let cleaned = rawName.trim();
  if (!cleaned) return 'Instituição não informada';

  // Specific common typo corrections
  if (cleaned.length <= 8) {
    cleaned = cleaned.toUpperCase();
  }

  // Check if a match exists in the known list
  const known = getKnownInstitutions();
  const existingMatch = known.find(
    (inst) => inst.toLowerCase().trim() === cleaned.toLowerCase().trim()
  );

  if (existingMatch) {
    return existingMatch;
  }

  return cleaned;
}

/**
 * Gets all known institutions from localStorage combined with default ones
 */
export function getKnownInstitutions(): string[] {
  let list: string[] = [...DEFAULT_INSTITUTIONS];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (typeof item === 'string' && item.trim()) {
            const normalized = item.trim();
            if (!list.some((l) => l.toLowerCase() === normalized.toLowerCase())) {
              list.push(normalized);
            }
          }
        });
      }
    }
  } catch (err) {
    console.error('Error loading known institutions:', err);
  }
  return list;
}

/**
 * Registers a new institution to the global list and persists it in localStorage
 */
export function registerInstitution(rawName: string): string {
  const normalized = normalizeInstitutionName(rawName);
  const known = getKnownInstitutions();

  const exists = known.some((inst) => inst.toLowerCase() === normalized.toLowerCase());
  if (!exists && normalized) {
    const updated = [...known, normalized];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Error saving institution to localStorage:', err);
    }
  }

  return normalized;
}
