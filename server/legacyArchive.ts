import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { normalizePersonName } from '../src/utils/personNameCase';
import {repositoryDefenseLocation} from '../src/utils/repositoryDefenseLocation';
import {normalizeAcademicKeyword} from '../src/utils/academicTextCase';
import { renderTccTitle } from '../src/utils/formatters';
import { legacyFacultyPresentation } from './legacyFacultyPresentation';
import type { ProcessData } from '../src/types';
import type { LegacyAcademicRecord, LegacyAttachment, LegacyAdministrativeFile, PublicLegacyAcademicRecord, PrivateLegacyAcademicView } from '../src/types/legacyArchive';

const bounded = (value: unknown, max = 1000): string => {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('Texto histórico inválido.');
  return value.trim();
};
/** Private references are validated before storage reads; never part of the public projection. */
export function legacyAdministrativeFiles(record: Pick<LegacyAcademicRecord,'provenance'>): LegacyAdministrativeFile[] {
  const value=record.provenance.administrativeDocuments;
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>100)throw new Error('Documentação histórica inválida.');
  const ids=new Set<string>();
  return value.map(file=>{
    if(!file||typeof file!=='object'||!['CONVITE','AVALIACAO','ATA','TERMO','DECLARACAO'].includes(file.kind)||file.visibility!=='PRIVATE_ADMINISTRATIVE_DOCUMENT')throw new Error('Documento administrativo inválido.');
    const driveFileId=bounded(file.driveFileId,150),folderId=bounded(file.folderId,150),sha256=bounded(file.sha256,64),fileName=bounded(file.fileName,250);
    const sourceFileName=file.sourceFileName===undefined?undefined:bounded(file.sourceFileName,250);
    if(!/^[\w-]{10,150}$/.test(driveFileId)||!/^[\w-]{10,150}$/.test(folderId)||!/^[a-f0-9]{64}$/.test(sha256)||!fileName||ids.has(driveFileId)||[fileName,sourceFileName].some(name=>name!==undefined&&(/[\\/]/.test(name)||name==='.'||name==='..')))throw new Error('Referência administrativa inválida.');
    ids.add(driveFileId);
    return {driveFileId,folderId,sha256,fileName,...(sourceFileName?{sourceFileName}:{}),kind:file.kind,visibility:'PRIVATE_ADMINISTRATIVE_DOCUMENT'};
  });
}
/** Keep already issued numeric links bound to their original after archive consolidation. */
export function legacyAdministrativeRoutes(record: Pick<LegacyAcademicRecord, 'provenance'>) {
  const files = legacyAdministrativeFiles(record);
  const slots = record.provenance.administrativeRouteFileIds;
  if (slots === undefined) return files.map((file, index) => ({ file, index, aliases: [index] }));
  if (!Array.isArray(slots) || slots.length > 100 || slots.some(id => typeof id !== 'string' || !/^[\w-]{10,150}$/.test(id))) {
    throw new Error('Índices históricos inválidos.');
  }
  let next = slots.length;
  return files.map(file => {
    const aliases = slots.flatMap((id, i) => id === file.driveFileId ? [i] : []);
    if (!aliases.length) aliases.push(next++);
    if (aliases[0] >= 100) throw new Error('Limite de documentos históricos excedido.');
    return { file, index: aliases[0], aliases };
  });
}

