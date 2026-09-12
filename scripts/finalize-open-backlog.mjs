import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceOnce(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`Trecho não localizado: ${label}`);
  return text.replace(search, replacement);
}
function replaceRegex(text, regex, replacement, label) {
  if (!regex.test(text)) throw new Error(`Padrão não localizado: ${label}`);
  return text.replace(regex, replacement);
}

// 1) Google Drive: pasta raiz pode ter usuários nominais; links/domínios/grupos continuam proibidos.
{
  const path = 'server/integrations/googleDriveArchive.ts';
  let s = read(path);
  s = replaceOnce(s,
`async function assertPrivateContainer(accessToken:string,fileId:string){
  const response=await driveRequest(\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(fileId)}'}/permissions?fields=permissions(id,type,role,domain,emailAddress)&supportsAllDrives=true\`,accessToken);
  const permissions=(await response.json()).permissions||[];
  const unauthorized=permissions.filter((permission:any)=>permission.type!=='user'||permission.role!=='owner');
  if(unauthorized.length)throw new Error('O destino no Google Drive não é exclusivo da conta proprietária. Remova acessos por link, domínio, grupo ou usuário adicional antes de armazenar documentos sigilosos.');
}`,
`export function isUnsafePrivateContainerPermission(permission:any):boolean{
  const type=String(permission?.type||'').toLowerCase();
  const role=String(permission?.role||'').toLowerCase();
  if(type!=='user')return true;
  return !['owner','organizer','fileorganizer','writer','commenter','reader'].includes(role);
}

async function assertPrivateContainer(accessToken:string,fileId:string){
  const response=await driveRequest(\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(fileId)}'}/permissions?fields=permissions(id,type,role,domain,emailAddress)&supportsAllDrives=true\`,accessToken);
  const permissions=(await response.json()).permissions||[];
  const unauthorized=permissions.filter(isUnsafePrivateContainerPermission);
  if(unauthorized.length)throw new Error('O destino no Google Drive possui compartilhamento público, por domínio, grupo ou permissão não reconhecida. Acesso nominal de usuários autorizados pode permanecer.');
}`,
  'privacidade do container Drive');

  const marker = `export async function downloadDrivePdf(accessToken:string,fileId:string,expected?:{processId?:string;artifactType?:string;signatureJobId?:string}):Promise<{pdf:Buffer;fileName:string}>{`;
  const helpers = `export async function publishPrivatePdfCopy(input:{accessToken:string;processFolderId:string;sourceFileId:string;processId:string;artifactType:'TRABALHO_COMPLETO'|'RESUMO_EXPANDIDO';sha256?:string;version?:number}){
  await assertPrivateContainer(input.accessToken,input.processFolderId);
  await assertPrivateContainer(input.accessToken,input.sourceFileId);
  const sourceResponse=await driveRequest(\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(input.sourceFileId)}'}?fields=id,name,mimeType,trashed,appProperties&supportsAllDrives=true\`,input.accessToken);
  const source=await sourceResponse.json();
  if(source.trashed||source.mimeType!=='application/pdf')throw new Error('O arquivo de origem autorizado não é um PDF disponível.');
  if(input.sha256&&source.appProperties?.sha256&&source.appProperties.sha256!==input.sha256)throw new Error('O hash do arquivo de origem diverge da versão autorizada.');
  const publicationFolder=await ensureFolder(input.accessToken,input.processFolderId,'08_PUBLICACAO');
  const query=\`'${'${escapeQuery(publicationFolder.id)}'}' in parents and appProperties has { key='publicationSourceFileId' and value='${'${escapeQuery(input.sourceFileId)}'}' } and trashed = false\`;
  const existingResponse=await driveRequest(\`${'${DRIVE_API}'}/files?q=${'${encodeURIComponent(query)}'}&fields=files(id,name,webViewLink,appProperties)&pageSize=2&supportsAllDrives=true&includeItemsFromAllDrives=true\`,input.accessToken);
  const existing=(await existingResponse.json()).files||[];
  if(existing.length>1)throw new Error('Há cópias públicas duplicadas para a mesma versão do arquivo.');
  let file=existing[0];
  if(!file){
    const publicName=\`PUBLICO__${'${String(source.name||input.artifactType).replace(/[^a-zA-Z0-9À-ÿ._ -]/g,"_").slice(0,150)}'}\`;
    const copied=await driveRequest(\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(input.sourceFileId)}'}/copy?fields=id,name,webViewLink,appProperties&supportsAllDrives=true\`,input.accessToken,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:publicName,parents:[publicationFolder.id],appProperties:{portal:'portal-tcc',portalProcessId:input.processId,artifactType:input.artifactType,publicationSourceFileId:input.sourceFileId,sha256:input.sha256||source.appProperties?.sha256||'',artifactVersion:String(input.version||source.appProperties?.artifactVersion||1),lifecycle:'PUBLIC_COPY'}})});
    file=await copied.json();
  }
  const permissionsResponse=await driveRequest(\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(file.id)}'}/permissions?fields=permissions(id,type,role)&supportsAllDrives=true\`,input.accessToken);
  const permissions=(await permissionsResponse.json()).permissions||[];
  if(!permissions.some((permission:any)=>permission.type==='anyone'&&permission.role==='reader')){
    await driveRequest(\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(file.id)}'}/permissions?supportsAllDrives=true&sendNotificationEmail=false\`,input.accessToken,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'anyone',role:'reader',allowFileDiscovery:false})});
  }
  return {id:String(file.id),webViewLink:String(file.webViewLink||\`https://drive.google.com/file/d/${'${file.id}'}/view\`),name:String(file.name||source.name||''),sha256:String(input.sha256||source.appProperties?.sha256||''),version:Number(input.version||source.appProperties?.artifactVersion||1)};
}

export async function withdrawDriveFilePublicAccess(accessToken:string,fileId:string):Promise<{removed:number}>{
  if(!fileId)return {removed:0};
  const response=await driveRequest(\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(fileId)}'}/permissions?fields=permissions(id,type,role)&supportsAllDrives=true\`,accessToken);
  const permissions=(await response.json()).permissions||[];
  const publicPermissions=permissions.filter((permission:any)=>permission.type==='anyone');
  for(const permission of publicPermissions){
    await driveRequest(\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(fileId)}'}/permissions/${'${encodeURIComponent(permission.id)}'}?supportsAllDrives=true\`,accessToken,{method:'DELETE'});
  }
  return {removed:publicPermissions.length};
}

${marker}`;
  s = replaceOnce(s, marker, helpers, 'helpers de publicação por arquivo');
  write(path, s);
}

