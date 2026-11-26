import {isDeepStrictEqual} from 'node:util';
import type {LegacyAcademicRecord} from '../src/types/legacyArchive';
import {legacyFileIsPublic,publicLegacyAcademicView} from './legacyArchive';
import {canonicalDriveOriginalLinks} from './driveOriginalLinks';
import {publicFileAuthorized} from './workflow/publicationAccess';
import {legacyRepositoryProcess} from '../src/utils/legacyRepository';
import {legacyRepositoryPeople} from './legacyRepositoryPeople';
import { DEFAULT_INSTALLATION_PROFILE } from '../src/constants/installation';
import {reservationReceipts} from './reservationReceipts';
import {publicDefenseReservationStatus} from '../src/utils/defenseReservationState';
import {correctUppercaseTitlePassages} from '../src/utils/reviewedTccTitle';
import {repositoryDefenseLocation} from '../src/utils/repositoryDefenseLocation';
import {normalizeAcademicKeyword} from '../src/utils/academicTextCase';
import {normalizePersonName} from '../src/utils/personNameCase';
import type { ProcessData, SignatureJob } from '../src/types';
import {advisorInstitutionResolver,ufesFacultyInstitution} from './ufesFacultyInstitution';

export type PublicArtifactState = 'NOT_PRESENTED' | 'PRIVATE' | 'PUBLIC';

const stateLabel = (state: PublicArtifactState): string =>
  state === 'PUBLIC' ? 'Publicado' : state === 'PRIVATE' ? 'Não publicado pelo autor' : 'Não apresentado';

const uppercaseNamePart = /(?<![\p{L}\p{M}])(?:\p{Lu}\p{M}*){2,}(?![\p{L}\p{M}])/u;

function displayPersonName(value?: string) {
  const name = String(value || '').trim();
  if (!uppercaseNamePart.test(name)) return name;
  const normalized = normalizePersonName(name).split(' ');
  return name.split(/\s+/u).map((part, index) =>
    uppercaseNamePart.test(part) ? normalized[index] : part).join(' ');
}

function personName(value: { nome?: string; email?: string; tratamento?: string; titulacao?: string; instituicao?: string } | null | undefined, faculty = false) {
  return value ? {
    nome: displayPersonName(value.nome),
    tratamento: value.tratamento,
    titulacao: value.titulacao,
    instituicao: faculty ? ufesFacultyInstitution(value) : value.instituicao,
  } : null;
}

/**
 * Contrato mínimo do calendário anônimo. Não leva acervo, avaliação, matrícula,
 * e-mail, IDs internos de pessoas ou vínculos do Drive.
 */
export function publicCalendarView(process: ProcessData) {
  const receiptCount = reservationReceipts(process).length;
  return {
    id: process.protocolo,
    protocolo: process.protocolo,
    titulo: correctUppercaseTitlePassages(process.titulo || ''),
    etapaAtual: process.etapaAtual,
    status: process.status,
    aluno1: personName(process.aluno1),
    aluno2: personName(process.aluno2),
    orientador: personName(process.orientador,true),
    coorientador: personName(process.coorientador,true),
    banca: process.banca.map((member) => ({
      nome: displayPersonName(member.nome),
      tratamento: member.tratamento,
      funcao: member.funcao,
      membroTipo: member.membroTipo,
      instituicao: ufesFacultyInstitution(member),
      profissao: member.profissao,
      titulacao: member.titulacao,
    })),
    defesa: {
      startAt: process.defesa.startAt,
      endAt: process.defesa.endAt,
      local: process.defesa.local,
      localStatus: publicDefenseReservationStatus(process),
      hasReservationReceipt: receiptCount > 0,
      reservationReceiptCount: receiptCount,
    },
    createdAt: process.createdAt,
    updatedAt: process.updatedAt,
  };
}

function fullWorkState(process: ProcessData): PublicArtifactState {
  if (process.status !== 'CONCLUIDO') return 'NOT_PRESENTED';
  const hasArchivedFile = Boolean(process.acervo?.trabalhoCompletoFileId || process.acervo?.trabalhoCompletoSha256);
  if (!hasArchivedFile) return 'NOT_PRESENTED';
  if (
    process.acervo?.publicationState === 'PUBLIC' &&
    process.acervo.publishFullWork &&
    process.acervo.publicFullWorkFileUrl
  ) return 'PUBLIC';
  return 'PRIVATE';
}

