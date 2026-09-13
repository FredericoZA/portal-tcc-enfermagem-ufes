import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceOnce(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 ocorrência, encontrado ${count}`);
  return text.replace(before, after);
}

// Configurações: monitor vai para Indicadores e a observação redundante do Drive sai.
{
  const path = 'src/pages/ConfiguracoesPage.tsx';
  let text = read(path);
  text = replaceOnce(text, "import { OperationsMonitorPanel } from '../components/OperationsMonitorPanel';\n", '', 'remover import monitor');
  text = replaceOnce(text, "            {isMasterAdmin&&<OperationsMonitorPanel />}\n\n", '', 'remover monitor das configurações');
  text = replaceOnce(text, "\n            <div className=\"rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-950\"><strong>Drive gerenciado pelo servidor.</strong> A autorização acima cria uma única raiz institucional e mantém o refresh token cifrado. A estrutura não depende de token do navegador, URL manual ou nova sincronização a cada acesso.</div>", '', 'remover observação drive');
  write(path, text);
}

// Transferência administrativa é função nuclear da instalação, não feature opcional.
{
  const path = 'server.ts';
  let text = read(path);
  text = replaceOnce(text,
    "app.get('/api/admin/administration-transfers',requireAuthenticated,requireAdministrator,requireFeature('ADMIN_TRANSFER'),(_req,res)=>",
    "app.get('/api/admin/administration-transfers',requireAuthenticated,requireAdministrator,(_req,res)=>",
    'listar transferências');
  text = replaceOnce(text,
    "app.get('/api/administration-transfers/pending',requireAuthenticated,requireFeature('ADMIN_TRANSFER'),(req,res)=>",
    "app.get('/api/administration-transfers/pending',requireAuthenticated,(req,res)=>",
    'transferências pendentes');
  text = replaceOnce(text,
    "app.post('/api/admin/administration-transfers',requireAuthenticated,requireAdministrator,requireFeature('ADMIN_TRANSFER'),async(req,res)=>",
    "app.post('/api/admin/administration-transfers',requireAuthenticated,requireAdministrator,async(req,res)=>",
    'criar transferência');
  text = replaceOnce(text,
    "app.post('/api/admin/administration-transfers/:id/accept',requireAuthenticated,requireFeature('ADMIN_TRANSFER'),async(req,res)=>",
    "app.post('/api/admin/administration-transfers/:id/accept',requireAuthenticated,async(req,res)=>",
    'aceitar transferência');
  text = replaceOnce(text,
    "app.post('/api/admin/administration-transfers/:id/cancel',requireAuthenticated,requireAdministrator,requireFeature('ADMIN_TRANSFER'),async(req,res)=>",
    "app.post('/api/admin/administration-transfers/:id/cancel',requireAuthenticated,requireAdministrator,async(req,res)=>",
    'cancelar transferência');
  write(path, text);
}

// Símbolo cadastrado pelo Master passa a ter precedência na lateral.
{
  const path = 'src/components/Sidebar.tsx';
  let text = read(path);
  text = replaceOnce(text,
    "  const configuredLogo = settings?.integrationStudio?.brandKit?.courseLogoUrl || settings?.integrationStudio?.brandKit?.universityLogoUrl || '';",
    "  const configuredLogo = (settings as any)?.courseLogoDataUrl || settings?.integrationStudio?.brandKit?.courseLogoUrl || settings?.integrationStudio?.brandKit?.universityLogoUrl || '';",
    'logo configurado');
  text = replaceOnce(text,
    "            <NursingEmblemLogo size={58} className=\"shrink-0\" customSrc={sidebarLogoSrc || '/colenf-logo.png'} />",
    "            <NursingEmblemLogo size={58} className=\"shrink-0\" customSrc={sidebarLogoSrc || '/colenf-logo.png'} />",
    'sentinela sidebar');
  write(path, text);
}

// QR Code do WhatsApp é automático no rodapé quando não houver imagem customizada.
{
  const path = 'src/components/Footer.tsx';
  let text = read(path);
  text = replaceOnce(text,
    "import React, { useState, useEffect } from 'react';\n",
    "import React, { useState, useEffect } from 'react';\nimport QRCode from 'qrcode';\n",
    'import qrcode footer');
  text = replaceOnce(text,
    "  const [layoutConfig, setLayoutConfig] = useState<SiteLayoutConfig>(loadSiteLayoutConfig());\n",
    "  const [layoutConfig, setLayoutConfig] = useState<SiteLayoutConfig>(loadSiteLayoutConfig());\n  const [generatedQrCode, setGeneratedQrCode] = useState('');\n",
    'estado qrcode footer');
  text = replaceOnce(text,
    "  const qrLabel = layoutConfig.footerQrLabel || 'WhatsApp QR';\n",
    "  const qrLabel = layoutConfig.footerQrLabel || 'WhatsApp QR';\n  const qrCodeSource = layoutConfig.footerQrCodeUrl || generatedQrCode;\n",
    'fonte qrcode footer');
  const marker = "  // Dynamic style tokens\n";
  const effect = "  useEffect(() => {\n    let active = true;\n    if (!whatsappUrl) { setGeneratedQrCode(''); return () => { active = false; }; }\n    void QRCode.toDataURL(whatsappUrl, { width: 240, margin: 1, errorCorrectionLevel: 'M' })\n      .then((value) => { if (active) setGeneratedQrCode(value); })\n      .catch(() => { if (active) setGeneratedQrCode(''); });\n    return () => { active = false; };\n  }, [whatsappUrl]);\n\n";
  text = replaceOnce(text, marker, effect + marker, 'efeito qrcode footer');
  text = replaceOnce(text, "            {layoutConfig.footerQrCodeUrl && <div ", "            {qrCodeSource && <div ", 'condição qrcode footer');
  text = replaceOnce(text, "                src={layoutConfig.footerQrCodeUrl}", "                src={qrCodeSource}", 'src qrcode footer');
  write(path, text);
}

// Integrações: remove banner redundante e torna a ativação objetiva.
{
  const path = 'src/components/InfrastructureIntegrationsPanel.tsx';
  let text = read(path);
  const secureBanner = `    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">\n      <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700"/><div><h3 className="font-black text-emerald-950">Central segura de integrações</h3><p className="mt-1 text-xs leading-5 text-emerald-900">Segredos nunca entram nas configurações públicas nem nos logs. Google e Asten são autorizados uma vez e suas credenciais ficam criptografadas no servidor.</p></div></div>\n    </div>\n`;
  text = replaceOnce(text, secureBanner, '', 'remover central segura');
  const oldActivation = `    <section className={card} aria-label="Checklist de ativação do portal"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black text-slate-950">Ativação inicial</h3><p className="mt-1 text-xs text-slate-600">Vercel e Supabase são preparados na implantação. Dentro do portal, o Master autoriza Google e Asten uma única vez.</p></div><span className={\`rounded-full px-3 py-1 text-xs font-black \${readyCount===readiness.length?'bg-emerald-100 text-emerald-900':'bg-amber-100 text-amber-900'}\`}>{readyCount}/{readiness.length} requisitos</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{readiness.map(item=><div key={item.label} className={\`flex items-center gap-2 rounded-xl border p-2 text-[11px] font-bold \${item.ok?'border-emerald-200 bg-emerald-50 text-emerald-900':'border-amber-200 bg-amber-50 text-amber-900'}\`}>{item.ok?<CheckCircle2 className="h-4 w-4 shrink-0"/>:<ShieldAlert className="h-4 w-4 shrink-0"/>}{item.label}</div>)}</div><button type="button" onClick={runHomologation} disabled={working==='homologation'} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{working==='homologation'?<Loader2 className="h-4 w-4 animate-spin"/>:<ShieldCheck className="h-4 w-4"/>}Executar homologação assistida</button>{homologation.length>0&&<div className="mt-3 grid gap-2 sm:grid-cols-2">{homologation.map(check=><div key={check.id} className={\`rounded-xl border p-3 text-xs \${check.status==='PASS'?'border-emerald-200 bg-emerald-50 text-emerald-950':check.status==='PENDING'?'border-blue-200 bg-blue-50 text-blue-950':'border-red-200 bg-red-50 text-red-950'}\`}><strong>{check.label}: {check.status==='PASS'?'aprovado':check.status==='PENDING'?'pendente':'reprovado'}</strong><p className="mt-1 leading-5">{check.message}</p></div>)}</div>}</section>\n`;
  const newActivation = `    <section className={card} aria-label="Checklist de ativação do portal">\n      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">\n        <div><h3 className="font-black text-slate-950">Ativação inicial</h3><p className="mt-1 text-xs text-slate-600">Confirme somente os serviços essenciais antes do uso real.</p></div>\n        <div className="flex items-center gap-2"><span className={\`rounded-full px-3 py-1.5 text-xs font-black \${readyCount===readiness.length?'bg-emerald-100 text-emerald-950':'bg-amber-100 text-amber-950'}\`}>{readyCount}/{readiness.length} prontos</span><button type="button" onClick={runHomologation} disabled={working==='homologation'} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#5f6937] px-4 py-2 text-xs font-black text-white hover:bg-[#4f582e] disabled:opacity-40">{working==='homologation'?<Loader2 className="h-4 w-4 animate-spin"/>:<ShieldCheck className="h-4 w-4"/>}Testar ativação</button></div>\n      </div>\n      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{readiness.map(item=><div key={item.label} className={\`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold \${item.ok?'border-emerald-300 bg-emerald-50 text-emerald-950':'border-amber-300 bg-amber-50 text-amber-950'}\`}>{item.ok?<CheckCircle2 className="h-4 w-4 shrink-0"/>:<ShieldAlert className="h-4 w-4 shrink-0"/>}{item.label}</div>)}</div>\n      {homologation.length>0&&<div className="mt-3 grid gap-2 sm:grid-cols-2">{homologation.map(check=><div key={check.id} className={\`rounded-xl border p-3 text-xs \${check.status==='PASS'?'border-emerald-200 bg-emerald-50 text-emerald-950':check.status==='PENDING'?'border-amber-200 bg-amber-50 text-amber-950':'border-red-200 bg-red-50 text-red-950'}\`}><strong>{check.label}: {check.status==='PASS'?'aprovado':check.status==='PENDING'?'pendente':'reprovado'}</strong><p className="mt-1 leading-5">{check.message}</p></div>)}</div>}\n    </section>\n`;
  text = replaceOnce(text, oldActivation, newActivation, 'simplificar ativação');
  write(path, text);
}