// 2) Asten: nunca interpretar "não assinado"/pendente/recusado como assinatura positiva.
{
  const path = 'server/integrations/asten.ts';
  let s = read(path);
  s = replaceOnce(s,
`      const signed=Boolean(signedAt)||(typeof flag==='boolean'&&flag)||['s','sim','true','1'].includes(flagText)||/assinad|conclu|finaliz/.test(statusText);`,
`      const negativeStatus=/(^|\\b)(nao[ _-]?assinado|pendente|aguardando|recusad|cancelad|expirad|nao[ _-]?conclu|nao[ _-]?finaliz)(\\b|$)/.test(statusText);
      const positiveStatus=/(^|\\b)(assinado|concluido|concluida|finalizado|finalizada)(\\b|$)/.test(statusText);
      const signed=!negativeStatus&&(Boolean(signedAt)||(typeof flag==='boolean'&&flag)||['s','sim','true','1'].includes(flagText)||positiveStatus);`,
  'status negativo da Asten');
  write(path, s);
}

// 3) Tipagem: comissão dinâmica e estado auditável de publicação.
{
  const path = 'src/types/index.ts';
  let s = read(path);
  s = replaceOnce(s,
`export interface ProcessAcervoInfo {`,
`export interface ProcessAcervoInfo {`, 'âncora acervo');
  s = replaceOnce(s,
`  publicationWithdrawalReason?: string;
  workType?: 'MONOGRAFIA' | 'ARTIGO' | 'OUTRO';`,
`  publicationWithdrawalReason?: string;
  publicFullWorkFileId?: string;
  publicFullWorkFileUrl?: string;
  publicExpandedAbstractFileId?: string;
  publicExpandedAbstractFileUrl?: string;
  publicationSyncedAt?: string;
  publicationState?: 'NOT_REQUESTED' | 'PENDING_SYNC' | 'PUBLIC' | 'WITHDRAWN';
  workType?: 'MONOGRAFIA' | 'ARTIGO' | 'OUTRO';`, 'campos de publicação');
  s = replaceOnce(s,
`export interface GlobalSettings {`,
`export interface CommissionMemberInfo {
  id: string;
  name: string;
  email?: string;
  startDate?: string;
  endDate?: string;
  active: boolean;
}

export interface GlobalSettings {`, 'tipo da comissão');
  s = replaceOnce(s,
`  commissionPresidentEmail?: string;
  isSystemBlocked?: boolean;`,
`  commissionPresidentEmail?: string;
  commissionMembers?: CommissionMemberInfo[];
  isSystemBlocked?: boolean;`, 'commissionMembers');
  write(path, s);
}

