import type { GlobalRole, GlobalSettings, ProcessData, SignatureJob } from '../../src/types';
import type { SignatureSignerSnapshot } from '../../src/types/signatures';
import { declarationReady } from './gates';

export type SignableDocumentType = 'ATA' | 'TERMO' | 'DECLARACAO';
type PresidentSettings = Pick<GlobalSettings, 'commissionPresidentEmail' | 'commissionPresidentName'>;

export function normalizeSignatureEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidSignatureEmail(value: unknown): boolean {
  if (typeof value !== 'string' || /[\r\n\u0000-\u001f\u007f]/.test(value)) return false;
  const email = normalizeSignatureEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function publicationRequested(process: ProcessData): boolean {
  return Boolean(process.acervo?.publishFullWork || process.acervo?.publishExpandedAbstract);
}

export function repositoryDataComplete(process: ProcessData): boolean {
  return Boolean(
    process.acervo?.palavrasChave?.length === 5 &&
    process.acervo.resumoSintese?.trim() &&
    process.acervo.trabalhoCompletoFileUrl &&
    (!process.acervo.publishExpandedAbstract || process.acervo.resumoExpandidoFileId)
  );
}

function registeredSigner(
  process: ProcessData,
  role: SignatureSignerSnapshot['role'],
  person: { nome?: string; email?: string } | null | undefined,
): SignatureSignerSnapshot {
  if (!isValidSignatureEmail(person?.email)) {
    if (role === 'PRESIDENT') throw new Error('Configure um e-mail válido do Presidente da Comissão.');
    throw new Error(`${process.protocolo}: signatário sem e-mail válido no cadastro.`);
  }
  const email = normalizeSignatureEmail(person!.email);
  const prefix = role === 'ADVISOR' ? 'advisor' : role === 'STUDENT' ? 'student' : 'president';
  return {
    id: `${prefix}:${email}`,
    role,
    name: person!.nome || (role === 'PRESIDENT' ? 'Presidente da Comissão' : ''),
    email,
    signingOrder: 1,
    status: 'WAITING',
  };
}

/** Recipients are always derived from persisted registration, never request overrides. */
export function deriveSignatureSigners(
  process: ProcessData,
  type: SignableDocumentType,
  settings: PresidentSettings,
): SignatureSignerSnapshot[] {
  let signers: SignatureSignerSnapshot[];
  if (type === 'ATA') {
    signers = [registeredSigner(process, 'ADVISOR', process.orientador)];
  } else if (type === 'TERMO') {
    signers = [
      registeredSigner(process, 'STUDENT', process.aluno1),
      ...(process.aluno2 ? [registeredSigner(process, 'STUDENT', process.aluno2)] : []),
      registeredSigner(process, 'ADVISOR', process.orientador),
    ];
  } else {
    signers = [registeredSigner(process, 'PRESIDENT', {
      nome: settings.commissionPresidentName,
      email: settings.commissionPresidentEmail,
    })];
  }
  if (new Set(signers.map(signer => signer.email)).size !== signers.length) {
    throw new Error(`${process.protocolo}: os signatários precisam ter e-mails distintos no cadastro.`);
  }
  return signers;
}

export function canInitiateSignature(
  email: string,
  process: ProcessData,
  type: SignableDocumentType,
  settings: PresidentSettings,
  globalRoles: readonly GlobalRole[] = [],
): boolean {
  if (!isValidSignatureEmail(email)) return false;
  if (globalRoles.includes('MASTER_ADMIN') || globalRoles.includes('COMMISSION_PRESIDENT')) return true;
  const actor = normalizeSignatureEmail(email);
  if (type === 'ATA') return normalizeSignatureEmail(process.orientador?.email) === actor;
  if (type === 'TERMO') {
    return [process.aluno1, process.aluno2, process.orientador]
      .some(person => normalizeSignatureEmail(person?.email) === actor);
  }
  return normalizeSignatureEmail(settings.commissionPresidentEmail) === actor;
}

/** Administrative permission never bypasses the document's workflow prerequisites. */
export function assertSignatureEligibility(
  process: ProcessData,
  type: SignableDocumentType,
  jobs: SignatureJob[],
): void {
  if (process.avaliacao.status !== 'CONCLUIDO') throw new Error(`${process.protocolo}: avaliação pendente.`);
  if ((type === 'TERMO' || type === 'DECLARACAO') && !repositoryDataComplete(process)) {
    throw new Error(`${process.protocolo}: dados finais do repositório ainda não foram concluídos.`);
  }
  if (type === 'DECLARACAO' && !declarationReady(process, jobs)) {
    throw new Error('A declaração aguarda a Ata e o Termo aplicável assinados e arquivados.');
  }
  if (type === 'TERMO' && !publicationRequested(process)) {
    throw new Error(`${process.protocolo}: o termo só é aplicável quando o aluno solicita publicação.`);
  }
  if (type === 'TERMO' && !process.acervo?.authorizationConfirmedAt) {
    throw new Error(`${process.protocolo}: a autorização de publicação ainda não foi confirmada.`);
  }
}
