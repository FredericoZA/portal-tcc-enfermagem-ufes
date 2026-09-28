import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, value) => fs.writeFileSync(p, value);
const mustReplace = (source, search, replacement, label) => {
  const next = typeof search === 'string' ? source.replace(search, replacement) : source.replace(search, replacement);
  if (next === source) throw new Error(`1048 patch não encontrou: ${label}`);
  return next;
};
const replaceAll = (source, search, replacement, label) => {
  const next = source.replace(search, replacement);
  if (next === source) throw new Error(`1048 patch não encontrou: ${label}`);
  return next;
};

// 1) Versionamento.
{
  const pkg = JSON.parse(read('package.json'));
  pkg.version = '1.0.48';
  write('package.json', JSON.stringify(pkg, null, 2) + '\n');
  if (fs.existsSync('package-lock.json')) {
    const lock = JSON.parse(read('package-lock.json'));
    lock.version = '1.0.48';
    if (lock.packages?.['']) lock.packages[''].version = '1.0.48';
    write('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  }
}

// 2) Filtros: botão sempre neutro; apenas a bolinha carrega a semântica.
{
  const file = 'src/utils/tableFormatters.ts';
  let src = read(file);
  src = mustReplace(src,
`      dotColor: String(semanticStyle.borderColor || dotColor),
      buttonStyle: {
        ...semanticStyle,
        opacity: isSelected ? 1 : 0.7,
        boxShadow: 'none',
      } as CSSProperties,`,
`      dotColor: String(semanticStyle.backgroundColor || semanticStyle.borderColor || dotColor),
      buttonStyle: {
        backgroundColor: '#ffffff',
        color: '#0f172a',
        borderColor: isSelected ? '#858b90' : '#cbd5e1',
        opacity: 1,
        boxShadow: isSelected ? 'inset 0 0 0 1px #858b90' : 'none',
      } as CSSProperties,`, 'getFilterChipProps semântico');
  write(file, src);

  write('src/portal-update-23.css', `/* 1.0.48 — filtros canônicos: superfície neutra; significado somente na bolinha. */
:root {
  --portal-selected-strong-23: #aeb0b3;
  --portal-selected-strong-border-23: #858b90;
  --portal-sidebar-highlight-23: #8fcfa6;
}
.portal-table-filter-chip,
.portal-table-filter-chip:hover,
.portal-table-filter-chip[data-selected="true"],
.portal-table-filter-chip[data-selected="true"]:hover {
  background-color: #ffffff !important;
  color: #0f172a !important;
  opacity: 1 !important;
  transform: none !important;
  filter: none !important;
}
.portal-table-filter-chip { border-color: #cbd5e1 !important; box-shadow: 0 1px 2px rgba(15,23,42,.08) !important; }
.portal-table-filter-chip[data-selected="true"] { border-color: #858b90 !important; box-shadow: inset 0 0 0 1px #858b90, 0 1px 2px rgba(15,23,42,.08) !important; }
.portal-filter-dot { width: .65rem !important; height: .65rem !important; min-width: .65rem !important; flex-basis: .65rem !important; }
#portal-sidebar h1 + div, #portal-sidebar h1 + div > span { color: var(--portal-sidebar-highlight-23) !important; }
`);
}

// 3) Lista de Defesas: bolinha explícita e exatamente a mesma cor semântica do calendário/botão.
{
  const file = 'src/pages/HomePage.tsx';
  let src = read(file);
  src = mustReplace(src,
`                          {chip.emoji && <span>{chip.emoji}</span>}
                          <span>{chip.label}</span>`,
`                          {statusKey !== 'all' && <span className="portal-filter-dot rounded-full shrink-0" style={{ backgroundColor: chip.dotColor }} aria-hidden="true" />}
                          <span>{chip.label}</span>`, 'bolinha filtros Lista de Defesas');
  write(file, src);
}

// 4) Meus TCCs: botão neutro e quatro bolinhas realmente distintas.
{
  const file = 'src/pages/MeusProcessosPage.tsx';
  let src = read(file);
  src = mustReplace(src,
`                      style={{ backgroundColor: cfg.bgColor, color: cfg.textHex, borderColor: cfg.borderColor, opacity: isSelected ? 1 : 0.62, boxShadow: isSelected ? \`inset 0 0 0 1px \${cfg.borderColor}\` : 'none' }}`,
`                      style={{ backgroundColor: '#ffffff', color: '#0f172a', borderColor: isSelected ? '#858b90' : '#cbd5e1', opacity: 1, boxShadow: isSelected ? 'inset 0 0 0 1px #858b90' : 'none' }}`, 'filtro vínculo neutro');
  src = mustReplace(src,
`                        style={{ backgroundColor: cfg.borderColor }}`,
`                        style={{ backgroundColor: cfg.bgColor, border: \`1px solid \${cfg.borderColor}\` }}`, 'bolinha vínculo');
  src = mustReplace(src,
`                        style={{ backgroundColor: cfg.borderColor, color: '#ffffff' }}`,
`                        style={{ backgroundColor: '#eef2f3', color: '#334155' }}`, 'contador vínculo neutro');
  write(file, src);
}

// 5) Rodapé: centralização inequívoca e e-mail apenas por clique no nome.
{
  const file = 'src/components/Footer.tsx';
  let src = read(file);
  src = mustReplace(src,
`<div className="mt-1 grid items-start gap-x-4 gap-y-1 text-center sm:grid-cols-2">`,
`<div className="mt-1 grid items-start justify-items-center gap-x-4 gap-y-1 text-center sm:grid-cols-2">`, 'centralização membros rodapé');
  src = mustReplace(src,
`className="inline-flex max-w-full items-center justify-center gap-1 rounded px-1 text-center font-bold`,
`className="mx-auto inline-flex max-w-full items-center justify-center gap-1 rounded px-1 text-center font-bold`, 'nome clicável centralizado');
  write(file, src);
}

// 6) Sincronização: autosave realmente sincroniza o snapshot compartilhado e remove troca administrativa redundante.
{
  const file = 'src/components/CommissionIdentityPanel.tsx';
  let src = read(file);
  src = mustReplace(src, `      if (manual) await refreshAuth();`, `      await refreshAuth();`, 'refresh após autosave');
  src = mustReplace(src, /\n\s*<details className="portal-president-master-transfer[\s\S]*?<\/details>\n/, '\n', 'bloco acessos administrativos');
  write(file, src);
}

// 7) Integrações: configuração de reserva na própria tela canônica.
{
  const file = 'src/components/InfrastructureIntegrationsPanel.tsx';
  let src = read(file);
  src = mustReplace(src, `import { apiClient } from '../services/apiClient';`, `import { apiClient } from '../services/apiClient';\nimport { ReservationEmailConfigPanel } from './ReservationEmailConfigPanel';`, 'import reserva');
  src = mustReplace(src,
`    </section>\n\n    {hasRunTests && <section`,
`      <ReservationEmailConfigPanel />\n    </section>\n\n    {hasRunTests && <section`, 'painel reserva em integrações');
  write(file, src);
}

// 8) Editor operacional: permitir Enter ao editar lista de locais; saneamento fica na publicação.
{
  const file = 'src/components/OperationalDesignerPanel.tsx';
  let src = read(file);
  src = mustReplace(src,
`onChange={e=>changeReservation({locations:e.target.value.split('\\n').map(value=>value.trim()).filter(Boolean)})}`,
`onChange={e=>changeReservation({locations:e.target.value.split('\\n')})}`,
'edição multiline de locais');
  write(file, src);
}

// 9) Assinaturas: não inferir horário real de assinatura a partir do arquivamento.
{
  const file = 'src/pages/AstenLogsPage.tsx';
  let src = read(file);
  src = mustReplace(src, `if (key === 'signedAt') return dateTime(job.signedAt || job.completedAt);`, `if (key === 'signedAt') return dateTime(job.signedAt);`, 'signedAt exato');
  src = mustReplace(src, `if (key === 'completedAt') return dateTime(job.completedAt || job.signedAt);`, `if (key === 'completedAt') return dateTime(job.completedAt);`, 'completedAt separado');
  write(file, src);
}

// 10) Logs: atividade como texto normal e ações administrativas em grupo separado.
{
  const file = 'src/pages/AuditLogsPage.tsx';
  let src = read(file);
  src = mustReplace(src,
`if (key === 'action') return <span className="inline-flex rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-black uppercase">{log.action || '—'}</span>;`,
`if (key === 'action') return <span className="text-[10px] font-bold uppercase text-slate-900">{log.action || '—'}</span>;`, 'ação sem caixa');
  src = mustReplace(src,
`const whiteButton = 'inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-white bg-white px-2.5 py-1.5 text-[10px] font-black uppercase text-slate-900 shadow-sm hover:bg-slate-50';`,
`const whiteButton = 'inline-flex min-h-8 items-center gap-1.5 rounded-full border border-white bg-white px-2.5 py-1.5 text-[10px] font-black uppercase text-slate-900 shadow-sm hover:bg-slate-50';`, 'botões arredondados logs');
  src = mustReplace(src,
`  const toolbar = <div className="portal-audit-toolbar flex flex-wrap items-center justify-end gap-1.5">\n    <button type="button" onClick={() => void downloadBackup()} className={whiteButton}><Download className="h-3.5 w-3.5"/>Backup</button>\n    <button type="button" onClick={() => restoreInputRef.current?.click()} className={whiteButton}><Upload className="h-3.5 w-3.5"/>Restaurar</button>\n    <input ref={restoreInputRef} type="file" accept=".json,application/json" className="hidden" onChange={event => restoreBackup(event.target.files?.[0])}/>\n    <SearchPopover`,
`  const toolbar = <div className="portal-audit-toolbar flex flex-wrap items-center justify-end gap-1.5">\n    <div className="flex items-center gap-1.5 border-r border-white/45 pr-2 mr-0.5">\n      <button type="button" onClick={() => void downloadBackup()} className={whiteButton}><Download className="h-3.5 w-3.5"/>Backup</button>\n      <button type="button" onClick={() => restoreInputRef.current?.click()} className={whiteButton}><Upload className="h-3.5 w-3.5"/>Restaurar</button>\n      <input ref={restoreInputRef} type="file" accept=".json,application/json" className="hidden" onChange={event => restoreBackup(event.target.files?.[0])}/>\n    </div>\n    <SearchPopover`, 'grupo backup logs');
  write(file, src);
}

// 11) Popovers acima do workspace administrativo.
for (const file of ['src/components/SearchPopover.tsx','src/components/HeaderSettingsPopover.tsx']) {
  let src = read(file);
  src = src.replaceAll('z-[1000001]', 'z-[1000020]');
  write(file, src);
}

// 12) Modal de Configurações: sem X redundante, ESC e clique externo continuam disponíveis.
{
  const file = 'src/components/SettingsWorkspaceModal.tsx';
  let src = read(file);
  src = src.replace(`import { X } from 'lucide-react';\n`, '');
  src = mustReplace(src,
`  useEffect(() => {\n    if (!open) setHeaderHost(null);\n  }, [open]);`,
`  useEffect(() => {\n    if (!open) setHeaderHost(null);\n  }, [open]);\n\n  useEffect(() => {\n    if (!open) return;\n    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };\n    window.addEventListener('keydown', onKeyDown);\n    return () => window.removeEventListener('keydown', onKeyDown);\n  }, [open, onClose]);`, 'ESC modal');
  src = mustReplace(src,
`          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white bg-white text-black shadow-sm" aria-label="Fechar"><X className="h-4 w-4"/></button>\n`, '', 'X workspace');
  write(file, src);
}

// 13) Acesso: botões redondos e modal auxiliar sem X; a planilha principal já é embedded.
{
  const file = 'src/components/AuthorizedStudentsPanel.tsx';
  let src = read(file);
  src = mustReplace(src,
`const whiteButton = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-white bg-white`,
`const whiteButton = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border border-white bg-white`, 'botões acesso redondos');
  src = src.replace(`  X,\n`, '');
  src = mustReplace(src,
`          <button type="button" onClick={onClose} className="rounded-md border border-white bg-white p-1 text-slate-900 hover:bg-slate-100" aria-label="Fechar"><X className="h-4 w-4" /></button>`,
`          <span className="text-[9px] font-semibold text-white/80">Clique fora ou pressione ESC para fechar</span>`, 'X modal acesso');
  src = mustReplace(src,
`function CompactModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {\n  if (typeof document === 'undefined') return null;`,
`function CompactModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {\n  useEffect(() => {\n    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };\n    window.addEventListener('keydown', onKeyDown);\n    return () => window.removeEventListener('keydown', onKeyDown);\n  }, [onClose]);\n  if (typeof document === 'undefined') return null;`, 'ESC modal acesso');
  write(file, src);
}

// 14) Área do Presidente: cor somente no Processo; Envio vira estado textual neutro e remove “Publicada”.
{
  const file = 'src/pages/CoordenadorPage.tsx';
  let src = read(file);
  src = mustReplace(src,
`                  <span className={\`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black uppercase \${signatureStatus.tone}\`}>\n                    {signatureStatus.label}\n                  </span>`,
`                  <span className="text-[9px] font-bold uppercase text-slate-800">{signatureStatus.label}</span>`, 'status envio pendente neutro');
  src = mustReplace(src,
`                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-full select-none leading-none">\n                    🟢 Enviada\n                  </span>\n                  <span className="text-[9.5px] text-emerald-800 font-bold flex items-center gap-0.5 select-none leading-none">\n                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> Publicada\n                  </span>`,
`                  <span className="text-[9px] font-bold uppercase text-slate-800">Assinatura concluída</span>`, 'envio concluído sem Publicada');
  write(file, src);
}

// 15) Rótulo global “Processo”.
{
  const files = [];
  const walk = (dir) => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full); } };
  walk('src');
  for (const file of files) {
    let src = read(file);
    const next = src.replaceAll('Nº do Processo', 'Processo').replaceAll('N° do Processo', 'Processo').replaceAll('Nº Processo', 'Processo');
    if (next !== src) write(file, next);
  }
}

