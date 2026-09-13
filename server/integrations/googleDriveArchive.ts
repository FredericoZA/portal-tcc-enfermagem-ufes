import { createHash } from 'node:crypto';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

const escapeQuery = (value: string) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const DOCUMENT_FOLDER:Record<string,string>={CONVITE:'03_CARTA_CONVITE',ATA:'04_ATA_DEFESA',TERMO:'05_TERMO_AUTORIZACAO',DECLARACAO:'06_DECLARACAO_COMISSAO'};
const SOURCE_FOLDER:Record<'TRABALHO_COMPLETO'|'RESUMO_EXPANDIDO',string>={TRABALHO_COMPLETO:'01_TRABALHO_COMPLETO',RESUMO_EXPANDIDO:'02_RESUMO_EXPANDIDO'};
const FORM_FOLDER={CADASTRO_INICIAL:'01_CADASTRO_INICIAL',CONFIRMACAO_LOCAL:'02_CONFIRMACAO_LOCAL',AVALIACAO:'03_AVALIACAO',DADOS_FINAIS:'04_DADOS_FINAIS'} as const;
export type ProcessFormArchiveType=keyof typeof FORM_FOLDER | (string & {});

async function driveRequest(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers || {}) } });
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

async function assertPrivateContainer(accessToken:string,fileId:string){
  const response=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions?fields=permissions(id,type,role,domain,emailAddress)&supportsAllDrives=true`,accessToken);
  const permissions=(await response.json()).permissions||[];
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
  const year=input.protocol.match(/TCC-(\d{4})-/)?.[1]||String(new Date().getFullYear());
  const yearFolder=await ensureFolder(input.accessToken,processes.id,year);
  const processFolder=await ensureFolder(input.accessToken,yearFolder.id,input.protocol);
  const processFolders=await Promise.all(['00_MANIFESTO','00_FORMULARIOS','01_TRABALHO_COMPLETO','02_RESUMO_EXPANDIDO','03_CARTA_CONVITE','04_ATA_DEFESA','05_TERMO_AUTORIZACAO','06_DECLARACAO_COMISSAO','07_COMPROVANTES_ASTEN','08_PUBLICACAO','09_COMPROVANTE_RESERVA'].map(name=>ensureFolder(input.accessToken,processFolder.id,name)));
  const formsFolder=processFolders.find(folder=>folder.name==='00_FORMULARIOS');
  if(!formsFolder)throw new Error('Não foi possível preparar a pasta de formulários do TCC.');
  await Promise.all(Object.values(FORM_FOLDER).map(name=>ensureFolder(input.accessToken,formsFolder.id,name)));
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

export async function uploadProcessFormPdf(input:{accessToken:string;processFolderId:string;processId:string;protocol:string;studentNames:string[];formType:ProcessFormArchiveType;version:number;pdf:Buffer;sha256:string}){
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
  if(existing[0]){if(existing[0].appProperties?.sha256!==input.sha256)throw new Error('Conflito de integridade na versão já arquivada do formulário.');return existing[0];}
  const fileName=buildProcessArchiveFileName({protocol:input.protocol,studentNames:input.studentNames,artifactLabel:`FORMULARIO_${input.formType}`,version:input.version});
  const boundary=`portal_form_${Date.now().toString(36)}`;
  const metadata=Buffer.from(JSON.stringify({name:fileName,parents:[destination.id],mimeType:'application/pdf',appProperties:{portal:'portal-tcc',schema:'5',portalProcessId:input.processId,formType:input.formType,formVersion:version,sha256:input.sha256}}),'utf8');
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
    const processFolder=await ensureFolder(input.accessToken,lifecycleFolder.id,input.protocol);
    parentId=processFolder.id;
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

export async function uploadGeneratedPdfToDrive(input:{rootFolderId?:string;protocol?:string;accessToken:string;processFolderId:string;processId:string;jobId:string;documentType:string;fileName:string;pdf:Buffer;sha256:string}){return uploadArtifactPdf({...input,lifecycle:'GERADO'});}
export async function uploadSignedPdfToDrive(input:{rootFolderId?:string;protocol?:string;accessToken:string;processFolderId:string;processId:string;jobId:string;documentType:string;fileName:string;pdf:Buffer;sha256:string}){return uploadArtifactPdf({...input,lifecycle:'ASSINADO'});}

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

export async function publishPrivatePdfCopy(input:{accessToken:string;processFolderId:string;sourceFileId:string;processId:string;artifactType:'TRABALHO_COMPLETO'|'RESUMO_EXPANDIDO';sha256?:string;version?:number}){
  await assertPrivateContainer(input.accessToken,input.processFolderId);
  await assertPrivateContainer(input.accessToken,input.sourceFileId);
  const sourceResponse=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(input.sourceFileId)}?fields=id,name,mimeType,trashed,appProperties&supportsAllDrives=true`,input.accessToken);
  const source=await sourceResponse.json();
  if(source.trashed||source.mimeType!=='application/pdf')throw new Error('O arquivo de origem autorizado não é um PDF disponível.');
  if(input.sha256&&source.appProperties?.sha256&&source.appProperties.sha256!==input.sha256)throw new Error('O hash do arquivo de origem diverge da versão autorizada.');
  const publicationFolder=await ensureFolder(input.accessToken,input.processFolderId,'08_PUBLICACAO');
  const query=`'${escapeQuery(publicationFolder.id)}' in parents and appProperties has { key='publicationSourceFileId' and value='${escapeQuery(input.sourceFileId)}' } and trashed = false`;
  const existingResponse=await driveRequest(`${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink,appProperties)&pageSize=2&supportsAllDrives=true&includeItemsFromAllDrives=true`,input.accessToken);
  const existing=(await existingResponse.json()).files||[];
  if(existing.length>1)throw new Error('Há cópias públicas duplicadas para a mesma versão do arquivo.');
  let file=existing[0];
  if(!file){
    const publicName=`PUBLICO__${String(source.name||input.artifactType).replace(/[^a-zA-Z0-9À-ÿ._ -]/g,"_").slice(0,150)}`;
    const copied=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(input.sourceFileId)}/copy?fields=id,name,webViewLink,appProperties&supportsAllDrives=true`,input.accessToken,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:publicName,parents:[publicationFolder.id],appProperties:{portal:'portal-tcc',portalProcessId:input.processId,artifactType:input.artifactType,publicationSourceFileId:input.sourceFileId,sha256:input.sha256||source.appProperties?.sha256||'',artifactVersion:String(input.version||source.appProperties?.artifactVersion||1),lifecycle:'PUBLIC_COPY'}})});
    file=await copied.json();
  }
  const permissionsResponse=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(file.id)}/permissions?fields=permissions(id,type,role)&supportsAllDrives=true`,input.accessToken);
  const permissions=(await permissionsResponse.json()).permissions||[];
  if(!permissions.some((permission:any)=>permission.type==='anyone'&&permission.role==='reader')){
    await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(file.id)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`,input.accessToken,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'anyone',role:'reader',allowFileDiscovery:false})});
  }
  return {id:String(file.id),webViewLink:String(file.webViewLink||`https://drive.google.com/file/d/${file.id}/view`),name:String(file.name||source.name||''),sha256:String(input.sha256||source.appProperties?.sha256||''),version:Number(input.version||source.appProperties?.artifactVersion||1)};
}

