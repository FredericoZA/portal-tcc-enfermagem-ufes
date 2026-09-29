#!/usr/bin/env node
import { readFile, writeFile, rm } from 'node:fs/promises';

const changed = new Set();

async function load(path) { return readFile(path, 'utf8'); }
async function save(path, content) { await writeFile(path, content); changed.add(path); }
function replaceOnce(content, from, to, label) {
  if (!content.includes(from)) throw new Error(`Padrão não encontrado: ${label}`);
  return content.replace(from, to);
}
function replaceAllExpected(content, from, to, minimum, label) {
  const count = content.split(from).length - 1;
  if (count < minimum) throw new Error(`Padrão insuficiente (${count}/${minimum}): ${label}`);
  return content.split(from).join(to);
}

// 1) Filtros semânticos: chip neutro; somente a bolinha conserva a cor.
{
  const path = 'src/utils/tableFormatters.ts';
  let s = await load(path);
  const from = `  if (semanticTone) {\n    const semanticStyle = getPortalToneStyle(semanticTone);\n    return {\n      label,\n      emoji: '',\n      dotColor: String(semanticStyle.borderColor || dotColor),\n      buttonStyle: {\n        ...semanticStyle,\n        opacity: isSelected ? 1 : 0.7,\n        boxShadow: 'none',\n      } as CSSProperties,\n      badgeStyle: {\n        backgroundColor: semanticStyle.borderColor,\n        color: semanticStyle.color,\n      } as CSSProperties,\n      mode: 'full',\n      itemConfig,\n    };\n  }`;
  const to = `  if (semanticTone) {\n    const semanticStyle = getPortalToneStyle(semanticTone);\n    const semanticDotColor = String(semanticStyle.borderColor || dotColor);\n    return {\n      label,\n      emoji: '',\n      dotColor: semanticDotColor,\n      buttonStyle: {\n        backgroundColor: isSelected ? '#AEB0B3' : '#ffffff',\n        color: '#111827',\n        borderColor: isSelected ? '#979a9d' : '#cbd5e1',\n        opacity: 1,\n        boxShadow: 'none',\n      } as CSSProperties,\n      badgeStyle: {\n        backgroundColor: '#6b7280',\n        color: '#ffffff',\n      } as CSSProperties,\n      mode: 'dot',\n      itemConfig,\n    };\n  }`;
  s = replaceOnce(s, from, to, 'getFilterChipProps semântico neutro');
  await save(path, s);
}

// 2) Lista pública de defesas: exibe a bolinha cromática explicitamente.
{
  const path = 'src/pages/HomePage.tsx';
  let s = await load(path);
  s = replaceOnce(
    s,
    `                          {chip.emoji && <span>{chip.emoji}</span>}\n                          <span>{chip.label}</span>`,
    `                          <span className="portal-filter-dot rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: chip.dotColor }} />\n                          <span>{chip.label}</span>`,
    'bolinha da Lista de Defesas',
  );
  await save(path, s);
}

// 3) Meus TCCs: remover cor do fundo do filtro e neutralizar contador.
{
  const path = 'src/pages/MeusProcessosPage.tsx';
  let s = await load(path);
  s = replaceOnce(
    s,
    `style={{ backgroundColor: cfg.bgColor, color: cfg.textHex, borderColor: cfg.borderColor, opacity: isSelected ? 1 : 0.62, boxShadow: isSelected ? \`inset 0 0 0 1px \${cfg.borderColor}\` : 'none' }}`,
    `style={{ backgroundColor: isSelected ? '#AEB0B3' : '#ffffff', color: '#111827', borderColor: isSelected ? '#979a9d' : '#cbd5e1', opacity: 1, boxShadow: 'none' }}`,
    'filtro de vínculo em Meus TCCs',
  );
  s = replaceOnce(
    s,
    `style={{ backgroundColor: cfg.borderColor, color: '#ffffff' }}`,
    `style={{ backgroundColor: '#6b7280', color: '#ffffff' }}`,
    'contador neutro em Meus TCCs',
  );
  await save(path, s);
}