// 4) Backend: coautoria, DTO público seguro, retry imutável e sincronização pública por cópia.
{
  const path = 'server.ts';
  let s = read(path);
  s = replaceOnce(s,
`import { buildProcessArchiveFileName, downloadDrivePdf, ensurePortalProcessDriveFolder, uploadGeneratedPdfToDrive, uploadProcessFormPdf, uploadProcessSourcePdf, uploadSignedPdfToDrive, type ProcessFormArchiveType } from './server/integrations/googleDriveArchive';`,
`import { buildProcessArchiveFileName, downloadDrivePdf, ensurePortalProcessDriveFolder, publishPrivatePdfCopy, withdrawDriveFilePublicAccess, uploadGeneratedPdfToDrive, uploadProcessFormPdf, uploadProcessSourcePdf, uploadSignedPdfToDrive, type ProcessFormArchiveType } from './server/integrations/googleDriveArchive';`, 'import Drive');

  s = replaceOnce(s,
`function coauthorIsPending(process:ProcessData):boolean{return Boolean(process.aluno2&&process.coauthorAcceptance?.status==='PENDING');}
function rejectPendingCoauthor(process:ProcessData,res:express.Response):boolean{if(coauthorIsPending(process)){res.status(409).json({error:'O segundo autor precisa aceitar o vínculo antes de o fluxo continuar.',code:'COAUTHOR_ACCEPTANCE_REQUIRED'});return true;}return false;}`,
`function coauthorIsPending(process:ProcessData):boolean{return Boolean(process.aluno2&&process.coauthorAcceptance?.status==='PENDING');}
function coauthorBlocksWorkflow(process:ProcessData):boolean{return Boolean(process.aluno2&&process.coauthorAcceptance?.status!=='ACCEPTED');}
function rejectPendingCoauthor(process:ProcessData,res:express.Response):boolean{if(!coauthorBlocksWorkflow(process))return false;const rejected=process.coauthorAcceptance?.status==='REJECTED';res.status(409).json({error:rejected?'O segundo autor recusou o vínculo. Corrija a autoria antes de continuar.':'O segundo autor precisa aceitar o vínculo antes de o fluxo continuar.',code:rejected?'COAUTHOR_ACCEPTANCE_REJECTED':'COAUTHOR_ACCEPTANCE_REQUIRED'});return true;}`,
  'bloqueio de coautoria');

  const oldPublic = `function publicProcessView(p:ProcessData):any{
  // DTO por lista branca: nenhum campo interno é propagado por spread a uma rota anônima.
  return {
    id:p.id,protocolo:p.protocolo,titulo:p.titulo,etapaAtual:p.etapaAtual,status:p.status,
    aluno1:{nome:p.aluno1.nome,email:'',matricula:p.aluno1.matricula},aluno2:p.aluno2?{nome:p.aluno2.nome,email:'',matricula:p.aluno2.matricula}:null,
    orientador:{nome:p.orientador.nome,email:''},coorientador:p.coorientador?{nome:p.coorientador.nome,email:'',instituicao:p.coorientador.instituicao||''}:null,
    banca:p.banca.map(member=>({id:member.id,nome:member.nome,email:'',funcao:member.funcao,membroTipo:member.membroTipo,instituicao:member.instituicao,profissao:member.profissao,titulacao:member.titulacao})),
    defesa:{startAt:p.defesa.startAt,endAt:p.defesa.endAt,local:p.defesa.local,localStatus:p.defesa.localStatus},
    avaliacao:{status:p.avaliacao.status,resultadoCode:p.avaliacao.resultadoCode,resultadoLabel:p.avaliacao.resultadoLabel},
    acervo:p.acervo?{palavrasChave:[...(p.acervo.palavrasChave||[])],resumoSintese:p.acervo.resumoSintese,publishFullWork:Boolean(p.acervo.publishFullWork),publishExpandedAbstract:Boolean(p.acervo.publishExpandedAbstract),trabalhoCompletoFileUrl:p.acervo.publishFullWork?\`/api/public/processes/${'${p.id}'}/files/trabalho-completo/download\`:undefined,resumoExpandidoFileUrl:p.acervo.publishExpandedAbstract?\`/api/public/processes/${'${p.id}'}/files/resumo-expandido/download\`:undefined,submittedAt:p.acervo.submittedAt}:undefined,
    dataRevision:p.dataRevision,createdAt:p.createdAt,updatedAt:p.updatedAt
  };
}`;
  const newPublic = `function publicProcessView(p:ProcessData):any{
  // DTO por lista branca: nenhuma matrícula, e-mail, SIAPE, ID interno de pessoa ou vínculo do Drive sai em rota anônima.
  const repositoryState=p.status!=='CONCLUIDO'?'NOT_PRESENTED':p.acervo?.publicationState==='PUBLIC'?'PUBLIC':'PRIVATE';
  return {
    id:p.protocolo,protocolo:p.protocolo,titulo:p.titulo,etapaAtual:p.etapaAtual,status:p.status,
    aluno1:{nome:p.aluno1.nome},aluno2:p.aluno2?{nome:p.aluno2.nome}:null,
    orientador:{nome:p.orientador.nome},coorientador:p.coorientador?{nome:p.coorientador.nome,instituicao:p.coorientador.instituicao||''}:null,
    banca:p.banca.map(member=>({nome:member.nome,funcao:member.funcao,membroTipo:member.membroTipo,instituicao:member.instituicao,profissao:member.profissao,titulacao:member.titulacao})),
    defesa:{startAt:p.defesa.startAt,endAt:p.defesa.endAt,local:p.defesa.local,localStatus:p.defesa.localStatus},
    avaliacao:{status:p.avaliacao.status,resultadoCode:p.avaliacao.resultadoCode,resultadoLabel:p.avaliacao.resultadoLabel},
    acervo:p.acervo?{palavrasChave:[...(p.acervo.palavrasChave||[])],resumoSintese:p.acervo.resumoSintese,publishFullWork:repositoryState==='PUBLIC'&&Boolean(p.acervo.publishFullWork&&p.acervo.publicFullWorkFileUrl),publishExpandedAbstract:repositoryState==='PUBLIC'&&Boolean(p.acervo.publishExpandedAbstract&&p.acervo.publicExpandedAbstractFileUrl),trabalhoCompletoFileUrl:repositoryState==='PUBLIC'&&p.acervo.publishFullWork?p.acervo.publicFullWorkFileUrl:undefined,resumoExpandidoFileUrl:repositoryState==='PUBLIC'&&p.acervo.publishExpandedAbstract?p.acervo.publicExpandedAbstractFileUrl:undefined,submittedAt:p.acervo.submittedAt,publicationState:repositoryState,publicationLabel:repositoryState==='PUBLIC'?'Publicado':repositoryState==='PRIVATE'?'Não publicado pelo autor':'Não apresentado'}:undefined,
    createdAt:p.createdAt,updatedAt:p.updatedAt
  };
}`;
  s = replaceOnce(s, oldPublic, newPublic, 'DTO público');

  const archiveMarker = `async function resumeWorkflowAfterNativeFormArchive(process:ProcessData,formType:ProcessFormArchiveType,actorEmail:string,resumeRun?:WorkflowRun):Promise<void>{`;
  const retryHelper = `async function retryExistingFormArchiveJob(job:FormArchiveJob,process:ProcessData):Promise<FormArchiveJob>{
  if(job.status==='ARCHIVED')return job;
  if(!job.artifactBase64)throw new Error('A cópia imutável do formulário não está disponível para nova tentativa.');
  const pdf=Buffer.from(job.artifactBase64,'base64');
  if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('A cópia imutável do formulário não é um PDF válido.');
  const actualSha=createHash('sha256').update(pdf).digest('hex');
  if(actualSha!==job.sha256)throw new Error('A cópia imutável do formulário falhou na verificação de integridade.');
  try{
    const accessToken=await getGoogleWorkspaceAccessToken();
    if(!currentSettings.driveRootFolderId)throw new Error('Pasta raiz do Drive não configurada.');
    if(!process.driveFolderId){const folder=await ensurePortalProcessDriveFolder({accessToken,rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,processId:process.id});process.driveFolderId=folder.id;process.driveFolderUrl=folder.webViewLink;process.driveSyncedAt=new Date().toISOString();}
    const uploaded=await uploadProcessFormPdf({accessToken,processFolderId:process.driveFolderId,processId:process.id,protocol:process.protocolo,studentNames:[process.aluno1.nome,process.aluno2?.nome].filter(Boolean) as string[],formType:job.formType,version:job.version,pdf,sha256:job.sha256});
    job.status='ARCHIVED';job.driveFileId=String(uploaded.id);job.fileName=String(uploaded.name||'');job.artifactBase64='';job.lastError=undefined;job.updatedAt=new Date().toISOString();
  }catch(error){job.status='FAILED';job.lastError=error instanceof Error?error.message:'Falha ao arquivar o formulário.';job.updatedAt=new Date().toISOString();}
  await persistPortalStateDurably();return job;
}

${archiveMarker}`;
  s = replaceOnce(s, archiveMarker, retryHelper, 'retry imutável');
  s = replaceOnce(s,
`app.post('/api/admin/form-archives/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>{const identity=getPortalIdentity(req)!;const job=formArchiveJobsStore.find(item=>item.id===req.params.id);if(!job)return res.status(404).json({error:'Arquivamento não encontrado.'});const process=processesStore.find(item=>item.id===job.processId);if(!process)return res.status(409).json({error:'O processo do formulário não está disponível.'});const updated=await archiveProcessFormSnapshot(process,job.formType);if(updated.status==='ARCHIVED')await resumeWorkflowAfterNativeFormArchive(process,updated.formType,identity.email);const{artifactBase64:_artifact,...safe}=updated;res.status(updated.status==='ARCHIVED'?200:409).json(safe);});`,
`app.post('/api/admin/form-archives/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>{const identity=getPortalIdentity(req)!;const job=formArchiveJobsStore.find(item=>item.id===req.params.id);if(!job)return res.status(404).json({error:'Arquivamento não encontrado.'});const process=processesStore.find(item=>item.id===job.processId);if(!process)return res.status(409).json({error:'O processo do formulário não está disponível.'});const updated=await retryExistingFormArchiveJob(job,process);if(updated.status==='ARCHIVED')await resumeWorkflowAfterNativeFormArchive(process,updated.formType,identity.email);const{artifactBase64:_artifact,...safe}=updated;res.status(updated.status==='ARCHIVED'?200:409).json(safe);});`, 'rota retry formulário');

  const completionMarker = `function missingSignatureJobsForRevision(process:ProcessData,types:Array<'ATA'|'TERMO'|'DECLARACAO'>):string[]{`;
  const publicationHelper = `async function syncAuthorizedPublication(process:ProcessData,actorEmail:string):Promise<void>{
  if(!publicationRequested(process)){process.acervo={...process.acervo,publicationState:process.acervo?.publicationWithdrawnAt?'WITHDRAWN':'NOT_REQUESTED'};return;}
  if(!process.acervo?.authorizationConfirmedAt)throw new Error('A publicação foi solicitada, mas a autorização expressa não foi confirmada.');
  if(!process.driveFolderId)throw new Error('A pasta privada do processo ainda não está sincronizada com o Drive.');
  const accessToken=await getGoogleWorkspaceAccessToken();
  const next={...process.acervo,publicationState:'PENDING_SYNC' as const};
  if(process.acervo.publishFullWork){if(!process.acervo.trabalhoCompletoFileId)throw new Error('O PDF completo autorizado não está arquivado no Drive.');const published=await publishPrivatePdfCopy({accessToken,processFolderId:process.driveFolderId,sourceFileId:process.acervo.trabalhoCompletoFileId,processId:process.id,artifactType:'TRABALHO_COMPLETO',sha256:process.acervo.trabalhoCompletoSha256,version:process.acervo.trabalhoCompletoVersion});next.publicFullWorkFileId=published.id;next.publicFullWorkFileUrl=published.webViewLink;}
  if(process.acervo.publishExpandedAbstract){if(!process.acervo.resumoExpandidoFileId)throw new Error('O resumo expandido autorizado não está arquivado no Drive.');const published=await publishPrivatePdfCopy({accessToken,processFolderId:process.driveFolderId,sourceFileId:process.acervo.resumoExpandidoFileId,processId:process.id,artifactType:'RESUMO_EXPANDIDO',sha256:process.acervo.resumoExpandidoSha256,version:process.acervo.resumoExpandidoVersion});next.publicExpandedAbstractFileId=published.id;next.publicExpandedAbstractFileUrl=published.webViewLink;}
  const now=new Date().toISOString();next.publicationState='PUBLIC';next.publicationSyncedAt=now;process.acervo=next;
  const details={fullWork:next.publicFullWorkFileId?{fileId:next.publicFullWorkFileId,version:next.trabalhoCompletoVersion,sha256:next.trabalhoCompletoSha256}:null,expandedAbstract:next.publicExpandedAbstractFileId?{fileId:next.publicExpandedAbstractFileId,version:next.resumoExpandidoVersion,sha256:next.resumoExpandidoSha256}:null};
  auditLogsStore.push({id:\`log-${'${Date.now()}'}-publish\`,processId:process.id,actorEmail,actorRoles:getUserRolesForEmail(actorEmail).globalRoles,action:'PUBLICACAO_DRIVE_SINCRONIZADA',entityType:'publication',entityId:process.id,after:details,timestamp:now});
}

${completionMarker}`;
  s = replaceOnce(s, completionMarker, publicationHelper, 'sincronização da publicação');

  s = replaceOnce(s,
`if(declarationReady(process,signatureJobsStore))await executeConfiguredWorkflowEvent(process,'PUBLICATION_CLEARED','webhook@asten.local');updateProcessCompletion(process.id);`,
`if(declarationReady(process,signatureJobsStore)){await syncAuthorizedPublication(process,'webhook@asten.local');await executeConfiguredWorkflowEvent(process,'PUBLICATION_CLEARED','webhook@asten.local');}updateProcessCompletion(process.id);`, 'publicação antes de conclusão');

  s = replaceOnce(s,
`app.post('/api/admin/processes/:id/publication/withdraw',requireAuthenticated,requireAdministrator,(req,res)=>{`,
`app.post('/api/admin/processes/:id/publication/withdraw',requireAuthenticated,requireAdministrator,async(req,res)=>{`, 'withdraw async');
  s = replaceOnce(s,
`    const now=new Date().toISOString();
    const before={publishFullWork:process.acervo?.publishFullWork,publishExpandedAbstract:process.acervo?.publishExpandedAbstract};
    const updated:ProcessData={...process,acervo:{...process.acervo,publishFullWork:false,publishExpandedAbstract:false,isPublic:false,publicationWithdrawnAt:now,publicationWithdrawnBy:identity.email,publicationWithdrawalReason:reason},dataRevision:process.dataRevision+1,updatedAt:now};`,
`    const now=new Date().toISOString();
    const before={publishFullWork:process.acervo?.publishFullWork,publishExpandedAbstract:process.acervo?.publishExpandedAbstract,publicFullWorkFileId:process.acervo?.publicFullWorkFileId,publicExpandedAbstractFileId:process.acervo?.publicExpandedAbstractFileId};
    try{const accessToken=await getGoogleWorkspaceAccessToken();if(process.acervo?.publicFullWorkFileId)await withdrawDriveFilePublicAccess(accessToken,process.acervo.publicFullWorkFileId);if(process.acervo?.publicExpandedAbstractFileId)await withdrawDriveFilePublicAccess(accessToken,process.acervo.publicExpandedAbstractFileId);}catch(error){return res.status(502).json({error:error instanceof Error?error.message:'Não foi possível remover o acesso público no Drive.'});}
    const updated:ProcessData={...process,acervo:{...process.acervo,publishFullWork:false,publishExpandedAbstract:false,isPublic:false,publicationState:'WITHDRAWN',publicationWithdrawnAt:now,publicationWithdrawnBy:identity.email,publicationWithdrawalReason:reason},dataRevision:process.dataRevision+1,updatedAt:now};`, 'retirada real no Drive');

  s = replaceOnce(s,
`  app.get('/api/processes', (req, res) => {`,
`  app.get('/api/public/calendar',(_req,res)=>res.json(processesStore.filter(p=>p.status!=='EM_RASCUNHO'&&p.status!=='CONCLUIDO').map(publicProcessView)));
  app.get('/api/public/repository',(_req,res)=>res.json(processesStore.filter(p=>p.status==='CONCLUIDO').map(publicProcessView)));

  app.get('/api/processes', (req, res) => {`, 'DTOs públicos separados');

  write(path, s);
}

