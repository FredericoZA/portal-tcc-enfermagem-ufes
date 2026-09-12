import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
function replaceOnce(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`Trecho não localizado: ${label}`);
  return text.replace(search, replacement);
}

// Backup cifrado reutiliza a chave exclusiva já validada para segredos do portal.
{
  const path = 'server/integrations/integrationSecrets.ts';
  let s = read(path);
  const anchor = `export function getSecretStoreStatus() {`;
  const helper = `export function encryptPortalBackupPayload(value:string):Buffer{
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  cipher.setAAD(Buffer.from('portal-tcc:backup:v1'));
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return Buffer.from(JSON.stringify({schema:'portal-tcc-backup-v1',alg:'A256GCM',iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:encrypted.toString('base64')}),'utf8');
}

export function decryptPortalBackupPayload(payload:Buffer):string{
  const parsed=JSON.parse(payload.toString('utf8')) as {schema?:string;alg?:string;iv?:string;tag?:string;ciphertext?:string};
  if(parsed.schema!=='portal-tcc-backup-v1'||parsed.alg!=='A256GCM'||!parsed.iv||!parsed.tag||!parsed.ciphertext)throw new Error('Backup cifrado em formato inválido.');
  const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(parsed.iv,'base64'));
  decipher.setAAD(Buffer.from('portal-tcc:backup:v1'));
  decipher.setAuthTag(Buffer.from(parsed.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(parsed.ciphertext,'base64')),decipher.final()]).toString('utf8');
}

${anchor}`;
  s = replaceOnce(s, anchor, helper, 'helpers de backup cifrado');
  write(path, s);
}

// Google Drive: grava backup somente na árvore privada do sistema e relê o mesmo arquivo para o ensaio.
{
  const path = 'server/integrations/googleWorkspace.ts';
  let s = read(path);
  const anchor = `export async function bootstrapGoogleDriveStructure(accessToken?: string, options?:{rootFolderName?:string;rootFolderId?:string}): Promise<GoogleDriveManifest> {`;
  const helper = `export async function storePrivatePortalBackup(input:{accessToken:string;rootFolderId:string;fileName:string;content:Buffer;sha256:string}){
  if(!/^PORTAL_TCC_BACKUP_[0-9TZ-]+\\.ptb$/.test(input.fileName))throw new Error('Nome de backup inválido.');
  if(!/^[a-f0-9]{64}$/.test(input.sha256))throw new Error('Hash do backup inválido.');
  if(!input.content.length||input.content.length>32*1024*1024)throw new Error('Backup fora do limite seguro de 32 MB.');
  await verifyPrivateDriveFolder(input.accessToken,input.rootFolderId);
  const systemFolder=await ensureFolder(input.accessToken,DRIVE_FOLDER_NAMES.system,input.rootFolderId);
  const backupFolder=await ensureFolder(input.accessToken,'02_BACKUPS_CIFRADOS',systemFolder.file.id);
  await verifyPrivateDriveFolder(input.accessToken,backupFolder.file.id);
  const created=await uploadBinary(input.accessToken,{name:input.fileName,parentId:backupFolder.file.id,mimeType:'application/octet-stream',content:input.content,appProperties:{schema:'9',lifecycle:'encrypted-backup',sha256:input.sha256,createdAt:new Date().toISOString()}});
  return{id:created.id,name:created.name,webViewLink:created.webViewLink||\`https://drive.google.com/file/d/${'${created.id}'}/view\`,folderId:backupFolder.file.id};
}

export async function readPrivatePortalBackup(accessToken:string,fileId:string):Promise<Buffer>{
  if(!/^[a-zA-Z0-9_-]{10,}$/.test(fileId))throw new Error('ID do backup inválido.');
  const permissions=await driveJson<{permissions?:Array<{type:string;role:string}>}>(accessToken,\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(fileId)}'}/permissions?fields=permissions(type,role)&supportsAllDrives=true\`);
  if((permissions.permissions||[]).some(permission=>permission.type==='anyone'||permission.type==='domain'||permission.type==='group'))throw new Error('O backup não está restrito a usuários nominais.');
  const response=await fetch(\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(fileId)}'}?alt=media&supportsAllDrives=true\`,{headers:{Authorization:\`Bearer ${'${accessToken}'}\`},signal:AbortSignal.timeout(30_000)});
  if(!response.ok)throw new Error(\`Não foi possível reler o backup cifrado no Drive (${'${response.status}'}).\`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(!bytes.length||bytes.length>32*1024*1024)throw new Error('Backup relido fora do limite seguro.');
  return bytes;
}

${anchor}`;
  s = replaceOnce(s, anchor, helper, 'backup privado no Drive');
  write(path, s);
}