// 16) Configurações: entradas diretas, sem navegação lateral interna.
{
  const file = 'src/pages/ConfiguracoesPage.tsx';
  let src = read(file);
  src = mustReplace(src,
`const [activeSettingsPanel, setActiveSettingsPanel] = useState<'sync' | 'access' | 'models' | 'signatures' | 'logs' | null>(null);`,
`const [activeSettingsPanel, setActiveSettingsPanel] = useState<'identity' | 'integrations' | 'access' | 'models-catalog' | 'documents' | 'emails' | 'forms' | 'workflow' | 'variables' | 'signatures' | 'logs' | null>(null);`, 'tipo painel direto');

  src = mustReplace(src,
`              { id: 'personalization', title: 'Personalização do Portal', text: 'Aparência, navegação, páginas, tabelas e pop-ups.', icon: Palette },\n              { id: 'sync', title: 'Sincronização', text: 'Rodapé, Asten, Google, Supabase, Vercel e demais integrações.', icon: Sliders },\n              { id: 'access', title: 'Acesso', text: 'Autorizações e pessoas com acesso ao Portal.', icon: Lock },\n              { id: 'models', title: 'Modelos e Variáveis', text: 'Documentos, e-mails, formulários, fluxos e variáveis.', icon: Layers },\n              { id: 'signatures', title: 'Registros de Assinatura', text: 'Fila, método, situação e histórico de assinatura.', icon: FileCheck2 },\n              { id: 'logs', title: 'Registro de Logs', text: 'Auditoria, histórico técnico e rastreabilidade.', icon: ClipboardList },`,
`              { id: 'personalization', title: 'Personalização do Portal', text: 'Aparência, navegação, páginas, tabelas e pop-ups.', icon: Palette },\n              { id: 'models-catalog', title: 'Modelos', text: 'Catálogo dos modelos documentais oficiais.', icon: FileText },\n              { id: 'documents', title: 'Documentos', text: 'Conteúdo, variáveis e pré-visualização dos documentos.', icon: FileText },\n              { id: 'emails', title: 'E-mails', text: 'Modelos, destinatários, variáveis e anexos.', icon: Mail },\n              { id: 'forms', title: 'Formulários', text: 'Campos, opções e regras dos formulários.', icon: ClipboardList },\n              { id: 'workflow', title: 'Fluxos', text: 'Etapas e ações do fluxo operacional.', icon: Layers },\n              { id: 'variables', title: 'Variáveis', text: 'Definições, usos, mescla e propagação.', icon: Sliders },\n              { id: 'identity', title: 'Rodapé e Identidade', text: 'Presidência, Secretaria e membros da Comissão.', icon: Building2 },\n              { id: 'integrations', title: 'Integrações e Plataformas', text: 'Asten, Google, Supabase, Vercel e reserva de espaço.', icon: Globe },\n              { id: 'access', title: 'Acesso', text: 'Autorizações e pessoas com acesso ao Portal.', icon: Lock },\n              { id: 'signatures', title: 'Registros de Assinatura', text: 'Rastreabilidade de documentos e assinaturas.', icon: FileCheck2 },\n              { id: 'logs', title: 'Registro de Logs', text: 'Auditoria, histórico técnico e rastreabilidade.', icon: ClipboardList },`, 'hub configurações direto');

  const start = src.indexOf('          {activeSettingsPanel && (');
  const end = src.indexOf('      {personalizationHubOpen && (', start);
  if (start < 0 || end < 0) throw new Error('1048: bloco do workspace de Configurações não encontrado');
  const studioProps = `actorEmail={userEmail || ''} initialStudio={settings?.integrationStudio} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification}`;
  const replacement = `          {activeSettingsPanel && (() => {\n            const panel = activeSettingsPanel;\n            const studio = (tab: 'documents' | 'emails' | 'forms' | 'workflow' | 'variables') => <IntegrationStudioPanel key={\`studio-\${tab}\`} initialTab={tab} hideTabs ${studioProps} />;\n            const definitions: Record<string, { title: string; icon: any; content: React.ReactNode }> = {\n              'identity': { title: 'Rodapé e Identidade', icon: Building2, content: <CommissionIdentityPanel isMaster /> },\n              'integrations': { title: 'Integrações e Plataformas', icon: Globe, content: <InfrastructureIntegrationsPanel isMaster /> },\n              'access': { title: 'Acesso', icon: Lock, content: <AuthorizedStudentsPanel canManage /> },\n              'models-catalog': { title: 'Modelos', icon: FileText, content: <MasterDocumentModelsPanel /> },\n              'documents': { title: 'Documentos', icon: FileText, content: studio('documents') },\n              'emails': { title: 'E-mails', icon: Mail, content: studio('emails') },\n              'forms': { title: 'Formulários', icon: ClipboardList, content: studio('forms') },\n              'workflow': { title: 'Fluxos', icon: Layers, content: studio('workflow') },\n              'variables': { title: 'Variáveis', icon: Sliders, content: studio('variables') },\n              'signatures': { title: 'Registros de Assinatura', icon: FileCheck2, content: <AstenLogsPage /> },\n              'logs': { title: 'Registro de Logs', icon: ClipboardList, content: <AuditLogsPage /> },\n            };\n            const definition = definitions[panel];\n            return <SettingsWorkspaceModal open title={definition.title} icon={definition.icon} onClose={() => setActiveSettingsPanel(null)} sections={[{ id: panel, label: definition.title, content: definition.content }]} />;\n          })()}\n\n`;
  src = src.slice(0, start) + replacement + src.slice(end);
  write(file, src);
}