/** Public catalog carries only issued document kinds and Portal routes, never Drive references. */
export function publicLegacyAdministrativeDocuments(record:LegacyAcademicRecord){
  const labels:Record<string,string>={ATA:'Ata',TERMO:'Termo de autorização',DECLARACAO:'Declaração'};
  const baseline=record.provenance.publicationImportBaseline as {privateFileIds?:string[]}|undefined;
  const academicIds=new Set([...record.attachments.map(file=>file.driveFileId),...legacyAdministrativeFiles(record).filter(f=>f.kind==='AVALIACAO').map(f=>f.driveFileId),...(baseline?.privateFileIds||[])]);
  return legacyAdministrativeRoutes(record).flatMap(({file,index})=>labels[file.kind]&&!academicIds.has(file.driveFileId)&&!(file.kind==='TERMO'&&record.provenance.publicationOverride&&!((record.provenance.publicationOverride as any).currentTermFileId===file.driveFileId&&(record.provenance.publicationOverride as any).status==='COMPLETED'))?[{id:`legacy-document-${index}`,type:file.kind,title:labels[file.kind],status:'DISPONIVEL',version:1,url:`/api/public/legacy-academic-records/${encodeURIComponent(record.id)}/documents/${index}/download`}]:[]);
}
export function legacyProtocol(id: string): string {
  if (!/^legado-\d{4}$/.test(id) || Number(id.slice(7)) < 1 || Number(id.slice(7)) > 999) throw new Error('Identificador legado inválido.');
  return `${String(Number(id.slice(7))).padStart(3,'0')} - Legado`;
}
/** Historical consent is independent of live-process signatures and required uploads. */
export function legacyAuthorization(provenance: Record<string, unknown>): LegacyAcademicRecord['authorizationDecision'] {
  const override=provenance.publicationOverride as any;
  const withdrawal=provenance.publicationWithdrawal as {withdrawnAt?:string}|undefined;
  if(withdrawal?.withdrawnAt && (!override?.syncedAt || !(Date.parse(override.syncedAt)>Date.parse(withdrawal.withdrawnAt))))return 'DENIED';
  if(override)return override.status==='COMPLETED'&&override.signedTermJobId&&override.syncedAt&&(override.publishFullWork||override.publishExpandedAbstract)?'AUTHORIZED':'DENIED';
  if(provenance?.publicationWithdrawal&&typeof provenance.publicationWithdrawal==='object'&&typeof (provenance.publicationWithdrawal as any).withdrawnAt==='string')return 'DENIED';
  const values = Array.isArray(provenance?.originalConsent) ? provenance.originalConsent : [];
  const normalized = values.map(v => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase());
  if (!normalized.length || normalized.some(v => !['sim','nao'].includes(v))) return 'UNSPECIFIED';
  if (normalized.includes('sim') && normalized.includes('nao')) return 'CONFLICT';
  return normalized.every(v => v === 'sim') ? 'AUTHORIZED' : 'DENIED';
}
export function legacyFileIsPublic(record: LegacyAcademicRecord, file: LegacyAttachment): boolean {
  return legacyAuthorization(record.provenance) === 'AUTHORIZED' &&
    legacyHistoricalFileApproved(record, file) &&
    (file.kind === 'TRABALHO_COMPLETO' ? record.publishFullWork : file.kind === 'RESUMO_EXPANDIDO' && record.publishExpandedAbstract) && /^[a-f0-9]{64}$/.test(file.sha256 || '');
}
/** Only the previously supplied historical kind/hash may be public. Consent
 * renewals and newly imported PDFs cannot expand this source boundary. */