// Verificador de integridade entre estado do portal e arquivos/permissões no Drive.
{
  const path = 'server/integrations/googleDriveArchive.ts';
  let s = read(path);
  const anchor = `export async function downloadDrivePdf(accessToken:string,fileId:string,expected?:{processId?:string;artifactType?:string;signatureJobId?:string}):Promise<{pdf:Buffer;fileName:string}>{`;
  const helper = `export async function inspectPortalDriveArtifact(input:{accessToken:string;fileId:string;expectedSha256?:string;expectedVersion?:number;expectPublic:boolean;expectedSourceFileId?:string}){
  if(!/^[a-zA-Z0-9_-]{10,}$/.test(input.fileId))return{ok:false,issues:['ID de arquivo inválido.']};
  const issues:string[]=[];
  try{
    const metadataResponse=await driveRequest(\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(input.fileId)}'}?fields=id,name,mimeType,trashed,appProperties&supportsAllDrives=true\`,input.accessToken);
    const metadata=await metadataResponse.json();
    if(metadata.trashed)issues.push('Arquivo está na lixeira.');
    if(metadata.mimeType!=='application/pdf')issues.push('Arquivo não é PDF.');
    const properties=metadata.appProperties||{};
    if(input.expectedSha256&&properties.sha256&&properties.sha256!==input.expectedSha256)issues.push('Hash SHA-256 divergente.');
    if(input.expectedVersion&&properties.artifactVersion&&Number(properties.artifactVersion)!==Number(input.expectedVersion))issues.push('Versão divergente.');
    if(input.expectedSourceFileId&&properties.publicationSourceFileId!==input.expectedSourceFileId)issues.push('Cópia pública aponta para origem divergente.');
    const permissionsResponse=await driveRequest(\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(input.fileId)}'}/permissions?fields=permissions(id,type,role,domain)&supportsAllDrives=true\`,input.accessToken);
    const permissions=(await permissionsResponse.json()).permissions||[];
    const broad=permissions.filter((permission:any)=>permission.type==='anyone'||permission.type==='domain'||permission.type==='group');
    const hasPublicReader=permissions.some((permission:any)=>permission.type==='anyone'&&permission.role==='reader');
    if(input.expectPublic&&!hasPublicReader)issues.push('Cópia autorizada não possui leitura pública.');
    if(!input.expectPublic&&broad.length)issues.push('Arquivo privado possui compartilhamento amplo.');
    if(input.expectPublic&&broad.some((permission:any)=>permission.type!=='anyone'||permission.role!=='reader'))issues.push('Cópia pública possui permissão ampla além de anyone:reader.');
    return{ok:issues.length===0,issues,name:String(metadata.name||'')};
  }catch(error){return{ok:false,issues:[error instanceof Error?error.message:'Falha ao inspecionar arquivo no Drive.']};}
}

${anchor}`;
  s = replaceOnce(s, anchor, helper, 'inspeção de integridade Drive');
  write(path, s);
}