function expandedAbstractState(process: ProcessData): PublicArtifactState {
  if (process.status !== 'CONCLUIDO') return 'NOT_PRESENTED';
  const hasArchivedFile = Boolean(process.acervo?.resumoExpandidoFileId || process.acervo?.resumoExpandidoSha256);
  if (!hasArchivedFile) return 'NOT_PRESENTED';
  if (
    process.acervo?.publicationState === 'PUBLIC' &&
    process.acervo.publishExpandedAbstract &&
    process.acervo.publicExpandedAbstractFileUrl
  ) return 'PUBLIC';
  return 'PRIVATE';
}

/**
 * Contrato do repositório anônimo. Os links passam pela autorização do Portal;
 * os PDFs acadêmicos seguem o consentimento individual e seus IDs nunca são serializados.
 */
export function publicRepositoryView(process: ProcessData) {
  const acervo = process.status === 'CONCLUIDO' ? process.acervo : undefined;
  const workState = fullWorkState(process);
  const abstractState = expandedAbstractState(process);
  const receiptCount = reservationReceipts(process).length;
  return {
    id: process.protocolo,
    protocolo: process.protocolo,
    titulo: correctUppercaseTitlePassages(process.titulo || ''),
    etapaAtual: process.etapaAtual,
    status: process.status,
    aluno1: personName(process.aluno1),
    aluno2: personName(process.aluno2),
    orientador: personName({
      ...process.orientador,
      instituicao: DEFAULT_INSTALLATION_PROFILE.institutionName,
    }),
    coorientador: personName(process.coorientador,true),
    banca: process.banca.map((member) => ({
      nome: displayPersonName(member.nome),
      tratamento: member.tratamento,
      funcao: member.funcao,
      membroTipo: member.membroTipo,
      instituicao: ufesFacultyInstitution(member),
      profissao: member.profissao,
      titulacao: member.titulacao,
    })),
    defesa: {
      startAt: process.defesa.startAt,
      endAt: process.defesa.endAt,
      local: repositoryDefenseLocation(process.defesa.local),
      localStatus: publicDefenseReservationStatus(process),
      hasReservationReceipt: receiptCount > 0,
      reservationReceiptCount: receiptCount,
    },
    avaliacao: { status: process.avaliacao.status,...(process.avaliacao.status==='CONCLUIDO'?{parecer:process.avaliacao.parecer}:{}) },
    acervo: acervo
      ? {
          palavrasChave: (acervo.palavrasChave || []).map(normalizeAcademicKeyword),
          resumoSintese: acervo.resumoSintese,
          submittedAt: acervo.submittedAt,
          fullWorkState: workState,
          fullWorkLabel: stateLabel(workState),
          expandedAbstractState: abstractState,
          expandedAbstractLabel: stateLabel(abstractState),
          publishFullWork: workState === 'PUBLIC',
          publishExpandedAbstract: abstractState === 'PUBLIC',
          trabalhoCompletoFileUrl: workState === 'PUBLIC' ? acervo.publicFullWorkFileUrl : undefined,
          resumoExpandidoFileUrl: abstractState === 'PUBLIC' ? acervo.publicExpandedAbstractFileUrl : undefined,
          publicationState: acervo.publicationState || (workState === 'PUBLIC' || abstractState === 'PUBLIC' ? 'PUBLIC' : 'NOT_REQUESTED'),
          publicationLabel:
            workState === 'PUBLIC' || abstractState === 'PUBLIC'
              ? 'Publicado'
              : workState === 'PRIVATE' || abstractState === 'PRIVATE'
                ? 'Não publicado pelo autor'
                : 'Não apresentado',
        }
      : {
          palavrasChave: [],
          fullWorkState: workState,
          fullWorkLabel: stateLabel(workState),
          expandedAbstractState: abstractState,
          expandedAbstractLabel: stateLabel(abstractState),
          publishFullWork: false,
          publishExpandedAbstract: false,
          publicationState: 'NOT_REQUESTED' as const,
          publicationLabel: 'Não apresentado',
        },
    createdAt: process.createdAt,
    updatedAt: process.updatedAt,
  };
}

/** Compatibilidade da antiga rota pública /api/processes sem ampliar dados. */
export function publicLegacyProcessView(process: ProcessData) {
  return process.status === 'CONCLUIDO' ? publicRepositoryView(process) : publicCalendarView(process);
}


