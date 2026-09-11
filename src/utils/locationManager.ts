// Central manager for Defense Locations with normalization, deduplication, and dynamic persistence

const DEFAULT_LOCATIONS = [
  'Local a confirmar com a unidade acadêmica',
  'Sala de aula',
  'Sala de reuniões',
  'Auditório',
  'Videoconferência / defesa on-line',
];

const STORAGE_KEY = 'portal_tcc_known_locations';

export const DEFAULT_DEFENSE_LOCATION = 'Local a confirmar com a unidade acadêmica';

/**
 * Normalizes location strings
 */
export function normalizeLocationName(rawName: string | undefined | null): string {
  if (!rawName) return DEFAULT_DEFENSE_LOCATION;
  const cleaned = rawName.trim();
  if (!cleaned) return DEFAULT_DEFENSE_LOCATION;

  const known = getKnownLocations();
  const existingMatch = known.find(
    (loc) => loc.toLowerCase().trim() === cleaned.toLowerCase().trim()
  );

  if (existingMatch) {
    return existingMatch;
  }

  return cleaned;
}

/**
 * Gets all known defense locations from localStorage combined with default ones
 */
export function getKnownLocations(): string[] {
  let list: string[] = [...DEFAULT_LOCATIONS];
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
    console.error('Error loading known locations:', err);
  }
  return list;
}

/**
 * Registers a new location to the global list and persists it in localStorage
 */
export function registerLocation(rawName: string): string {
  const normalized = normalizeLocationName(rawName);
  const known = getKnownLocations();

  const exists = known.some((loc) => loc.toLowerCase() === normalized.toLowerCase());
  if (!exists && normalized) {
    const updated = [...known, normalized];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Error saving location to localStorage:', err);
    }
  }

  return normalized;
}
