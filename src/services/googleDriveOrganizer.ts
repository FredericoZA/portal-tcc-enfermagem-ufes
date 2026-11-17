import type { DocumentType, ProcessData } from '../types';
import { createDriveFolder, findDriveFolderByName, listDriveFiles, type GoogleDriveFile } from './googleDriveService';
import {buildDriveProcessFileName,buildDriveProcessFolderName,DRIVE_ACADEMIC_FOLDER_NAMES,DRIVE_ACADEMIC_FOLDER_ALIASES} from '../utils/driveProcessLayout';
import {DRIVE_DOCUMENT_MODEL_FOLDERS,DRIVE_MODEL_LIFECYCLE_FOLDERS} from '../utils/driveDocumentModels';

export interface DriveStructureManifest { root: GoogleDriveFile; folders: Record<string, GoogleDriveFile>; createdCount: number; existingCount: number; }
export const PORTAL_DRIVE_STRUCTURE = {
  models:DRIVE_ACADEMIC_FOLDER_NAMES.documents, processes:DRIVE_ACADEMIC_FOLDER_NAMES.processes,
  modelChildren:Object.values(DRIVE_DOCUMENT_MODEL_FOLDERS).map(folder=>folder.name),
  processChildren:[], processFormChildren:[]
} as const;

export function extractGoogleDriveFolderId(input: string): string { const value=String(input||'').trim(); const match=value.match(/\/folders\/([a-zA-Z0-9_-]+)/)||value.match(/[?&]id=([a-zA-Z0-9_-]+)/); const id=match?.[1]||value; if(!/^[a-zA-Z0-9_-]{10,}$/.test(id)) throw new Error('ID de pasta do Google Drive inválido.'); return id; }
async function ensure(accessToken:string,name:string,parentId:string,appProperties?:Record<string,string>,aliases:readonly string[]=[name],properties?:Record<string,string>) {
  const matches=new Map<string,GoogleDriveFile>();
  for(const alias of new Set([name,...aliases])){const existing=await findDriveFolderByName(accessToken,alias,parentId);if(existing)matches.set(existing.id,existing);}
  if(matches.size>1)throw new Error('Há mais de uma pasta para o mesmo destino do Portal.');
  const existing=[...matches.values()][0];
  return existing?{file:existing,created:false}:{file:await createDriveFolder(accessToken,name,parentId,appProperties,properties),created:true};
}

export async function bootstrapPortalDriveStructure(accessToken:string,rootInput:string):Promise<DriveStructureManifest>{
  const rootId=extractGoogleDriveFolderId(rootInput); const root={id:rootId,name:'PORTAL_TCC',mimeType:'application/vnd.google-apps.folder'}; const folders:Record<string,GoogleDriveFile>={}; let createdCount=0,existingCount=0;
  for(const [key,name] of Object.entries({models:PORTAL_DRIVE_STRUCTURE.models,processes:PORTAL_DRIVE_STRUCTURE.processes})){const r=await ensure(accessToken,name,rootId,{portal:'portal-tcc',schema:'10',section:key},key==='models'?DRIVE_ACADEMIC_FOLDER_ALIASES.documents:DRIVE_ACADEMIC_FOLDER_ALIASES.processes);folders[key]=r.file;r.created?createdCount++:existingCount++;}
  for(const [type,definition] of Object.entries(DRIVE_DOCUMENT_MODEL_FOLDERS)){
    const r=await ensure(accessToken,definition.name,folders.models.id,{portal:'portal-tcc',type:'document'},definition.aliases);folders[`models/${definition.name}`]=r.file;r.created?createdCount++:existingCount++;
    if(!['CONVITE','ATA','TERMO','DECLARACAO'].includes(type))continue;
    for(const [key,lifecycle] of Object.entries(DRIVE_MODEL_LIFECYCLE_FOLDERS)){const c=await ensure(accessToken,lifecycle.name,r.file.id,{portal:'portal-tcc',lifecycle:key},lifecycle.aliases);folders[`models/${definition.name}/${key}`]=c.file;c.created?createdCount++:existingCount++;}
  }
  return {root,folders,createdCount,existingCount};
}

/** Destinations are created by uploads, so absent optional files leave no empty tree. */
export async function ensureProcessDriveStructure(accessToken:string,processesRootId:string,process:Pick<ProcessData,'id'|'protocolo'>&Partial<Pick<ProcessData,'aluno1'|'aluno2'|'legacyRecord'|'driveFolderId'>>):Promise<DriveStructureManifest>{
  const name=buildDriveProcessFolderName({protocol:process.protocolo,studentNames:[process.aluno1?.nome,process.aluno2?.nome].filter(Boolean) as string[],legacy:process.legacyRecord});
  const read=async(id:string):Promise<GoogleDriveFile>=>{
    const response=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,trashed,parents,webViewLink,appProperties,properties&supportsAllDrives=true`,{headers:{Authorization:`Bearer ${accessToken}`}});
    if(!response.ok)throw new Error('A pasta vinculada ao processo não está disponível.');
    const file=await response.json();if(file.id!==id||file.trashed||file.mimeType!=='application/vnd.google-apps.folder')throw new Error('O destino vinculado não é uma pasta ativa.');return file;
  };
  let existing:GoogleDriveFile|undefined;
  if(process.driveFolderId){
    existing=await read(process.driveFolderId);
    if(existing.parents?.length!==1)throw new Error('A origem da pasta do processo não foi confirmada.');
    if(existing.parents[0]!==processesRootId){const parent=await read(existing.parents[0]);if(!/^\d{4}$/.test(parent.name)||parent.parents?.length!==1||parent.parents[0]!==processesRootId)throw new Error('A pasta não pertence à raiz de processos configurada.');}
  }else{
    const escape=(value:string)=>value.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const candidates=await listDriveFiles(accessToken,`'${escape(processesRootId)}' in parents and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='portalProcessId' and value='${escape(process.id)}' }`);
    if(candidates.length>1)throw new Error('Há pastas duplicadas para este processo.');existing=candidates[0];
  }
  const pr=existing?{file:existing,created:false}:await ensure(accessToken,name,processesRootId,{portal:'portal-tcc',portalProcessId:process.id,protocol:process.protocolo},[name,process.protocolo],{portalDriveLayout:'flat-v1'});
  const owner=pr.file.appProperties?.portalProcessId||pr.file.appProperties?.processId;
  if(owner&&owner!==process.id)throw new Error('A pasta encontrada pertence a outro processo.');
  const updateName=Boolean((process.aluno1?.nome||process.aluno2?.nome)&&pr.file.name!==name);
  if(updateName||pr.file.properties?.portalDriveLayout!=='flat-v1'){
    const response=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(pr.file.id)}?fields=id&supportsAllDrives=true`,{method:'PATCH',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({...(updateName?{name}:{}),properties:{...pr.file.properties,portalDriveLayout:'flat-v1'}})});
    if(!response.ok)throw new Error('Não foi possível confirmar a organização da pasta do processo.');
  }
  return {root:pr.file,folders:{process:pr.file},createdCount:Number(pr.created),existingCount:Number(!pr.created)};
}

export function buildPortalDriveFileName(input:{protocol:string;title?:string;studentNames?:string[];documentType:DocumentType|'TRABALHO_COMPLETO'|'RESUMO_EXPANDIDO'|'ASTEN_COMPROVANTE';version:number;lifecycle:'GERADO'|'ASSINADO';extension?:string}){return buildDriveProcessFileName({...input,kind:input.documentType});}