// Backend: backup real cifrado, integridade, saúde ampliada e auditoria completa.
{
  const path = 'server.ts';
  let s = read(path);
  s = replaceOnce(s,
`import { buildProcessArchiveFileName, downloadDrivePdf, ensurePortalProcessDriveFolder, publishPrivatePdfCopy, withdrawDriveFilePublicAccess, uploadGeneratedPdfToDrive, uploadProcessFormPdf, uploadProcessSourcePdf, uploadSignedPdfToDrive, type ProcessFormArchiveType } from './server/integrations/googleDriveArchive';`,
`import { buildProcessArchiveFileName, downloadDrivePdf, ensurePortalProcessDriveFolder, inspectPortalDriveArtifact, publishPrivatePdfCopy, withdrawDriveFilePublicAccess, uploadGeneratedPdfToDrive, uploadProcessFormPdf, uploadProcessSourcePdf, uploadSignedPdfToDrive, type ProcessFormArchiveType } from './server/integrations/googleDriveArchive';`, 'import inspeção Drive');
  s = replaceOnce(s,
`import { bootstrapGoogleDriveStructure, buildGoogleAuthorizationUrl, decodeGoogleOAuthState, exchangeGoogleAuthorizationCode, getGoogleOAuthSecurityPreflight, getGoogleWorkspaceAccessToken, getGoogleWorkspaceStatus, persistGoogleWorkspaceAuthorization, publishMasterDocumentModel, registerMasterDocumentModelFromDrive, sendGmailMessage, synchronizeDefenseCalendar, upsertLivingIntelligenceFile, verifyMasterDocumentModelFingerprint, verifyPrivateDriveFolder } from './server/integrations/googleWorkspace';`,
`import { bootstrapGoogleDriveStructure, buildGoogleAuthorizationUrl, decodeGoogleOAuthState, exchangeGoogleAuthorizationCode, getGoogleOAuthSecurityPreflight, getGoogleWorkspaceAccessToken, getGoogleWorkspaceStatus, persistGoogleWorkspaceAuthorization, publishMasterDocumentModel, readPrivatePortalBackup, registerMasterDocumentModelFromDrive, sendGmailMessage, storePrivatePortalBackup, synchronizeDefenseCalendar, upsertLivingIntelligenceFile, verifyMasterDocumentModelFingerprint, verifyPrivateDriveFolder } from './server/integrations/googleWorkspace';`, 'import backup Workspace');
  s = replaceOnce(s,
`import { deleteIntegrationSecret, getSecretStoreStatus } from './server/integrations/integrationSecrets';`,
`import { decryptPortalBackupPayload, deleteIntegrationSecret, encryptPortalBackupPayload, getSecretStoreStatus } from './server/integrations/integrationSecrets';`, 'import criptografia backup');

  const oldBackup = `  app.post('/api/admin/backup/drill',requireAuthenticated,requireAdministrator,(req,res)=>{const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Reautentique-se para executar o ensaio de restauração.'});const snapshot=snapshotPortalState();const serialized=JSON.stringify(snapshot);const checksum=createHash('sha256').update(serialized).digest('hex');const roundTrip=JSON.parse(serialized) as PersistedPortalState;const issues:string[]=[];if(!roundTrip.settings)issues.push('Configurações ausentes.');if(!Array.isArray(roundTrip.processes))issues.push('Coleção de processos ausente.');if((roundTrip.processes||[]).some(item=>!item.id||!item.protocolo))issues.push('Processo sem identificação obrigatória.');if(new Set((roundTrip.processes||[]).map(item=>item.id)).size!==(roundTrip.processes||[]).length)issues.push('IDs de processo duplicados.');const report={id:\`drill-${'${Date.now()}'}\`,executedAt:new Date().toISOString(),schemaVersion:3,checksumValid:checksum===createHash('sha256').update(JSON.stringify(roundTrip)).digest('hex'),restorable:issues.length===0,counts:{processes:roundTrip.processes?.length||0,memberships:roundTrip.memberships?.length||0,authorized:roundTrip.authorizedStudents?.length||0,studioVersions:roundTrip.studioVersions?.length||0},issues};auditLogsStore.push({id:\`log-${'${Date.now()}'}-drill\`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ENSAIO_RESTAURACAO_BACKUP',entityType:'system_backup',entityId:report.id,after:{restorable:report.restorable,counts:report.counts},timestamp:report.executedAt});persistPortalState();res.json(report);});`;
  const newBackup = `  app.post('/api/admin/backup/drill',requireAuthenticated,requireAdministrator,async(req,res)=>{const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Reautentique-se para executar o ensaio de restauração.'});if(!currentSettings.driveRootFolderId)return res.status(409).json({error:'Defina a pasta raiz privada do Google Drive antes de executar o backup.'});try{const snapshot=snapshotPortalState();const serialized=JSON.stringify(snapshot);const checksum=createHash('sha256').update(serialized).digest('hex');const encrypted=encryptPortalBackupPayload(serialized);const encryptedSha256=createHash('sha256').update(encrypted).digest('hex');const accessToken=await getGoogleWorkspaceAccessToken();await verifyPrivateDriveFolder(accessToken,currentSettings.driveRootFolderId);const stamp=new Date().toISOString().replace(/[:.]/g,'-');const stored=await storePrivatePortalBackup({accessToken,rootFolderId:currentSettings.driveRootFolderId,fileName:\`PORTAL_TCC_BACKUP_${'${stamp}'}.ptb\`,content:encrypted,sha256:encryptedSha256});const reread=await readPrivatePortalBackup(accessToken,stored.id);if(createHash('sha256').update(reread).digest('hex')!==encryptedSha256)throw new Error('O backup relido do Drive diverge do arquivo cifrado enviado.');const roundTrip=JSON.parse(decryptPortalBackupPayload(reread)) as PersistedPortalState;const issues:string[]=[];if(!roundTrip.settings)issues.push('Configurações ausentes.');if(!Array.isArray(roundTrip.processes))issues.push('Coleção de processos ausente.');if((roundTrip.processes||[]).some(item=>!item.id||!item.protocolo))issues.push('Processo sem identificação obrigatória.');if(new Set((roundTrip.processes||[]).map(item=>item.id)).size!==(roundTrip.processes||[]).length)issues.push('IDs de processo duplicados.');const checksumValid=checksum===createHash('sha256').update(JSON.stringify(roundTrip)).digest('hex');if(!checksumValid)issues.push('Checksum lógico divergente após restauração simulada.');const report={id:\`drill-${'${Date.now()}'}\`,executedAt:new Date().toISOString(),schemaVersion:4,backupFileId:stored.id,backupFileUrl:stored.webViewLink,encryptedSha256,sourceSha256:checksum,checksumValid,driveRoundTrip:true,restorable:issues.length===0,counts:{processes:roundTrip.processes?.length||0,memberships:roundTrip.memberships?.length||0,authorized:roundTrip.authorizedStudents?.length||0,studioVersions:roundTrip.studioVersions?.length||0},issues};auditLogsStore.push({id:\`log-${'${Date.now()}'}-drill\`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ENSAIO_RESTAURACAO_BACKUP_CIFRADO',entityType:'system_backup',entityId:stored.id,after:{restorable:report.restorable,encryptedSha256,sourceSha256:checksum,counts:report.counts},timestamp:report.executedAt});await persistPortalStateDurably();res.json(report);}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Não foi possível concluir o backup cifrado e o ensaio de restauração.'});}});`;
  s = replaceOnce(s, oldBackup, newBackup, 'backup drill real');

  s = s.replace(`const [asten,google]=await Promise.all([getPersistentAstenStatus(),getGoogleWorkspaceStatus()]);const supabase=getSupabaseRuntimeStatus();`, `const [asten,google]=await Promise.all([getPersistentAstenStatus(),getGoogleWorkspaceStatus()]);const supabase=getSupabaseRuntimeStatus();const secretStore=getSecretStoreStatus();const googleSecurity=getGoogleOAuthSecurityPreflight();`);
  s = s.replace(`{id:'google',label:'Google Workspace',status:google.connected?'NOT_CONFIRMED':'WARNING',message:google.connected?'Autorização encontrada; execute homologação real para confirmar.':'Google não conectado.'},{id:'asten'`, `{id:'google',label:'Google Workspace / Drive',status:google.connected&&googleSecurity.ready?'NOT_CONFIRMED':'WARNING',message:google.connected?(googleSecurity.ready?'Autorização encontrada; execute homologação real para confirmar escrita e privacidade.':googleSecurity.issues.join(' ')):'Google não conectado.'},{id:'gmail',label:'Gmail institucional',status:google.connected?'NOT_CONFIRMED':'WARNING',message:google.connected?'Escopo de envio configurado; o envio real deve ser confirmado no piloto controlado.':'Google não conectado.'},{id:'secret-store',label:'Cofre de segredos',status:secretStore.configured?'PASS':'FAIL',message:secretStore.configured?'Segredos cifrados com persistência durável.':'Cofre cifrado/durável não está pronto.'},{id:'asten'`);

  const integrityEndpoint = `
  app.post('/api/admin/integrity/drive',requireAuthenticated,requireAdministrator,async(req,res)=>{const identity=getPortalIdentity(req)!;if(!currentSettings.driveRootFolderId)return res.status(409).json({error:'Pasta raiz do Drive não configurada.'});try{const accessToken=await getGoogleWorkspaceAccessToken();await verifyPrivateDriveFolder(accessToken,currentSettings.driveRootFolderId);const findings:Array<{processId:string;protocol:string;artifact:string;fileId:string;ok:boolean;issues:string[]}> = [];for(const process of processesStore){const acervo=process.acervo;if(!acervo)continue;const checks=[{artifact:'TRABALHO_COMPLETO_PRIVADO',fileId:acervo.trabalhoCompletoFileId,sha:acervo.trabalhoCompletoSha256,version:acervo.trabalhoCompletoVersion,public:false},{artifact:'RESUMO_EXPANDIDO_PRIVADO',fileId:acervo.resumoExpandidoFileId,sha:acervo.resumoExpandidoSha256,version:acervo.resumoExpandidoVersion,public:false},{artifact:'TRABALHO_COMPLETO_PUBLICO',fileId:acervo.publicFullWorkFileId,sha:acervo.trabalhoCompletoSha256,version:acervo.trabalhoCompletoVersion,public:acervo.publicationState==='PUBLIC'&&Boolean(acervo.publishFullWork),source:acervo.trabalhoCompletoFileId},{artifact:'RESUMO_EXPANDIDO_PUBLICO',fileId:acervo.publicExpandedAbstractFileId,sha:acervo.resumoExpandidoSha256,version:acervo.resumoExpandidoVersion,public:acervo.publicationState==='PUBLIC'&&Boolean(acervo.publishExpandedAbstract),source:acervo.resumoExpandidoFileId}];for(const check of checks){if(!check.fileId)continue;const inspected=await inspectPortalDriveArtifact({accessToken,fileId:check.fileId,expectedSha256:check.sha,expectedVersion:check.version,expectPublic:check.public,expectedSourceFileId:check.source});findings.push({processId:process.id,protocol:process.protocolo,artifact:check.artifact,fileId:check.fileId,ok:inspected.ok,issues:inspected.issues});}}const failures=findings.filter(item=>!item.ok);const report={executedAt:new Date().toISOString(),executedBy:identity.email,checked:findings.length,failures:failures.length,ok:failures.length===0,findings};auditLogsStore.push({id:\`log-${'${Date.now()}'}-integrity\`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'VERIFICACAO_INTEGRIDADE_DRIVE',entityType:'drive_integrity',entityId:String(Date.now()),after:{checked:report.checked,failures:report.failures},timestamp:report.executedAt});await persistPortalStateDurably();res.json(report);}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Não foi possível verificar a integridade entre Portal e Drive.'});}});
`;
  const integrityAnchor = `  app.get('/api/admin/health',requireAuthenticated,requireAdministrator,async(_req,res)=>`;
  s = replaceOnce(s, integrityAnchor, integrityEndpoint + '\n' + integrityAnchor, 'endpoint integridade');

  s = s.replace(`const before={publishFullWork:process.acervo?.publishFullWork,publishExpandedAbstract:process.acervo?.publishExpandedAbstract,publicFullWorkFileId:process.acervo?.publicFullWorkFileId,publicExpandedAbstractFileId:process.acervo?.publicExpandedAbstractFileId};`, `const before={publishFullWork:process.acervo?.publishFullWork,publishExpandedAbstract:process.acervo?.publishExpandedAbstract,publicFullWorkFileId:process.acervo?.publicFullWorkFileId,publicExpandedAbstractFileId:process.acervo?.publicExpandedAbstractFileId,trabalhoCompletoVersion:process.acervo?.trabalhoCompletoVersion,trabalhoCompletoSha256:process.acervo?.trabalhoCompletoSha256,resumoExpandidoVersion:process.acervo?.resumoExpandidoVersion,resumoExpandidoSha256:process.acervo?.resumoExpandidoSha256};`);

  const homologationAnchor = `    const supabase=await testSupabaseRuntimeConnection();`;
  s = replaceOnce(s, homologationAnchor, `    const secretStore=getSecretStoreStatus();const oauthSecurity=getGoogleOAuthSecurityPreflight();\n    checks.push({id:'secret-store',label:'Cofre cifrado de segredos',status:secretStore.configured?'PASS':'FAIL',message:secretStore.configured?'Persistência cifrada pronta.':'Configure Supabase e PORTAL_SECRET_ENCRYPTION_KEY exclusiva.'});\n    checks.push({id:'google-oauth-security',label:'Segurança OAuth Google',status:oauthSecurity.ready?'PASS':'FAIL',message:oauthSecurity.ready?'State OAuth forte e separado da sessão.':oauthSecurity.issues.join(' ')});\n${homologationAnchor}`, 'checks de segurança na homologação');

  write(path, s);
}

