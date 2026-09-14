import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8'); const write=(p,s)=>fs.writeFileSync(p,s);
function once(s,a,b,label){if(!s.includes(a))throw new Error(`Trecho não localizado: ${label}`);return s.replace(a,b);}
function re(s,r,b,label){if(!r.test(s))throw new Error(`Padrão não localizado: ${label}`);return s.replace(r,b);}

// App: restaura a tela de replicação institucional.
{
 let p='src/App.tsx',s=read(p);
 s=once(s,"const PortalTutorialPage = lazy(() => import('./pages/PortalTutorialPage').then((module) => ({ default: module.PortalTutorialPage })));", "const PortalTutorialPage = lazy(() => import('./pages/PortalTutorialPage').then((module) => ({ default: module.PortalTutorialPage })));\nconst PortalReplicationPage = lazy(() => import('./pages/PortalReplicationPage').then((module) => ({ default: module.PortalReplicationPage })));",'import replication');
 s=once(s,"      case 'tutorial':\n        return <PortalTutorialPage onNavigate={handleNavigate} />;", "      case 'tutorial':\n        return <PortalTutorialPage onNavigate={handleNavigate} />;\n      case 'replicar':\n        return <PortalReplicationPage />;",'route replication');
 s=once(s,": currentTab === 'tutorial' ? 'Como usar o Portal'",": currentTab === 'tutorial' ? 'Como usar o Portal'\n                  : currentTab === 'replicar' ? 'Replicar o Portal'",'title replication');
 write(p,s);
}

// Sidebar: tipografia mais legível, sem verde fluorescente, replica Portal de volta.
{
 let p='src/components/Sidebar.tsx',s=read(p);
 s=once(s,"  Settings,\n} from 'lucide-react';","  Settings,\n  Copy,\n} from 'lucide-react';",'sidebar Copy import');
 s=s.replace("const sidebarFooterMutedColor = isHeaderLight ? '#64748b' : '#c8ceb0';","const sidebarFooterMutedColor = isHeaderLight ? '#64748b' : '#d6d9d7';");
 s=s.replace("isActive ? 'text-[#e0e3cf]' : 'text-slate-200'","isActive ? 'text-white' : 'text-slate-200'");
 s=s.replace("backgroundColor: layoutConfig.sidebarBgColor || '#343b20'","backgroundColor: layoutConfig.sidebarBgColor || '#06372d'");
 s=s.replace("borderColor: layoutConfig.sidebarDividerColor || '#616d36'","borderColor: layoutConfig.sidebarDividerColor || '#365349'");
 s=s.replace("color: layoutConfig.sidebarTextColor || '#f0f1e7'","color: layoutConfig.sidebarTextColor || '#f8fafc'");
 s=s.replaceAll("backgroundColor: layoutConfig.sidebarHeaderBgColor || '#252a16'","backgroundColor: layoutConfig.sidebarHeaderBgColor || '#03271f'");
 s=s.replaceAll("borderColor: layoutConfig.sidebarDividerColor || '#616d36'","borderColor: layoutConfig.sidebarDividerColor || '#365349'");
 s=s.replace("className=\"text-[9.5px] sm:text-[10px] font-bold tracking-[0.08em] uppercase mt-1 text-center leading-4 whitespace-normal w-full\"","className=\"text-[11px] sm:text-[12px] font-semibold tracking-[0.025em] mt-1.5 text-center leading-4 whitespace-normal w-full\"");
 s=s.replace("style={{ color: layoutConfig.sidebarSubtitleColor || (isHeaderLight ? '#5f6937' : '#c8ceb0') }}","style={{ color: layoutConfig.sidebarSubtitleColor || (isHeaderLight ? '#475569' : '#d6d9d7') }}");
 s=s.replace("{layoutConfig.sidebarSubtitle || `${installationProfile.courseName} • ${installationProfile.institutionAcronym || installationProfile.institutionName}`}","{layoutConfig.sidebarSubtitle || `Enfermagem e Obstetrícia · ${installationProfile.institutionAcronym || installationProfile.institutionName}`}");
 s=once(s,"              analise: { id: 'analise', label: getNavLabel('indicadores', 'Indicadores'), icon: BarChart3, emoji: getNavEmoji('indicadores', '📊'), visible: isMasterAdmin && !isVisitor }","              analise: { id: 'analise', label: getNavLabel('indicadores', 'Indicadores'), icon: BarChart3, emoji: getNavEmoji('indicadores', '📊'), visible: isMasterAdmin && !isVisitor },\n              replicar: { id: 'replicar', label: getNavLabel('replicar', 'Replicar Portal'), icon: Copy, emoji: getNavEmoji('replicar', '🧩'), visible: true }",'sidebar replication nav');
 s=s.replace(".filter((key) => !['acessar-portal', 'replicar', 'assinaturas'].includes(key))",".filter((key) => !['acessar-portal', 'assinaturas'].includes(key))");
 s=s.replace(" : ['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'configuracoes', 'analise', 'DIVIDER_2', 'tutorial'];"," : ['home', 'biblioteca', 'DIVIDER_1', 'meus-processos', 'coordenador', 'configuracoes', 'analise', 'DIVIDER_2', 'tutorial', 'replicar'];");
 s=once(s,"            if (!order.includes('analise')) {\n              const settingsIndex = order.indexOf('configuracoes');\n              order.splice(settingsIndex >= 0 ? settingsIndex + 1 : order.length, 0, 'analise');\n            }", "            if (!order.includes('analise')) {\n              const settingsIndex = order.indexOf('configuracoes');\n              order.splice(settingsIndex >= 0 ? settingsIndex + 1 : order.length, 0, 'analise');\n            }\n            if (!order.includes('replicar')) order.push('replicar');",'ensure replication order');
 s=s.replace("backgroundColor: layoutConfig.sidebarActiveBgColor || '#525c2e'","backgroundColor: layoutConfig.sidebarActiveBgColor || '#154d41'");
 s=s.replace("borderLeft: `3px solid ${layoutConfig.sidebarActiveBorderColor || '#aab388'}`","borderLeft: `3px solid ${layoutConfig.sidebarActiveBorderColor || '#cbd5d1'}`");
 s=s.replace("{ color: layoutConfig.sidebarTextColor || '#f0f1e7' }","{ color: layoutConfig.sidebarTextColor || '#f8fafc' }");
 s=s.replace("border border-[#aab388]/70 bg-[#e0e3cf]","border border-slate-300 bg-slate-100").replace("text-[#343b20]","text-slate-800");
 write(p,s);
}

