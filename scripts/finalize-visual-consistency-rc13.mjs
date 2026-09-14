import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);

function replaceOnce(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`Trecho não localizado: ${label}`);
  return text.replace(search, replacement);
}
function replaceRegex(text, regex, replacement, label) {
  if (!regex.test(text)) throw new Error(`Padrão não localizado: ${label}`);
  regex.lastIndex = 0;
  return text.replace(regex, replacement);
}

// 1) Rodapé: QR agrupado ao contato e afastado da borda direita.
{
  const path = 'src/components/Footer.tsx';
  let s = read(path);
  s = replaceOnce(
    s,
    'className="flex w-full max-w-[500px] items-center justify-center gap-3 sm:gap-4"',
    'className="flex w-full max-w-[370px] items-center justify-center gap-0.5 sm:gap-1"',
    'agrupamento contato + QR'
  );
  s = replaceOnce(
    s,
    'className="min-w-0 w-[280px] flex flex-col justify-center items-center text-center gap-2"',
    'className="min-w-0 w-[255px] flex flex-col justify-center items-center text-center gap-2"',
    'largura do bloco de suporte'
  );
  write(path, s);
}

// 2) Replicar Portal: verde musgo apenas no cabeçalho; restante branco/cinza.
{
  const path = 'src/pages/PortalReplicationPage.tsx';
  let s = read(path);
  s = s.replaceAll('border-[#344125]/25 bg-[#344125]', 'border-[#06372d]/25 bg-[#06372d]');
  s = s.replaceAll('border-amber-200 bg-amber-50', 'border-slate-300 bg-slate-50');
  s = s.replaceAll('text-amber-800', 'text-slate-700');
  s = s.replaceAll('text-amber-950', 'text-slate-950');
  s = s.replaceAll('text-amber-900', 'text-slate-700');
  write(path, s);
}

// 3) Como usar: seleção segue o verde musgo institucional.
{
  const path = 'src/pages/PortalTutorialPage.tsx';
  let s = read(path);
  s = replaceOnce(
    s,
    "role === key ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-400'",
    "role === key ? 'border-[#06372d] bg-[#06372d] text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-400'",
    'filtro ativo do tutorial'
  );
  write(path, s);
}

// 4) Popup de login: branco/cinza, texto correto, sem rodapé-observação e sem emblema institucional.
{
  const path = 'src/utils/loginPopupConfig.ts';
  let s = read(path);
  s = s.replace("discenteTip: 'utilize sempre seu e-mail institucional @edu.ufes.br cadastrado no processo.'", "discenteTip: 'utilize sempre seu e-mail institucional @edu.ufes.br'");
  s = s.replace("headerTheme: 'emerald'", "headerTheme: 'slate'");
  s = s.replace('showLogo: true', 'showLogo: false');
  s = s.replace('showSecurityFooter: true', 'showSecurityFooter: false');
  s = s.replace("cardBgColor: '#ecfdf5'", "cardBgColor: '#ffffff'");
  s = s.replace("primaryBtnBg: '#005830'", "primaryBtnBg: '#475569'");
  s = replaceOnce(
    s,
    '          locationText: DEFAULT_LOGIN_POPUP_CONFIG.locationText\n',
    '          locationText: DEFAULT_LOGIN_POPUP_CONFIG.locationText,\n          headerTheme: DEFAULT_LOGIN_POPUP_CONFIG.headerTheme,\n          showLogo: DEFAULT_LOGIN_POPUP_CONFIG.showLogo,\n          showSecurityFooter: DEFAULT_LOGIN_POPUP_CONFIG.showSecurityFooter,\n          cardBgColor: DEFAULT_LOGIN_POPUP_CONFIG.cardBgColor,\n          cardTextColor: DEFAULT_LOGIN_POPUP_CONFIG.cardTextColor,\n          primaryBtnBg: DEFAULT_LOGIN_POPUP_CONFIG.primaryBtnBg,\n          primaryBtnTextColor: DEFAULT_LOGIN_POPUP_CONFIG.primaryBtnTextColor\n',
    'forçar padrão do popup ao carregar'
  );
  s = s.replace('      cardBgColor: global.headerBgColor,', '      cardBgColor: DEFAULT_LOGIN_POPUP_CONFIG.cardBgColor,');
  s = s.replace('      cardTextColor: global.headerTextColor,', '      cardTextColor: DEFAULT_LOGIN_POPUP_CONFIG.cardTextColor,');
  s = s.replace('      primaryBtnBg: global.actionBgColor,', '      primaryBtnBg: DEFAULT_LOGIN_POPUP_CONFIG.primaryBtnBg,');
  s = s.replace('      primaryBtnTextColor: global.actionTextColor,', '      primaryBtnTextColor: DEFAULT_LOGIN_POPUP_CONFIG.primaryBtnTextColor,');
  write(path, s);
}

