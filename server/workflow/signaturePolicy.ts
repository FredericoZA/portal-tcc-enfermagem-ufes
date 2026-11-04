import {documentSignatureCompleted} from '../../src/utils/documentSignatureState';
import {academicName} from '../../src/utils/personPresentation';
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
  const prefix = role === 'ADVISOR' ? 'advisor' : role === 'EXAMINER' ? 'examiner' : role === 'STUDENT' ? 'student' : 'president';
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
    // A ata requer os três titulares. A linha de orientador em "banca" não conta duas vezes.
    const examiner2 = (process.banca || []).filter(member => member.funcao === 'EXAMINER_2');
    const examiner3 = (process.banca || []).filter(member => member.funcao === 'EXAMINER_3');
    if (examiner2.length !== 1 || examiner3.length !== 1) {
      throw new Error(`${process.protocolo}: a ata exige dois examinadores titulares (2º e 3º membros da banca) cadastrados.`);
    }
    signers = [
      registeredSigner(process, 'ADVISOR', { ...process.orientador, nome: academicName(process.orientador, 'abbreviated') }),
      registeredSigner(process, 'EXAMINER', { ...examiner2[0], nome: academicName(examiner2[0], 'abbreviated') }),
      registeredSigner(process, 'EXAMINER', { ...examiner3[0], nome: academicName(examiner3[0], 'abbreviated') }),
    ];
  } else if (type === 'TERMO') {
    signers = [
      registeredSigner(process, 'STUDENT', process.aluno1),
      ...(process.aluno2 ? [registeredSigner(process, 'STUDENT', process.aluno2)] : []),
      registeredSigner(process, 'ADVISOR', { ...process.orientador, nome: academicName(process.orientador, 'abbreviated') }),
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
  if (type === 'ATA') return [process.orientador, ...(process.banca || []).filter(member => member.funcao === 'EXAMINER_2' || member.funcao === 'EXAMINER_3')]
    .some(person => normalizeSignatureEmail(person?.email) === actor);
  if (type === 'TERMO') {
    return [process.aluno1, process.aluno2, process.orientador]
      .some(person => normalizeSignatureEmail(person?.email) === actor);
  }
  return normalizeSignatureEmail(settings.commissionPresidentEmail) === actor;
}

/** Final return is made by the advisor, or the presidency for declarations.
 * The Master can return any document; other administrators cannot return the term. */
export function canReturnGovbrDocument(
  email: string,
  process: ProcessData,
  type: SignableDocumentType,
  settings: PresidentSettings,
  globalRoles: readonly GlobalRole[] = [],
): boolean {
  if (!isValidSignatureEmail(email)) return false;
  if (globalRoles.includes('MASTER_ADMIN')) return true;
  if (type === 'TERMO') return normalizeSignatureEmail(email) === normalizeSignatureEmail(process.orientador.email);
  if (globalRoles.includes('COMMISSION_PRESIDENT')) return true;
  const responsible = type === 'DECLARACAO' ? settings.commissionPresidentEmail : process.orientador?.email;
  return normalizeSignatureEmail(email) === normalizeSignatureEmail(responsible);
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

/** Never send a queued document to an old recipient after presidency settings change. */
export function assertCurrentSignatureRecipients(process:ProcessData,type:SignableDocumentType,job:Pick<SignatureJob,'signers'>,settings:PresidentSettings):void{
 const key=(signers:SignatureSignerSnapshot[])=>signers.map(s=>`${s.role}:${normalizeSignatureEmail(s.email)}:${s.signingOrder}`).sort().join('|');
 if(key(job.signers||[])!==key(deriveSignatureSigners(process,type,settings)))throw new Error('O destinatário desta solicitação mudou desde a preparação do documento. Cancele a solicitação anterior e gere uma nova versão para o responsável atual.');
}

/** Prevent a new request through either provider once this revision is signed. */
export function assertDocumentSignatureOpen(process:ProcessData,type:SignableDocumentType,jobs:SignatureJob[]):void{
 if(process.status==='CONCLUIDO'||process.etapaAtual==='CONCLUIDO'||documentSignatureCompleted(jobs,process.id,type,process.dataRevision))throw new Error('Este documento já está assinado. Utilize Ver ou Baixar PDF.');
}
