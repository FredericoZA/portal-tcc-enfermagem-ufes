import { createHash } from 'node:crypto';
import {readBoundedResponse,ResponseSizeError} from '../security/boundedResponse';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

const escapeQuery = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const DOCUMENT_FOLDER:Record<string,string>={CONVITE:'03_CARTA_CONVITE',ATA:'04_ATA_DEFESA',TERMO:'05_TERMO_AUTORIZACAO',DECLARACAO:'06_DECLARACAO_COMISSAO'};
const SOURCE_FOLDER:Record<'TRABALHO_COMPLETO'|'RESUMO_EXPANDIDO',string>={TRABALHO_COMPLETO:'01_TRABALHO_COMPLETO',RESUMO_EXPANDIDO:'02_RESUMO_EXPANDIDO'};
const FORM_FOLDER={CADASTRO_INICIAL:'01_CADASTRO_INICIAL',CONFIRMACAO_LOCAL:'02_CONFIRMACAO_LOCAL',AVALIACAO:'03_AVALIACAO',DADOS_FINAIS:'04_DADOS_FINAIS'} as const;
export type ProcessFormArchiveType=keyof typeof FORM_FOLDER | (string & {});

async function driveRequest(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, signal:init.signal??AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers || {}) } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload?.error?.message || `Google Drive respondeu ${response.status}.`));
  }
  return response;
}

export function isUnsafePrivateContainerPermission(permission:any):boolean{
  const type=String(permission?.type||'').toLowerCase();
  const role=String(permission?.role||'').toLowerCase();
  if(type!=='user')return true;
  return !['owner','organizer','fileorganizer','writer','commenter','reader'].includes(role);
}