// 5) Home/login real: emoji no lugar do emblema; remove observações; neutraliza alertas e ações dentro do popup.
{
  const path = 'src/pages/HomePage.tsx';
  let s = read(path);
  s = s.replace("import { NursingEmblemLogo } from '../components/NursingEmblemLogo';\n", '');
  s = replaceRegex(
    s,
    /\{loginPopupConfig\.showLogo && \(\s*<div className="w-12 h-12 flex items-center justify-center shrink-0">\s*<NursingEmblemLogo[\s\S]*?<\/div>\s*\)\}/,
    '<div className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0 text-xl" aria-hidden="true">🎓</div>',
    'emblema do popup de login'
  );
  s = replaceRegex(
    s,
    /\s*\{\/\* Footer institutional security note \*\/\}\s*\{loginPopupConfig\.showSecurityFooter && \([\s\S]*?\n\s*\)\}/,
    '',
    'rodapé de observações do login'
  );
  s = s.replaceAll('border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950', 'border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900');
  s = s.replaceAll('className="mt-2 rounded-lg bg-blue-800 px-3 py-2 font-black text-white"', 'className="mt-2 rounded-lg bg-slate-700 px-3 py-2 font-black text-white hover:bg-slate-800"');
  s = s.replaceAll('Shield className="w-5 h-5 text-emerald-700 shrink-0"', 'Shield className="w-5 h-5 text-slate-600 shrink-0"');
  write(path, s);
}

// 6) Editor do popup: não oferece paletas coloridas nem emblema fora da lateral.
{
  const path = 'src/components/LoginPopupEditorModal.tsx';
  let s = read(path);
  s = s.replace("import { NursingEmblemLogo } from './NursingEmblemLogo';\n", '');
  s = replaceRegex(
    s,
    /const THEME_OPTIONS:[\s\S]*?= \[[\s\S]*?\n\];/,
    `const THEME_OPTIONS: Array<{\n  id: LoginPopupConfig['headerTheme'];\n  name: string;\n  badgeBg: string;\n  headerBg: string;\n  btnBg: string;\n  accentText: string;\n}> = [\n  { id: 'slate', name: 'Branco e cinza — padrão do Portal', badgeBg: 'bg-slate-500', headerBg: 'bg-white border-slate-200', btnBg: 'bg-slate-600 hover:bg-slate-700', accentText: 'text-slate-600' }\n];`,
    'opções de tema do popup'
  );
  s = s.replaceAll('bg-purple-600/30 border border-purple-400/40 text-purple-300', 'bg-slate-700 border border-slate-600 text-slate-100');
  s = s.replaceAll('bg-purple-500/20 text-purple-200 border border-purple-400/30', 'bg-slate-700 text-slate-100 border border-slate-600');
  s = s.replaceAll('bg-emerald-600 hover:bg-emerald-500', 'bg-slate-600 hover:bg-slate-700');
  s = s.replaceAll('text-purple-900', 'text-slate-900');
  s = s.replaceAll('focus:ring-purple-500', 'focus:ring-slate-400');
  s = s.replaceAll('border-purple-600 bg-purple-50 ring-2 ring-purple-200', 'border-slate-500 bg-slate-100 ring-2 ring-slate-200');
  s = s.replaceAll('text-purple-600', 'text-slate-600');
  s = s.replaceAll('Configure textos, logotipo, dicas para discentes/docentes, paletas de cores e rodapé de segurança', 'Configure textos e o padrão branco/cinza do popup de acesso');
  // Caso a prévia ainda contenha o emblema, substitui por emoji acadêmico.
  s = s.replace(/<NursingEmblemLogo[^>]*\/>/g, '<span className="text-2xl" aria-hidden="true">🎓</span>');
  write(path, s);
}

