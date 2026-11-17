import type { LegacyAcademicRecord } from '../src/types/legacyArchive';
import { isEmailHeaderAddress } from '../src/utils/emailAddress';
import { normalizeEmail } from '../src/utils/formatters';

export interface VerifiedLegacyParticipant {
  nome: string;
  email: string;
}
export interface VerifiedLegacyParticipants {
  authors: VerifiedLegacyParticipant[];
  advisor: VerifiedLegacyParticipant;
  verifiedBy: string;
}
type LegacyIdentity = Pick<LegacyAcademicRecord, 'id' | 'autores' | 'orientador' | 'provenance'>;
export interface LegacyReaderPolicy {
  isTrustedVerifier: (email: string) => boolean;
  isAccessRevoked?: (email: string, recordId: string) => boolean;
}

// This is a consistency check on an explicitly verified email binding, never an
// identity lookup: accent changes, abbreviations and similar names do not match.
const canonicalName = (value: unknown): string => typeof value === 'string' &&
  value.length <= 1000 && !/[\u0000-\u001f\u007f]/.test(value)
  ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR') : '';
const contact = (value: unknown, expectedName: string): VerifiedLegacyParticipant | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const person = value as Record<string, unknown>;
  const name = canonicalName(person.nome), expected = canonicalName(expectedName);
  const email = typeof person.email === 'string' && !/[\u0000-\u001f\u007f]/.test(person.email)
    ? normalizeEmail(person.email) : '';
  if (!name || !expected || name !== expected || !isEmailHeaderAddress(email) ||
      /[\u0000-\u001f\u007f]/.test(email)) return;
  return { nome: String(person.nome).trim(), email };
};

/** Only explicit, Master-verified bindings can grant private historical access.
 * Raw submission emails, live memberships and publication-process copies are
 * deliberately not alternate identity sources. Missing or conflicting proof
 * keeps the whole historical participant binding unavailable. */
export function verifiedLegacyParticipants(
  record: LegacyIdentity,
  isTrustedVerifier: LegacyReaderPolicy['isTrustedVerifier'],
): VerifiedLegacyParticipants | undefined {
  const value = record.provenance.verifiedPublicationParticipants;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const saved = value as Record<string, unknown>;
  const verifiedBy = typeof saved.verifiedBy === 'string' && !/[\u0000-\u001f\u007f]/.test(saved.verifiedBy)
    ? normalizeEmail(saved.verifiedBy) : '';
  if (!isEmailHeaderAddress(verifiedBy) || /[\u0000-\u001f\u007f]/.test(verifiedBy) ||
      !isTrustedVerifier(verifiedBy) || !Array.isArray(record.autores) ||
      !record.autores.length || record.autores.length > 10 || !Array.isArray(saved.authors) ||
      saved.authors.length !== record.autores.length) return;
  const savedAuthors = saved.authors as unknown[];
  const authors = record.autores.map((name, index) => contact(savedAuthors[index], name));
  const advisor = contact(saved.advisor, record.orientador);
  if (!advisor || authors.some(person => !person)) return;
  const people = [...authors as VerifiedLegacyParticipant[], advisor];
  if (new Set(people.map(person => person.email)).size !== people.length ||
      new Set(people.map(person => canonicalName(person.nome))).size !== people.length) return;
  return { authors: authors as VerifiedLegacyParticipant[], advisor, verifiedBy };
}

/** Returns a read-only historical role. It does not grant registration,
 * publication editing or any global/live-process role. */
export function legacyEvaluationParticipantRole(
  record: LegacyIdentity,
  email: string,
  policy: LegacyReaderPolicy,
): 'STUDENT' | 'ADVISOR' | undefined {
  const normalized = normalizeEmail(email);
  if (!isEmailHeaderAddress(normalized) || /[\u0000-\u001f\u007f]/.test(normalized) ||
      policy.isAccessRevoked?.(normalized, record.id)) return;
  const contacts = verifiedLegacyParticipants(record, policy.isTrustedVerifier);
  if (!contacts) return;
  if (contacts.authors.some(person => person.email === normalized)) return 'STUDENT';
  if (contacts.advisor.email === normalized) return 'ADVISOR';
}