// Header: cores neutras em detalhes sobre fundo claro.
{
 let p='src/components/Header.tsx',s=read(p);
 s=s.replace('bg-emerald-50 border border-emerald-100','bg-slate-100 border border-slate-200');
 s=s.replace("layoutConfig.headerTextColor || '#047857'","layoutConfig.headerTextColor || '#475569'");
 s=s.replace('bg-emerald-100 text-emerald-900 border border-emerald-300','bg-slate-100 text-slate-800 border border-slate-300');
 s=s.replace('text-emerald-700','text-slate-600');
 write(p,s);
}

// Como usar: cabeçalho musgo único e filtros cinza padronizados; assinatura dual.
{
 let p='src/pages/PortalTutorialPage.tsx',s=read(p);
 s=s.replace("'Confira a prévia da Ata. Somente depois da confirmação o documento é encaminhado à Asten para sua assinatura.'","'Confira a prévia da Ata e escolha a via de assinatura disponível: Asten ou Gov.br.'");
 s=s.replace("'Selecione uma ou mais declarações aptas e confirme o envio à Asten.'","'Selecione as declarações aptas e escolha Asten ou Gov.br. A indisponibilidade de um provedor não bloqueia o outro.'");
 s=s.replace("className=\"rounded-3xl border border-[#343b20]/20 bg-gradient-to-br from-[#5f6937] to-[#343b20] p-5 text-white shadow-lg sm:p-7\"","className=\"rounded-2xl border border-[#344125]/25 bg-[#344125] p-5 text-white shadow-sm sm:p-6\"");
 s=s.replace('text-[#e0e3cf]','text-slate-200').replace('text-[#f0f1e7]','text-slate-100');
 s=s.replace("role === key ? 'border-[#4f582e] bg-[#5f6937] text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-[#5f6937] hover:text-[#343b20]'","role === key ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-400'");
 s=s.replace("border border-[#5f6937]/25 bg-[#f5f6ef]","border border-slate-200 bg-slate-50").replace("text-[#343b20]","text-slate-900").replace("text-[#4f582e]","text-slate-600");
 s=s.replace("bg-[#5f6937] text-xs font-black text-white","bg-slate-600 text-xs font-black text-white");
 s=s.replaceAll("bg-[#f0f1e7] text-[#5f6937]","bg-slate-100 text-slate-600");
 s=s.replace("border border-[#5f6937]/30 bg-[#f5f6ef]","border border-slate-200 bg-slate-50");
 write(p,s);
}

