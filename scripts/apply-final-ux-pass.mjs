import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const rep=(s,a,b,label)=>{if(!s.includes(a))throw new Error(`Trecho não encontrado: ${label}`);return s.replace(a,b);};

// 1) Paleta global: substitui o verde amarelado por cinzas esverdeados neutros.
{
 const p='src/index.css'; let s=read(p);
 s=rep(s,`  --color-emerald-50: #f6f8f7;\n  --color-emerald-100: #e8ecea;\n  --color-emerald-200: #d6ddd9;\n  --color-emerald-300: #b6c2bc;\n  --color-emerald-400: #91a096;\n  --color-emerald-500: #6f8076;\n  --color-emerald-600: #52675d;\n  --color-emerald-700: #435649;\n  --color-emerald-800: #344125;\n  --color-emerald-900: #27382f;\n  --color-emerald-950: #18271f;`, `  --color-emerald-50: #f7f8f7;\n  --color-emerald-100: #edf0ee;\n  --color-emerald-200: #dbe0dd;\n  --color-emerald-300: #c4cbc7;\n  --color-emerald-400: #a5aea9;\n  --color-emerald-500: #87918b;\n  --color-emerald-600: #707a74;\n  --color-emerald-700: #5d6761;\n  --color-emerald-800: #4b5550;\n  --color-emerald-900: #3b4540;\n  --color-emerald-950: #28302c;`, 'paleta emerald');
 s=rep(s,`  --portal-focus-color: #435649;`, `  --portal-focus-color: #344125;`, 'focus moss');
 write(p,s);
}

// 2) Tabelas: cabeçalho musgo único; botões auxiliares cinza.
{
 const p='src/utils/tableFormatters.ts'; let s=read(p);
 s=rep(s,`  militar: {\n    bg: '#435649',\n    secondary: '#3b4d41',\n    text: '#ffffff',\n    divider: '#232d26',\n    filterDivider: 'rgba(255, 255, 255, 0.18)',\n    buttonBg: '#303f35',\n    buttonText: '#ffffff',\n    theadBg: '#435649',\n    theadHover: 'hover:bg-[#344439]',\n    isDark: true,\n  },`, `  militar: {\n    bg: '#344125',\n    secondary: '#28331d',\n    text: '#ffffff',\n    divider: '#1f2817',\n    filterDivider: 'rgba(255, 255, 255, 0.20)',\n    buttonBg: '#5d6761',\n    buttonText: '#ffffff',\n    theadBg: '#344125',\n    theadHover: 'hover:bg-[#28331d]',\n    isDark: true,\n  },`, 'tema militar');
 write(p,s);
}

// 3) Barra lateral: subtítulo legível, maior e sem verde fluorescente.
{
 const p='src/components/Sidebar.tsx'; let s=read(p);
 s=rep(s,`              <p className="mt-1.5 w-full text-center text-[12px] sm:text-[13px] font-semibold tracking-[0.02em] leading-[1.25]" style={{ color: layoutConfig.sidebarSubtitleColor || (isHeaderLight ? '#475569' : '#d6d9d7') }}>\n                <span className="block">Enfermagem e Obstetrícia</span>\n                <span className="block">CC/UFES</span>\n              </p>`, `              <p className="mt-1.5 w-full text-center text-[13px] sm:text-[14px] font-bold tracking-[0.01em] leading-snug" style={{ color: isHeaderLight ? '#475569' : '#f1f5f9' }}>\n                Enfermagem e Obstetrícia · UFES\n              </p>`, 'subtitulo sidebar');
 s=s.replaceAll("activeBg: '#154d41'", "activeBg: '#344125'");
 s=s.replaceAll("activeBorder: '#cbd5d1'", "activeBorder: '#aeb7b2'");
 write(p,s);
}