export async function listDriveFilePermissions(accessToken:string,fileId:string):Promise<any[]>{
  const permissions:any[]=[],seen=new Set<string>();
  let pageToken='';
  do{
    const params=new URLSearchParams({fields:'permissions(id,type,role,domain,emailAddress),nextPageToken',pageSize:'100',supportsAllDrives:'true',...(pageToken?{pageToken}:{})});
    const response=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions?${params}`,accessToken);
    const result=await response.json();
    if(result.permissions!==undefined&&!Array.isArray(result.permissions))throw new Error('Não foi possível conferir as permissões do Google Drive.');
    permissions.push(...(result.permissions||[]));
    if(result.nextPageToken!==undefined&&typeof result.nextPageToken!=='string')throw new Error('Paginação de permissões inválida no Google Drive.');
    pageToken=result.nextPageToken||'';
    if(pageToken){
      if(seen.has(pageToken)||seen.size>=100)throw new Error('Não foi possível concluir a conferência das permissões do Google Drive.');
      seen.add(pageToken);
    }
  }while(pageToken);
  return permissions;
}

async function assertPrivateContainer(accessToken:string,fileId:string){
  const permissions=await listDriveFilePermissions(accessToken,fileId);
  const unauthorized=permissions.filter(isUnsafePrivateContainerPermission);
  if(unauthorized.length)throw new Error('O destino no Google Drive possui compartilhamento público, por domínio, grupo ou permissão não reconhecida. Acesso nominal de usuários autorizados pode permanecer.');
}

async function ensureFolder(accessToken: string, parentId: string, name: string) {
  const query = `name = '${escapeQuery(name)}' and mimeType = 'application/vnd.google-apps.folder' and '${escapeQuery(parentId)}' in parents and trashed = false`;
  const result = await driveRequest(`${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&pageSize=2&supportsAllDrives=true&includeItemsFromAllDrives=true`, accessToken);
  const files = (await result.json()).files || [];
  if (files.length > 1) throw new Error(`Há pastas duplicadas chamadas ${name}. Corrija a estrutura antes de arquivar.`);
  if (files[0]) { await assertPrivateContainer(accessToken,String(files[0].id)); return files[0]; }
  const created = await driveRequest(`${DRIVE_API}/files?fields=id,name,webViewLink&supportsAllDrives=true`, accessToken, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId], appProperties: { portal: 'portal-tcc', lifecycle: 'signed' } })
  });
  return created.json();
}

export async function ensurePortalProcessDriveFolder(input:{accessToken:string;rootFolderId:string;protocol:string;processId:string}){
  await assertPrivateContainer(input.accessToken,input.rootFolderId);
  const processes=await ensureFolder(input.accessToken,input.rootFolderId,'02_PROCESSOS');
  const processFolder=await ensureFolder(input.accessToken,processes.id,input.protocol);
  // Each upload creates its own destination on demand. Do not pre-create
  // empty legacy document/publication trees for every new process.
  return {id:String(processFolder.id),webViewLink:String(processFolder.webViewLink||`https://drive.google.com/drive/folders/${processFolder.id}`)};
}

function archiveNamePart(value:string,max=80){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').toUpperCase().slice(0,max)||'NAO_INFORMADO';}
export function buildProcessArchiveFileName(input:{protocol:string;studentNames:string[];artifactLabel:string;version:number;title?:string;extension?:string}){
  const protocol=archiveNamePart(input.protocol,40);
  const students=input.studentNames.map(name=>archiveNamePart(name.trim().split(/\s+/)[0],48)).filter(Boolean).join('_E_').slice(0,100)||'ALUNO_NAO_INFORMADO';
  const label=archiveNamePart(input.artifactLabel,48);
  const title=input.title?archiveNamePart(input.title,80):'';
  const version=String(Math.max(1,Math.floor(input.version||1))).padStart(3,'0');
  const extension=String(input.extension||'pdf').replace(/[^a-z0-9]/gi,'').toLowerCase()||'pdf';
  return `${protocol}__${students}__${title?`${title}__`:''}${label}__v${version}.${extension}`;
}

export async function reserveProcessFormPdfId(accessToken: string): Promise<string> {
  const response = await driveRequest(`${DRIVE_API}/files/generateIds?count=1&space=drive&type=files`, accessToken);
  const id = (await response.json()).ids?.[0];
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{10,}$/.test(id)) throw new Error('O Drive não confirmou o identificador do comprovante.');
  return id;
}

export async function readProcessFormPdfById(accessToken: string, fileId: string, expected: {processId: string; formType: string; formVersion: number; allowedHashes: readonly string[]}): Promise<{pdf: Buffer; fileName: string; sha256: string} | null> {
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) throw new Error('Identificador do comprovante inválido.');
  const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id&supportsAllDrives=true`, {
    headers:{Authorization:`Bearer ${accessToken}`}, signal:AbortSignal.timeout(15_000),
  });
  if (response.status === 404) return null;
  if (!response.ok || (await response.json()).id !== fileId) throw new Error('O Drive não confirmou o arquivo arquivado.');
  const {pdf,fileName} = await downloadDrivePdf(accessToken,fileId,expected);
  const sha256 = createHash('sha256').update(pdf).digest('hex');
  if (!expected.allowedHashes.includes(sha256)) throw new Error('O PDF arquivado não corresponde a uma tentativa registrada para este comprovante.');
  return {pdf,fileName,sha256};
}

export async function uploadProcessFormPdf(input:{accessToken:string;processFolderId:string;processId:string;protocol:string;studentNames:string[];formType:ProcessFormArchiveType;version:number;pdf:Buffer;sha256:string;reservedFileId?:string}){
  if (input.reservedFileId && !/^[a-zA-Z0-9_-]{10,}$/.test(input.reservedFileId)) throw new Error('Identificador de arquivo reservado inválido.');
  await assertPrivateContainer(input.accessToken,input.processFolderId);
  if(!input.pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('O formulário gerado não é um PDF válido.');
  if(input.pdf.length>16*1024*1024)throw new Error('O PDF do formulário não pode ultrapassar 16 MB.');
  const formsRoot=await ensureFolder(input.accessToken,input.processFolderId,'00_FORMULARIOS');
  const destinationName=FORM_FOLDER[input.formType as keyof typeof FORM_FOLDER]||`05_PERSONALIZADO_${archiveNamePart(input.formType,48)}`;
  const destination=await ensureFolder(input.accessToken,formsRoot.id,destinationName);
  const version=String(Math.max(1,Math.floor(input.version||1)));
  const duplicateQuery=`'${escapeQuery(destination.id)}' in parents and appProperties has { key='portalProcessId' and value='${escapeQuery(input.processId)}' } and appProperties has { key='formType' and value='${input.formType}' } and appProperties has { key='formVersion' and value='${version}' } and trashed = false`;
  const existingResponse=await driveRequest(`${DRIVE_API}/files?q=${encodeURIComponent(duplicateQuery)}&fields=files(id,name,webViewLink,appProperties)&pageSize=2&supportsAllDrives=true&includeItemsFromAllDrives=true`,input.accessToken);
  const existing=(await existingResponse.json()).files||[];
  if(existing.length>1)throw new Error('Foram encontrados PDFs duplicados para a mesma versão do formulário.');
  if(existing[0]){if((input.reservedFileId&&existing[0].id!==input.reservedFileId)||existing[0].appProperties?.sha256!==input.sha256)throw new Error('Conflito de integridade na versão já arquivada do formulário.');return existing[0];}
  const fileName=buildProcessArchiveFileName({protocol:input.protocol,studentNames:input.studentNames,artifactLabel:`FORMULARIO_${input.formType}`,version:input.version});
  const boundary=`portal_form_${Date.now().toString(36)}`;
  const metadata=Buffer.from(JSON.stringify({...(input.reservedFileId?{id:input.reservedFileId}:{}),name:fileName,parents:[destination.id],mimeType:'application/pdf',appProperties:{portal:'portal-tcc',schema:'5',portalProcessId:input.processId,formType:input.formType,formVersion:version,sha256:input.sha256}}),'utf8');
  const body=Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,'ascii'),metadata,
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,'ascii'),input.pdf,
    Buffer.from(`\r\n--${boundary}--`,'ascii')
  ]);
  const upload=await driveRequest(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true`,input.accessToken,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
  return upload.json();
}

async function uploadArtifactPdf(input:{rootFolderId?:string;protocol?:string;accessToken:string;processFolderId:string;processId:string;jobId:string;documentType:string;lifecycle:'GERADO'|'ASSINADO';fileName:string;pdf:Buffer;sha256:string}){
  await assertPrivateContainer(input.accessToken,input.processFolderId);
  if (!input.pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('O artefato documental não é um PDF válido.');
  let parentId = input.processFolderId;
  if(input.rootFolderId && input.protocol){
    await assertPrivateContainer(input.accessToken,input.rootFolderId);
    const documents=await ensureFolder(input.accessToken,input.rootFolderId,'01_DOCUMENTOS');
    const names:Record<string,string>={CONVITE:'01_CARTA_CONVITE',ATA:'02_ATA_DEFESA',TERMO:'03_TERMO_AUTORIZACAO',DECLARACAO:'04_DECLARACAO_PARTICIPACAO'};
    const typeFolder=await ensureFolder(input.accessToken,documents.id,names[input.documentType]||input.documentType);
    const lifecycleFolder=await ensureFolder(input.accessToken,typeFolder.id,input.lifecycle==='GERADO'?'02_GERADOS':'03_ASSINADOS');
    parentId=lifecycleFolder.id;
  } else {
    const legacy=await ensureFolder(input.accessToken,input.processFolderId,DOCUMENT_FOLDER[input.documentType]||'07_COMPROVANTES_ASTEN');
    parentId=legacy.id;
  }
  const destination=input.rootFolderId&&input.protocol?{id:parentId}:await ensureFolder(input.accessToken,parentId,input.lifecycle==='GERADO'?'Gerados':'Assinados');
  const duplicateQuery = `'${escapeQuery(destination.id)}' in parents and appProperties has { key='portalSignatureJobId' and value='${escapeQuery(input.jobId)}' } and appProperties has { key='portalLifecycle' and value='${input.lifecycle}' } and trashed = false`;
  const existingResponse = await driveRequest(`${DRIVE_API}/files?q=${encodeURIComponent(duplicateQuery)}&fields=files(id,name,webViewLink,appProperties)&pageSize=2&supportsAllDrives=true&includeItemsFromAllDrives=true`, input.accessToken);
  const existing = (await existingResponse.json()).files || [];
  if (existing.length > 1) throw new Error('Foram encontrados PDFs duplicados para o mesmo trabalho de assinatura.');
  if(existing[0]){if(existing[0].appProperties?.sha256!==input.sha256)throw new Error('Conflito de integridade no arquivo já existente do Drive.');return existing[0];}

  const boundary = `portal_${Date.now().toString(36)}`;
  const metadata = Buffer.from(JSON.stringify({ name: input.fileName, parents: [destination.id], mimeType: 'application/pdf', appProperties: { portal: 'portal-tcc',schema:'7',portalProcessId:input.processId,portalSignatureJobId:input.jobId,portalLifecycle:input.lifecycle,artifactType:input.documentType,sha256:input.sha256 } }), 'utf8');
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`, 'ascii'), metadata,
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`, 'ascii'), input.pdf,
    Buffer.from(`\r\n--${boundary}--`, 'ascii')
  ]);
  const upload = await driveRequest(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true`, input.accessToken, {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body
  });
  return upload.json();
}

/** Recover only an already created invitation belonging to this exact workflow action.
 * This is a readback after a lost upload ACK; no upload/conversion or ACL change. */
export async function readExistingGeneratedInvitation(input:{accessToken:string;rootFolderId:string;processId:string;jobId:string;expectedFileId?:string}):Promise<{id:string;fileName:string;sha256:string}|null>{
  const fields='id,name,mimeType,trashed,parents,appProperties';
  let file:any;
  if(input.expectedFileId){
    if(!/^[a-zA-Z0-9_-]{10,}$/.test(input.expectedFileId))throw new Error('Identificador do convite inválido.');
    const response=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(input.expectedFileId)}?fields=${fields}&supportsAllDrives=true`,input.accessToken);
    file=await response.json();
  }else{
    const query=`appProperties has { key='portalProcessId' and value='${escapeQuery(input.processId)}' } and appProperties has { key='portalSignatureJobId' and value='${escapeQuery(input.jobId)}' } and appProperties has { key='portalLifecycle' and value='GERADO' } and trashed = false`;
    const response=await driveRequest(`${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(${fields}),nextPageToken&pageSize=2&supportsAllDrives=true&includeItemsFromAllDrives=true`,input.accessToken);
    const result=await response.json();
    if(!Array.isArray(result.files)||result.files.length>1||result.nextPageToken)throw new Error('O Drive não confirmou uma única cópia do convite desta execução.');
    file=result.files[0];if(!file)return null;
  }
  const properties=file?.appProperties||{};
  if(!file?.id||(input.expectedFileId&&file.id!==input.expectedFileId)||file.trashed||file.mimeType!=='application/pdf'||properties.portal!=='portal-tcc'
    ||properties.portalProcessId!==input.processId||properties.portalSignatureJobId!==input.jobId
    ||properties.portalLifecycle!=='GERADO'||properties.artifactType!=='CONVITE'||!/^[a-f0-9]{64}$/.test(properties.sha256||'')){
    throw new Error('O convite existente não corresponde à revisão desta execução.');
  }
  let parents=file.parents;let inside=false;
  for(let depth=0;depth<8;depth++){
    if(!Array.isArray(parents)||parents.length!==1||typeof parents[0]!=='string')break;
    if(parents[0]===input.rootFolderId){inside=true;break;}
    const response=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(parents[0])}?fields=id,mimeType,trashed,parents&supportsAllDrives=true`,input.accessToken);
    const parent=await response.json();
    if(parent.trashed||parent.mimeType!=='application/vnd.google-apps.folder'||parent.id!==parents[0])break;
    parents=parent.parents;
  }
  if(!inside)throw new Error('O convite não pertence à raiz privada deste Portal.');
  const {pdf,fileName}=await downloadDrivePdf(input.accessToken,String(file.id),{processId:input.processId,artifactType:'CONVITE',signatureJobId:input.jobId});
  const sha256=createHash('sha256').update(pdf).digest('hex');
  if(sha256!==properties.sha256)throw new Error('O hash do convite existente não foi confirmado.');
  return {id:String(file.id),fileName,sha256};
}

export async function uploadGeneratedPdfToDrive(input:{rootFolderId?:string;protocol?:string;accessToken:string;processFolderId:string;processId:string;jobId:string;documentType:string;fileName:string;pdf:Buffer;sha256:string}){return uploadArtifactPdf({...input,lifecycle:'GERADO'});}
export async function uploadSignedPdfToDrive(input:{rootFolderId?:string;protocol?:string;accessToken:string;processFolderId:string;processId:string;jobId:string;documentType:string;fileName:string;pdf:Buffer;sha256:string;previousFileId?:string}){const uploaded=await uploadArtifactPdf({...input,lifecycle:'ASSINADO'});if(input.previousFileId&&input.previousFileId!==String(uploaded.id))await markDriveFileSuperseded(input.accessToken,input.previousFileId,String(uploaded.id));return uploaded;}

export function buildSupersededAppProperties(existing:Record<string,string>|undefined,supersededBy:string,supersededAt:string){
  return {...(existing||{}),lifecycle:'SUPERSEDED',supersededBy,supersededAt};
}

async function markDriveFileSuperseded(accessToken:string,fileId:string,supersededBy:string){
  if(!fileId||fileId===supersededBy)return;
  const currentResponse=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,appProperties&supportsAllDrives=true`,accessToken);
  const current=await currentResponse.json();
  const appProperties=buildSupersededAppProperties(current.appProperties,String(supersededBy),new Date().toISOString());
  await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id&supportsAllDrives=true`,accessToken,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({appProperties})});
}

export async function uploadProcessSourcePdf(input:{accessToken:string;processFolderId:string;processId:string;artifactType:'TRABALHO_COMPLETO'|'RESUMO_EXPANDIDO'|'COMPROVANTE_LOCAL';fileName:string;version:number;previousFileId?:string;pdf:Buffer;sha256:string}){
  await assertPrivateContainer(input.accessToken,input.processFolderId);
  if(!input.pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Envie um arquivo PDF válido.');
  if(input.pdf.length>24*1024*1024)throw new Error('O PDF não pode ultrapassar 24 MB.');
  const destination=await ensureFolder(input.accessToken,input.processFolderId,input.artifactType==='COMPROVANTE_LOCAL'?'09_COMPROVANTE_RESERVA':SOURCE_FOLDER[input.artifactType]);
  const duplicateQuery=`'${escapeQuery(destination.id)}' in parents and appProperties has { key='portalProcessId' and value='${escapeQuery(input.processId)}' } and appProperties has { key='artifactType' and value='${input.artifactType}' } and appProperties has { key='sha256' and value='${input.sha256}' } and trashed = false`;
  const existingResponse=await driveRequest(`${DRIVE_API}/files?q=${encodeURIComponent(duplicateQuery)}&fields=files(id,name,webViewLink,appProperties)&pageSize=2&supportsAllDrives=true&includeItemsFromAllDrives=true`,input.accessToken);
  const existing=(await existingResponse.json()).files||[];
  if(existing.length>1)throw new Error('Foram encontrados arquivos duplicados para este TCC.');
  if(existing[0]){
    if(input.previousFileId&&input.previousFileId!==String(existing[0].id))await markDriveFileSuperseded(input.accessToken,input.previousFileId,String(existing[0].id));
    return existing[0];
  }
  const safeName=String(input.fileName||`${input.artifactType}.pdf`).replace(/[^a-zA-Z0-9À-ÿ._ -]/g,'_').slice(0,150);
  const fileName=safeName.toLowerCase().endsWith('.pdf')?safeName:`${safeName}.pdf`;
  const boundary=`portal_source_${Date.now().toString(36)}`;
  const metadata=Buffer.from(JSON.stringify({name:fileName,parents:[destination.id],mimeType:'application/pdf',appProperties:{portal:'portal-tcc',schema:'6',portalProcessId:input.processId,artifactType:input.artifactType,artifactVersion:String(Math.max(1,input.version)),lifecycle:'CURRENT',sha256:input.sha256}}),'utf8');
  const body=Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,'ascii'),metadata,
    Buffer.from(`\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,'ascii'),input.pdf,
    Buffer.from(`\r\n--${boundary}--`,'ascii')
  ]);
  const upload=await driveRequest(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true`,input.accessToken,{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body});
  const created=await upload.json();
  if(input.previousFileId&&input.previousFileId!==created.id)await markDriveFileSuperseded(input.accessToken,input.previousFileId,String(created.id));
  return created;
}

/** Publication serves the authorized process source through the Portal; Drive remains private. */
export async function preparePrivatePublicationSource(input:{accessToken:string;processFolderId:string;sourceFileId:string;processId:string;artifactType:'TRABALHO_COMPLETO'|'RESUMO_EXPANDIDO';sha256?:string;version?:number}){
  await assertPrivateContainer(input.accessToken,input.processFolderId);
  if(!/^[a-f0-9]{64}$/i.test(input.sha256||''))throw new Error('O arquivo autorizado precisa de um hash SHA-256 válido.');
  const source=await downloadDrivePdf(input.accessToken,input.sourceFileId,{processId:input.processId,artifactType:input.artifactType});
  if(createHash('sha256').update(source.pdf).digest('hex')!==input.sha256!.toLowerCase())throw new Error('O arquivo mudou desde a autorização de publicação.');
  const kind=input.artifactType==='TRABALHO_COMPLETO'?'trabalho-completo':'resumo-expandido';
  return {id:input.sourceFileId,webViewLink:`/api/public/processes/${encodeURIComponent(input.processId)}/files/${kind}/download`,name:source.fileName,sha256:input.sha256!,version:input.version||1};
}

export async function withdrawDriveFilePublicAccess(accessToken:string,fileId:string):Promise<{removed:number}>{
  if(!fileId)return {removed:0};
  const permissions=await listDriveFilePermissions(accessToken,fileId);
  const publicPermissions=permissions.filter((permission:any)=>permission.type==='anyone');
  for(const permission of publicPermissions){
    await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permission.id)}?supportsAllDrives=true`,accessToken,{method:'DELETE'});
  }
  return {removed:publicPermissions.length};
}