export function legacyHistoricalFileApproved(record: LegacyAcademicRecord, file: LegacyAttachment): boolean {
  const baseline = record.provenance.publicationImportBaseline as {policy?:string;cutoffDate?:string;publicFiles?: Array<{kind:string;sha256:string;sourceUrl?:string;sourceRowFingerprint?:string;sourceFileName?:string;sourceRecordId?:string;sourcePageRecordId?:string}>;privateFileIds?:string[]} | undefined;
  return Boolean(/^[a-f0-9]{64}$/.test(file.sha256) && baseline && Array.isArray(baseline.publicFiles) &&
    !baseline.privateFileIds?.includes(file.driveFileId) &&
    baseline.publicFiles.some(f => {
      if(f.kind!==file.kind||f.sha256!==file.sha256)return false;
      if(baseline.policy!=='BODY_ROW_LINK_AND_VERIFIED_KIND_HASH_REQUIRED')return true;
      if(f.sourceRecordId!==record.id||!/^legado-\d{4}$/.test(f.sourcePageRecordId||'')||!f.sourceUrl||!f.sourceFileName||
        !/^[a-f0-9]{64}$/.test(f.sourceRowFingerprint||'')||
        !/^\d{4}-\d{2}-\d{2}$/.test(baseline.cutoffDate||'')||record.dataDefesa>baseline.cutoffDate!)return false;
      try{
        const url=new URL(f.sourceUrl);
        if(url.protocol!=='https:'||url.username||url.password||url.port||
          decodeURIComponent(url.pathname.split('/').at(-1)||'')!==f.sourceFileName)return false;
      }catch{return false;}
      const rows=record.provenance.pageRecords;
      // Source page ordinals and consolidated catalog IDs are independent.
      // Keep the captured row identity and URL intact, including its fragment.
      return Array.isArray(rows)&&rows.some(row=>row?.legacyId===f.sourcePageRecordId&&
        row.sourceFingerprint===f.sourceRowFingerprint&&Array.isArray(row.sourceLinks)&&row.sourceLinks.includes(f.sourceUrl));
    }));
}
export function legacyPublicationScopeAllowed(record: LegacyAcademicRecord, process: ProcessData): boolean {
  const request=process.acervo.publicationChange;
  for (const [kind,wanted,id,sha] of [
    ['TRABALHO_COMPLETO',request?.publishFullWork??process.acervo.publishFullWork,process.acervo.trabalhoCompletoFileId,process.acervo.trabalhoCompletoSha256],
    ['RESUMO_EXPANDIDO',request?.publishExpandedAbstract??process.acervo.publishExpandedAbstract,process.acervo.resumoExpandidoFileId,process.acervo.resumoExpandidoSha256],
  ]) {
    if (!wanted) continue;
    const file=record.attachments.find(f=>f.kind===kind&&f.driveFileId===id&&f.sha256===sha);
    if (!file || !legacyHistoricalFileApproved(record,file)) return false;
  }
  return true;
}

const legacy011BoardSource = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQucIwgv0TbpZzsFIqGvaCh7meVsKRZtF8o17sBNh604utu_cY3m4syMp7jao69-LNIBaxZzS8IcriE/pubhtml';

function legacy011Board(record: LegacyAcademicRecord): Pick<LegacyAcademicRecord, 'examinadores' | 'provenance'> {
  const { examinadores, provenance } = record;
  const [first, ...remaining] = examinadores || [];
  const names = ['Carolina Maia Martins Sales', 'Márcia Valéria de Souza Almeida'];
  // The official sheet lists both names in Membro Interno and leaves Membro Externo empty.
  if (record.id !== 'legado-0011' || record.dataDefesa !== '2025-02-21' ||
      !first || normalizePersonName(first.nome || '') !== names.join(' - ') || first.instituicao?.trim() ||
      remaining.some(person => person?.nome?.trim() || person?.instituicao?.trim())) {
    return { examinadores, provenance };
  }
  return {
    examinadores: names.map(nome => ({ nome, instituicao: 'Universidade Federal do Espírito Santo' })),
    provenance: {
      ...provenance,
      legacy011BoardCorrection: { source: legacy011BoardSource, row: 98, originalExaminers: examinadores },
    },
  };
}