// 7) Todos os popups: superfície branca, cabeçalho cinza claro e ações cinza.
{
  const path = 'src/index.css';
  let s = read(path);
  const replacements = new Map([
    ['--portal-popup-header: #344125;', '--portal-popup-header: #f1f5f9;'],
    ['--portal-popup-header-text: #ffffff;', '--portal-popup-header-text: #0f172a;'],
    ['--portal-popup-action: #5b635e;', '--portal-popup-action: #475569;'],
    ['--portal-new-defense-header: #435649;', '--portal-new-defense-header: #f1f5f9;'],
    ['--portal-new-defense-header-text: #ffffff;', '--portal-new-defense-header-text: #0f172a;'],
    ['--portal-new-defense-action: #5b635e;', '--portal-new-defense-action: #475569;'],
    ['--portal-upload-header: #435649;', '--portal-upload-header: #f1f5f9;'],
    ['--portal-upload-header-text: #ffffff;', '--portal-upload-header-text: #0f172a;'],
    ['--portal-upload-action: #5b635e;', '--portal-upload-action: #475569;'],
    ['--portal-hipoar-bg: #f8fafc;', '--portal-hipoar-bg: #ffffff;'],
    ['--portal-hipoar-header: #0f172a;', '--portal-hipoar-header: #f1f5f9;'],
    ['--portal-hipoar-header-text: #ffffff;', '--portal-hipoar-header-text: #0f172a;'],
    ['--portal-hipoar-action: #0284c7;', '--portal-hipoar-action: #475569;'],
    ['--portal-pdf-bg: #0f172a;', '--portal-pdf-bg: #ffffff;'],
    ['--portal-pdf-header: #1e293b;', '--portal-pdf-header: #f1f5f9;'],
    ['--portal-pdf-header-text: #ffffff;', '--portal-pdf-header-text: #0f172a;'],
    ['--portal-pdf-action: #2563eb;', '--portal-pdf-action: #475569;'],
    ['--portal-correction-header: #435649;', '--portal-correction-header: #f1f5f9;'],
    ['--portal-correction-header-text: #ffffff;', '--portal-correction-header-text: #0f172a;'],
    ['--portal-correction-action: #5b635e;', '--portal-correction-action: #475569;']
  ]);
  for (const [from, to] of replacements) s = s.replaceAll(from, to);
  if (!s.includes('Padrão rc.13: todos os popups em branco e cinza')) {
    s += `\n\n/* Padrão rc.13: todos os popups em branco e cinza. */\n.portal-modal-surface,\n:where(.fixed.inset-0.z-50, .fixed.inset-0.z-\\[60\\]) > :where(.bg-white, .bg-slate-100) {\n  background-color: #ffffff !important;\n  border-color: #cbd5e1 !important;\n}\n.portal-modal-header {\n  background-color: #f1f5f9 !important;\n  color: #0f172a !important;\n  border-color: #cbd5e1 !important;\n}\n`;
  }
  write(path, s);
}

// 8) Versão rc.13 em pacote, lock e fallback visível da lateral.
{
  const pkgPath = 'package.json';
  const pkg = JSON.parse(read(pkgPath));
  pkg.version = '1.0.0-rc.13';
  write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  const lockPath = 'package-lock.json';
  const lock = JSON.parse(read(lockPath));
  lock.version = '1.0.0-rc.13';
  if (lock.packages?.['']) lock.packages[''].version = '1.0.0-rc.13';
  write(lockPath, JSON.stringify(lock, null, 2) + '\n');

  const sidebarPath = 'src/components/Sidebar.tsx';
  let sidebar = read(sidebarPath).replaceAll('1.0.0-rc.12', '1.0.0-rc.13');
  write(sidebarPath, sidebar);
}

console.log('Padronização visual rc.13 aplicada.');
