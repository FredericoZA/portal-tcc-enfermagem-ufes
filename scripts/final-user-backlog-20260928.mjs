import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);
const exact = (src, from, to, label) => {
  const count = src.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 exact match, found ${count}`);
  return src.replace(from, to);
};
const regex = (src, re, to, label, expected = 1) => {
  const matches = [...src.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`))];
  if (matches.length !== expected) throw new Error(`${label}: expected ${expected} regex match(es), found ${matches.length}`);
  return src.replace(re, to);
};

// 1) Filtros: uma única apresentação canônica — botão neutro, somente bolinha semântica.
{
  const p = 'src/utils/tableFormatters.ts';
  let s = read(p);
  s = regex(s,
    /  if \(semanticTone\) \{[\s\S]*?\n  \}\n\n  let buttonStyle: CSSProperties = \{\};[\s\S]*?\n  return \{\n    label,\n    emoji,\n    dotColor,\n    buttonStyle,\n    badgeStyle,\n    mode,\n    itemConfig,\n  \};/,
`  if (semanticTone) {
    const semanticStyle = getPortalToneStyle(semanticTone);
    return {
      label,
      emoji: '',
      dotColor: String(semanticStyle.borderColor || dotColor),
      buttonStyle: {
        backgroundColor: isSelected ? '#AEB0B3' : '#ffffff',
        color: isSelected ? '#111827' : '#1f2937',
        borderColor: isSelected ? '#979a9d' : '#cbd5e1',
        opacity: 1,
        boxShadow: 'none',
        transform: 'none',
      } as CSSProperties,
      badgeStyle: { backgroundColor: '#6b7280', color: '#ffffff' } as CSSProperties,
      mode: 'dot',
      itemConfig,
    };
  }

  return {
    label,
    emoji: '',
    dotColor,
    buttonStyle: {
      backgroundColor: isSelected ? '#AEB0B3' : '#ffffff',
      color: isSelected ? '#111827' : '#1f2937',
      borderColor: isSelected ? '#979a9d' : '#cbd5e1',
      opacity: 1,
      boxShadow: 'none',
      transform: 'none',
    } as CSSProperties,
    badgeStyle: { backgroundColor: '#6b7280', color: '#ffffff' } as CSSProperties,
    mode: 'dot',
    itemConfig,
  };`, 'canonical neutral filter chips');
  s = s.replaceAll("label: '📄 Nº Processo'", "label: 'Processo'");
  s = s.replaceAll("label: 'Nº Processo'", "label: 'Processo'");
  s = s.replaceAll("label: 'Número do Processo'", "label: 'Processo'");
  write(p, s);
}

// 2) Lista de Defesas: mostrar a bolinha do mesmo tom usado pelo calendário/processo.
{
  const p = 'src/pages/HomePage.tsx';
  let s = read(p);
  s = exact(s,
`                          {chip.emoji && <span>{chip.emoji}</span>}
                          <span>{chip.label}</span>`,
`                          <span className="portal-filter-dot h-[.65rem] w-[.65rem] shrink-0 rounded-full" style={{ backgroundColor: chip.dotColor }} aria-hidden="true" />
                          <span>{chip.label}</span>`,
  'defense filter dot');
  write(p, s);
}

// 3) Meus TCCs: retirar cor do botão/contador na fonte; somente dot identifica o vínculo.
{
  const p = 'src/pages/MeusProcessosPage.tsx';
  let s = read(p);
  s = exact(s,
"                      style={{ backgroundColor: cfg.bgColor, color: cfg.textHex, borderColor: cfg.borderColor, opacity: isSelected ? 1 : 0.62, boxShadow: isSelected ? `inset 0 0 0 1px ${cfg.borderColor}` : 'none' }}",
"                      style={{ backgroundColor: isSelected ? '#AEB0B3' : '#ffffff', color: isSelected ? '#111827' : '#1f2937', borderColor: isSelected ? '#979a9d' : '#cbd5e1', opacity: 1, boxShadow: 'none' }}",
  'my tcc role chip');
  s = exact(s,
"                        style={{ backgroundColor: cfg.borderColor, color: '#ffffff' }}",
"                        style={{ backgroundColor: '#6b7280', color: '#ffffff' }}",
  'my tcc neutral count');
  write(p, s);
}