// Cliente da interface administrativa.
{
  const path = 'src/services/apiClient.ts';
  let s = read(path);
  s = replaceOnce(s,
`  getOperationalHealth:()=>fetchApi<any>('/api/admin/health'),`,
`  getOperationalHealth:()=>fetchApi<any>('/api/admin/health'),\n  runDriveIntegrityCheck:()=>fetchApi<any>('/api/admin/integrity/drive',{method:'POST'}),`, 'cliente integridade');
  write(path, s);
}

// Painel: tornar as rotinas operacionais visíveis e executáveis sem terminal.
{
  const path = 'src/components/InfrastructureIntegrationsPanel.tsx';
  let s = read(path);
  s = replaceOnce(s, `const [homologation, setHomologation] = useState<Array<{id:string;label:string;status:'PASS'|'FAIL'|'PENDING';message:string}>>([]);`, `const [homologation, setHomologation] = useState<Array<{id:string;label:string;status:'PASS'|'FAIL'|'PENDING';message:string}>>([]);\n  const [operational, setOperational] = useState<any>(null);\n  const [backupReport, setBackupReport] = useState<any>(null);\n  const [integrityReport, setIntegrityReport] = useState<any>(null);`, 'estado operacional');
  s = replaceOnce(s, `  if (!isMaster) return`, `  const loadOperational = async () => { setWorking('health'); setMessage(null); try { const result=await apiClient.getOperationalHealth(); setOperational(result); setMessage({ok:result.overall==='HEALTHY',text:result.overall==='HEALTHY'?'Saúde operacional sem bloqueios.':'Saúde operacional carregada. Revise os itens marcados antes da abertura.'}); } catch(error){ setMessage({ok:false,text:error instanceof Error?error.message:'Falha ao consultar a saúde operacional.'}); } finally { setWorking(''); } };\n  const runBackup = async () => { setWorking('backup'); setMessage(null); try { const result=await apiClient.runBackupDrill(); setBackupReport(result); setMessage({ok:Boolean(result.restorable),text:result.restorable?'Backup cifrado salvo no Drive e restauração simulada com sucesso.':'O ensaio de restauração encontrou pendências.'}); } catch(error){ setMessage({ok:false,text:error instanceof Error?error.message:'Falha no ensaio de backup.'}); } finally { setWorking(''); } };\n  const runIntegrity = async () => { setWorking('integrity'); setMessage(null); try { const result=await apiClient.runDriveIntegrityCheck(); setIntegrityReport(result); setMessage({ok:Boolean(result.ok),text:result.ok?'Integridade entre Portal e Drive confirmada para os arquivos registrados.':\`${'${result.failures}'} divergência(s) encontrada(s) no Drive.\`}); } catch(error){ setMessage({ok:false,text:error instanceof Error?error.message:'Falha na verificação de integridade.'}); } finally { setWorking(''); } };\n\n  if (!isMaster) return`, 'ações operacionais');
  const insertion = `    <section className={card} aria-label="Operação e confiabilidade"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-slate-950">Operação e confiabilidade</h3><p className="mt-1 text-xs leading-5 text-slate-600">Diagnóstico das integrações, backup cifrado no Drive e conferência de integridade dos documentos.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={loadOperational} disabled={Boolean(working)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-[10px] font-black uppercase text-slate-800 disabled:opacity-40">Saúde operacional</button><button type="button" onClick={runIntegrity} disabled={Boolean(working)} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black uppercase text-blue-900 disabled:opacity-40">Verificar integridade</button><button type="button" onClick={runBackup} disabled={Boolean(working)} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[10px] font-black uppercase text-violet-900 disabled:opacity-40">Backup + restauração</button></div></div>{operational&&<div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{(operational.checks||[]).map((check:any)=><div key={check.id} className={\`rounded-xl border p-3 text-xs ${'${check.status===\'PASS\'?\'border-emerald-200 bg-emerald-50 text-emerald-950\':check.status===\'FAIL\'?\'border-red-200 bg-red-50 text-red-950\':\'border-amber-200 bg-amber-50 text-amber-950\'}'}\`}><strong>{check.label} · {check.status}</strong><p className="mt-1 leading-5">{check.message}</p></div>)}</div>}{integrityReport&&<div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"><strong>Integridade:</strong> {integrityReport.checked} arquivo(s) conferido(s), {integrityReport.failures} divergência(s).</div>}{backupReport&&<div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"><strong>Backup cifrado:</strong> {backupReport.restorable?'restaurável':'com pendências'} · checksum {backupReport.checksumValid?'válido':'inválido'} · cópia privada gravada no Drive.</div>}</section>\n`;
  s = replaceOnce(s, `    <div className="grid gap-4 lg:grid-cols-2">`, insertion + `    <div className="grid gap-4 lg:grid-cols-2">`, 'painel operacional');
  write(path, s);
}

