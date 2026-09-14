import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function mustReplace(s,a,b,label){if(!s.includes(a))throw new Error(`Trecho não localizado: ${label}`);return s.replace(a,b);}
function replaceBetween(s,start,end,replacement,label){const i=s.indexOf(start);if(i<0)throw new Error(`Início não localizado: ${label}`);const j=s.indexOf(end,i);if(j<0)throw new Error(`Fim não localizado: ${label}`);return s.slice(0,i)+replacement+s.slice(j);}

// 1) Gestão da Comissão: rótulo canônico.
{
  const p='src/components/CommissionIdentityPanel.tsx';
  let s=read(p);
  s=s.replace("'Salvar comissão'","'Salvar Comissão'");
  write(p,s);
}

// 2) Paleta final: musgo sóbrio, cinza e branco; remove oliva fluorescente.
{
  const p='src/index.css';
  let s=read(p);
  const swaps=[
    ['#f0f1e7','#f6f8f7'],['#e0e3cf','#e8ecea'],['#c8ceb0','#d6ddd9'],['#aab388','#b6c2bc'],
    ['#8c9862','#91a096'],['#738044','#6f8076'],['#616d36','#52675d'],['#5f6937','#435649'],
    ['#4f582e','#344125'],['#343b20','#27382f'],['#252a16','#18271f']
  ];
  for(const [a,b] of swaps)s=s.replaceAll(a,b);
  s=s.replace('--portal-popup-action: #344125;','--portal-popup-action: #5b635e;');
  s=s.replace('--portal-new-defense-action: #435649;','--portal-new-defense-action: #5b635e;');
  s=s.replace('--portal-upload-action: #435649;','--portal-upload-action: #5b635e;');
  s=s.replace('--portal-correction-action: #435649;','--portal-correction-action: #5b635e;');
  write(p,s);
}

// 3) Ordem de assinatura isolada em função pura e testável.
write('server/workflow/signatureOrder.ts',`export interface OrderedSigner {\n  status: string;\n  signingOrder: number;\n}\n\nexport function nextPendingSignatureSigner<T extends OrderedSigner>(signers:T[]):T|undefined {\n  return signers\n    .filter((signer)=>signer.status!=='SIGNED')\n    .slice()\n    .sort((a,b)=>a.signingOrder-b.signingOrder)[0];\n}\n`);
write('server/workflow/signatureOrder.test.ts',`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { nextPendingSignatureSigner } from './signatureOrder';\n\ntest('escolhe o próximo signatário pela ordem e ignora quem já assinou',()=>{\n  const signers=[\n    {id:'advisor',status:'WAITING',signingOrder:2},\n    {id:'student-2',status:'WAITING',signingOrder:1},\n    {id:'student-1',status:'SIGNED',signingOrder:1},\n  ];\n  assert.equal(nextPendingSignatureSigner(signers)?.id,'student-2');\n  signers[1].status='SIGNED';\n  assert.equal(nextPendingSignatureSigner(signers)?.id,'advisor');\n});\n\ntest('retorna vazio quando todos já assinaram',()=>{\n  assert.equal(nextPendingSignatureSigner([{status:'SIGNED',signingOrder:1}]),undefined);\n});\n`);

