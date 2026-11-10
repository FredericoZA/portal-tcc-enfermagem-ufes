import {signaturePolicyDigest,assertSignaturePolicySnapshot} from './signaturePolicySnapshot';
export {assertSignaturePolicySnapshot} from './signaturePolicySnapshot';
import {getSignatureRecipientRoles,validateSignatureRecipientRoles,resolveSignatureTemplateType} from '../../src/utils/signatureRecipientRoles';
import type {SignaturePolicySnapshot} from '../../src/types/signatures';
import {currentAtaArchived,documentSignatureCompleted,signatureDocumentRevision} from '../../src/utils/documentSignatureState';
import {academicName} from '../../src/utils/personPresentation';
import type { GlobalRole, GlobalSettings, ProcessData, SignatureJob } from '../../src/types';
import type { SignatureSignerSnapshot } from '../../src/types/signatures';
import { declarationReady } from './gates';

export type SignableDocumentType = 'ATA' | 'TERMO' | 'DECLARACAO';
type PresidentSettings = Pick<GlobalSettings, 'commissionPresidentEmail' | 'commissionPresidentName' | 'integrationStudio'>;

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
  const prefix = role === 'ADVISOR' ? 'advisor' : role === 'EXAMINER' ? 'examiner' : role === 'STUDENT' ? 'student' : role === 'CO_ADVISOR' ? 'coadvisor' : 'president';
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
  ataPolicy:'BOARD_AUTHORS_V1'|'BOARD_ONLY_LEGACY'='BOARD_AUTHORS_V1',
): SignatureSignerSnapshot[] {
  let signers: SignatureSignerSnapshot[];
  if (type === 'ATA') {
    // The advisor's duplicate registration in banca is never another signer.
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
    if(ataPolicy==='BOARD_AUTHORS_V1'){
      if(process.coorientador&&typeof process.avaliacao.coadvisorPresent!=='boolean')throw new Error('Confirme se o coorientador participou da sessão antes de preparar as assinaturas da ata.');
      signers.push(registeredSigner(process,'STUDENT',process.aluno1));
      if(process.aluno2)signers.push(registeredSigner(process,'STUDENT',process.aluno2));
      if(process.coorientador&&process.avaliacao.coadvisorPresent===true)signers.push(registeredSigner(process,'CO_ADVISOR',{...process.coorientador,nome:academicName(process.coorientador,'abbreviated')}));
    }
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
  const template=settings.integrationStudio?.docTemplates?.find(item=>resolveSignatureTemplateType(item)===type);
  if(template?.signatureRecipientRoles!==undefined){
    validateSignatureRecipientRoles(template);
    const roles=getSignatureRecipientRoles(template);
    const extras:SignatureSignerSnapshot[]=[];
    if(roles.includes('AUTHORS')){extras.push(registeredSigner(process,'STUDENT',process.aluno1));if(process.aluno2)extras.push(registeredSigner(process,'STUDENT',process.aluno2));}
    if(roles.includes('ADVISOR'))extras.push(registeredSigner(process,'ADVISOR',{...process.orientador,nome:academicName(process.orientador,'abbreviated')}));
    if(roles.includes('EXAMINERS'))for(const slot of ['EXAMINER_2','EXAMINER_3']){const people=process.banca.filter(person=>person.funcao===slot);if(people.length!==1)throw new Error('Confira os dois examinadores titulares antes de preparar as assinaturas.');extras.push(registeredSigner(process,'EXAMINER',{...people[0],nome:academicName(people[0],'abbreviated')}));}
    if(roles.includes('COADVISOR_PRESENT')&&process.coorientador&&process.avaliacao.coadvisorPresent===true)extras.push(registeredSigner(process,'CO_ADVISOR',{...process.coorientador,nome:academicName(process.coorientador,'abbreviated')}));
    if(roles.includes('COMMISSION_PRESIDENT'))extras.push(registeredSigner(process,'PRESIDENT',{nome:settings.commissionPresidentName,email:settings.commissionPresidentEmail}));
    for(const signer of extras)if(!signers.some(existing=>existing.role===signer.role&&existing.email===signer.email))signers.push(signer);
  }
  if(type==='ATA'&&signers.length>6)throw new Error('A ata admite no máximo seis signatários para preservar a página única. Revise os papéis adicionais antes de conferir o documento.');
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
  if (globalRoles.includes('MASTER_ADMIN')) return true;
  const actor = normalizeSignatureEmail(email);
  if (type === 'ATA') return normalizeSignatureEmail(process.orientador?.email) === actor;
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
  const responsible = type === 'DECLARACAO' ? settings.commissionPresidentEmail : process.orientador?.email;
  return normalizeSignatureEmail(email) === normalizeSignatureEmail(responsible);
}

/** Administrative permission never bypasses the document's workflow prerequisites. */
export function assertSignatureEligibility(
  process: ProcessData,
  type: SignableDocumentType,
  jobs: SignatureJob[],
): void {
  if (process.avaliacao.status !== 'CONCLUIDO') throw new Error(`${process.protocolo}: registro de conceito e ata pendente.`);
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
export function assertCurrentSignatureRecipients(process:ProcessData,type:SignableDocumentType,job:Pick<SignatureJob,'signers'|'ataSignerPolicy'|'signerPolicySnapshot'>,settings:PresidentSettings):void{
 if(job.signerPolicySnapshot){assertSignaturePolicySnapshot(type,job);return;}
 const key=(signers:SignatureSignerSnapshot[])=>signers.map(s=>`${s.role}:${normalizeSignatureEmail(s.email)}:${s.signingOrder}`).sort().join('|');
 if(job.ataSignerPolicy!==undefined&&job.ataSignerPolicy!=='BOARD_AUTHORS_V1')throw new Error('A política de signatários desta ata não é reconhecida. Confira a versão registrada.');
 if(key(job.signers||[])!==key(deriveSignatureSigners(process,type,{commissionPresidentName:settings.commissionPresidentName,commissionPresidentEmail:settings.commissionPresidentEmail},type==='ATA'&&job.ataSignerPolicy===undefined?'BOARD_ONLY_LEGACY':'BOARD_AUTHORS_V1')))throw new Error('O destinatário desta solicitação mudou desde a preparação do documento. Cancele a solicitação anterior e gere uma nova versão para o responsável atual.');
}

/** Prevent a new request through either provider once this revision is signed. */
export function assertDocumentSignatureOpen(process:ProcessData,type:SignableDocumentType,jobs:SignatureJob[]):void{
 if(process.status==='CONCLUIDO'||process.etapaAtual==='CONCLUIDO'||(type==='ATA'&&currentAtaArchived(process,jobs))||documentSignatureCompleted(jobs,process.id,type,signatureDocumentRevision(process,type)))throw new Error('Este documento já está assinado. Utilize Ver ou Baixar PDF.');
}

export function signatureJobMatchesCurrentRevision(process:ProcessData,job:Pick<SignatureJob,'documentType'|'sourceDataRevision'|'status'|'removedFromLogsAt'>):boolean{
 return !job.removedFromLogsAt&&job.status!=='CANCELED'&&job.sourceDataRevision===signatureDocumentRevision(process,job.documentType);
}

export function hasCompetingSignatureArchive(process:ProcessData,job:SignatureJob,jobs:SignatureJob[]):boolean{
 return jobs.some(other=>other.id!==job.id&&other.processId===job.processId&&other.documentType===job.documentType
   &&other.sourceDataRevision===job.sourceDataRevision&&other.status==='ARCHIVED'&&Boolean(other.driveSignedFileId)
   &&(job.documentType!=='ATA'||currentAtaArchived(process,[other])));
}

export function captureSignaturePolicySnapshot(process:ProcessData,type:SignableDocumentType,settings:PresidentSettings,signers=deriveSignatureSigners(process,type,settings)):SignaturePolicySnapshot{
 const template=settings.integrationStudio?.docTemplates?.find(item=>resolveSignatureTemplateType(item)===type);
 const snapshot:Omit<SignaturePolicySnapshot,'digest'>={version:1,configured:template?.signatureRecipientRoles!==undefined,documentType:type,templateId:String(template?.id||`tmpl-${type.toLowerCase()}`),studioRevision:settings.integrationStudio?.revision||0,roles:getSignatureRecipientRoles(template||{type}),signers:signers.map(({role,name,email,signingOrder})=>({role,name,email,signingOrder}))};
 return {...snapshot,digest:signaturePolicyDigest(snapshot)};
}

export function signatureSignersFromSnapshot(snapshot:SignaturePolicySnapshot):SignatureSignerSnapshot[]{return snapshot.signers.map(signer=>({...signer,id:`${signer.role.toLowerCase()}:${signer.email}`,status:'WAITING'}));}