fs.writeFileSync('server/integrations/integrationSecrets.backup.test.ts', `import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { decryptPortalBackupPayload, encryptPortalBackupPayload } from './integrationSecrets';\n\ntest('backup do portal é cifrado e restaura sem perda', () => {\n  const before=process.env.PORTAL_SECRET_ENCRYPTION_KEY;\n  process.env.PORTAL_SECRET_ENCRYPTION_KEY='11'.repeat(32);\n  try {\n    const source=JSON.stringify({processes:[{id:'p1'}],secret:'não deve aparecer em claro'});\n    const encrypted=encryptPortalBackupPayload(source);\n    assert.ok(!encrypted.toString('utf8').includes('não deve aparecer em claro'));\n    assert.equal(decryptPortalBackupPayload(encrypted),source);\n    const parsed=JSON.parse(encrypted.toString('utf8')); parsed.ciphertext=Buffer.from('adulterado').toString('base64');\n    assert.throws(()=>decryptPortalBackupPayload(Buffer.from(JSON.stringify(parsed))));\n  } finally { if(before===undefined) delete process.env.PORTAL_SECRET_ENCRYPTION_KEY; else process.env.PORTAL_SECRET_ENCRYPTION_KEY=before; }\n});\n`);

console.log('Confiabilidade operacional aplicada.');