// 4) Backend: recuperação do Master = Presidente; Gov.br respeita ordem e versão do PDF.
{
  const p='server.ts';
  let s=read(p);
  if(!s.includes("from './server/workflow/signatureOrder'")){
    s=mustReplace(s,"import { ataArchived, declarationReady } from './server/workflow/gates';","import { ataArchived, declarationReady } from './server/workflow/gates';\nimport { nextPendingSignatureSigner } from './server/workflow/signatureOrder';",'import signatureOrder');
  }

  const signerStart="function deriveSignatureSigners(p:ProcessData,type:'ATA'|'TERMO'|'DECLARACAO'){";
  const signerEnd='\nfunction repositoryDataComplete';
  const signerReplacement=`function deriveSignatureSigners(p:ProcessData,type:'ATA'|'TERMO'|'DECLARACAO'){\n  if(type==='ATA')return[{id:\`advisor:\${normalizeEmail(p.orientador.email)}\`,role:'ADVISOR' as const,name:p.orientador.nome,email:normalizeEmail(p.orientador.email),signingOrder:1,status:'WAITING' as const}];\n  if(type==='TERMO'){\n    const students=[p.aluno1,p.aluno2].filter(Boolean) as Array<NonNullable<ProcessData['aluno2']>>;\n    return[\n      ...students.map((student)=>({id:\`student:\${normalizeEmail(student.email)}\`,role:'STUDENT' as const,name:student.nome,email:normalizeEmail(student.email),signingOrder:1,status:'WAITING' as const})),\n      {id:\`advisor:\${normalizeEmail(p.orientador.email)}\`,role:'ADVISOR' as const,name:p.orientador.nome,email:normalizeEmail(p.orientador.email),signingOrder:2,status:'WAITING' as const}\n    ];\n  }\n  const email=normalizeEmail(currentSettings.commissionPresidentEmail||''),name=currentSettings.commissionPresidentName||'Presidente da Comissão';\n  if(!email)throw new Error('Configure o e-mail do Presidente da Comissão.');\n  return[{id:\`president:\${email}\`,role:'PRESIDENT' as const,name,email,signingOrder:1,status:'WAITING' as const}];\n}`;
  s=replaceBetween(s,signerStart,signerEnd,signerReplacement,'deriveSignatureSigners');

  const recoveryStart="  app.patch('/api/admin/recovery-emails'";
  const recoveryEnd="\n\n  app.get('/api/admin/administration-transfers'";
  const recoveryReplacement=`  app.patch('/api/admin/recovery-emails',requireAuthenticated,requireAdministrator,async(req,res)=>{\n    const identity=getPortalIdentity(req)!;\n    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de alterar o contato de recuperação.',code:'REAUTHENTICATION_REQUIRED'});\n    const presidentEmail=normalizeEmail(currentSettings.commissionPresidentEmail||'');\n    if(!presidentEmail)return res.status(409).json({error:'Defina primeiro a Presidente da Comissão e conclua a transferência do e-mail institucional.',code:'COMMISSION_PRESIDENT_REQUIRED'});\n    const input:unknown[]=Array.isArray(req.body?.emails)?req.body.emails:[];\n    const requested:string[]=Array.from(new Set<string>(input.map((value:unknown)=>normalizeEmail(String(value))).filter((value:string)=>/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value))));\n    if(requested.length!==1||requested[0]!==presidentEmail)return res.status(400).json({error:'A Presidente da Comissão é o único contato de recuperação permitido para o Master.',code:'PRESIDENT_RECOVERY_ONLY'});\n    const before=(currentSettings.masterRecoveryEmails||[]).map(value=>createHash('sha256').update(normalizeEmail(value)).digest('hex'));\n    currentSettings={...currentSettings,masterRecoveryEmails:[presidentEmail],updatedAt:new Date().toISOString()};\n    auditLogsStore.push({id:\`log-\${Date.now()}-recovery-contact\`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ALTERACAO_CONTATO_RECUPERACAO',entityType:'security',entityId:'master_recovery_email',before:{emailHashes:before},after:{emailHashes:[createHash('sha256').update(presidentEmail).digest('hex')],count:1},timestamp:currentSettings.updatedAt});\n    await persistPortalStateDurably();\n    res.json(publicSettingsForRequest(true));\n  });`;
  s=replaceBetween(s,recoveryStart,recoveryEnd,recoveryReplacement,'recovery endpoint');

  const downloadStart="  app.get('/api/signatures/jobs/:id/govbr/download'";
  const downloadEnd="\n\n  app.post('/api/signatures/jobs/:id/govbr/complete'";
  const downloadReplacement=`  app.get('/api/signatures/jobs/:id/govbr/download',requireAuthenticated,async(req,res)=>{\n    const identity=getPortalIdentity(req)!;\n    const job=signatureJobsStore.find(item=>item.id===req.params.id&&item.provider==='GOV_BR');\n    if(!job)return res.status(404).json({error:'Solicitação Gov.br não encontrada.'});\n    const process=processesStore.find(item=>item.id===job.processId);\n    if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});\n    const nextSigner=nextPendingSignatureSigner(job.signers);\n    const isNextSigner=Boolean(nextSigner&&normalizeEmail(nextSigner.email)===identity.email);\n    if(!isNextSigner&&!hasFullAdministration(identity.email))return res.status(403).json({error:'O documento está aguardando outro signatário.',code:'SIGNING_ORDER_REQUIRED'});\n    try{\n      const accessToken=await getGoogleWorkspaceAccessToken();\n      const fileId=job.driveSignedFileId||job.driveUnsignedFileId;\n      if(!fileId)throw new Error('PDF da assinatura não está disponível no Drive.');\n      const file=await downloadDrivePdf(accessToken,fileId,{processId:job.processId,artifactType:job.documentType});\n      await deliverPortalDownload({res,bytes:file.pdf,fileName:file.fileName,mimeType:'application/pdf',requesterBinding:sessionUploadBinding(identity),cacheControl:'private, no-store'});\n    }catch(error){res.status(502).json({error:error instanceof Error?error.message:'Não foi possível baixar o PDF para assinatura Gov.br.'});}\n  });`;
  s=replaceBetween(s,downloadStart,downloadEnd,downloadReplacement,'govbr download');

  const completeStart="  app.post('/api/signatures/jobs/:id/govbr/complete'";
  const completeEnd="\n\n  app.post('/api/signatures/jobs/:id/retry'";
  const completeReplacement=`  app.post('/api/signatures/jobs/:id/govbr/complete',requireAuthenticated,async(req,res)=>{\n    const identity=getPortalIdentity(req)!;\n    const job=signatureJobsStore.find(item=>item.id===req.params.id&&item.provider==='GOV_BR');\n    if(!job)return res.status(404).json({error:'Solicitação Gov.br não encontrada.'});\n    const process=processesStore.find(item=>item.id===job.processId);\n    if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});\n    const signer=nextPendingSignatureSigner(job.signers);\n    if(!signer||normalizeEmail(signer.email)!==identity.email)return res.status(403).json({error:'Somente o próximo signatário pode enviar sua versão assinada pelo Gov.br.',code:'SIGNING_ORDER_REQUIRED'});\n    try{\n      const uploadId=String(req.body?.stagedUploadId||'').trim();\n      if(!uploadId)throw new Error('Envie o PDF assinado pelo canal seguro do Portal.');\n      const previousSignedFileId=job.driveSignedFileId;\n      const result=await withSupabaseStagedUpload({uploadId,purpose:'GOV_BR_SIGNED_PDF',requesterBinding:sessionUploadBinding(identity),processId:process.id},async(file)=>{\n        if(!file.bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Envie um PDF válido.');\n        const accessToken=await getGoogleWorkspaceAccessToken();\n        const {folderId}=await ensureWorkflowProcessFolder(process);\n        const sha256=createHash('sha256').update(file.bytes).digest('hex');\n        const signerArtifactSuffix=createHash('sha256').update(\`${signer.role}|${signer.email}|${signer.signingOrder}\`).digest('hex').slice(0,10);\n        const uploaded=await uploadSignedPdfToDrive({rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,accessToken,processFolderId:folderId,processId:process.id,jobId:\`${job.id}-gov-${signer.signingOrder}-${signerArtifactSuffix}\`,documentType:job.documentType,fileName:job.fileName.replace(/\\.pdf$/i,\`__GOVBR_${signer.signingOrder}_${signerArtifactSuffix}.pdf\`),pdf:file.bytes,sha256,previousFileId:previousSignedFileId});\n        return{uploaded,sha256};\n      });\n      job.driveSignedFileId=String(result.uploaded.id);\n      job.driveSignedWebViewLink=String(result.uploaded.webViewLink||'');\n      job.signedSha256=result.sha256;\n      signer.status='SIGNED';\n      signer.signedAt=new Date().toISOString();\n      job.updatedAt=signer.signedAt;\n      const complete=job.signers.every(item=>item.status==='SIGNED');\n      job.status=complete?'ARCHIVED':'PARTIALLY_SIGNED';\n      if(complete){job.signedAt=job.updatedAt;job.completedAt=job.updatedAt;updateProcessCompletion(job.processId);}\n      auditLogsStore.push({id:\`log-\${Date.now()}-govbr\`,processId:job.processId,actorEmail:identity.email,actorRoles:[...getUserRolesForEmail(identity.email).globalRoles,...getActiveProcessRoles(identity.email,job.processId)],action:'ASSINATURA_GOVBR_RECEBIDA',entityType:'signature_job',entityId:job.id,after:{documentType:job.documentType,provider:'GOV_BR',signerRole:signer.role,signingOrder:signer.signingOrder,status:job.status,sha256:result.sha256},timestamp:job.updatedAt});\n      await persistPortalStateDurably();\n      res.json(publicSignatureJob(job));\n    }catch(error){res.status(400).json({error:error instanceof Error?error.message:'Não foi possível arquivar o PDF assinado pelo Gov.br.'});}\n  });`;
  s=replaceBetween(s,completeStart,completeEnd,completeReplacement,'govbr complete');
  write(p,s);
}