// 4) Presidência: mesmo contrato visual de filtro neutro + bolinha semântica.
{
  const path = 'src/pages/CoordenadorPage.tsx';
  let s = await load(path);
  s = replaceOnce(
    s,
    `style={{ backgroundColor: semanticTone.bg, color: semanticTone.text, borderColor: semanticTone.border, opacity: isSelected ? 1 : 0.62, boxShadow: isSelected ? \`inset 0 0 0 1px \${semanticTone.border}\` : 'none' }}`,
    `style={{ backgroundColor: isSelected ? '#AEB0B3' : '#ffffff', color: '#111827', borderColor: isSelected ? '#979a9d' : '#cbd5e1', opacity: 1, boxShadow: 'none' }}`,
    'filtros de Presidência',
  );
  s = replaceOnce(
    s,
    `style={{ backgroundColor: semanticTone.border, color: '#ffffff' }}>{filter.count}</span>`,
    `style={{ backgroundColor: '#6b7280', color: '#ffffff' }}>{filter.count}</span>`,
    'contador neutro na Presidência',
  );
  await save(path, s);
}

// 5) CSS de defesa contra regressões de inline/legado.
{
  const path = 'src/portal-version-1046.css';
  let s = await load(path);
  s = replaceOnce(s,
`#public-calendar-cards-section button.portal-table-filter-chip {\n  opacity: 1 !important;\n  transform: none !important;\n}\n#public-calendar-cards-section button.portal-table-filter-chip[data-selected="true"] {\n  box-shadow: inset 0 0 0 1px currentColor !important;\n}`,
`#public-calendar-cards-section button.portal-table-filter-chip {\n  opacity: 1 !important;\n  transform: none !important;\n  background: #ffffff !important;\n  border-color: #cbd5e1 !important;\n  color: #111827 !important;\n  box-shadow: none !important;\n}\n#public-calendar-cards-section button.portal-table-filter-chip[data-selected="true"] {\n  background: #AEB0B3 !important;\n  border-color: #979a9d !important;\n  color: #111827 !important;\n  box-shadow: none !important;\n}`,
'CSS dos filtros da Lista de Defesas');

  const presidencyFrom = `#coordenador-page-root .portal-coordinator-filter-row .portal-standard-filter-chip {\n  opacity: 1 !important;\n  transform: none !important;\n}\n#coordenador-page-root .portal-coordinator-filter-row .portal-standard-filter-chip:nth-child(1) {\n  background: var(--portal-signature-pending-bg) !important;\n  border-color: var(--portal-signature-pending-border) !important;\n  color: var(--portal-signature-pending-text) !important;\n}\n#coordenador-page-root .portal-coordinator-filter-row .portal-standard-filter-chip:nth-child(2) {\n  background: var(--portal-signature-signed-bg) !important;\n  border-color: var(--portal-signature-signed-border) !important;\n  color: var(--portal-signature-signed-text) !important;\n}\n#coordenador-page-root .portal-coordinator-filter-row .portal-standard-filter-chip[aria-pressed="true"] {\n  box-shadow: inset 0 0 0 1px currentColor !important;\n}`;
  const presidencyTo = `#coordenador-page-root .portal-coordinator-filter-row .portal-standard-filter-chip {\n  opacity: 1 !important;\n  transform: none !important;\n  background: #ffffff !important;\n  border-color: #cbd5e1 !important;\n  color: #111827 !important;\n  box-shadow: none !important;\n}\n#coordenador-page-root .portal-coordinator-filter-row .portal-standard-filter-chip[aria-pressed="true"] {\n  background: #AEB0B3 !important;\n  border-color: #979a9d !important;\n  color: #111827 !important;\n  box-shadow: none !important;\n}`;
  s = replaceOnce(s, presidencyFrom, presidencyTo, 'CSS dos filtros da Presidência');
  await save(path, s);
}