export async function withdrawDriveFilePublicAccess(accessToken:string,fileId:string):Promise<{removed:number}>{
  if(!fileId)return {removed:0};
  const response=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}/permissions?fields=permissions(id,type,role)&supportsAllDrives=true`,accessToken);
  const permissions=(await response.json()).permissions||[];
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
    const permissionsResponse=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(input.fileId)}/permissions?fields=permissions(id,type,role,domain)&supportsAllDrives=true`,input.accessToken);
    const permissions=(await permissionsResponse.json()).permissions||[];
    const broad=permissions.filter((permission:any)=>permission.type==='anyone'||permission.type==='domain'||permission.type==='group');
    const hasPublicReader=permissions.some((permission:any)=>permission.type==='anyone'&&permission.role==='reader');
    if(input.expectPublic&&!hasPublicReader)issues.push('Cópia autorizada não possui leitura pública.');
    if(!input.expectPublic&&broad.length)issues.push('Arquivo privado possui compartilhamento amplo.');
    if(input.expectPublic&&broad.some((permission:any)=>permission.type!=='anyone'||permission.role!=='reader'))issues.push('Cópia pública possui permissão ampla além de anyone:reader.');
    return{ok:issues.length===0,issues,name:String(metadata.name||'')};
  }catch(error){return{ok:false,issues:[error instanceof Error?error.message:'Falha ao inspecionar arquivo no Drive.']};}
}

export async function downloadDrivePdf(accessToken:string,fileId:string,expected?:{processId?:string;artifactType?:string;signatureJobId?:string}):Promise<{pdf:Buffer;fileName:string}>{
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
  }
  const contentResponse=await driveRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,accessToken);
  const pdf=Buffer.from(await contentResponse.arrayBuffer());
  if(pdf.length>50*1024*1024)throw new Error('O PDF armazenado ultrapassa o limite seguro de 50 MB.');
  if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('O arquivo armazenado não é um PDF válido.');
  const storedSha256=String(metadata.appProperties?.sha256||'').toLowerCase();
  if(storedSha256&&createHash('sha256').update(pdf).digest('hex')!==storedSha256)throw new Error('O conteúdo do PDF no Drive diverge do hash registrado pelo portal.');
  return{pdf,fileName:String(metadata.name||'documento.pdf').replace(/[\r\n"]/g,'_')};
}