// 5) Drive: cada PDF Gov.br substitui a versão assinada anterior sem perder histórico.
{
  const p='server/integrations/googleDriveArchive.ts';
  let s=read(p);
  const old="export async function uploadSignedPdfToDrive(input:{rootFolderId?:string;protocol?:string;accessToken:string;processFolderId:string;processId:string;jobId:string;documentType:string;fileName:string;pdf:Buffer;sha256:string}){return uploadArtifactPdf({...input,lifecycle:'ASSINADO'});}";
  const replacement="export async function uploadSignedPdfToDrive(input:{rootFolderId?:string;protocol?:string;accessToken:string;processFolderId:string;processId:string;jobId:string;documentType:string;fileName:string;pdf:Buffer;sha256:string;previousFileId?:string}){const uploaded=await uploadArtifactPdf({...input,lifecycle:'ASSINADO'});if(input.previousFileId&&input.previousFileId!==String(uploaded.id))await markDriveFileSuperseded(input.accessToken,input.previousFileId,String(uploaded.id));return uploaded;}";
  s=mustReplace(s,old,replacement,'uploadSignedPdfToDrive');
  write(p,s);
}

// 6) Tela de contas: Presidente é automaticamente o único contato de recuperação do Master.
{
  const p='src/components/AuditAndSecuritySection.tsx';
  let s=read(p);
  s=s.replace(/\n  const \[recoveryEmails,setRecoveryEmails\]=useState\([^\n]+\);/,'');
  s=s.replace(/\n    setRecoveryEmails\([^\n]+\);/,'');
  s=s.replace(/\n      const contacts:string\[\]=[^\n]+;\n      res=await apiClient\.updateRecoveryEmails\(contacts\);/,'');
  const recoveryBlock=/\n        <div className="rounded-lg border border-slate-200 bg-slate-50\/70 p-3\.5">[\s\S]*?<\/div>\n\n        <div className="pt-2 flex items-center justify-end border-t border-slate-200">/;
  if(!recoveryBlock.test(s))throw new Error('Bloco visual de recuperação não localizado.');
  s=s.replace(recoveryBlock,`\n        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">\n          <p className="text-[10px] font-bold uppercase text-slate-700">Recuperação do Master</p>\n          <p className="mt-1 text-[11px] leading-5 text-slate-600">A Presidente da Comissão é automaticamente o contato de recuperação do Master. A troca de Presidente usa transferência segura com confirmação do novo titular; após a aceitação, o e-mail da Presidência passa a ser o único contato de recuperação.</p>\n          <p className="mt-1 text-[11px] font-semibold text-slate-700">Contato atual: {settings.commissionPresidentEmail || 'Presidência ainda não configurada'}</p>\n        </div>\n\n        <div className="pt-2 flex items-center justify-end border-t border-slate-200">`);
  write(p,s);
}