// 4) Presidência: filtro neutro + bolinha e coluna Envio sem segunda pílula colorida.
{
  const p = 'src/pages/CoordenadorPage.tsx';
  let s = read(p);
  s = exact(s,
"                        style={{ backgroundColor: semanticTone.bg, color: semanticTone.text, borderColor: semanticTone.border, opacity: isSelected ? 1 : 0.62, boxShadow: isSelected ? `inset 0 0 0 1px ${semanticTone.border}` : 'none' }}",
"                        style={chip.buttonStyle}",
  'president filter button');
  s = exact(s,
"                        <span className=\"portal-filter-dot w-2 h-2 rounded-full shrink-0 shadow-2xs\" style={{ backgroundColor: semanticTone.border }} />",
"                        <span className=\"portal-filter-dot w-2 h-2 rounded-full shrink-0 shadow-2xs\" style={{ backgroundColor: chip.dotColor || semanticTone.border }} />",
  'president filter dot');
  s = exact(s,
`                  <span className={\`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black uppercase \${signatureStatus.tone}\`}>
                    {signatureStatus.label}
                  </span>`,
`                  <span className="text-[10px] font-semibold text-slate-700">
                    {signatureStatus.label}
                  </span>`,
  'president pending envio neutral');
  s = exact(s,
`                <>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-full select-none leading-none">
                    🟢 Enviada
                  </span>
                  <span className="text-[9.5px] text-emerald-800 font-bold flex items-center gap-0.5 select-none leading-none">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> Publicada
                  </span>
                </>`,
`                <span className="text-[10px] font-semibold text-slate-700">Assinada</span>`,
  'president completed envio neutral');
  write(p, s);
}

// 5) CSS legado não pode voltar a pintar o chip inteiro.
{
  const p = 'src/portal-version-1046.css';
  let s = read(p);
  if (!s.includes('/* 1.0.48 filtro canônico: botão neutro + bolinha semântica */')) {
    s += `\n\n/* 1.0.48 filtro canônico: botão neutro + bolinha semântica */\n.portal-table-filter-chip {\n  background: #ffffff !important;\n  border-color: #cbd5e1 !important;\n  color: #1f2937 !important;\n  opacity: 1 !important;\n  box-shadow: none !important;\n  transform: none !important;\n}\n.portal-table-filter-chip[aria-pressed=\"true\"],\n.portal-table-filter-chip[data-selected=\"true\"] {\n  background: #AEB0B3 !important;\n  border-color: #979a9d !important;\n  color: #111827 !important;\n}\n`;
  }
  write(p, s);
}

// 6) Popup de Configurações: sem botão X; fecha por clique externo/ESC.
{
  const p = 'src/components/SettingsWorkspaceModal.tsx';
  let s = read(p);
  s = exact(s, "import { X } from 'lucide-react';\n", '', 'settings modal x import');
  s = exact(s,
`          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white bg-white text-black shadow-sm" aria-label="Fechar"><X className="h-4 w-4"/></button>\n`,
'', 'settings modal x button');
  write(p, s);
}