// 6) Lista de Acesso: autorização é por identidade, não por papel global.
{
  const path = 'src/components/AuthorizedStudentsPanel.tsx';
  let s = await load(path);
  s = replaceOnce(s, `import type { AuthorizedStudent, ProcessRole } from '../types';`, `import type { AuthorizedStudent } from '../types';`, 'import ProcessRole em Acesso');
  const roleBlock = `const roleLabels: Record<ProcessRole, string> = {\n  STUDENT: 'Aluno',\n  ADVISOR: 'Orientador',\n  CO_ADVISOR: 'Coorientador',\n  EXAMINER: 'Membro da banca',\n};\nconst roles: ProcessRole[] = ['STUDENT', 'ADVISOR', 'CO_ADVISOR', 'EXAMINER'];\nfunction administrativeRole(entry: AuthorizedStudent): ProcessRole { return (entry.accessType || entry.roles?.[0] || 'STUDENT') as ProcessRole; }\n\n`;
  s = replaceOnce(s, roleBlock, '', 'papel global da lista de acesso');
  s = replaceOnce(s, `  { key: 'role', label: 'Qualidade' },\n`, '', 'coluna Qualidade');
  s = replaceOnce(s, `  const [role, setRole] = useState<ProcessRole>('STUDENT');\n`, '', 'estado de Qualidade');
  s = replaceOnce(s,
    `      await apiClient.addAuthorizedStudent({ nome, email, matricula: matricula.trim() || undefined, role });\n      setNome(''); setEmail(''); setMatricula(''); setRole('STUDENT'); setModal(null); await load();`,
    `      await apiClient.addAuthorizedStudent({ nome, email, matricula: matricula.trim() || undefined });\n      setNome(''); setEmail(''); setMatricula(''); setModal(null); await load();`,
    'cadastro de acesso sem papel global');
  const changeRole = `  const changeRole = async (entry: AuthorizedStudent, nextRole: ProcessRole) => {\n    if (administrativeRole(entry) === nextRole) return;\n    try { await apiClient.updateAuthorizedStudent(entry.id, { role: nextRole, replaceRole: true }); await load(); }\n    catch (error) { portalNotice(error instanceof Error ? error.message : 'Falha ao alterar a qualidade de acesso.'); }\n  };\n\n`;
  s = replaceOnce(s, changeRole, '', 'alteração de Qualidade');
  s = replaceOnce(s,
    `.filter((entry) => !term || \`\${entry.nome} \${entry.email} \${entry.matricula || ''} \${roleLabels[administrativeRole(entry)] || ''} \${entry.origin || ''}\`.toLocaleLowerCase('pt-BR').includes(term))`,
    `.filter((entry) => !term || \`\${entry.nome} \${entry.email} \${entry.matricula || ''} \${entry.origin || ''}\`.toLocaleLowerCase('pt-BR').includes(term))`,
    'busca da lista de acesso');
  s = replaceOnce(s, `    const adminRole = administrativeRole(entry);\n`, '', 'adminRole em renderCell');
  const roleCell = `    if (key === 'role') return canManage && entry.origin === 'MASTER_LIST'\n      ? <select aria-label={\`Qualidade de \${entry.nome}\`} value={adminRole} onChange={(event) => void changeRole(entry, event.target.value as ProcessRole)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[9px] font-bold">{roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select>\n      : <span className="text-[9px] font-bold">{roleLabels[adminRole]}</span>;\n`;
  s = replaceOnce(s, roleCell, '', 'célula Qualidade');
  s = replaceOnce(s, `placeholder="Nome, e-mail, matrícula ou qualidade"`, `placeholder="Nome, e-mail ou matrícula"`, 'placeholder de busca em Acesso');
  s = replaceOnce(s,
    `<label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Matrícula — opcional</span><input value={matricula} onChange={(event) => setMatricula(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Qualidade</span><select value={role} onChange={(event) => setRole(event.target.value as ProcessRole)} className={inputClass}>{roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label>`,
    `<label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Matrícula — opcional</span><input value={matricula} onChange={(event) => setMatricula(event.target.value)} className={inputClass} /></label>`,
    'campo Qualidade no modal de acesso');
  await save(path, s);
}