export async function inspectPortalDriveArtifact(input:{accessToken:string;fileId:string;expectedSha256?:string;expectedVersion?:number;expectPublic:boolean;expectedSourceFileId?:string}){
  if(!/^[a-zA-Z0-9_-]{10,}$/.test(input.fileId))return{ok:false,issues:['ID de arquivo inválido.']};
  const issues:string[]=[];
  try{
    const metadataResponse=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(input.fileId)}?fields=id,name,mimeType,trashed,appProperties&supportsAllDrives=true`,input.accessToken);
    const metadata=await metadataResponse.json();
    if(metadata.trashed)issues.push('Arquivo está na lixeira.');
    if(metadata.mimeType!=='application/pdf')issues.push('Arquivo não é PDF.');
    const properties=metadata.appProperties||{};
    if(input.expectedSha256&&properties.sha256&&properties.sha256!==input.expectedSha256)issues.push('Hash SHA-256 divergente.');
    if(input.expectedVersion&&properties.artifactVersion&&Number(properties.artifactVersion)!==Number(input.expectedVersion))issues.push('Versão divergente.');
    if(input.expectedSourceFileId&&properties.publicationSourceFileId!==input.expectedSourceFileId)issues.push('Cópia pública aponta para origem divergente.');
    const permissions=await listDriveFilePermissions(input.accessToken,input.fileId);
    const broad=permissions.filter(isUnsafePrivateContainerPermission);
    const hasPublicReader=permissions.some((permission:any)=>permission.type==='anyone'&&permission.role==='reader');
    if(input.expectPublic&&!hasPublicReader)issues.push('Cópia autorizada não possui leitura pública.');
    if(!input.expectPublic&&broad.length)issues.push('Arquivo privado possui compartilhamento amplo.');
    if(input.expectPublic&&broad.some((permission:any)=>permission.type!=='anyone'||permission.role!=='reader'))issues.push('Cópia pública possui permissão ampla além de anyone:reader.');
    return{ok:issues.length===0,issues,name:String(metadata.name||'')};
  }catch(error){return{ok:false,issues:[error instanceof Error?error.message:'Falha ao inspecionar arquivo no Drive.']};}
}

export async function downloadDrivePdf(accessToken:string,fileId:string,expected?:{processId?:string;artifactType?:string;signatureJobId?:string;formType?:string;formVersion?:number}):Promise<{pdf:Buffer;fileName:string}>{
  if(!/^[a-zA-Z0-9_-]{10,}$/.test(fileId))throw new Error('Identificador de arquivo inválido.');
  await assertPrivateContainer(accessToken,fileId);
  const metadataResponse=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,trashed,appProperties,parents&supportsAllDrives=true`,accessToken);
  const metadata=await metadataResponse.json();
  if(metadata.trashed||metadata.mimeType!=='application/pdf')throw new Error('O arquivo solicitado não é um PDF disponível.');
  if(expected){
    const properties=metadata.appProperties||{};
    if(properties.portal!=='portal-tcc')throw new Error('O arquivo não pertence ao Portal de TCC.');
    if(expected.processId&&properties.portalProcessId!==expected.processId)throw new Error('O arquivo não pertence a este processo de TCC.');
    if(expected.artifactType&&properties.artifactType!==expected.artifactType)throw new Error('O tipo do arquivo não corresponde ao documento solicitado.');
    if(expected.signatureJobId&&properties.portalSignatureJobId!==expected.signatureJobId)throw new Error('O arquivo não pertence a esta solicitação de assinatura.');
    if(expected.formType&&(properties.formType!==expected.formType||Number(properties.formVersion)!==expected.formVersion))throw new Error('A versão do formulário não corresponde ao comprovante solicitado.');
  }
  const contentResponse=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,accessToken);
  let pdf:Buffer;
  try{pdf=await readBoundedResponse(contentResponse,50*1024*1024);}
  catch(error){if(error instanceof ResponseSizeError)throw new Error('O PDF armazenado ultrapassa o limite seguro de 50 MB ou possui tamanho inválido.');throw error;}
  if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('O arquivo armazenado não é um PDF válido.');
  const storedSha256=String(metadata.appProperties?.sha256||'').toLowerCase();
  if(storedSha256&&createHash('sha256').update(pdf).digest('hex')!==storedSha256)throw new Error('O conteúdo do PDF no Drive diverge do hash registrado pelo portal.');
  return{pdf,fileName:String(metadata.name||'documento.pdf').replace(/[\r\n"]/g,'_')};
}

export async function renamePortalProcessFolder(input:{accessToken:string;fileId:string;previousProtocol:string;protocol:string}){
 await assertPrivateContainer(input.accessToken,input.fileId);
 const response=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(input.fileId)}?fields=id,name,mimeType,trashed&supportsAllDrives=true`,input.accessToken);
 const folder=await response.json();
 if(folder.trashed||folder.mimeType!=='application/vnd.google-apps.folder'||folder.name!==input.previousProtocol)throw new Error('A pasta do processo mudou no Drive. Confira a sincronização antes de alterar o protocolo.');
 await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(input.fileId)}?fields=id,name&supportsAllDrives=true`,input.accessToken,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:input.protocol})});
}