/** Only repeated canonical identities are collapsed. Titles are never identity. */
export function canonicalRepositoryCurrentRecords(processes:ProcessData[]):ProcessData[]{
 const groups=new Map<string,ProcessData[]>();
 for(const process of processes){
  const key=process.id?`id:${process.id}`:`protocol:${process.protocolo}`;
  const group=groups.get(key)||[];group.push(process);groups.set(key,group);
 }
 const rank=(process:ProcessData)=>[Number.isSafeInteger(process.dataRevision)?process.dataRevision:0,Number.isFinite(Date.parse(process.updatedAt))?Date.parse(process.updatedAt):0];
 return [...groups.values()].flatMap(group=>{
  const best=group.reduce((previous,current)=>{const a=rank(previous),b=rank(current);return b[0]>a[0]||(b[0]===a[0]&&b[1]>a[1])?current:previous;});
  const maximum=rank(best),selected:ProcessData[]=[];
  for(const candidate of group){
   const candidateRank=rank(candidate);
   if(candidateRank[0]!==maximum[0]||candidateRank[1]!==maximum[1])continue;
   // An unresolved same-version conflict stays visible; do not silently lose content.
   if(!selected.some(existing=>isDeepStrictEqual(existing,candidate)))selected.push(candidate);
  }
  return selected;
 });
}

/** Public repository projection is identical for visitors and authenticated roles. */
export function buildPublicRepository(
 processes: ProcessData[],
 legacyRecords: LegacyAcademicRecord[],
 repositorySignatures: SignatureJob[] = [],
) {
 const legacyGroups=new Map<string,LegacyAcademicRecord[]>();
 for(const record of legacyRecords){
  const key=record.id?`id:${record.id}`:`protocol:${record.protocolo}`;
  const group=legacyGroups.get(key)||[];
  // Historical records have no revision clock. Only exact copies are proved duplicates.
  if(!group.some(existing=>isDeepStrictEqual(existing,record)))group.push(record);
  legacyGroups.set(key,group);
 }
 const signaturesByProcess = new Map<string, SignatureJob[]>();
 for (const job of repositorySignatures) {
  const jobs = signaturesByProcess.get(job.processId) ?? [];
  jobs.push(job);
  signaturesByProcess.set(job.processId, jobs);
 }
 return [
  ...canonicalRepositoryCurrentRecords(processes).filter(process=>process.status!=='EM_RASCUNHO')
   .map(advisorInstitutionResolver(processes)).map(process => {
    const row = publicRepositoryView(process);
    const jobs = signaturesByProcess.get(process.id) ?? [];
    const acervo = process.acervo;
    const workId = acervo?.trabalhoCompletoFileId;
    const abstractId = acervo?.resumoExpandidoFileId;
    const work = acervo && workId && row.acervo.trabalhoCompletoFileUrl && workId === acervo.publicFullWorkFileId &&
      publicFileAuthorized(process, jobs, 'trabalho-completo')
      ? canonicalDriveOriginalLinks(workId, acervo.trabalhoCompletoSha256)?.view : undefined;
    const abstract = acervo && abstractId && row.acervo.resumoExpandidoFileUrl && abstractId === acervo.publicExpandedAbstractFileId &&
      publicFileAuthorized(process, jobs, 'resumo-expandido')
      ? canonicalDriveOriginalLinks(abstractId, acervo.resumoExpandidoSha256)?.view : undefined;
    return { ...row, acervo: { ...row.acervo, repositoryFullWorkDriveUrl: work, repositoryExpandedAbstractDriveUrl: abstract } };
   }),
  ...[...legacyGroups.values()].flatMap(records => records.map(record => {
   const view = publicLegacyAcademicView(record);
   const process = legacyRepositoryPeople(legacyRepositoryProcess(view));
   const directLink = (kind: 'TRABALHO_COMPLETO' | 'RESUMO_EXPANDIDO') => {
    const file = view.publicFiles.find(item => item.kind === kind);
    const original = file && record.attachments[file.index];
    if (original && legacyFileIsPublic(record, original)) {
     return canonicalDriveOriginalLinks(original.driveFileId, original.sha256)?.view;
    }
   };
   return { ...process, acervo: { ...process.acervo,
    repositoryFullWorkDriveUrl: directLink('TRABALHO_COMPLETO'),
    repositoryExpandedAbstractDriveUrl: directLink('RESUMO_EXPANDIDO'),
   } };
  })),
 ];
}