// 7) Backend: a lista autoriza qualquer e-mail válido; uma pessoa pode participar de vários TCCs.
{
  const path = 'server.ts';
  let s = await load(path);
  s = replaceOnce(s,
    `    const profile=resolveInstallationProfile(currentSettings);const invalid=normalized.filter(record=>!record.nome||!isValidPortalEmail(record.email)||!emailMatchesDomains(record.email,profile.studentEmailDomains)||duplicateEmails.has(record.email));\n    if(invalid.length)return res.status(400).json({error:'O lote contém linhas inválidas ou duplicadas.',invalidRows:invalid.map(record=>({row:record.row,email:record.email,reason:duplicateEmails.has(record.email)?'E-mail duplicado no arquivo':'Nome, e-mail institucional ou domínio inválido'}))});`,
    `    const invalid=normalized.filter(record=>!record.nome||!isValidPortalEmail(record.email)||duplicateEmails.has(record.email));\n    if(invalid.length)return res.status(400).json({error:'O lote contém linhas inválidas ou duplicadas.',invalidRows:invalid.map(record=>({row:record.row,email:record.email,reason:duplicateEmails.has(record.email)?'E-mail duplicado no arquivo':'Nome ou e-mail inválido'}))});`,
    'importação sem domínio institucional');

  s = replaceOnce(s,
    `    const studentEmails=[aluno1Email,aluno2?.email?normalizeEmail(aluno2.email):''].filter(Boolean);const installationProfile=resolveInstallationProfile(currentSettings);\n    if(studentEmails.some(email=>!emailMatchesDomains(email,installationProfile.studentEmailDomains)))return res.status(400).json({error:\`Os alunos autores devem usar um dos domínios institucionais configurados: \${installationProfile.studentEmailDomains.join(', ')}.\`});\n    const existingTcc=processesStore.find(process=>studentEmails.some(email=>[process.aluno1.email,process.aluno2?.email].filter(Boolean).map(normalizeEmail).includes(email)));\n    if (existingTcc) {\n      return res.status(409).json({\n        error: \`Cada aluno pode autuar apenas um TCC. Já existe o processo \${existingTcc.protocolo}.\`\n      });\n    }`,
    `    const studentEmails=[aluno1Email,aluno2?.email?normalizeEmail(aluno2.email):''].filter(Boolean);\n    // A autorização de acesso é definida pela lista administrativa. Domínio de e-mail e\n    // participação do mesmo aluno em outros TCCs não bloqueiam uma nova autuação.`,
    'criação de múltiplos TCCs e e-mail externo');

  const updateRestriction = `    {const studentEmails=[updated.aluno1.email,updated.aluno2?.email].filter(Boolean).map(email=>normalizeEmail(String(email)));const profile=resolveInstallationProfile(currentSettings);if(studentEmails.some(email=>!emailMatchesDomains(email,profile.studentEmailDomains)))return res.status(400).json({error:\`Os alunos autores devem usar os domínios institucionais configurados: \${profile.studentEmailDomains.join(', ')}.\`});const conflict=processesStore.find(process=>process.id!==existing.id&&studentEmails.some(email=>[process.aluno1.email,process.aluno2?.email].filter(Boolean).map(value=>normalizeEmail(String(value))).includes(email)));if(conflict)return res.status(409).json({error:\`Cada aluno pode participar como autor de apenas um TCC. Já existe o processo \${conflict.protocolo}.\`});}\n`;
  s = replaceOnce(s, updateRestriction, '', 'edição com múltiplos TCCs e e-mail externo');
  await save(path, s);
}