/** Read compatibility for the initial private-only archive, without changing its identity. */
export function canonicalLegacyRecord(record: LegacyAcademicRecord): LegacyAcademicRecord {
  const protocol = legacyProtocol(record.id);
  // Hydration cannot rename a physical Drive file. Keep the stored display name
  // and original source basename separate; migration updates the former only
  // after the same Drive ID has actually been renamed.
  const attachments = record.attachments.map(file => ({...file, sourceFileName:file.sourceFileName||file.fileName, sha256: file.sha256 || /SHA256:([a-f0-9]{64})/.exec(file.evidence)?.[1] || ''}));
  const authorizationDecision = legacyAuthorization(record.provenance);
  const authorized = authorizationDecision === 'AUTHORIZED';
  const override=record.provenance.publicationOverride as any;
  const publishFullWork = authorized && (!override||override.publishFullWork===true) && attachments.some(f => f.kind === 'TRABALHO_COMPLETO' && /^[a-f0-9]{64}$/.test(f.sha256) && legacyHistoricalFileApproved(record,f));
  const publishExpandedAbstract = authorized && (!override||override.publishExpandedAbstract===true) && attachments.some(f => f.kind === 'RESUMO_EXPANDIDO' && /^[a-f0-9]{64}$/.test(f.sha256) && legacyHistoricalFileApproved(record,f));
  const isPublic = publishFullWork || publishExpandedAbstract;
  const { examinadores, provenance } = legacy011Board(record);
  return {...record, titulo: renderTccTitle(record.titulo), autores: record.autores.map(normalizePersonName), orientador: normalizePersonName(record.orientador), coorientador: normalizePersonName(record.coorientador), examinadores: examinadores.map(p=>({...p,nome:normalizePersonName(p.nome)})), provenance, protocolo: protocol, attachments, authorizationDecision,
    publishFullWork, publishExpandedAbstract, isPublic, publicationState: isPublic ? 'PUBLIC' : authorized ? 'AUTHORIZED' : 'NOT_REQUESTED'};
}
export function validateLegacyBatch(value: unknown): LegacyAcademicRecord[] {
  if (!Array.isArray(value) || !value.length || value.length > 500) throw new Error('Informe entre 1 e 500 trabalhos legados.');
  const ids = new Set<string>(), fingerprints = new Set<string>();
  return value.map((input): LegacyAcademicRecord => {
    if (!input || typeof input !== 'object') throw new Error('Registro legado inválido.');
    const id = bounded(input.id, 40), protocolo = bounded(input.protocolo, 40);
    const protocol = legacyProtocol(id);
    if (protocolo !== protocol && protocolo !== `Legado ${String(Number(id.slice(7))).padStart(3,'0')}`) throw new Error('Use o formato 001 - Legado, sem consumir protocolos novos.');
    const sourceFingerprint = bounded(input.sourceFingerprint, 64);
    if (!/^[a-f0-9]{64}$/.test(sourceFingerprint) || ids.has(id) || fingerprints.has(sourceFingerprint)) throw new Error('Registro legado duplicado ou sem origem.');
    ids.add(id); fingerprints.add(sourceFingerprint);
    if (!Array.isArray(input.autores) || !input.autores.length || input.autores.length > 10 || !Array.isArray(input.examinadores) || input.examinadores.length > 10 || !Array.isArray(input.palavrasChave) || input.palavrasChave.length > 20 || !Array.isArray(input.attachments) || input.attachments.length > 20) throw new Error('Dados históricos incompletos.');
    const dataDefesa = bounded(input.dataDefesa, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataDefesa) || !Number.isFinite(Date.parse(dataDefesa)) || new Date(dataDefesa).toISOString().slice(0,10) !== dataDefesa) throw new Error('Data histórica inválida.');
    const horaDefesa = bounded(input.horaDefesa, 8);
    if (horaDefesa && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(horaDefesa)) throw new Error('Horário histórico inválido.');
    const attachments = input.attachments.map((file: any) => {
      const driveFileId = bounded(file.driveFileId, 150);
      if (!/^[\w-]{10,150}$/.test(driveFileId) || !['TRABALHO_COMPLETO','RESUMO_EXPANDIDO','DOCUMENTO_ACADEMICO'].includes(file.kind)) throw new Error('Referência de PDF inválida.');
      const sha256 = bounded(file.sha256, 64);
      if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('O PDF legado precisa de um hash conferido.');
      return {driveFileId, fileName: bounded(file.fileName, 250), ...(file.sourceFileName?{sourceFileName:bounded(file.sourceFileName,250)}:{}), kind: file.kind, evidence: bounded(file.evidence, 2000), sha256};
    });
    const titulo = bounded(input.titulo, 3000), autores = input.autores.map((a: unknown) => bounded(a, 1000));
    if (!titulo || autores.some((a: string) => !a)) throw new Error('Informe título e autoria.');
    const provenance = input.provenance;
    if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance) || JSON.stringify(provenance).length > 100000) throw new Error('Origem histórica ausente ou excessiva.');
    legacyAdministrativeFiles({provenance});
    // Whitelist: no live workflow, sessions, email jobs, grades or external public links.
    const record = canonicalLegacyRecord({ id, protocolo, sourceFingerprint, titulo, autores,
      orientador: bounded(input.orientador), coorientador: bounded(input.coorientador), coorientadorInstituicao: bounded(input.coorientadorInstituicao),
      examinadores: input.examinadores.map((p: any) => ({nome: bounded(p.nome), instituicao: bounded(p.instituicao)})),
      resumo: bounded(input.resumo, 40000), palavrasChave: input.palavrasChave.map((v: unknown) => bounded(v, 500)),
      dataDefesa, horaDefesa, localDefesa: bounded(input.localDefesa, 2000),
      isPublic: false, publishFullWork: false, publishExpandedAbstract: false, publicationState: 'NOT_REQUESTED',
      authorizationDecision: 'UNSPECIFIED', attachments, provenance: structuredClone(provenance) });
    if (['isPublic','publishFullWork','publishExpandedAbstract','publicationState','authorizationDecision'].some(key => input[key] !== record[key])) throw new Error('A publicação deve corresponder à autorização de origem e aos arquivos disponíveis.');
    return record;
  });
}
export function legacyCatalogRevision(records: LegacyAcademicRecord[]): string {
  return createHash('sha256').update(JSON.stringify(records)).digest('hex');
}
export function mergeLegacyBatch(existing: LegacyAcademicRecord[], incoming: LegacyAcademicRecord[]): LegacyAcademicRecord[] {
  const merged = existing.map(canonicalLegacyRecord);
  for (const record of incoming) {
    const prior = merged.find(r => r.id === record.id || r.sourceFingerprint === record.sourceFingerprint);
    if (prior) {
      if (!isDeepStrictEqual(prior, record)) throw new Error('Um trabalho legado já existe com dados diferentes. Confira a origem antes de substituir.');
    } else merged.push(record);
  }
  return merged;
}
export function publicLegacyAcademicView(r: LegacyAcademicRecord): PublicLegacyAcademicRecord {
  // The introductory catalog text is public metadata. Publication consent applies
  // to the attached full work / expanded abstract PDFs, never to this cell.
  return {id:r.id,protocolo:r.protocolo,titulo:r.titulo,autores:r.autores,
    orientador:r.orientador,
    ...legacyFacultyPresentation(r),resumo:r.resumo,
    palavrasChave:r.palavrasChave.map(normalizeAcademicKeyword).filter(word => /[\p{L}\p{N}]/u.test(word) && !/^nenhum(?:a)?$/i.test(word)),
    dataDefesa:r.dataDefesa,horaDefesa:r.horaDefesa,localDefesa:repositoryDefenseLocation(r.localDefesa),filesRestricted:!r.attachments.some(file=>legacyFileIsPublic(r,file)),authorizationDecision:legacyAuthorization(r.provenance),
    publicFiles:r.attachments.flatMap((file,index)=>legacyFileIsPublic(r,file)?[{index,kind:file.kind,downloadUrl:`/api/legacy-academic-records/${encodeURIComponent(r.id)}/files/${index}/download`}]:[])};
}

/** This projection is served exclusively by the Master-authorized route. */
export function privateLegacyAcademicView(record: LegacyAcademicRecord): PrivateLegacyAcademicView {
  return {
    ...((record.provenance.publicationWithdrawal as any)?.withdrawnAt?{publicationWithdrawal:{withdrawnAt:String((record.provenance.publicationWithdrawal as any).withdrawnAt),drivePending:(record.provenance.publicationWithdrawal as any).drivePending===true}}:{}),
    resumo: record.resumo,
    palavrasChave: [...record.palavrasChave],
    files: record.attachments.map((file, index) => ({
      index,
      kind: file.kind,
      fileName: file.fileName,
      downloadUrl: `/api/admin/legacy-academic-records/${encodeURIComponent(record.id)}/files/${index}/download`,
      isPublic: legacyFileIsPublic(record, file),
    })),
  };
}