// 4) Como usar: filtro segue padrão neutro, cabeçalho permanece musgo.
{
 const p='src/pages/PortalTutorialPage.tsx'; let s=read(p);
 s=rep(s,`role === key ? 'border-[#06372d] bg-[#06372d] text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-400'`, `role === key ? 'border-slate-400 bg-slate-100 text-slate-950 ring-1 ring-slate-200' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-400'`, 'filtro tutorial');
 write(p,s);
}

// 5) Rodapé: contraste claro e QR realmente grande, sem moldura branca extra.
{
 const p='src/components/Footer.tsx'; let s=read(p);
 s=rep(s,`footerMuted=layoutConfig.footerMutedTextColor||'#d6d9d7'`, `footerMuted=layoutConfig.footerMutedTextColor||'#eef1ef'`, 'contraste rodape');
 s=rep(s,`<div className="grid md:grid-cols-[1.1fr_1fr] items-stretch">`, `<div className="grid md:grid-cols-[1fr_1.25fr] items-stretch">`, 'proporcao rodape');
 s=rep(s,`<div className="flex items-center justify-center p-3 min-h-[135px]">\n          <div className="flex w-full max-w-[370px] items-center justify-center gap-0.5 sm:gap-1">\n            <div className="min-w-0 w-[255px] flex flex-col justify-center items-center text-center gap-2">`, `<div className="flex items-center justify-center p-2 min-h-[170px]">\n          <div className="flex w-full max-w-[560px] items-center justify-center gap-2 sm:gap-3">\n            <div className="min-w-0 flex-1 flex flex-col justify-center items-center text-center gap-2">`, 'layout contato QR');
 s=rep(s,`{qrCodeSource&&<div className="w-[86px] h-[86px] sm:w-[104px] sm:h-[104px] bg-white shrink-0 overflow-hidden"><img src={qrCodeSource} alt="QR Code para contato pelo WhatsApp" className="block h-full w-full object-cover" referrerPolicy="no-referrer"/></div>}`, `{qrCodeSource&&<div className="w-[150px] h-[150px] sm:w-[180px] sm:h-[180px] shrink-0 overflow-hidden"><img src={qrCodeSource} alt="QR Code para contato pelo WhatsApp" className="block h-full w-full object-contain" referrerPolicy="no-referrer"/></div>}`, 'tamanho QR');
 write(p,s);
}

// 6) Contas administrativas: recuperação passa a integrar o cartão da Presidência.
{
 const p='src/components/AuditAndSecuritySection.tsx'; let s=read(p);
 s=rep(s,`            <div>\n              <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">\n                E-mail do Presidente da Comissão:\n              </label>`, `            <div>\n              <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">\n                E-mail da Presidência e recuperação do Master:\n              </label>`, 'label presidente');
 s=rep(s,`            </div>\n          </div>\n        </div>\n\n        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">\n          <p className="text-[10px] font-bold uppercase text-slate-700">Recuperação do Master</p>\n          <p className="mt-1 text-[11px] leading-5 text-slate-600">A Presidente da Comissão é automaticamente o contato de recuperação do Master. A troca de Presidente usa transferência segura com confirmação do novo titular; após a aceitação, o e-mail da Presidência passa a ser o único contato de recuperação.</p>\n          <p className="mt-1 text-[11px] font-semibold text-slate-700">Contato atual: {settings.commissionPresidentEmail || 'Presidência ainda não configurada'}</p>\n        </div>`, `              <p className="mt-1 text-[10px] leading-4 text-slate-500">Este e-mail é também o único contato de recuperação do Master e pode iniciar a troca segura do usuário Master.</p>\n            </div>\n          </div>\n        </div>`, 'integrar recuperacao no cartao');
 write(p,s);
}