// 8) Configurações: mantém Personalização acessível, mas aplica a ordem solicitada aos cinco módulos administrativos.
{
  const path = 'src/pages/ConfiguracoesPage.tsx';
  let s = await load(path);
  const from = `              { id: 'personalization', title: 'Personalização do Portal', text: 'Aparência, navegação, páginas, tabelas e pop-ups.', icon: Palette },\n              { id: 'sync', title: 'Sincronização', text: 'Rodapé, Asten, Google, Supabase, Vercel e demais integrações.', icon: Sliders },\n              { id: 'access', title: 'Acesso', text: 'Autorizações e pessoas com acesso ao Portal.', icon: Lock },\n              { id: 'models', title: 'Modelos e Variáveis', text: 'Documentos, e-mails, formulários, fluxos e variáveis.', icon: Layers },\n              { id: 'signatures', title: 'Registros de Assinatura', text: 'Fila, método, situação e histórico de assinatura.', icon: FileCheck2 },\n              { id: 'logs', title: 'Registro de Logs', text: 'Auditoria, histórico técnico e rastreabilidade.', icon: ClipboardList },`;
  const to = `              { id: 'personalization', title: 'Personalização do Portal', text: 'Aparência, navegação, páginas, tabelas e pop-ups.', icon: Palette },\n              { id: 'models', title: 'Modelos e Variáveis', text: 'Documentos, e-mails, formulários, fluxos e variáveis.', icon: Layers },\n              { id: 'sync', title: 'Sincronização', text: 'Rodapé, Asten, Google, Supabase, Vercel e demais integrações.', icon: Sliders },\n              { id: 'access', title: 'Acesso', text: 'Autorizações e pessoas com acesso ao Portal.', icon: Lock },\n              { id: 'signatures', title: 'Registros de Assinatura', text: 'Fila, método, situação e histórico de assinatura.', icon: FileCheck2 },\n              { id: 'logs', title: 'Registro de Logs', text: 'Auditoria, histórico técnico e rastreabilidade.', icon: ClipboardList },`;
  s = replaceOnce(s, from, to, 'ordem dos módulos de Configurações');
  await save(path, s);
}

// 9) Editores de pop-up: shell administrativo verde/cinza/branco do Portal.
{
  const path = 'src/components/LoginPopupEditorModal.tsx';
  let s = await load(path);
  s = replaceOnce(s,
    `      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">`,
    `      <div className="portal-admin-editor-modal bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">`,
    'shell do editor de Login');
  s = replaceOnce(s,
    `        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">`,
    `        <div className="portal-admin-editor-header text-white px-6 py-4 flex items-center justify-between border-b-[16px] border-white shrink-0" style={{ backgroundColor: 'var(--portal-green-header)' }}>`,
    'header do editor de Login');
  s = s.replace('w-10 h-10 rounded-xl bg-slate-700 border border-slate-600 text-slate-100', 'w-10 h-10 rounded-xl bg-white border border-white text-slate-900');
  s = s.replace('text-xs text-slate-400 font-medium', 'text-xs text-white/80 font-medium');
  s = s.replace('border border-slate-700 hover:bg-slate-800 text-slate-300', 'border border-white bg-white hover:bg-slate-50 text-slate-900');
  s = s.replace('rounded-xl bg-slate-600 hover:bg-slate-700 text-white', 'rounded-xl bg-white hover:bg-slate-50 text-slate-900 border border-white');
  s = s.replace('rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white', 'rounded-xl bg-white hover:bg-slate-50 text-slate-900');
  s = s.replace('border-purple-600 bg-purple-50 text-slate-900', 'border-[#337959] bg-[#e1e6e9] text-slate-900');
  s = replaceOnce(s, `        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden bg-slate-100">`, `        <div className="portal-admin-editor-body flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">`, 'corpo do editor de Login');
  await save(path, s);
}

