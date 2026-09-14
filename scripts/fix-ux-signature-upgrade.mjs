import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function must(s,a,b,label){if(!s.includes(a))throw new Error(`Trecho não localizado: ${label}`);return s.replace(a,b);}

// Corrige fechamento duplicado inserido pelo patch inicial e deixa o fluxo Gov.br sequencial.
{
  const p='src/pages/ProcessoDetailPage.tsx';
  let s=read(p);
  s=must(s,"}finally{setSignatureWorking('');}};\n  };\n", "}finally{setSignatureWorking('');}};\n", 'fechamento Gov.br');
  write(p,s);
}

{
  const p='server.ts';
  let s=read(p);
  s=s.replace("const file=await downloadDrivePdf(accessToken,fileId,{processId:job.processId,artifactType:job.documentType,signatureJobId:job.id});","const file=await downloadDrivePdf(accessToken,fileId,{processId:job.processId,artifactType:job.documentType});");
  s=s.replace("jobId:job.id,documentType:job.documentType,fileName:job.fileName.replace(/\\.pdf$/i,'__GOVBR.pdf')","jobId:`${job.id}-gov-${signer.signingOrder}`,documentType:job.documentType,fileName:job.fileName.replace(/\\.pdf$/i,`__GOVBR_${signer.signingOrder}.pdf`)");
  const old="currentSettings.featureFlags=(currentSettings.featureFlags||[]).map(flag=>flag.key==='ADMIN_TRANSFER'?{...flag,enabled:true}:flag);";
  const replacement="{const flags=currentSettings.featureFlags||[];currentSettings.featureFlags=flags.some(flag=>flag.key==='ADMIN_TRANSFER')?flags.map(flag=>flag.key==='ADMIN_TRANSFER'?{...flag,enabled:true}:flag):[...flags,{key:'ADMIN_TRANSFER',enabled:true,audience:'ADMIN_ONLY',description:'Transferência segura de administração',updatedAt:new Date().toISOString(),updatedBy:'SYSTEM'}];}";
  s=must(s,old,replacement,'feature ADMIN_TRANSFER');
  write(p,s);
}

// Mantém o rótulo canônico coberto pelo contrato de UI.
{
  const p='src/components/CommissionIdentityPanel.tsx';
  let s=read(p);
  s=s.replace("'Salvar comissão'","'Salvar Comissão'");
  write(p,s);
}

// Deixa a ativação e integrações mais compactas e trata Asten como opcional visualmente.
{
  const p='src/components/InfrastructureIntegrationsPanel.tsx';
  let s=read(p);
  s=s.replaceAll('p-6','p-4').replaceAll('p-5','p-4').replaceAll('gap-5','gap-3').replaceAll('gap-4','gap-3');
  s=s.replaceAll('bg-emerald-50','bg-slate-50').replaceAll('border-emerald-200','border-slate-200').replaceAll('text-emerald-800','text-slate-700').replaceAll('text-emerald-900','text-slate-800');
  s=s.replaceAll('bg-emerald-700','bg-slate-600').replaceAll('hover:bg-emerald-800','hover:bg-slate-700');
  s=s.replace(/Asten Assinatura/g,'Asten Assinatura · opcional');
  s=s.replace(/Conecte o token da conta Asten\./g,'Conecte a Asten quando a API estiver disponível. O Portal continua operando pela via Gov.br.');
  write(p,s);
}

// Contas administrativas: texto explícito sobre Presidente = recuperação do Master e ações neutras.
{
  const p='src/components/AuditAndSecuritySection.tsx';
  let s=read(p);
  s=s.replaceAll('bg-emerald-700','bg-slate-600').replaceAll('hover:bg-emerald-800','hover:bg-slate-700').replaceAll('text-emerald-700','text-slate-600');
  s=s.replace('E-MAILS DE RECUPERAÇÃO DO MASTER','RECUPERAÇÃO DO MASTER · PRESIDENTE DA COMISSÃO');
  s=s.replace('A troca de Master ou Presidente nunca é imediata: o novo titular recebe um código e precisa aceitar o convite.','A Presidente da Comissão é o contato de recuperação do Master e pode iniciar a transferência segura do usuário Master. Toda troca exige confirmação do novo titular.');
  write(p,s);
}

// Política visual global: elimina os tons oliva antigos restantes em componentes JSX/TSX.
for (const p of ['src/pages/HomePage.tsx','src/pages/IndicadoresPage.tsx','src/pages/ConfiguracoesPage.tsx']) {
  if(!fs.existsSync(p)) continue;
  let s=read(p);
  const swaps=[
    ['#5f6937','#5b635e'],['#4f582e','#48504c'],['#525c2e','#344125'],['#343b20','#344125'],['#252a16','#20301f'],
    ['#aab388','#cbd5d1'],['#e0e3cf','#e5e7eb'],['#f0f1e7','#f8fafc'],['#c8ceb0','#d6d9d7'],['#616d36','#365349']
  ];
  for(const [a,b] of swaps)s=s.replaceAll(a,b);
  write(p,s);
}

console.log('Correções complementares aplicadas.');