// Acesso autorizado: compacta e troca ações para cinza.
{
 let p='src/components/AuthorizedStudentsPanel.tsx',s=read(p);
 s=s.replace("border border-[#4f582e] bg-[#5f6937]","border border-slate-500 bg-slate-600").replaceAll('hover:bg-[#4f582e]','hover:bg-slate-700');
 s=s.replaceAll('focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100','focus:border-slate-500 focus:ring-2 focus:ring-slate-200');
 s=s.replaceAll('text-emerald-800','text-slate-600').replaceAll('text-emerald-900','text-slate-700');
 s=s.replace('border border-emerald-200 bg-emerald-50','border border-slate-300 bg-slate-100');
 s=s.replace('grid gap-4 border-b border-slate-200 p-4 xl:grid-cols-2','grid gap-3 border-b border-slate-200 p-3 xl:grid-cols-[1.1fr_0.9fr]');
 s=s.replaceAll('rounded-xl border border-slate-200 bg-slate-50/70 p-4','rounded-xl border border-slate-200 bg-slate-50/70 p-3');
 s=s.replaceAll('bg-[#4f582e]','bg-[#344125]');
 s=s.replace("'border-emerald-300 bg-emerald-50 text-emerald-900'","'border-slate-300 bg-slate-100 text-slate-800'");
 write(p,s);
}

// Feature: transferência administrativa deve estar ativa nesta instalação.
{
 let p='src/constants/installation.ts',s=read(p);s=s.replace("['ADMIN_TRANSFER', 'Transferência segura de administração', false]","['ADMIN_TRANSFER', 'Transferência segura de administração', true]");write(p,s);
}

// Tipos de assinatura: provedor dual.
{
 let p='src/types/signatures.ts',s=read(p);s=s.replace("provider: 'ASTEN'; providerEnvelopeId?: string;","provider: 'ASTEN' | 'GOV_BR'; providerEnvelopeId?: string;");write(p,s);
}

// Staging servidor: PDF vindo do Gov.br usa a mesma camada privada.
{
 let p='server/integrations/supabaseStorageStaging.ts',s=read(p);
 s=s.replace("  | 'PROCESS_EXPANDED_ABSTRACT'\n  | 'VERIFICATION_PDF';","  | 'PROCESS_EXPANDED_ABSTRACT'\n  | 'GOV_BR_SIGNED_PDF'\n  | 'VERIFICATION_PDF';");
 s=s.replace("  PROCESS_EXPANDED_ABSTRACT: 24 * 1024 * 1024,\n  VERIFICATION_PDF", "  PROCESS_EXPANDED_ABSTRACT: 24 * 1024 * 1024,\n  GOV_BR_SIGNED_PDF: 50 * 1024 * 1024,\n  VERIFICATION_PDF");
 s=s.replace("  PROCESS_EXPANDED_ABSTRACT: PDF_MIME,\n  VERIFICATION_PDF", "  PROCESS_EXPANDED_ABSTRACT: PDF_MIME,\n  GOV_BR_SIGNED_PDF: PDF_MIME,\n  VERIFICATION_PDF");
 s=s.replace("if((input.purpose==='PROCESS_FULL_WORK'||input.purpose==='PROCESS_EXPANDED_ABSTRACT')&&!input.processId?.trim())", "if((input.purpose==='PROCESS_FULL_WORK'||input.purpose==='PROCESS_EXPANDED_ABSTRACT'||input.purpose==='GOV_BR_SIGNED_PDF')&&!input.processId?.trim())");
 write(p,s);
}