{
  const path = 'src/components/CalendarPopupEditorModal.tsx';
  let s = await load(path);
  s = replaceOnce(s,
    `      <div className="bg-white rounded-2xl border border-slate-300 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">`,
    `      <div className="portal-admin-editor-modal bg-white rounded-2xl border border-slate-300 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">`,
    'shell do editor do Calendário');
  s = replaceOnce(s,
    `        <div className="bg-slate-100 p-4 sm:p-5 flex items-center justify-between border-b border-slate-300 shrink-0">`,
    `        <div className="portal-admin-editor-header p-4 sm:p-5 flex items-center justify-between border-b-[16px] border-white shrink-0 text-white" style={{ backgroundColor: 'var(--portal-green-header)' }}>`,
    'header do editor do Calendário');
  s = s.replace('p-2 bg-white text-slate-800 rounded-xl border border-slate-300', 'p-2 bg-white text-slate-900 rounded-xl border border-white');
  s = s.replace('text-sm sm:text-base font-black uppercase tracking-tight text-slate-900', 'text-sm sm:text-base font-black uppercase tracking-tight text-white');
  s = s.replace('text-[11px] text-slate-600 font-medium mt-0.5', 'text-[11px] text-white/80 font-medium mt-0.5');
  s = s.replace('text-[10px] bg-emerald-100 text-emerald-900 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300', 'text-[10px] bg-white text-slate-900 font-extrabold px-2 py-0.5 rounded-full border border-white');
  s = s.replace('rounded-xl p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer border border-transparent hover:border-slate-300', 'rounded-xl p-2 text-slate-900 bg-white hover:bg-slate-50 transition-colors cursor-pointer border border-white');
  await save(path, s);
}

{
  const path = 'src/components/TccDetailPopupEditorModal.tsx';
  let s = await load(path);
  s = replaceOnce(s,
    `      <div className="w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-900 animate-in zoom-in-95 duration-150">`,
    `      <div className="portal-admin-editor-modal w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl border border-slate-300 shadow-2xl flex flex-col overflow-hidden text-slate-900 animate-in zoom-in-95 duration-150">`,
    'shell do editor de detalhe TCC');
  s = replaceOnce(s,
    `        <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 shrink-0 flex items-center justify-between gap-3">`,
    `        <div className="portal-admin-editor-header border-b-[16px] border-white p-3 sm:p-4 shrink-0 flex items-center justify-between gap-3 text-white" style={{ backgroundColor: 'var(--portal-green-header)' }}>`,
    'header do editor de detalhe TCC');
  s = s.replace('w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200', 'w-8 h-8 rounded-lg bg-white text-slate-900 border border-white');
  s = s.replace('font-black text-xs sm:text-sm uppercase tracking-wide text-slate-900', 'font-black text-xs sm:text-sm uppercase tracking-wide text-white');
  s = s.replace('className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"', 'className="p-1.5 rounded-lg text-slate-900 bg-white hover:bg-slate-50 transition-colors cursor-pointer shrink-0 border border-white"');
  await save(path, s);
}

// 10) Tokens CSS para o shell dos editores administrativos.
{
  const path = 'src/portal-semantic-ui.css';
  let s = await load(path);
  const marker = `\n/* Rodada final: shell único para editores administrativos abertos por Configurações. */\n.portal-admin-editor-modal {\n  background: var(--portal-surface-page) !important;\n  border-color: #cbd5e1 !important;\n}\n.portal-admin-editor-header {\n  background: var(--portal-green-header) !important;\n  color: #fff !important;\n  border-bottom-color: #fff !important;\n}\n.portal-admin-editor-body {\n  background: var(--portal-surface-layer-1) !important;\n}\n`;
  if (!s.includes('Rodada final: shell único para editores administrativos')) s += marker;
  await save(path, s);
}

// 11) Versão 1.0.48.
{
  const path = 'package.json';
  const pkg = JSON.parse(await load(path));
  pkg.version = '1.0.48';
  await save(path, `${JSON.stringify(pkg, null, 2)}\n`);
}
{
  const path = 'package-lock.json';
  const lock = JSON.parse(await load(path));
  lock.version = '1.0.48';
  if (lock.packages?.['']) lock.packages[''].version = '1.0.48';
  await save(path, `${JSON.stringify(lock, null, 2)}\n`);
}