// Indicadores recebe o monitor operacional.
{
  const path = 'src/pages/IndicadoresPage.tsx';
  let text = read(path);
  text = replaceOnce(text,
    "import { apiClient } from '../services/apiClient';\n",
    "import { apiClient } from '../services/apiClient';\nimport { OperationsMonitorPanel } from '../components/OperationsMonitorPanel';\n",
    'import monitor indicadores');
  text = replaceOnce(text,
    "          <section className=\"grid gap-4 xl:grid-cols-2\">",
    "          <OperationsMonitorPanel />\n\n          <section className=\"grid gap-4 xl:grid-cols-2\">",
    'render monitor indicadores');
  write(path, text);
}

// Tailwind emerald passa a usar uma paleta oliva/militar fosca, sem verde neon.
{
  const path = 'src/index.css';
  let text = read(path);
  const palette = `@theme {\n  --color-emerald-50: #f0f1e7;\n  --color-emerald-100: #e0e3cf;\n  --color-emerald-200: #c8ceb0;\n  --color-emerald-300: #aab388;\n  --color-emerald-400: #8c9862;\n  --color-emerald-500: #738044;\n  --color-emerald-600: #616d36;\n  --color-emerald-700: #5f6937;\n  --color-emerald-800: #4f582e;\n  --color-emerald-900: #343b20;\n  --color-emerald-950: #252a16;\n}\n\n`;
  text = replaceOnce(text, '@import "tailwindcss";\n\n', '@import "tailwindcss";\n\n' + palette, 'paleta militar');
  text = text.replaceAll('#005830', '#5f6937').replaceAll('#047857', '#5f6937').replaceAll('#0f5132', '#4f582e');
  write(path, text);
}

console.log('Rodada de pendências aplicada com sucesso.');