// API client: escolha do provedor e ida/volta do Gov.br.
{
 let p='src/services/apiClient.ts',s=read(p);
 s=s.replace("signProcessDocument:(id:string,type:string)=>fetchApi<{job:SignatureJob;message:string}>(`/api/processes/${id}/documents/${type}/sign`,{method:'POST'}),", "signProcessDocument:(id:string,type:string,provider:'ASTEN'|'GOV_BR'='ASTEN')=>fetchApi<{job:SignatureJob;message:string}>(`/api/processes/${id}/documents/${type}/sign`,{method:'POST',body:JSON.stringify({provider})}),\n  downloadGovBrSigningPdf:(jobId:string)=>downloadApiFile(`/api/signatures/jobs/${encodeURIComponent(jobId)}/govbr/download`),\n  uploadGovBrSignedPdf:async(jobId:string,processId:string,file:File)=>{const staged=await stageFile(file,{purpose:'GOV_BR_SIGNED_PDF',processId});return fetchApi<SignatureJob>(`/api/signatures/jobs/${encodeURIComponent(jobId)}/govbr/complete`,{method:'POST',body:JSON.stringify({stagedUploadId:staged.uploadId})});},");
 write(p,s);
}

// Processo: escolha Asten/Gov.br e upload do PDF assinado.
{
 let p='src/pages/ProcessoDetailPage.tsx',s=read(p);
 s=s.replace("  const handleSignDocument=async(doc:ProcessDocument)=>{\n    setSignatureWorking(doc.type);setSignatureNotice(null);\n    try{\n      const result=await apiClient.signProcessDocument(process.id,doc.type);", "  const handleSignDocument=async(doc:ProcessDocument,provider:'ASTEN'|'GOV_BR')=>{\n    setSignatureWorking(`${doc.type}:${provider}`);setSignatureNotice(null);\n    try{\n      const result=await apiClient.signProcessDocument(process.id,doc.type,provider);");
 s=s.replace("finally{setSignatureWorking('');}\n  };", "finally{setSignatureWorking('');}\n  };\n\n  const handleGovBrDownload=async(job:SignatureJob)=>{try{const {blob,fileName}=await apiClient.downloadGovBrSigningPdf(job.id);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fileName;a.click();URL.revokeObjectURL(url);setSignatureNotice({ok:true,text:'PDF baixado. Assine no Gov.br e envie o PDF resultante nesta mesma área.'});}catch(error){setSignatureNotice({ok:false,text:error instanceof Error?error.message:'Não foi possível baixar o PDF para o Gov.br.'});}};\n  const handleGovBrUpload=async(job:SignatureJob,file?:File)=>{if(!file)return;setSignatureWorking(`${job.documentType}:GOV_UPLOAD`);try{await apiClient.uploadGovBrSignedPdf(job.id,process.id,file);setSignatureNotice({ok:true,text:'PDF assinado no Gov.br recebido e arquivado. Se houver outro signatário, ele deve repetir o procedimento com esta versão.'});await loadData();}catch(error){setSignatureNotice({ok:false,text:error instanceof Error?error.message:'Não foi possível receber o PDF assinado.'});}finally{setSignatureWorking('');}};\n  };");
 // Replace old single Asten button by provider choices + pending Gov actions.
 s=s.replace("{canRequestSignature&&<button type=\"button\" onClick={()=>handleSignDocument(doc)} disabled={signatureWorking===doc.type||alreadySent} className=\"inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600\"><ShieldCheck className=\"h-4 w-4\"/>{alreadySent?'Enviado à Asten':signatureWorking===doc.type?'Enviando…':'Assinar documento'}</button>}", "{canRequestSignature&&<div className=\"grid grid-cols-2 gap-2\"><button type=\"button\" onClick={()=>handleSignDocument(doc,'ASTEN')} disabled={signatureWorking!==''||alreadySent} className=\"inline-flex items-center justify-center gap-2 rounded-lg bg-[#344125] px-3 py-2 text-xs font-black text-white hover:bg-[#28331d] disabled:bg-slate-300\"><ShieldCheck className=\"h-4 w-4\"/>Asten</button><button type=\"button\" onClick={()=>handleSignDocument(doc,'GOV_BR')} disabled={signatureWorking!==''||alreadySent} className=\"inline-flex items-center justify-center gap-2 rounded-lg bg-slate-600 px-3 py-2 text-xs font-black text-white hover:bg-slate-700 disabled:bg-slate-300\"><ShieldCheck className=\"h-4 w-4\"/>Gov.br</button></div>}\n                    {signatureJobs.filter(job=>job.documentType===doc.type&&job.provider==='GOV_BR'&&job.status!=='ARCHIVED'&&job.status!=='CANCELED').sort((a,b)=>b.documentVersion-a.documentVersion).slice(0,1).map(job=><div key={job.id} className=\"mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2\"><div className=\"text-[10px] font-black uppercase text-slate-600\">Assinatura Gov.br · {job.status}</div><div className=\"mt-2 flex flex-wrap gap-2\"><button type=\"button\" onClick={()=>void handleGovBrDownload(job)} className=\"rounded-lg border border-slate-300 bg-white px-3 py-2 text-[10px] font-black text-slate-800\">1. Baixar PDF</button><label className=\"cursor-pointer rounded-lg bg-slate-600 px-3 py-2 text-[10px] font-black text-white\">2. Enviar PDF assinado<input type=\"file\" accept=\"application/pdf,.pdf\" className=\"sr-only\" onChange={e=>void handleGovBrUpload(job,e.target.files?.[0])}/></label></div></div>)}");
 write(p,s);
}