// 12) Atualiza contratos históricos que ainda exigiam filtros totalmente coloridos.
{
  const path = 'server/homologacaoVisual20260927Contract.test.ts';
  let s = await load(path);
  const old = `test('Presidência usa a mesma paleta nos filtros e nos status correspondentes', async () => {\n  const css = await source('src/portal-version-1046.css');\n  assert.match(css, /portal-coordinator-filter-row[\\s\\S]*nth-child\\(1\\)[\\s\\S]*--portal-signature-pending-bg/);\n  assert.match(css, /portal-coordinator-filter-row[\\s\\S]*nth-child\\(2\\)[\\s\\S]*--portal-signature-signed-bg/);\n  assert.match(css, /tbody span\\.bg-amber-50[\\s\\S]*--portal-signature-pending-bg/);\n  assert.match(css, /tbody span\\.bg-emerald-100[\\s\\S]*--portal-signature-signed-bg/);\n});`;
  const next = `test('Presidência usa filtros neutros com bolinha semântica e mantém a paleta nos status', async () => {\n  const [css, page] = await Promise.all([source('src/portal-version-1046.css'), source('src/pages/CoordenadorPage.tsx')]);\n  assert.match(css, /portal-coordinator-filter-row[\\s\\S]*background:\\s*#ffffff\\s*!important/);\n  assert.match(css, /portal-coordinator-filter-row[\\s\\S]*#AEB0B3/);\n  assert.match(page, /portal-filter-dot[\\s\\S]*semanticTone\\.border/);\n  assert.match(css, /tbody span\\.bg-amber-50[\\s\\S]*--portal-signature-pending-bg/);\n  assert.match(css, /tbody span\\.bg-emerald-100[\\s\\S]*--portal-signature-signed-bg/);\n});`;
  s = replaceOnce(s, old, next, 'contrato histórico da Presidência');
  await save(path, s);
}

