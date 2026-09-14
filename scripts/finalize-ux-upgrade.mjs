import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
function must(s,a,b,label){if(!s.includes(a))throw new Error(`Trecho não localizado: ${label}`);return s.replace(a,b);}

// 1) Comissão: mantém o contrato visual já testado.
{
  const p='src/components/CommissionIdentityPanel.tsx';
  let s=read(p);
  s=s.replace("'Salvar comissão'","'Salvar Comissão'");
  write(p,s);
}

// 2) Paleta global: remove os tons oliva/fluorescentes do tema base.
{
  const p='src/index.css';
  let s=read(p);
  const swaps=[
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
  for(const [a,b] of swaps){ if(s.includes(a))s=s.replaceAll(a,b); }
  write(p,s);
}

// 3) Contas: Presidência é a única recuperação do Master; remove cadastro paralelo que gerava erro.
{
  const p='src/components/AuditAndSecuritySection.tsx';
  let s=read(p);
  s=s.replace("  const [recoveryEmails,setRecoveryEmails]=useState((settings.masterRecoveryEmails||[]).join('\\n'));\n",'');
  s=s.replace("    setRecoveryEmails((settings.masterRecoveryEmails||[]).join('\\n'));\n",'');
  s=s.replace("      let res = await apiClient.updateSettings(updated);\n      const contacts:string[]=Array.from(new Set<string>(recoveryEmails.split(/[\\n,;]+/).map(value=>value.trim().toLowerCase()).filter(Boolean)));\n      res=await apiClient.updateRecoveryEmails(contacts);", "      const res = await apiClient.updateSettings(updated);");
  const oldBlock=`        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">\n          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-700">E-mails de recuperação do Master</label>\n          <textarea value={recoveryEmails} onChange={event=>setRecoveryEmails(event.target.value)} required rows={3} placeholder="Um e-mail por linha (máximo 5)" className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"/>\n          <p className="mt-1 text-[11px] text-slate-600">A Presidente da Comissão é o contato de recuperação do Master e pode iniciar a transferência segura do usuário Master. Toda troca exige confirmação do novo titular.</p>\n        </div>`;
  const newBlock=`        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">\n          <div className="text-[10px] font-black uppercase tracking-wide text-slate-600">Recuperação do Master</div>\n          <div className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">\n            <span className="text-xs font-bold text-slate-900">{presidentEmail.trim() || 'Defina o e-mail da Presidente da Comissão'}</span>\n            <span className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[9px] font-black uppercase text-slate-600">Presidência</span>\n          </div>\n          <p className="mt-1.5 text-[10px] leading-4 text-slate-600">A Presidente da Comissão é automaticamente o contato de recuperação do Master e pode iniciar a transferência segura do usuário Master. A troca de titular só é efetivada após confirmação.</p>\n        </div>`;
  s=must(s,oldBlock,newBlock,'bloco recuperação Master');
  s=s.replace('className="space-y-3"','className="space-y-2.5"');
  write(p,s);
}

// 4) Backend: não permite uma lista de recuperação divergente da Presidência.
{
  const p='server.ts';
  let s=read(p);
  const old=`    const input:unknown[]=Array.isArray(req.body?.emails)?req.body.emails:[];\n    const emails:string[]=Array.from(new Set<string>(input.map((value:unknown)=>normalizeEmail(String(value))).filter((value:string)=>/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value))));\n    if(!emails.length||emails.length>5)return res.status(400).json({error:'Cadastre de um a cinco e-mails válidos de recuperação.'});\n    const before=(currentSettings.masterRecoveryEmails||[]).map(value=>createHash('sha256').update(normalizeEmail(value)).digest('hex'));\n    currentSettings={...currentSettings,masterRecoveryEmails:emails,updatedAt:new Date().toISOString()};\n    auditLogsStore.push({id:\`log-\${Date.now()}-recovery-contacts\`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'ALTERACAO_CONTATOS_RECUPERACAO',entityType:'security',entityId:'master_recovery_emails',before:{emailHashes:before},after:{emailHashes:emails.map(value=>createHash('sha256').update(value).digest('hex')),count:emails.length},timestamp:currentSettings.updatedAt});`;
  const replacement=`    const presidentEmail=normalizeEmail(currentSettings.commissionPresidentEmail||'');\n    if(!presidentEmail)return res.status(409).json({error:'Defina primeiro o e-mail da Presidente da Comissão.',code:'COMMISSION_PRESIDENT_REQUIRED'});\n    const emails=[presidentEmail];\n    const before=(currentSettings.masterRecoveryEmails||[]).map(value=>createHash('sha256').update(normalizeEmail(value)).digest('hex'));\n    currentSettings={...currentSettings,masterRecoveryEmails:emails,updatedAt:new Date().toISOString()};\n    auditLogsStore.push({id:\`log-\${Date.now()}-recovery-contacts\`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'SINCRONIZACAO_RECUPERACAO_PRESIDENCIA',entityType:'security',entityId:'master_recovery_emails',before:{emailHashes:before},after:{emailHashes:emails.map(value=>createHash('sha256').update(value).digest('hex')),count:1},timestamp:currentSettings.updatedAt});`;
  s=must(s,old,replacement,'rota recuperação');

  // Gov.br: somente o próximo signatário da ordem pode baixar/enviar a versão.
  const oldDownload="const signer=job.signers.find(item=>normalizeEmail(item.email)===identity.email&&item.status!=='SIGNED');if(!signer&&!hasFullAdministration(identity.email))return res.status(403).json({error:'Você não é signatário deste documento.'});";
  const newDownload="const nextSigner=job.signers.filter(item=>item.status!=='SIGNED').sort((a,b)=>a.signingOrder-b.signingOrder)[0];if(!nextSigner||normalizeEmail(nextSigner.email)!==identity.email)return res.status(403).json({error:'A assinatura Gov.br aguarda o signatário anterior ou pertence a outro usuário.'});";
  s=must(s,oldDownload,newDownload,'ordem download Gov.br');
  const oldUpload="const signer=job.signers.find(item=>normalizeEmail(item.email)===identity.email&&item.status!=='SIGNED');if(!signer)return res.status(403).json({error:'Somente o próximo signatário pode enviar sua versão assinada pelo Gov.br.'});";
  const newUpload="const signer=job.signers.filter(item=>item.status!=='SIGNED').sort((a,b)=>a.signingOrder-b.signingOrder)[0];if(!signer||normalizeEmail(signer.email)!==identity.email)return res.status(403).json({error:'Somente o próximo signatário pode enviar sua versão assinada pelo Gov.br.'});";
  s=must(s,oldUpload,newUpload,'ordem upload Gov.br');
  write(p,s);
}

// 5) Repositório: exportação é ação secundária cinza, não continuação do cabeçalho.
{
  const p='src/pages/HomePage.tsx';
  let s=read(p);
  const old=`                  style={acervoActionStyles.actionPillStyle}\n                  className={acervoActionStyles.actionPillClass}\n                  title="Exportar todo o banco de dados de TCCs para Excel (.csv)"`;
  const replacement=`                  style={{...acervoActionStyles.actionPillStyle,backgroundColor:'#5b635e',borderColor:'#5b635e',color:'#ffffff'}}\n                  className={\`${'${acervoActionStyles.actionPillClass}'} hover:brightness-95\`}\n                  title="Exportar todo o banco de dados de TCCs para Excel (.csv)"`;
  s=must(s,old,replacement,'botão Download dos dados');
  write(p,s);
}

// 6) Configurações: reduz espaços excessivos sem alterar a hierarquia.
{
  const p='src/pages/ConfiguracoesPage.tsx';
  let s=read(p);
  s=s.replaceAll('space-y-6','space-y-4').replaceAll('gap-6','gap-4');
  write(p,s);
}

console.log('Fechamento visual e operacional aplicado.');
