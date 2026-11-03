import type { DocumentType, ProcessData } from '../types';
import { createDriveFolder, findDriveFolderByName, type GoogleDriveFile } from './googleDriveService';

export interface DriveStructureManifest { root: GoogleDriveFile; folders: Record<string, GoogleDriveFile>; createdCount: number; existingCount: number; }
export const PORTAL_DRIVE_STRUCTURE = {
  system:'00_SISTEMA', models:'01_DOCUMENTOS', processes:'02_PROCESSOS',
  modelChildren:['01_CARTA_CONVITE','02_ATA_DEFESA','03_TERMO_AUTORIZACAO','04_DECLARACAO_PARTICIPACAO'],
  processChildren:['00_FORMULARIOS','01_TRABALHO_COMPLETO','09_COMPROVANTE_RESERVA'],
  processFormChildren:['01_CADASTRO_INICIAL']
} as const;

export function extractGoogleDriveFolderId(input: string): string { const value=String(input||'').trim(); const match=value.match(/\/folders\/([a-zA-Z0-9_-]+)/)||value.match(/[?&]id=([a-zA-Z0-9_-]+)/); const id=match?.[1]||value; if(!/^[a-zA-Z0-9_-]{10,}$/.test(id)) throw new Error('ID de pasta do Google Drive inválido.'); return id; }
async function ensure(accessToken:string,name:string,parentId:string,appProperties?:Record<string,string>) { const existing=await findDriveFolderByName(accessToken,name,parentId); return existing?{file:existing,created:false}:{file:await createDriveFolder(accessToken,name,parentId,appProperties),created:true}; }

export async function bootstrapPortalDriveStructure(accessToken:string,rootInput:string):Promise<DriveStructureManifest>{
  const rootId=extractGoogleDriveFolderId(rootInput); const root={id:rootId,name:'PORTAL_TCC',mimeType:'application/vnd.google-apps.folder'}; const folders:Record<string,GoogleDriveFile>={}; let createdCount=0,existingCount=0;
  for(const [key,name] of Object.entries({system:PORTAL_DRIVE_STRUCTURE.system,models:PORTAL_DRIVE_STRUCTURE.models,processes:PORTAL_DRIVE_STRUCTURE.processes})){const r=await ensure(accessToken,name,rootId,{portal:'portal-tcc',schema:'4',section:key});folders[key]=r.file;r.created?createdCount++:existingCount++;}
  for(const name of PORTAL_DRIVE_STRUCTURE.modelChildren){const r=await ensure(accessToken,name,folders.models.id,{portal:'portal-tcc',type:'document'});folders[`models/${name}`]=r.file;r.created?createdCount++:existingCount++;for(const lifecycle of ['00_MODELO_ATIVO','01_HISTORICO_MODELOS','02_GERADOS',...(name==='01_CARTA_CONVITE'?[]:['03_ASSINADOS'])]){const c=await ensure(accessToken,lifecycle,r.file.id,{portal:'portal-tcc',lifecycle});folders[`models/${name}/${lifecycle}`]=c.file;c.created?createdCount++:existingCount++;}}
  return {root,folders,createdCount,existingCount};
}

/** Destinations are created by uploads, so absent optional files leave no empty tree. */
export async function ensureProcessDriveStructure(accessToken:string,processesRootId:string,process:Pick<ProcessData,'id'|'protocolo'>):Promise<DriveStructureManifest>{
  const pr=await ensure(accessToken,process.protocolo,processesRootId,{portal:'portal-tcc',processId:process.id,protocol:process.protocolo});
  return {root:pr.file,folders:{process:pr.file},createdCount:Number(pr.created),existingCount:Number(!pr.created)};
}

const LABEL:Record<DocumentType,string>={CONVITE:'CARTA_CONVITE',ATA:'ATA_DEFESA',TERMO:'TERMO_AUTORIZACAO',DECLARACAO:'DECLARACAO_PARTICIPACAO'};
export function buildPortalDriveFileName(input:{protocol:string;title?:string;studentNames?:string[];documentType:DocumentType|'TRABALHO_COMPLETO'|'RESUMO_EXPANDIDO'|'ASTEN_COMPROVANTE';version:number;lifecycle:'GERADO'|'ASSINADO';extension?:string}){const clean=(value:string,max:number)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/gi,'_').replace(/^_+|_+$/g,'').toUpperCase().slice(0,max),p=clean(input.protocol,40)||'TCC_SEM_CODIGO',students=(input.studentNames||[]).map(name=>clean(name.trim().split(/\s+/)[0],45)).filter(Boolean).join('_E_').slice(0,96),title=clean(input.title||'SEM_TITULO',80)||'SEM_TITULO',label=(LABEL as Record<string,string>)[input.documentType]||input.documentType,v=String(Math.max(1,Math.floor(input.version))).padStart(3,'0'),ext=String(input.extension||'pdf').replace(/[^a-z0-9]/gi,'').toLowerCase()||'pdf';return`${p}__${students?`${students}__`:''}${label}__v${v}__${input.lifecycle}.${ext}`;}