// 7) Contratos de regressão alinhados à implementação real.
{
  const p='server/signatureFallbackContract.test.ts';
  let s=read(p);
  s=s.replace(`test('assinatura Gov.br preserva ordem dos signatários',async()=>{\n  const server=await source('server.ts');\n  const orderExpression="filter(item=>item.status!=='SIGNED').sort((a,b)=>a.signingOrder-b.signingOrder)[0]";\n  assert.ok(server.split(orderExpression).length>=3);\n});`, `test('assinatura Gov.br preserva ordem dos signatários',async()=>{\n  const server=await source('server.ts');\n  assert.ok(server.includes("import { nextPendingSignatureSigner } from './server/workflow/signatureOrder'"));\n  assert.ok(server.split('nextPendingSignatureSigner(job.signers)').length>=3);\n  assert.ok(server.includes("role:'ADVISOR' as const,name:p.orientador.nome,email:normalizeEmail(p.orientador.email),signingOrder:2"));\n  assert.ok(server.includes("code:'SIGNING_ORDER_REQUIRED'"));\n});`);
  s=s.replace(`test('Presidência é o contato único de recuperação do Master',async()=>{\n  const [server,accounts]=await Promise.all([source('server.ts'),source('src/components/AuditAndSecuritySection.tsx')]);\n  assert.ok(server.includes('masterRecoveryEmails:[configuredPresidentEmail]'));\n  assert.ok(server.includes("const presidentEmail=normalizeEmail(currentSettings.commissionPresidentEmail||'')"));\n  assert.ok(accounts.includes('A Presidente da Comissão é automaticamente o contato de recuperação do Master'));\n  assert.ok(!accounts.includes('setRecoveryEmails'));\n});`, `test('Presidência é o contato único de recuperação do Master',async()=>{\n  const [server,accounts]=await Promise.all([source('server.ts'),source('src/components/AuditAndSecuritySection.tsx')]);\n  assert.ok(server.includes('masterRecoveryEmails:[configuredPresidentEmail]'));\n  assert.ok(server.includes("const presidentEmail=normalizeEmail(currentSettings.commissionPresidentEmail||'')"));\n  assert.ok(server.includes("requested.length!==1||requested[0]!==presidentEmail"));\n  assert.ok(server.includes("masterRecoveryEmails:[presidentEmail]"));\n  assert.ok(accounts.includes('A Presidente da Comissão é automaticamente o contato de recuperação do Master'));\n  assert.ok(!accounts.includes('setRecoveryEmails'));\n});`);
  write(p,s);
}

console.log('Fechamento de UX, recuperação administrativa e contingência de assinatura aplicado.');
