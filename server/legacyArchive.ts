import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { normalizePersonName } from '../src/utils/personNameCase';
import { renderTccTitle } from '../src/utils/formatters';
import { buildProcessArchiveFileName } from './integrations/googleDriveArchive';
import type { LegacyAcademicRecord, LegacyAttachment, LegacyAdministrativeFile, PublicLegacyAcademicRecord } from '../src/types/legacyArchive';

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
export function legacyProtocol(id: string): string {
  if (!/^legado-\d{4}$/.test(id) || Number(id.slice(7)) < 1 || Number(id.slice(7)) > 999) throw new Error('Identificador legado inválido.');
  return `${String(Number(id.slice(7))).padStart(3,'0')} - Legado`;
}
/** Historical consent is independent of live-process signatures and required uploads. */
export function legacyAuthorization(provenance: Record<string, unknown>): LegacyAcademicRecord['authorizationDecision'] {
  const values = Array.isArray(provenance?.originalConsent) ? provenance.originalConsent : [];
  const normalized = values.map(v => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase());
  if (!normalized.length || normalized.some(v => !['sim','nao'].includes(v))) return 'UNSPECIFIED';
  if (normalized.includes('sim') && normalized.includes('nao')) return 'CONFLICT';
  return normalized.every(v => v === 'sim') ? 'AUTHORIZED' : 'DENIED';
}
export function legacyFileIsPublic(record: LegacyAcademicRecord, file: LegacyAttachment): boolean {
  return legacyAuthorization(record.provenance) === 'AUTHORIZED' &&
    (file.kind === 'TRABALHO_COMPLETO' ? record.publishFullWork : file.kind === 'RESUMO_EXPANDIDO' && record.publishExpandedAbstract) && /^[a-f0-9]{64}$/.test(file.sha256 || '');
}
/** Read compatibility for the initial private-only archive, without changing its identity. */
export function canonicalLegacyRecord(record: LegacyAcademicRecord): LegacyAcademicRecord {
  const protocol = legacyProtocol(record.id);
  const attachments = record.attachments.map(file => ({...file, sourceFileName:file.sourceFileName||file.fileName, fileName:buildProcessArchiveFileName({protocol,studentNames:record.autores,title:record.titulo,artifactLabel:file.kind,version:1}), sha256: file.sha256 || /SHA256:([a-f0-9]{64})/.exec(file.evidence)?.[1] || ''}));
  const authorizationDecision = legacyAuthorization(record.provenance);
  const authorized = authorizationDecision === 'AUTHORIZED';
  const publishFullWork = authorized && attachments.some(f => f.kind === 'TRABALHO_COMPLETO' && /^[a-f0-9]{64}$/.test(f.sha256));
  const publishExpandedAbstract = authorized && attachments.some(f => f.kind === 'RESUMO_EXPANDIDO' && /^[a-f0-9]{64}$/.test(f.sha256));
  const isPublic = publishFullWork || publishExpandedAbstract;
  return {...record, titulo: renderTccTitle(record.titulo), autores: record.autores.map(normalizePersonName), orientador: normalizePersonName(record.orientador), coorientador: normalizePersonName(record.coorientador), examinadores: record.examinadores.map(p=>({...p,nome:normalizePersonName(p.nome)})), protocolo: protocol, attachments, authorizationDecision,
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
  return {id:r.id,protocolo:r.protocolo,titulo:r.titulo,autores:r.autores,
    orientador:r.orientador,coorientador:r.coorientador,coorientadorInstituicao:r.coorientadorInstituicao,
    examinadores:r.examinadores,resumo:legacyAuthorization(r.provenance)==='AUTHORIZED'?r.resumo:'',palavrasChave:r.palavrasChave,dataDefesa:r.dataDefesa,horaDefesa:r.horaDefesa,localDefesa:r.localDefesa,filesRestricted:!r.attachments.some(file=>legacyFileIsPublic(r,file)),authorizationDecision:legacyAuthorization(r.provenance),
    publicFiles:r.attachments.flatMap((file,index)=>legacyFileIsPublic(r,file)?[{index,kind:file.kind,downloadUrl:`/api/legacy-academic-records/${encodeURIComponent(r.id)}/files/${index}/download`}]:[])};
}