// 7) Autorização de acesso: menos altura e melhor aproveitamento horizontal.
{
 const p='src/components/AuthorizedStudentsPanel.tsx'; let s=read(p);
 s=s.replaceAll('px-4 py-4 lg:flex-row','px-4 py-3 lg:flex-row');
 s=s.replaceAll('rounded-xl border border-slate-200 bg-slate-50/70 p-3', 'rounded-xl border border-slate-200 bg-slate-50/70 p-2.5');
 s=s.replaceAll('mt-3 grid gap-2 md:grid-cols-2','mt-2 grid gap-2 md:grid-cols-2');
 s=s.replaceAll('`${primaryButton} mt-3`','`${primaryButton} mt-2`');
 s=s.replaceAll('className={`${primaryButton} mt-3 cursor-pointer`}', 'className={`${primaryButton} mt-2 cursor-pointer`}');
 s=s.replaceAll('<div className="p-4">','<div className="p-3">');
 s=s.replaceAll('px-3 py-3">Nome','px-3 py-2.5">Nome');
 s=s.replaceAll('px-3 py-3">E-mail','px-3 py-2.5">E-mail');
 s=s.replaceAll('px-3 py-3">Matrícula','px-3 py-2.5">Matrícula');
 write(p,s);
}

// 8) Integrações: Asten é contingência opcional; ativação mede apenas serviços essenciais.
{
 const p='src/components/InfrastructureIntegrationsPanel.tsx'; let s=read(p);
 s=s.replace(`  const readiness=[\n    {label:'Supabase conectado',ok:Boolean(status?.supabase?.connected&&status?.supabase?.transactionalRuntimeReady)},\n    {label:'Google Workspace',ok:Boolean(status?.googleDrive?.connected)},\n    {label:'Pasta raiz do Drive',ok:Boolean(status?.googleDrive?.rootFolderIdPresent)},\n    {label:'Asten e callback',ok:Boolean(status?.asten?.configured&&status?.asten?.callbackConfigured)},\n    {label:'Runtime seguro v6',ok:Boolean(status?.persistence?.productionSafe)},\n  ];`, `  const readiness=[\n    {label:'Supabase',ok:Boolean(status?.supabase?.connected&&status?.supabase?.transactionalRuntimeReady)},\n    {label:'Google Workspace',ok:Boolean(status?.googleDrive?.connected)},\n    {label:'Drive privado',ok:Boolean(status?.googleDrive?.rootFolderIdPresent)},\n    {label:'Runtime v6',ok:Boolean(status?.persistence?.productionSafe)},\n  ];\n  const astenOptionalReady=Boolean(status?.asten?.configured&&status?.asten?.callbackConfigured);`);
 s=s.replace(`{readyCount}/{readiness.length} prontos`, `{readyCount}/{readiness.length} essenciais`);
 s=s.replaceAll('bg-[#5f6937]','bg-slate-600');
 s=s.replaceAll('hover:bg-[#4f592e]','hover:bg-slate-700');
 s=s.replaceAll('text-[#4b542d]','text-slate-700');
 s=s.replaceAll('border-[#a8ae87]','border-slate-300');
 s=s.replaceAll('bg-[#f3f4eb]','bg-slate-50');
 s=s.replaceAll('bg-[#e7e9d8]','bg-slate-100');
 s=s.replaceAll('border-[#c9cdaa]','border-slate-300');
 s=s.replaceAll('text-[#4a522e]','text-slate-700');
 s=s.replace(`Asten Assinatura`, `Asten Assinatura · opcional`);
 s=s.replace(`{status?.asten?.configured ? 'Conectada' : 'Pendente'}`, `{astenOptionalReady ? 'Pronta' : 'Opcional'}`);
 write(p,s);
}

// 9) Login: mantenha branco/cinza e contraste, sem reaproveitar verde em botões.
{
 const p='src/utils/loginPopupConfig.ts'; let s=read(p);
 s=s.replace(`subtitle: 'Enfermagem e Obstetrícia • UFES'`, `subtitle: 'Enfermagem e Obstetrícia · UFES'`);
 write(p,s);
}

console.log('Rodada visual final aplicada.');