// 17) Estúdio direto: o título do popup já identifica a área; manter apenas Publicar na barra interna.
{
  const file = 'src/components/IntegrationStudioPanel.tsx';
  let src = read(file);
  src = mustReplace(src,
`        <div><h3 className="text-xs font-black uppercase tracking-wide">Editor de modelos e variáveis</h3><p className="mt-0.5 text-[9px] text-white/80">Selecione uma área acima e trabalhe com seleção, edição e visualização no mesmo contexto.</p></div>`,
`        <div className="text-[9px] font-semibold text-white/80">{isDirty ? 'Alterações em rascunho' : 'Configuração publicada'}</div>`, 'título redundante estúdio');
  src = src.replace(`{isDirty ? (draftSavedAt ? \`Rascunho automático \${new Date(draftSavedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}\` : 'Salvando rascunho…') : (lastSavedAt ? \`Publicado \${new Date(lastSavedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}\` : 'Ainda não publicado')}`, `{isDirty ? 'Rascunho' : (lastSavedAt ? 'Publicado' : 'Ainda não publicado')}`);
  write(file, src);
}

// 18) Backend: acesso sem domínio institucional, múltiplos TCCs e e-mail de reserva realmente aplicado.
{
  const file = 'server.ts';
  let src = read(file);
  // lote: e-mail válido, sem restrição de domínio.
  src = replaceAll(src, /\|\|!emailMatchesDomains\(record\.email,profile\.studentEmailDomains\)/g, '', 'domínio lote');
  src = src.replaceAll('Nome, e-mail institucional ou domínio inválido', 'Nome ou e-mail inválido');
  // criação/edição: remove validação de domínio dos alunos.
  src = src.replace(/\s*if\(studentEmails\.some\(email=>!emailMatchesDomains\(email,installationProfile\.studentEmailDomains\)\)\)return res\.status\(400\)\.json\(\{error:'[^']*'\}\);/g, '');
  // limite de um TCC por aluno na criação/edição.
  src = src.replace(/\s*const existingTcc=processesStore\.find\([\s\S]*?return res\.status\(409\)\.json\(\{error:'Cada aluno pode autuar apenas um TCC\.'\}\);/g, '');
  src = src.replace(/\s*const conflict=processesStore\.find\([\s\S]*?return res\.status\(409\)\.json\(\{error:'Cada aluno pode participar como aluno de apenas um TCC\.'\}\);/g, '');
  src = src.replace(/\s*if\(processesStore\.some\(p=>\[p\.aluno1\.email,p\.aluno2\?\.email\]\.includes\(email\)\)\)return res\.status\(409\)\.json\(\{error:'Você já tem um TCC\. Continue pelo processo existente\.'\}\);/g, '');
  // reserva: uma só resolução por evento e assunto/corpo configuráveis no envio ao departamento.
  src = mustReplace(src,
`  const effectiveVariables={...(process.registrationAnswers||{}),...historicalStudioAnswers(process.id),...(extraVariables||{}),DEPARTAMENTO_EMAIL:operationalConfig(studio).reservation.departmentEmail,LOCAL_ALTERNATIVO:process.defesa.alternateLocation||''};`,
`  const reservation=operationalConfig(studio).reservation;\n  const effectiveVariables={...(process.registrationAnswers||{}),...historicalStudioAnswers(process.id),...(extraVariables||{}),DEPARTAMENTO_EMAIL:reservation.departmentEmail,DEPARTAMENTO_NOME:reservation.recipientName||'',LOCAL_ALTERNATIVO:process.defesa.alternateLocation||''};`, 'reserva runtime');
  src = mustReplace(src,
`sendEmail:async({template,to,subject,text,html,eventVariables,idempotencyKey})=>{const templateId=String(template.id||'');const attachments=await resolveWorkflowEmailAttachments(process,template);const records=[];for(const recipient of to){const accepted=emailDeliveriesStore.find(record=>record.processId===process.id&&record.templateId===templateId&&record.recipient===normalizeEmail(recipient)&&record.status==='ACCEPTED_BY_GMAIL');if(eventCode==='LOCATION_CONFIRMED'&&process.defesa.invitationSentAt&&accepted){records.push(accepted);continue;}records.push(await sendTrackedPortalEmail({process,recipient,subject,text,html,templateId,workflowEventCode:eventCode,workflowEventVariables:eventVariables,idempotencyKey:\`\${idempotencyKey}:\${recipient}\`,attachments}));}`,
`sendEmail:async({template,to,subject,text,html,variables,eventVariables,idempotencyKey})=>{const templateId=String(template.id||'');const attachments=await resolveWorkflowEmailAttachments(process,template);const records=[];for(const recipient of to){const accepted=emailDeliveriesStore.find(record=>record.processId===process.id&&record.templateId===templateId&&record.recipient===normalizeEmail(recipient)&&record.status==='ACCEPTED_BY_GMAIL');if(eventCode==='LOCATION_CONFIRMED'&&process.defesa.invitationSentAt&&accepted){records.push(accepted);continue;}const isReservationRequest=eventCode==='TCC_CREATED'&&normalizeEmail(recipient)===normalizeEmail(reservation.departmentEmail);const resolvedSubject=isReservationRequest?mergeWorkflowVariables(reservation.emailSubject||subject,variables):subject;const resolvedText=isReservationRequest?mergeWorkflowVariables(reservation.emailBody||text,variables):text;const resolvedHtml=isReservationRequest?undefined:html;records.push(await sendTrackedPortalEmail({process,recipient,subject:resolvedSubject,text:resolvedText,html:resolvedHtml,templateId,workflowEventCode:eventCode,workflowEventVariables:eventVariables,idempotencyKey:\`\${idempotencyKey}:\${recipient}\`,attachments}));}`, 'aplicar email reserva');
  write(file, src);
}

// 19) Contrato de release abrangendo as regressões centrais desta rodada.
write('server/release1048FinalizationContract.test.ts', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';\nconst source=(p:string)=>readFile(p,'utf8');\n\ntest('release 1.0.48 está versionada e não mantém limite/domain de aluno',async()=>{\n const [pkg,server]=await Promise.all([source('package.json'),source('server.ts')]);\n assert.equal(JSON.parse(pkg).version,'1.0.48');\n assert.doesNotMatch(server,/Cada aluno pode autuar apenas um TCC/);\n assert.doesNotMatch(server,/Você já tem um TCC/);\n assert.doesNotMatch(server,/studentEmails\\.some\\(email=>!emailMatchesDomains/);\n assert.match(server,/synchronizeProcessParticipants/);\n});\n\ntest('defesa usa a mesma semântica para calendário, lista e filtro neutro com bolinha',async()=>{\n const [home,formatter,css]=await Promise.all([source('src/pages/HomePage.tsx'),source('src/utils/tableFormatters.ts'),source('src/portal-update-23.css')]);\n assert.match(home,/getDefenseState\\(proc\\)/);\n assert.match(home,/getPortalToneCssVars\\(defenseState\\)/);\n assert.match(home,/portal-filter-dot[\\s\\S]*chip\\.dotColor/);\n assert.match(formatter,/backgroundColor: '#ffffff'/);\n assert.doesNotMatch(css,/background-color:\\s*#e5e9ed\\s*!important/);\n});\n\ntest('configurações abre áreas diretamente sem agrupadores sync e models',async()=>{\n const config=await source('src/pages/ConfiguracoesPage.tsx');\n for(const id of ['models-catalog','documents','emails','forms','workflow','variables','identity','integrations','access','signatures','logs']) assert.ok(config.includes(\`id: '\${id}'\`));\n assert.doesNotMatch(config,/id: 'sync', title: 'Sincronização'/);\n assert.doesNotMatch(config,/id: 'models', title: 'Modelos e Variáveis'/);\n});\n\ntest('assinatura não inventa signedAt e reserva usa configuração no runtime',async()=>{\n const [logs,server]=await Promise.all([source('src/pages/AstenLogsPage.tsx'),source('server.ts')]);\n assert.match(logs,/signedAt'\\) return dateTime\\(job\\.signedAt\\)/);\n assert.doesNotMatch(logs,/job\\.signedAt \\|\\| job\\.completedAt/);\n assert.match(server,/isReservationRequest=eventCode==='TCC_CREATED'/);\n assert.match(server,/reservation\\.emailSubject/);\n assert.match(server,/reservation\\.emailBody/);\n});\n\ntest('workspace fecha por clique externo e ESC sem X redundante',async()=>{\n const modal=await source('src/components/SettingsWorkspaceModal.tsx');\n assert.match(modal,/event\\.key === 'Escape'/);\n assert.doesNotMatch(modal,/<X className=/);\n});\n`);

console.log('Aplicação estrutural 1.0.48 concluída.');