// 5) Texto de avaliação: somente resultado + parecer.
{
  const path = 'src/pages/AvaliacoesPage.tsx';
  let s = read(path);
  s = s.replace(/registre a nota final, selecione o resultado/gi, 'selecione o resultado e registre o parecer');
  write(path, s);
}
{
  const path = 'src/pages/ProcessoDetailPage.tsx';
  let s = read(path);
  s = s.replace(/LANÇAMENTO_NOTA_ATA/g, 'REGISTRO_RESULTADO_PARECER');
  s = s.replace(/Lançamento do Parecer Final e Nota: \\?\$\{pData\.avaliacao\.notaFinal\?\.toFixed\(2\)\} \([^`]*\)/g, 'Registro do resultado final e parecer da avaliação');
  s = s.replace(/pData\.avaliacao\.notaFinal !== undefined/g, "pData.avaliacao.status === 'CONCLUIDO'");
  write(path, s);
}

// 6) Smoke de produção precisa provar que o PNG realmente existe e é PNG.
{
  const path = '.github/workflows/production-smoke.yml';
  let s = read(path);
  s = replaceOnce(s,
`          root_headers="$(mktemp)"
          setup_body="$(mktemp)"`,
`          root_headers="$(mktemp)"
          logo_body="$(mktemp)"
          logo_headers="$(mktemp)"
          setup_body="$(mktemp)"`, 'temporários do logo');
  s = replaceOnce(s,
`          trap 'rm -f "$body" "$root_body" "$root_headers" "$setup_body" "$profile_body" "$auth_body" "$verification_body"' EXIT`,
`          trap 'rm -f "$body" "$root_body" "$root_headers" "$logo_body" "$logo_headers" "$setup_body" "$profile_body" "$auth_body" "$verification_body"' EXIT`, 'trap logo');
  s = replaceOnce(s,
`              grep -Eqi '<!doctype html|<html' "$root_body" || { echo 'Frontend não retornou um documento HTML válido.' >&2; exit 1; }

              setup_code=`,
`              grep -Eqi '<!doctype html|<html' "$root_body" || { echo 'Frontend não retornou um documento HTML válido.' >&2; exit 1; }

              logo_code="$(curl --silent --show-error --location --connect-timeout 10 --max-time 20 --dump-header "$logo_headers" --output "$logo_body" --write-out '%{http_code}' "$origin/colenf-logo.png" || true)"
              [ "$logo_code" = "200" ] || { echo "Logo institucional respondeu HTTP ${'${logo_code:-000}'}." >&2; exit 1; }
              grep -Eqi '^content-type:[[:space:]]*image/png' "$logo_headers" || { echo 'Logo institucional não foi servido como image/png.' >&2; exit 1; }
              [ "$(xxd -p -l 8 "$logo_body")" = "89504e470d0a1a0a" ] || { echo 'Arquivo colenf-logo.png não possui assinatura PNG válida.' >&2; exit 1; }

              setup_code=`, 'validação PNG');
  write(path, s);
}

// 7) Testes unitários das regressões encontradas.
{
  const path='server/integrations/googleDriveArchive.test.ts';
  let s=read(path);
  s=s.replace(`import { buildProcessArchiveFileName } from './googleDriveArchive';`,`import { buildProcessArchiveFileName, isUnsafePrivateContainerPermission } from './googleDriveArchive';`);
  s += `\n\ntest('pasta privada aceita usuários nominais e bloqueia compartilhamento amplo', () => {\n  assert.equal(isUnsafePrivateContainerPermission({type:'user',role:'writer',emailAddress:'secretaria@ufes.br'}), false);\n  assert.equal(isUnsafePrivateContainerPermission({type:'user',role:'reader',emailAddress:'docente@ufes.br'}), false);\n  assert.equal(isUnsafePrivateContainerPermission({type:'anyone',role:'reader'}), true);\n  assert.equal(isUnsafePrivateContainerPermission({type:'domain',role:'reader',domain:'ufes.br'}), true);\n  assert.equal(isUnsafePrivateContainerPermission({type:'group',role:'reader'}), true);\n});\n`;
  write(path,s);
}
fs.writeFileSync('server/integrations/astenSignerStatus.test.ts', `import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { assertAstenEnvelopeSigners } from './asten';\n\ntest('Asten não trata status negativo como assinatura concluída', () => {\n  assert.throws(() => assertAstenEnvelopeSigners({signatarios:[{email:'aluno@ufes.br',ordem:1,status:'Não assinado'}]},[{email:'aluno@ufes.br',order:1}]), /ainda não confirma/);\n  assert.throws(() => assertAstenEnvelopeSigners({signatarios:[{email:'aluno@ufes.br',ordem:1,status:'Pendente'}]},[{email:'aluno@ufes.br',order:1}]), /ainda não confirma/);\n  assert.doesNotThrow(() => assertAstenEnvelopeSigners({signatarios:[{email:'aluno@ufes.br',ordem:1,status:'Assinado'}]},[{email:'aluno@ufes.br',order:1}]));\n});\n`);

console.log('Pendências de go-live aplicadas.');
