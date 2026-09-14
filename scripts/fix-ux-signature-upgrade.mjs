import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function must(s,a,b,label){if(!s.includes(a))throw new Error(`Trecho não localizado: ${label}`);return s.replace(a,b);}

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

{
  const p='src/components/CommissionIdentityPanel.tsx';
  let s=read(p);
  s=s.replace("'Salvar comissão'","'Salvar Comissão'");
  write(p,s);
}

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

{
  const p='src/components/AuditAndSecuritySection.tsx';
  let s=read(p);
  s=s.replaceAll('bg-emerald-700','bg-slate-600').replaceAll('hover:bg-emerald-800','hover:bg-slate-700').replaceAll('text-emerald-700','text-slate-600');
  s=s.replace('E-MAILS DE RECUPERAÇÃO DO MASTER','RECUPERAÇÃO DO MASTER · PRESIDENTE DA COMISSÃO');
  s=s.replace('A troca de Master ou Presidente nunca é imediata: o novo titular recebe um código e precisa aceitar o convite.','A Presidente da Comissão é o contato de recuperação do Master e pode iniciar a transferência segura do usuário Master. Toda troca exige confirmação do novo titular.');
  write(p,s);
}

// Tokens globais: musgo nos cabeçalhos, cinza nas ações e neutros claros nos fundos.
{
  const p='src/index.css';
  let s=read(p);
  const replacements=[
    ['--color-emerald-50: #f0f1e7;','--color-emerald-50: #f7f8f7;'],
    ['--color-emerald-100: #e0e3cf;','--color-emerald-100: #eef0ee;'],
    ['--color-emerald-200: #c8ceb0;','--color-emerald-200: #dfe3df;'],
    ['--color-emerald-300: #aab388;','--color-emerald-300: #c7cdc8;'],
    ['--color-emerald-400: #8c9862;','--color-emerald-400: #9da69f;'],
    ['--color-emerald-500: #738044;','--color-emerald-500: #7a847d;'],
    ['--color-emerald-600: #616d36;','--color-emerald-600: #5f6962;'],
    ['--color-emerald-700: #5f6937;','--color-emerald-700: #4d5751;'],
    ['--color-emerald-800: #4f582e;','--color-emerald-800: #344125;'],
    ['--color-emerald-900: #343b20;','--color-emerald-900: #28331d;'],
    ['--color-emerald-950: #252a16;','--color-emerald-950: #20301f;'],
    ['--portal-popup-header: #4f582e;','--portal-popup-header: #344125;'],
    ['--portal-popup-action: #4f582e;','--portal-popup-action: #5b635e;'],
    ['--portal-new-defense-header: #5f6937;','--portal-new-defense-header: #344125;'],
    ['--portal-new-defense-action: #5f6937;','--portal-new-defense-action: #5b635e;'],
    ['--portal-upload-header: #5f6937;','--portal-upload-header: #344125;'],
    ['--portal-upload-action: #5f6937;','--portal-upload-action: #5b635e;'],
    ['--portal-correction-header: #5f6937;','--portal-correction-header: #344125;'],
    ['--portal-correction-action: #5f6937;','--portal-correction-action: #5b635e;'],
    ['--portal-focus-color: #5f6937;','--portal-focus-color: #344125;'],
    ['border-top-color: #5f6937;','border-top-color: #344125;']
  ];
  for(const [a,b] of replacements)s=must(s,a,b,`css ${a}`);
  write(p,s);
}

for (const p of ['src/pages/HomePage.tsx','src/pages/IndicadoresPage.tsx','src/pages/ConfiguracoesPage.tsx']) {
  if(!fs.existsSync(p)) continue;
  let s=read(p);
  const swaps=[
    ['#5f6937','#5b635e'],['#4f582e','#48504c'],['#525c2e','#344125'],['#343b20','#344125'],['#252a16','#20301f'],
    ['#aab388','#cbd5d1'],['#e0e3cf','#e5e7eb'],['#f0f1e7','#f8fafc'],['#c8ceb0','#d6d9d7'],['#616d36','#365349'],['#738044','#7a847d'],['#8c9862','#9da69f']
  ];
  for(const [a,b] of swaps)s=s.replaceAll(a,b);
  write(p,s);
}

console.log('Correções complementares aplicadas.');