// 7) Sincronização: remover área redundante de troca administrativa, preservando gestão de identidade.
{
  const p = 'src/components/CommissionIdentityPanel.tsx';
  let s = read(p);
  s = exact(s, "import { portalConfirm } from '../services/portalDialogs';\n", '', 'remove transfer confirm import');
  s = exact(s, '  const { settings, refreshAuth, isCommissionPresident } = useAuth();', '  const { settings, refreshAuth } = useAuth();', 'remove president transfer auth flag');
  s = exact(s, "  const [presidentTransferEmail, setPresidentTransferEmail] = useState('');\n  const [masterTransferEmail, setMasterTransferEmail] = useState('');\n", '', 'remove transfer state');
  s = exact(s, "  const [transferring, setTransferring] = useState('');\n", '', 'remove transferring state');
  s = regex(s, /\n  const startTransfer = async \(role: 'MASTER_ADMIN' \| 'COMMISSION_PRESIDENT', targetEmail: string\) => \{[\s\S]*?\n  \};\n/, '\n', 'remove transfer function');
  s = regex(s, /\n      <details className="portal-president-master-transfer[\s\S]*?<\/details>\n/, '\n', 'remove transfer ui');
  write(p, s);
}

// 8) Configurações: cada linha abre seu próprio workspace; sem navegação lateral interna.
{
  const p = 'src/pages/ConfiguracoesPage.tsx';
  let s = read(p);
  s = exact(s,
"  const [activeSettingsPanel, setActiveSettingsPanel] = useState<'sync' | 'access' | 'models' | 'signatures' | 'logs' | null>(null);",
"  const [activeSettingsPanel, setActiveSettingsPanel] = useState<'identity' | 'integrations' | 'access' | 'models-catalog' | 'documents' | 'emails' | 'forms' | 'workflow' | 'variables' | 'signatures' | 'logs' | null>(null);",
  'direct settings state');
  const oldHub = `              { id: 'personalization', title: 'Personalização do Portal', text: 'Aparência, navegação, páginas, tabelas e pop-ups.', icon: Palette },
              { id: 'sync', title: 'Sincronização', text: 'Rodapé, Asten, Google, Supabase, Vercel e demais integrações.', icon: Sliders },
              { id: 'access', title: 'Acesso', text: 'Autorizações e pessoas com acesso ao Portal.', icon: Lock },
              { id: 'models', title: 'Modelos e Variáveis', text: 'Documentos, e-mails, formulários, fluxos e variáveis.', icon: Layers },
              { id: 'signatures', title: 'Registros de Assinatura', text: 'Fila, método, situação e histórico de assinatura.', icon: FileCheck2 },
              { id: 'logs', title: 'Registro de Logs', text: 'Auditoria, histórico técnico e rastreabilidade.', icon: ClipboardList },`;
  const newHub = `              { id: 'personalization', title: 'Personalização do Portal', text: 'Aparência, navegação, páginas, tabelas e pop-ups.', icon: Palette },
              { id: 'models-catalog', title: 'Modelos', text: 'Catálogo de modelos documentais.', icon: FileText },
              { id: 'documents', title: 'Documentos', text: 'Seleção, variáveis e pré-visualização.', icon: FileText },
              { id: 'emails', title: 'E-mails', text: 'Modelos, variáveis, anexos e pré-visualização.', icon: Mail },
              { id: 'forms', title: 'Formulários', text: 'Campos, regras, variáveis e prévia.', icon: ClipboardList },
              { id: 'workflow', title: 'Fluxos', text: 'Etapas e ações do fluxo operacional.', icon: Layers },
              { id: 'variables', title: 'Variáveis', text: 'Definições canônicas, usos e propagação.', icon: Sliders },
              { id: 'identity', title: 'Rodapé e Identidade', text: 'Presidência, Secretaria, Comissão e contatos.', icon: Building2 },
              { id: 'integrations', title: 'Integrações e Plataformas', text: 'Asten, Google, Supabase, Vercel e serviços externos.', icon: Globe },
              { id: 'access', title: 'Acesso', text: 'Autorizações e pessoas com acesso ao Portal.', icon: Lock },
              { id: 'signatures', title: 'Registros de Assinatura', text: 'Fila, método, situação e histórico de assinatura.', icon: FileCheck2 },
              { id: 'logs', title: 'Registro de Logs', text: 'Auditoria, histórico técnico e rastreabilidade.', icon: ClipboardList },`;
  s = exact(s, oldHub, newHub, 'direct settings hub rows');
  s = exact(s,
"              title={activeSettingsPanel === 'sync' ? 'Sincronização' : activeSettingsPanel === 'access' ? 'Acesso' : activeSettingsPanel === 'models' ? 'Modelos e Variáveis' : activeSettingsPanel === 'signatures' ? 'Registros de Assinatura' : 'Registro de Logs'}",
"              title={({ identity: 'Rodapé e Identidade', integrations: 'Integrações e Plataformas', access: 'Acesso', 'models-catalog': 'Modelos', documents: 'Documentos', emails: 'E-mails', forms: 'Formulários', workflow: 'Fluxos', variables: 'Variáveis', signatures: 'Registros de Assinatura', logs: 'Registro de Logs' } as Record<string, string>)[activeSettingsPanel] || 'Configurações'}",
  'direct settings title');
  s = exact(s,
"              icon={activeSettingsPanel === 'sync' ? Sliders : activeSettingsPanel === 'access' ? Lock : activeSettingsPanel === 'models' ? Layers : activeSettingsPanel === 'signatures' ? FileCheck2 : ClipboardList}",
"              icon={({ identity: Building2, integrations: Globe, access: Lock, 'models-catalog': FileText, documents: FileText, emails: Mail, forms: ClipboardList, workflow: Layers, variables: Sliders, signatures: FileCheck2, logs: ClipboardList } as Record<string, React.ComponentType<{ className?: string }>>)[activeSettingsPanel]}",
  'direct settings icon');

  const start = s.indexOf("                activeSettingsPanel === 'sync' ? [");
  const endMarker = "                ]\n              }";
  const end = s.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('direct settings sections: boundaries not found');
  const studioCommon = `actorEmail={userEmail || ''} initialStudio={settings?.integrationStudio} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification}`;
  const sectionExpr = `                activeSettingsPanel === 'identity' ? [
                  { id: 'identity', label: 'Rodapé e identidade', icon: Building2, content: settings ? <><MasterAndPresidentConfigForm settings={settings} onSettingsUpdated={() => { void refreshAuth(); }} showNotification={showNotification} /><CommissionIdentityPanel isMaster /></> : null },
                ] : activeSettingsPanel === 'integrations' ? [
                  { id: 'integrations', label: 'Integrações e plataformas', icon: Globe, content: <InfrastructureIntegrationsPanel isMaster /> },
                ] : activeSettingsPanel === 'access' ? [
                  { id: 'authorizations', label: 'Autorizações de acesso', icon: Lock, content: <AuthorizedStudentsPanel canManage /> },
                ] : activeSettingsPanel === 'models-catalog' ? [
                  { id: 'models-catalog', label: 'Modelos', icon: FileText, content: <MasterDocumentModelsPanel /> },
                ] : activeSettingsPanel === 'documents' ? [
                  { id: 'documents', label: 'Documentos', icon: FileText, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-documents" initialTab="documents" hideTabs ${studioCommon} /></div> },
                ] : activeSettingsPanel === 'emails' ? [
                  { id: 'emails', label: 'E-mails', icon: Mail, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-emails" initialTab="emails" hideTabs ${studioCommon} /></div> },
                ] : activeSettingsPanel === 'forms' ? [
                  { id: 'forms', label: 'Formulários', icon: ClipboardList, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-forms" initialTab="forms" hideTabs ${studioCommon} /></div> },
                ] : activeSettingsPanel === 'workflow' ? [
                  { id: 'workflow', label: 'Fluxos', icon: Layers, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-workflow" initialTab="workflow" hideTabs ${studioCommon} /></div> },
                ] : activeSettingsPanel === 'variables' ? [
                  { id: 'variables', label: 'Variáveis', icon: Sliders, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-variables" initialTab="variables" hideTabs ${studioCommon} /></div> },
                ] : activeSettingsPanel === 'signatures' ? [
                  { id: 'signature-ledger', label: 'Registros de assinatura', icon: FileCheck2, content: <AstenLogsPage /> },
                ] : [
                  { id: 'audit-ledger', label: 'Registro de logs', icon: ClipboardList, content: <AuditLogsPage /> },
                ]`;
  s = s.slice(0, start) + sectionExpr + s.slice(end + endMarker.length - 1);
  write(p, s);
}

// 9) Acesso: e-mail comum é válido; remover limite de um TCC por aluno no backend.
{
  const p = 'server.ts';
  let s = read(p);
  s = exact(s,
"    const profile=resolveInstallationProfile(currentSettings);const invalid=normalized.filter(record=>!record.nome||!isValidPortalEmail(record.email)||!emailMatchesDomains(record.email,profile.studentEmailDomains)||duplicateEmails.has(record.email));\n    if(invalid.length)return res.status(400).json({error:'O lote contém linhas inválidas ou duplicadas.',invalidRows:invalid.map(record=>({row:record.row,email:record.email,reason:duplicateEmails.has(record.email)?'E-mail duplicado no arquivo':'Nome, e-mail institucional ou domínio inválido'}))});",
"    const invalid=normalized.filter(record=>!record.nome||!isValidPortalEmail(record.email)||duplicateEmails.has(record.email));\n    if(invalid.length)return res.status(400).json({error:'O lote contém linhas inválidas ou duplicadas.',invalidRows:invalid.map(record=>({row:record.row,email:record.email,reason:duplicateEmails.has(record.email)?'E-mail duplicado no arquivo':'Nome ou e-mail inválido'}))});",
  'bulk access domain restriction');
  s = regex(s,
/    const studentEmails=\[aluno1Email,aluno2\?\.email\?normalizeEmail\(aluno2\.email\):''\]\.filter\(Boolean\);const installationProfile=resolveInstallationProfile\(currentSettings\);\n    if\(studentEmails\.some\(email=>!emailMatchesDomains\(email,installationProfile\.studentEmailDomains\)\)\)return res\.status\(400\)\.json\(\{error:`Os alunos autores devem usar um dos domínios institucionais configurados: \$\{installationProfile\.studentEmailDomains\.join\(', '\)\}\.`\}\);\n    const existingTcc=processesStore\.find\(process=>studentEmails\.some\(email=>\[process\.aluno1\.email,process\.aluno2\?\.email\]\.filter\(Boolean\)\.map\(normalizeEmail\)\.includes\(email\)\)\);\n    if \(existingTcc\) \{\n      return res\.status\(409\)\.json\(\{\n        error: `Cada aluno pode autuar apenas um TCC\. Já existe o processo \$\{existingTcc\.protocolo\}\.`\n      \}\);\n    \}\n/,
"    const studentEmails=[aluno1Email,aluno2?.email?normalizeEmail(aluno2.email):''].filter(Boolean);\n    if(studentEmails.some(email=>!isValidPortalEmail(email)))return res.status(400).json({error:'Informe e-mails válidos para os alunos autores.'});\n",
  'create tcc domain and uniqueness', 1);
  s = regex(s,
/\n    const requestedStudentEmails = \[req\.body\?\.aluno1\?\.email, req\.body\?\.aluno2\?\.email\][\s\S]*?code: 'STUDENT_TCC_ALREADY_EXISTS'\n      \}\);\n    \}\n/,
'\n', 'duplicate student tcc guard', 1);
  // Edit guards: remove any student-domain check and cross-process author conflict without touching master-transfer security.
  s = s.replace(/\n\s*const installationProfile=resolveInstallationProfile\(currentSettings\);\n\s*if\(studentEmails\.some\(email=>!emailMatchesDomains\(email,installationProfile\.studentEmailDomains\)\)\)[^\n]*\n/g, '\n');
  s = s.replace(/\n\s*const conflict=processesStore\.find\([\s\S]*?\n\s*if\(conflict\)[^\n]*\n/g, '\n');
  write(p, s);
}

// 10) Versão final consistente.
{
  const p = 'package.json';
  const pkg = JSON.parse(read(p));
  pkg.version = '1.0.48';
  write(p, `${JSON.stringify(pkg, null, 2)}\n`);
  const lockPath = 'package-lock.json';
  const lock = JSON.parse(read(lockPath));
  lock.version = '1.0.48';
  if (lock.packages?.['']) lock.packages[''].version = '1.0.48';
  write(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
}

console.log('Final user backlog migration applied successfully.');