/** Delete only the selected process tree, after checking its ancestry and protecting shared/model resources. */
export async function deleteProcessDriveArtifacts(input:{accessToken:string;processId:string;protocol:string;protocolAliases?:string[];folderId?:string;rootFolderId:string;fileIds:string[];protectedIds:string[];jobIds?:string[]}):Promise<void>{
 if(!input.processId.trim())throw Error('O vínculo do TCC é necessário para a limpeza do Drive.');
 const protectedIds=new Set([input.rootFolderId,...input.protectedIds].filter(Boolean)),done=new Set<string>(),active=new Set<string>();
 const jobIds=new Set((input.jobIds||[]).filter(Boolean));
 const get=async(id:string)=>{
  if(!id)return null;
  if(!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('Identificador de arquivo do Drive inválido.');
  const response=await fetch(`${DRIVE_API}/files/${encodeURIComponent(id)}?fields=id,name,mimeType,parents,appProperties&supportsAllDrives=true`,{headers:{Authorization:`Bearer ${input.accessToken}`},signal:AbortSignal.timeout(15000)});
  if(response.status===404||response.status===410)return null;
  if(!response.ok)throw Error(`Drive: não foi possível conferir o arquivo (${response.status}).`);
  return response.json();
 };
 const listIds=async(query:string):Promise<string[]>=>{
  const ids=new Set<string>(),seen=new Set<string>();let pageToken='';
  do{
   const params=new URLSearchParams({q:query,fields:'files(id),nextPageToken',pageSize:'1000',supportsAllDrives:'true',includeItemsFromAllDrives:'true',...(pageToken?{pageToken}:{})});
   const response=await driveRequest(`${DRIVE_API}/files?${params}`,input.accessToken),result=await response.json();
   if(result.files!==undefined&&!Array.isArray(result.files))throw Error('Drive: inventário de exclusão inválido.');
   for(const file of result.files||[]){if(typeof file.id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(file.id))throw Error('Drive: identificador inválido no inventário.');ids.add(file.id);}
   if(result.nextPageToken!==undefined&&typeof result.nextPageToken!=='string')throw Error('Drive: paginação de exclusão inválida.');
   pageToken=result.nextPageToken||'';
   if(pageToken){if(seen.has(pageToken)||seen.size>=100)throw Error('Drive: não foi possível concluir o inventário de exclusão.');seen.add(pageToken);}
  }while(pageToken);
  return [...ids];
 };
 const folderMime='application/vnd.google-apps.folder';
 const officialYear=/^[A-Z0-9_-]{1,16}-([1-9]\d{3})-\d+$/.exec(input.protocol)?.[1];
 const verifyProcessFolder=async(id:string):Promise<string>=>{
  if(protectedIds.has(id))throw Error('A pasta configurada é compartilhada com outro recurso e foi preservada.');
  const folder=await get(id);if(!folder)return '';
  // An identity migration may retain the original folder name. Historical names
  // authorize only the exact folder already pinned in the deletion manifest.
  const expectedName=folder.name===input.protocol?input.protocol
    :id===input.folderId&&input.protocolAliases?.includes(folder.name)?folder.name:undefined;
  const folderYear=/^[A-Z0-9_-]{1,16}-([1-9]\d{3})-\d+$/.exec(expectedName||'')?.[1];
  const parent=await get(folder.parents?.[0]||'');
  const annual=parent?.mimeType===folderMime&&/^\d{4}$/.test(String(parent.name||''));
  const processRoot=annual?await get(parent.parents?.[0]||''):parent;
  if(folder.mimeType!==folderMime||!expectedName||processRoot?.mimeType!==folderMime||processRoot.name!=='02_PROCESSOS'||!processRoot.parents?.includes(input.rootFolderId)||(annual&&folderYear&&parent.name!==folderYear))throw Error('A pasta não pertence à árvore deste TCC.');
  protectedIds.add(String(parent.id));protectedIds.add(String(processRoot.id));
  return id;
 };
 let verifiedFolder=input.folderId?await verifyProcessFolder(input.folderId):'';
 if(!verifiedFolder&&input.rootFolderId){
  const childFolders=(parentId:string,name:string)=>listIds(`'${escapeQuery(parentId)}' in parents and name = '${escapeQuery(name)}' and mimeType = '${folderMime}' and trashed = false`);
  const processRoots=await childFolders(input.rootFolderId,'02_PROCESSOS');
  if(processRoots.length>1)throw Error('Drive: há pastas 02_PROCESSOS duplicadas; a exclusão foi interrompida.');
  if(processRoots[0]){
   const processRoot=await get(processRoots[0]);
   if(!processRoot||processRoot.mimeType!==folderMime||processRoot.name!=='02_PROCESSOS'||!processRoot.parents?.includes(input.rootFolderId))throw Error('A pasta não pertence à árvore deste TCC.');
   protectedIds.add(processRoots[0]);
   const matches=new Set(await childFolders(processRoots[0],input.protocol));
   if(officialYear){
    const years=await childFolders(processRoots[0],officialYear);
    if(years.length>1)throw Error('Drive: há pastas anuais duplicadas; a exclusão foi interrompida.');
    if(years[0]){
     const year=await get(years[0]);
     if(!year||year.mimeType!==folderMime||year.name!==officialYear||!year.parents?.includes(processRoots[0]))throw Error('A pasta anual não pertence à árvore deste TCC.');
     protectedIds.add(years[0]);
     for(const id of await childFolders(years[0],input.protocol))matches.add(id);
    }
   }
   if(matches.size>1)throw Error('Drive: há mais de uma pasta com o protocolo deste TCC; a exclusão foi interrompida.');
   if(matches.size)verifiedFolder=await verifyProcessFolder([...matches][0]);
  }
 }
 const candidates=new Set(input.fileIds.filter(id=>!id.startsWith('local_')));
 const processQuery=`appProperties has { key='portalProcessId' and value='${escapeQuery(input.processId)}' }`;
 const allJobs=[...jobIds];
 for(let offset=0;offset<Math.max(1,allJobs.length);offset+=20){
  const terms=[...(offset===0?[processQuery]:[]),...allJobs.slice(offset,offset+20).map(id=>`appProperties has { key='portalSignatureJobId' and value='${escapeQuery(id)}' }`)];
  for(const id of await listIds(terms.map(term=>`(${term})`).join(' or ')))candidates.add(id);
 }
 const remove=async(id:string,parentId?:string):Promise<void>=>{
  if(done.has(id))return;
  if(protectedIds.has(id))throw Error('Um arquivo compartilhado com outro TCC ou modelo foi preservado.');
  if(active.has(id))throw Error('Drive: foi encontrado um ciclo na árvore de arquivos.');
  const file=await get(id);if(!file){done.add(id);return;}
  const properties=file.appProperties||{};
  if(properties.portalProcessId&&properties.portalProcessId!==input.processId)throw Error('Arquivo de outro processo foi preservado.');
  if(['active-model','historical-model'].includes(String(properties.lifecycle||'')))throw Error('Um modelo documental foi preservado.');
  const processMatches=properties.portalProcessId===input.processId;
  if(properties.portalSignatureJobId&&!jobIds.has(properties.portalSignatureJobId)&&!processMatches)throw Error('Arquivo de outra solicitação de assinatura foi preservado.');
  const jobMatches=properties.portal==='portal-tcc'&&jobIds.has(properties.portalSignatureJobId);
  const parentMatches=Boolean(parentId&&Array.isArray(file.parents)&&file.parents.includes(parentId));
  if(id!==verifiedFolder&&!processMatches&&!jobMatches&&!parentMatches)throw Error('Não foi possível comprovar o vínculo de um arquivo ao TCC.');
  active.add(id);
  try{
   if(file.mimeType==='application/vnd.google-apps.folder')for(const childId of await listIds(`'${escapeQuery(id)}' in parents`))await remove(childId,id);
   const deleted=await fetch(`${DRIVE_API}/files/${encodeURIComponent(id)}?supportsAllDrives=true`,{method:'DELETE',headers:{Authorization:`Bearer ${input.accessToken}`},signal:AbortSignal.timeout(15000)});
   if(!deleted.ok&&deleted.status!==404&&deleted.status!==410)throw Error(`Drive: exclusão não confirmada (${deleted.status}).`);
   done.add(id);
  }finally{active.delete(id);}
 };
 if(verifiedFolder)await remove(verifiedFolder);
 for(const id of candidates)await remove(id);
}