// 13) Novo contrato explícito da rodada, para impedir novas regressões.
{
  const path = 'server/finalGreenRoundContract.test.ts';
  const content = `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';\n\nconst source = (path: string) => readFile(path, 'utf8');\n\ntest('filtros semânticos são neutros e a cor fica somente na bolinha', async () => {\n  const [formatter, home, mine, coordinator, css] = await Promise.all([\n    source('src/utils/tableFormatters.ts'),\n    source('src/pages/HomePage.tsx'),\n    source('src/pages/MeusProcessosPage.tsx'),\n    source('src/pages/CoordenadorPage.tsx'),\n    source('src/portal-version-1046.css'),\n  ]);\n  assert.match(formatter, /backgroundColor: isSelected \\? '#AEB0B3' : '#ffffff'/);\n  assert.match(formatter, /dotColor: semanticDotColor/);\n  assert.doesNotMatch(formatter, /buttonStyle:\\s*\\{\\s*\\.\\.\\.semanticStyle/);\n  assert.match(home, /portal-filter-dot[\\s\\S]*chip\\.dotColor/);\n  assert.match(mine, /backgroundColor: isSelected \\? '#AEB0B3' : '#ffffff'/);\n  assert.match(mine, /portal-filter-dot[\\s\\S]*cfg\\.borderColor/);\n  assert.match(coordinator, /backgroundColor: isSelected \\? '#AEB0B3' : '#ffffff'/);\n  assert.match(coordinator, /portal-filter-dot[\\s\\S]*semanticTone\\.border/);\n  assert.match(css, /#public-calendar-cards-section button\\.portal-table-filter-chip[\\s\\S]*background:\\s*#ffffff\\s*!important/);\n  assert.match(css, /#coordenador-page-root \\.portal-coordinator-filter-row \\.portal-standard-filter-chip[\\s\\S]*background:\\s*#ffffff\\s*!important/);\n});\n\ntest('lista de acesso autoriza identidade sem qualidade global ou domínio institucional', async () => {\n  const [panel, server] = await Promise.all([source('src/components/AuthorizedStudentsPanel.tsx'), source('server.ts')]);\n  assert.doesNotMatch(panel, /Qualidade/);\n  assert.doesNotMatch(panel, /key: 'role'/);\n  assert.match(panel, /O e-mail não precisa pertencer a um domínio institucional/);\n  assert.doesNotMatch(server, /Nome, e-mail institucional ou domínio inválido/);\n  assert.doesNotMatch(server, /Os alunos autores devem usar um dos domínios institucionais configurados/);\n});\n\ntest('um aluno pode participar de vários TCCs sem bloqueio global', async () => {\n  const server = await source('server.ts');\n  assert.doesNotMatch(server, /Cada aluno pode autuar apenas um TCC/);\n  assert.doesNotMatch(server, /Cada aluno pode participar como autor de apenas um TCC/);\n  assert.match(server, /participação do mesmo aluno em outros TCCs não bloqueiam uma nova autuação/);\n  assert.match(server, /synchronizeProcessParticipants\\(updated,actorEmail\\)/);\n});\n\ntest('editores administrativos usam o shell verde e as superfícies do Portal', async () => {\n  const [login, calendar, detail, css] = await Promise.all([\n    source('src/components/LoginPopupEditorModal.tsx'),\n    source('src/components/CalendarPopupEditorModal.tsx'),\n    source('src/components/TccDetailPopupEditorModal.tsx'),\n    source('src/portal-semantic-ui.css'),\n  ]);\n  for (const file of [login, calendar, detail]) {\n    assert.match(file, /portal-admin-editor-modal/);\n    assert.match(file, /portal-admin-editor-header/);\n    assert.match(file, /var\\(--portal-green-header\\)/);\n  }\n  assert.match(css, /portal-admin-editor-modal[\\s\\S]*--portal-surface-page/);\n  assert.match(css, /portal-admin-editor-header[\\s\\S]*--portal-green-header/);\n});\n\ntest('Configurações respeita a ordem administrativa e a release foi atualizada', async () => {\n  const [config, pkg] = await Promise.all([source('src/pages/ConfiguracoesPage.tsx'), source('package.json')]);\n  const models = config.indexOf("id: 'models'");\n  const sync = config.indexOf("id: 'sync'", models);\n  const access = config.indexOf("id: 'access'", sync);\n  const signatures = config.indexOf("id: 'signatures'", access);\n  const logs = config.indexOf("id: 'logs'", signatures);\n  assert.ok(models >= 0 && models < sync && sync < access && access < signatures && signatures < logs);\n  assert.equal(JSON.parse(pkg).version, '1.0.48');\n});\n`;
  await save(path, content);
}

// 14) Changelog resumido.
{
  const path = 'CHANGELOG.md';
  let s = await load(path);
  const entry = `\n## 1.0.48 — 2026-09-28\n\n- padroniza filtros: branco, seleção cinza institucional e somente a bolinha com cor semântica;\n- mantém botões/processos com a mesma fonte semântica de cores;\n- uniformiza o shell dos editores de pop-up em Configurações;\n- transforma a lista de acesso em autorização por identidade, sem qualidade global e sem restrição de domínio;\n- permite que a mesma pessoa participe de mais de um TCC;\n- mantém importação Excel/Google Planilhas e sincronização dos participantes com a lista de acesso;\n- adiciona contratos de regressão para a rodada.\n`;
  if (!s.includes('## 1.0.48 — 2026-09-28')) s = entry + s;
  await save(path, s);
}

// O migrador e seu workflow são temporários: o commit final fica limpo.
await rm('scripts/apply-final-green-round.mjs', { force: true });
await rm('.github/workflows/apply-final-green-round.yml', { force: true });

console.log(`Rodada aplicada. Arquivos alterados: ${[...changed].join(', ')}`);