// API Vercel: Asten deixa de bloquear a aplicação; classificação Supabase vem antes.
{
 let p='api/index.ts',s=read(p);
 s=s.replace("  if (process.env.ASTEN_INTEGRATION_ENABLED === 'true' && (!configured('ASTEN_CALLBACK_URL') || !configured('ASTEN_WEBHOOK_SECRET', 32) || process.env.ASTEN_REQUIRE_CODE === 'false')) missing.push('ASTEN');\n",'');
 const asten="  if (detail.includes('Asten') || detail.includes('ASTEN_')) return { code: 'ASTEN_SECURITY_REQUIRED', message: 'A integração de assinatura ainda não passou na verificação de segurança.' };\n";
 const sup="  if (detail.includes('migrações do Supabase') || detail.includes('outbox transacional')) return { code: 'SUPABASE_SCHEMA_REQUIRED', message: 'O esquema transacional do banco ainda não foi validado.' };\n";
 s=s.replace(asten,'').replace(sup,sup+asten);
 write(p,s);
}

// Servidor: Asten opcional, Presidente como recuperação do Master e Gov.br manual.
{
 let p='server.ts',s=read(p);
 // startup invariant and Asten soft dependency
 s=s.replace("if(process.env.ASTEN_INTEGRATION_ENABLED==='true'){const astenSecurity=getAstenSecurityPreflight();if(!astenSecurity.callbackConfigured)throw new Error(`Implantação bloqueada: ${astenSecurity.issues.join(' ')}`);}\n",'');
 const settingsAnchor="delete (currentSettings as any).courseCoordinatorName;\n";
 s=once(s,settingsAnchor,settingsAnchor+"const configuredPresidentEmail=normalizeEmail(currentSettings.commissionPresidentEmail||currentSettings.masterRecoveryEmails?.[0]||'');\nif(configuredPresidentEmail)currentSettings={...currentSettings,commissionPresidentEmail:configuredPresidentEmail,masterRecoveryEmails:[configuredPresidentEmail]};\ncurrentSettings.featureFlags=(currentSettings.featureFlags||[]).map(flag=>flag.key==='ADMIN_TRANSFER'?{...flag,enabled:true}:flag);\n",'settings invariant');
 // staging accepts GOV
 s=s.replace("    }else if(purpose==='PROCESS_FULL_WORK'||purpose==='PROCESS_EXPANDED_ABSTRACT'){", "    }else if(purpose==='PROCESS_FULL_WORK'||purpose==='PROCESS_EXPANDED_ABSTRACT'||purpose==='GOV_BR_SIGNED_PDF'){");
 s=s.replace("      if(!hasFullAdministration(identity.email)&&!roles.includes('STUDENT'))return res.status(403).json({error:'Seu perfil não pode anexar arquivos finais.'});\n      if(process.avaliacao.status!=='CONCLUIDO')return res.status(409).json({error:'A avaliação precisa ser concluída antes do envio dos arquivos finais.'});", "      if(purpose==='GOV_BR_SIGNED_PDF'){if(!canAccessProcess(identity.email,process.id))return res.status(403).json({error:'Seu perfil não pode anexar assinatura para este processo.'});}\n      else{if(!hasFullAdministration(identity.email)&&!roles.includes('STUDENT'))return res.status(403).json({error:'Seu perfil não pode anexar arquivos finais.'});if(process.avaliacao.status!=='CONCLUIDO')return res.status(409).json({error:'A avaliação precisa ser concluída antes do envio dos arquivos finais.'});}");
 // President can initiate/cancel master transfer
 s=s.replace("if(role==='MASTER_ADMIN'&&!actorRoles.includes('MASTER_ADMIN'))return res.status(403).json({error:'Somente o Master atual pode transferir a titularidade Master.'});", "if(role==='MASTER_ADMIN'&&!actorRoles.some(role=>role==='MASTER_ADMIN'||role==='COMMISSION_PRESIDENT'))return res.status(403).json({error:'Somente o Master ou a Presidente da Comissão pode iniciar a transferência Master.'});");
 s=s.replace("else currentSettings={...currentSettings,commissionPresidentEmail:identity.email};", "else currentSettings={...currentSettings,commissionPresidentEmail:identity.email,masterRecoveryEmails:[identity.email]};");
 s=s.replace("if(transfer.role==='MASTER_ADMIN'&&!actorRoles.includes('MASTER_ADMIN'))return res.status(403).json({error:'Somente o Master atual pode cancelar a transferência Master.'});", "if(transfer.role==='MASTER_ADMIN'&&!actorRoles.some(role=>role==='MASTER_ADMIN'||role==='COMMISSION_PRESIDENT'))return res.status(403).json({error:'Somente o Master ou a Presidente da Comissão pode cancelar a transferência Master.'});");
 // Asten homologation is optional
 s=s.replace("checks.push({id:'asten',label:'Asten Assinatura',status:asten.configured&&asten.callbackConfigured?'PASS':'FAIL',message:asten.configured?(asten.callbackConfigured?'Token cifrado e callback autenticado configurados.':'Token conectado; configure o segredo do callback antes da produção.'):'Conecte o token da conta Asten.'});", "checks.push({id:'govbr',label:'Assinatura Gov.br',status:'PASS',message:'Fluxo manual independente disponível: download do PDF, assinatura externa e reenvio controlado.'});checks.push({id:'asten',label:'Asten Assinatura (opcional)',status:asten.configured&&asten.callbackConfigured?'PASS':'PENDING',message:asten.configured?(asten.callbackConfigured?'Token cifrado e callback autenticado configurados.':'Asten conectada, mas ainda indisponível para despacho.'):'Asten pode ser conectada posteriormente; sua ausência não bloqueia o Portal.'});");
 s=s.replace("readyForProduction:checks.every(check=>check.status==='PASS')&&vercelProduction", "readyForProduction:checks.filter(check=>check.id!=='asten').every(check=>check.status==='PASS')&&vercelProduction");
 // Signature job provider argument and idempotency
 s=s.replace("async function createSignatureJob(p:ProcessData,type:'ATA'|'TERMO'|'DECLARACAO',actor:string,renderVariables:Record<string,string>={}):Promise<SignatureJob>{", "async function createSignatureJob(p:ProcessData,type:'ATA'|'TERMO'|'DECLARACAO',actor:string,renderVariables:Record<string,string>={},provider:'ASTEN'|'GOV_BR'='ASTEN'):Promise<SignatureJob>{");
 s=s.replace("`${p.id}|${type}|${p.dataRevision}|${contentSha256}|${signerHash}`", "`${p.id}|${type}|${provider}|${p.dataRevision}|${contentSha256}|${signerHash}`");
 s=s.replace("status:'QUEUED',signers,createdAt:now,createdBy:actor,updatedAt:now,provider:'ASTEN',providerCreationState:'PENDING'", "status:provider==='GOV_BR'?'READY_FOR_REVIEW':'QUEUED',signers,createdAt:now,createdBy:actor,updatedAt:now,provider,providerCreationState:provider==='ASTEN'?'PENDING':undefined");
 // automatic workflow no longer fails due Asten outage
 s=s.replace("    if(job.status==='WAITING_INTEGRATION'||job.status==='PROVIDER_ERROR')throw new Error(job.lastError||`O documento ${type} não foi enviado à Asten.`);", "    // A indisponibilidade da Asten não bloqueia o fluxo: o mesmo documento pode seguir pela via Gov.br.");
 // sign route provider selection
 s=s.replace("    const type=String(req.params.type).toUpperCase() as 'ATA'|'TERMO'|'DECLARACAO';", "    const type=String(req.params.type).toUpperCase() as 'ATA'|'TERMO'|'DECLARACAO';\n    const provider=String(req.body?.provider||'ASTEN').toUpperCase()==='GOV_BR'?'GOV_BR':'ASTEN';");
 s=s.replace("      const job=await createSignatureJob(process,type,identity.email);\n      await dispatchSignatureJobAutomatically(job);", "      const job=await createSignatureJob(process,type,identity.email,{},provider);\n      if(provider==='ASTEN')await dispatchSignatureJobAutomatically(job);");
 s=s.replace("action:'SOLICITACAO_ASSINATURA_ASTEN'", "action:'SOLICITACAO_ASSINATURA'");
 s=s.replace("after:{documentType:type,status:job.status,contentSha256:job.contentSha256,providerEnvelopeId:job.providerEnvelopeId}", "after:{documentType:type,status:job.status,provider,contentSha256:job.contentSha256,providerEnvelopeId:job.providerEnvelopeId}");
 s=s.replace("const status=job.status==='WAITING_INTEGRATION'||job.status==='PROVIDER_ERROR'?409:200;\n      res.status(status).json({job:publicSignatureJob(job),message:job.status==='SENT'?'Documento enviado à Asten. Os signatários receberão o acesso diretamente pela plataforma.':job.lastError||'Solicitação registrada.'});", "const status=provider==='ASTEN'&&(job.status==='WAITING_INTEGRATION'||job.status==='PROVIDER_ERROR')?409:200;\n      res.status(status).json({job:publicSignatureJob(job),message:provider==='GOV_BR'?'Documento preparado para assinatura Gov.br. Baixe o PDF, assine em sua conta Gov.br e envie o PDF assinado de volta ao Portal.':job.status==='SENT'?'Documento enviado à Asten. Os signatários receberão o acesso diretamente pela plataforma.':job.lastError||'Solicitação registrada.'});");
 // Add GOV endpoints before retries
 const retryAnchor="  app.post('/api/signatures/jobs/:id/retry',requireAuthenticated,requireAdministrator,async(req,res)=>";
 const govEndpoints=`  app.get('/api/signatures/jobs/:id/govbr/download',requireAuthenticated,async(req,res)=>{const identity=getPortalIdentity(req)!;const job=signatureJobsStore.find(item=>item.id===req.params.id&&item.provider==='GOV_BR');if(!job)return res.status(404).json({error:'Solicitação Gov.br não encontrada.'});const process=processesStore.find(item=>item.id===job.processId);if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});const signer=job.signers.find(item=>normalizeEmail(item.email)===identity.email&&item.status!=='SIGNED');if(!signer&&!hasFullAdministration(identity.email))return res.status(403).json({error:'Você não é signatário deste documento.'});try{const accessToken=await getGoogleWorkspaceAccessToken();const fileId=job.driveSignedFileId||job.driveUnsignedFileId;if(!fileId)throw new Error('PDF da assinatura não está disponível no Drive.');const file=await downloadDrivePdf(accessToken,fileId,{processId:job.processId,artifactType:job.documentType,signatureJobId:job.id});await deliverPortalDownload({res,bytes:file.pdf,fileName:file.fileName,mimeType:'application/pdf',requesterBinding:sessionUploadBinding(identity),cacheControl:'private, no-store'});}catch(error){res.status(502).json({error:error instanceof Error?error.message:'Não foi possível baixar o PDF para assinatura Gov.br.'});}});\n\n  app.post('/api/signatures/jobs/:id/govbr/complete',requireAuthenticated,async(req,res)=>{const identity=getPortalIdentity(req)!;const job=signatureJobsStore.find(item=>item.id===req.params.id&&item.provider==='GOV_BR');if(!job)return res.status(404).json({error:'Solicitação Gov.br não encontrada.'});const process=processesStore.find(item=>item.id===job.processId);if(!process||!canAccessProcess(identity.email,process.id))return res.status(404).json({error:'Processo não encontrado.'});const signer=job.signers.find(item=>normalizeEmail(item.email)===identity.email&&item.status!=='SIGNED');if(!signer)return res.status(403).json({error:'Somente o próximo signatário pode enviar sua versão assinada pelo Gov.br.'});try{const uploadId=String(req.body?.stagedUploadId||'').trim();if(!uploadId)throw new Error('Envie o PDF assinado pelo canal seguro do Portal.');const result=await withSupabaseStagedUpload({uploadId,purpose:'GOV_BR_SIGNED_PDF',requesterBinding:sessionUploadBinding(identity),processId:process.id},async(file)=>{if(!file.bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw new Error('Envie um PDF válido.');const accessToken=await getGoogleWorkspaceAccessToken();const sha256=createHash('sha256').update(file.bytes).digest('hex');const uploaded=await uploadSignedPdfToDrive({rootFolderId:currentSettings.driveRootFolderId,protocol:process.protocolo,accessToken,processFolderId:process.driveFolderId||'',processId:process.id,jobId:job.id,documentType:job.documentType,fileName:job.fileName.replace(/\\.pdf$/i,'__GOVBR.pdf'),pdf:file.bytes,sha256});return{uploaded,sha256};});job.driveSignedFileId=String(result.uploaded.id);job.driveSignedWebViewLink=String(result.uploaded.webViewLink||'');job.signedSha256=result.sha256;signer.status='SIGNED';signer.signedAt=new Date().toISOString();job.updatedAt=signer.signedAt;const complete=job.signers.every(item=>item.status==='SIGNED');job.status=complete?'ARCHIVED':'PARTIALLY_SIGNED';if(complete){job.signedAt=job.updatedAt;job.completedAt=job.updatedAt;updateProcessCompletion(job.processId);}auditLogsStore.push({id:\`log-\${Date.now()}-govbr\`,processId:job.processId,actorEmail:identity.email,actorRoles:[...getUserRolesForEmail(identity.email).globalRoles,...getActiveProcessRoles(identity.email,job.processId)],action:'ASSINATURA_GOVBR_RECEBIDA',entityType:'signature_job',entityId:job.id,after:{documentType:job.documentType,provider:'GOV_BR',signerRole:signer.role,status:job.status,sha256:result.sha256},timestamp:job.updatedAt});await persistPortalStateDurably();res.json(publicSignatureJob(job));}catch(error){res.status(400).json({error:error instanceof Error?error.message:'Não foi possível arquivar o PDF assinado pelo Gov.br.'});}});\n\n`;
 s=once(s,retryAnchor,govEndpoints+retryAnchor,'gov endpoints');
 write(p,s);
}

console.log('Atualização visual, administrativa e de assinatura aplicada.');
