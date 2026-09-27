import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, value) { fs.writeFileSync(path, value); }
function replaceRequired(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) throw new Error(`${label}: trecho não encontrado`);
  return source.replace(oldText, newText);
}
function replaceRegexRequired(source, regex, replacement, label) {
  if (!regex.test(source)) throw new Error(`${label}: padrão não encontrado`);
  return source.replace(regex, replacement);
}

// 1) Calendário: resumo em duas linhas e filtro com indicador canônico.
{
  const path = 'src/pages/HomePage.tsx';
  let source = read(path);
  source = replaceRequired(
    source,
    "import { DefenseFilter, DefenseState, formatDefenseCalendarSummary, getDefenseState, getDefenseStateFromTimes, matchesDefenseFilter } from '../utils/defenseSemantics';",
    "import { DefenseFilter, DefenseState, formatDefenseCalendarSummary, getDefenseCalendarSummaryParts, getDefenseState, getDefenseStateFromTimes, matchesDefenseFilter } from '../utils/defenseSemantics';",
    'import do resumo canônico',
  );

  source = replaceRegexRequired(
    source,
    /\{dayDefenses\.map\(\(proc\) => \{\s*const defenseState = getDefenseState\(proc\);\s*return \(\s*<span\s*key=\{proc\.id\}\s*className="portal-calendar-defense-summary portal-semantic-tone"\s*style=\{getPortalToneCssVars\(defenseState\)\}\s*data-defense-state=\{defenseState\}\s*title=\{formatDefenseCalendarSummary\(proc, 160\)\}\s*>\s*\{formatDefenseCalendarSummary\(proc\)\}\s*<\/span>\s*\);\s*\}\)\}/m,
    `{dayDefenses.map((proc) => {\n                          const defenseState = getDefenseState(proc);\n                          const eventSummary = getDefenseCalendarSummaryParts(proc);\n                          return (\n                            <span\n                              key={proc.id}\n                              className="portal-calendar-defense-summary portal-semantic-tone"\n                              style={getPortalToneCssVars(defenseState)}\n                              data-defense-state={defenseState}\n                              title={eventSummary.tooltip}\n                            >\n                              <span className="portal-calendar-defense-headline">{eventSummary.headline}</span>\n                              {eventSummary.students && <span className="portal-calendar-defense-students">{eventSummary.students}</span>}\n                            </span>\n                          );\n                        })}`,
    'resumo visual de ProcessData',
  );

  source = replaceRequired(
    source,
    "                          const summary = [startLabel, parsed.trabalho, parsed.aluno, parsed.local].filter(Boolean).join(' · ');",
    "                          const headline = [startLabel, parsed.trabalho].filter(Boolean).join(' · ');\n                          const students = parsed.aluno || '';\n                          const summary = [headline, students, parsed.local].filter(Boolean).join(' · ');",
    'resumo externo em duas linhas',
  );
  source = replaceRequired(
    source,
    "                              {summary}\n                            </span>",
    "                              <span className=\"portal-calendar-defense-headline\">{headline}</span>\n                              {students && <span className=\"portal-calendar-defense-students\">{students}</span>}\n                            </span>",
    'render externo em duas linhas',
  );

  source = replaceRequired(
    source,
    "                          {chip.emoji && <span>{chip.emoji}</span>}\n                          <span>{chip.label}</span>",
    "                          <span className=\"portal-filter-color-dot rounded-full shrink-0\" style={{ backgroundColor: chip.dotColor }} aria-hidden=\"true\" />\n                          {chip.emoji && <span>{chip.emoji}</span>}\n                          <span>{chip.label}</span>",
    'bolinha semântica da lista de defesas',
  );
  write(path, source);
}

// 2) Meus TCCs: aumenta só o indicador de cor; processo continua consumindo os mesmos tokens.
{
  const path = 'src/pages/MeusProcessosPage.tsx';
  let source = read(path);
  source = replaceRequired(
    source,
    'className="w-2 h-2 rounded-full shrink-0 shadow-2xs"',
    'className="portal-filter-color-dot rounded-full shrink-0 shadow-2xs"',
    'indicador de cor dos papéis',
  );
  write(path, source);
}

// 3) Hub de Configurações: remove cores locais concorrentes e usa a barra canônica.
{
  const path = 'src/pages/ConfiguracoesPage.tsx';
  let source = read(path);
  source = replaceRequired(
    source,
    'className="portal-settings-title-bar flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-[#d5dce0] px-3.5 py-3 text-left shadow-sm"',
    'className="portal-settings-title-bar flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left shadow-sm"',
    'barra canônica do hub',
  );
  source = replaceRequired(source, 'className="h-5 w-5 shrink-0 text-[#337959]"', 'className="h-5 w-5 shrink-0 text-white"', 'ícone branco do hub');
  source = replaceRequired(source, 'className="block text-xs font-black uppercase tracking-wide text-black"', 'className="block text-xs font-black uppercase tracking-wide text-white"', 'título branco do hub');
  source = replaceRequired(source, 'className="mt-0.5 block text-[10px] text-slate-600"', 'className="portal-settings-description mt-0.5 block text-[10px] text-white/85"', 'descrição branca do hub');
  source = replaceRequired(source, 'className="h-4 w-4 shrink-0 text-slate-600"', 'className="h-4 w-4 shrink-0 text-white/85"', 'chevron branco do hub');

  // Modelos e Variáveis passa a usar a sidebar externa real, sem uma segunda navegação concorrente.
  const studioProps = `<IntegrationStudioPanel actorEmail={userEmail || ''} initialStudio={settings?.integrationStudio} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification}`;
  const modelsReplacement = `activeSettingsPanel === 'models' ? [\n                  { id: 'models', label: 'Modelos', description: 'Catálogo e inclusão de modelos documentais.', icon: Layers, content: <div id="portal-models-workspace"><MasterDocumentModelsPanel /></div> },\n                  { id: 'documents', label: 'Documentos', description: 'Modelos, variáveis e prévia do documento final.', icon: FileText, content: <div id="portal-models-workspace">${studioProps} activeTabOverride="documents" hideTabNavigation /></div> },\n                  { id: 'emails', label: 'E-mails', description: 'Modelos de mensagem e pré-visualização.', icon: Mail, content: <div id="portal-models-workspace">${studioProps} activeTabOverride="emails" hideTabNavigation /></div> },\n                  { id: 'forms', label: 'Formulários', description: 'Campos, regras e prévia do formulário.', icon: ClipboardList, content: <div id="portal-models-workspace">${studioProps} activeTabOverride="forms" hideTabNavigation /></div> },\n                  { id: 'workflow', label: 'Fluxo', description: 'Etapas e ações do processo.', icon: ArrowRight, content: <div id="portal-models-workspace">${studioProps} activeTabOverride="workflow" hideTabNavigation /></div> },\n                  { id: 'variables', label: 'Variáveis', description: 'Definições, usos, formatação e saneamento.', icon: Type, content: <div id="portal-models-workspace">${studioProps} activeTabOverride="variables" hideTabNavigation /></div> },\n                ] : activeSettingsPanel === 'signatures' ? [`;
  source = replaceRegexRequired(
    source,
    /activeSettingsPanel === 'models' \? \[[\s\S]*?\] : activeSettingsPanel === 'signatures' \? \[/,
    modelsReplacement,
    'sidebar externa de modelos e variáveis',
  );
  write(path, source);
}

// 4) Estúdio: navegação controlável externamente e formulários progressivos.
{
  const path = 'src/components/IntegrationStudioPanel.tsx';
  let source = read(path);
  source = replaceRequired(
    source,
    "  notify: (message: string) => void;\n}",
    "  notify: (message: string) => void;\n  activeTabOverride?: 'documents' | 'emails' | 'forms' | 'workflow' | 'variables';\n  hideTabNavigation?: boolean;\n}",
    'props de navegação externa',
  );
  source = replaceRequired(
    source,
    '    onConnectDrive, onScanDrive, isScanningDrive, notify\n  } = props;',
    '    onConnectDrive, onScanDrive, isScanningDrive, notify, activeTabOverride, hideTabNavigation\n  } = props;',
    'desestruturação de navegação externa',
  );
  source = replaceRequired(
    source,
    "  const [activeTab, setActiveTab] = useState<StudioTab>('documents');",
    "  const [internalActiveTab, setActiveTab] = useState<StudioTab>('documents');\n  const activeTab: StudioTab = activeTabOverride || internalActiveTab;",
    'tab controlada externamente',
  );
  source = replaceRequired(
    source,
    '        <nav className="portal-studio-tabs flex flex-wrap items-center gap-1.5 border-b border-slate-300 p-2.5" style={{ backgroundColor: \'var(--portal-surface-layer-2)\' }} aria-label="Áreas de modelos e variáveis">',
    '        {!hideTabNavigation && <nav className="portal-studio-tabs flex flex-wrap items-center gap-1.5 border-b border-slate-300 p-2.5" style={{ backgroundColor: \'var(--portal-surface-layer-2)\' }} aria-label="Áreas de modelos e variáveis">',
    'oculta navegação interna quando externa',
  );
  source = replaceRequired(
    source,
    '        </nav>\n        <div className="min-w-0 p-3 sm:p-4"',
    '        </nav>}\n        <div className="min-w-0 p-3 sm:p-4"',
    'fecha navegação condicional',
  );

  // Estado de seleção progressiva para campos e etapas.
  source = replaceRequired(
    source,
    "  const [selectedVariableId, setSelectedVariableId] = useState(matrixColumns[0]?.id || '');",
    "  const [selectedVariableId, setSelectedVariableId] = useState(matrixColumns[0]?.id || '');\n  const [selectedQuestionId, setSelectedQuestionId] = useState('');\n  const [expandedWorkflowStageId, setExpandedWorkflowStageId] = useState('');",
    'estado progressivo de formulário/fluxo',
  );

  const oldQuestions = `{selectedForm.questions.map((question, index) => <div key={question.id} className="space-y-1"><div className="flex justify-end gap-1"><button type="button" className="portal-action" disabled={index===0} onClick={()=>moveSelectedFormQuestion(index,-1)} aria-label={\`Mover \${question.label} para cima\`}>↑</button><button type="button" className="portal-action" disabled={index===selectedForm.questions.length-1} onClick={()=>moveSelectedFormQuestion(index,1)} aria-label={\`Mover \${question.label} para baixo\`}>↓</button></div><FormQuestionEditor question={question} index={index} variables={matrixColumns} previousQuestions={selectedForm.questions.slice(0, index)} onChange={(updates) => updateSelectedForm({ questions: selectedForm.questions.map((item) => item.id === question.id ? { ...item, ...updates } : item) })} onDelete={() => updateSelectedForm({ questions: selectedForm.questions.filter((item) => item.id !== question.id) })}/></div>) }`;
  const newQuestions = `{selectedForm.questions.map((question, index) => { const selected = (selectedQuestionId || selectedForm.questions[0]?.id) === question.id; return <div key={question.id} className="space-y-1"><button type="button" onClick={() => setSelectedQuestionId(question.id)} className={\`portal-form-field-list flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left \${selected ? 'portal-selected-editor-item' : 'bg-white'}\`}><span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-slate-600">{index + 1}</span><span className="min-w-0 flex-1 truncate text-[10px] font-black text-slate-900">{question.label}</span><code className="hidden text-[9px] text-slate-500 sm:block">{question.fieldKey || 'sem variável'}</code><span className="text-[9px] font-bold text-slate-500">{question.fieldType}</span></button>{selected && <div className="space-y-1 rounded-xl border border-slate-300 bg-white p-2"><div className="flex justify-end gap-1"><button type="button" className="portal-action" disabled={index===0} onClick={()=>moveSelectedFormQuestion(index,-1)} aria-label={\`Mover \${question.label} para cima\`}>↑</button><button type="button" className="portal-action" disabled={index===selectedForm.questions.length-1} onClick={()=>moveSelectedFormQuestion(index,1)} aria-label={\`Mover \${question.label} para baixo\`}>↓</button></div><FormQuestionEditor question={question} index={index} variables={matrixColumns} previousQuestions={selectedForm.questions.slice(0, index)} onChange={(updates) => updateSelectedForm({ questions: selectedForm.questions.map((item) => item.id === question.id ? { ...item, ...updates } : item) })} onDelete={() => updateSelectedForm({ questions: selectedForm.questions.filter((item) => item.id !== question.id) })}/></div>}</div>; }) }`;
  source = replaceRequired(source, oldQuestions, newQuestions, 'editor progressivo de campos');
  source = replaceRequired(
    source,
    '<div className="rounded-2xl border border-slate-300 bg-slate-200/70 p-4"><div className="mx-auto max-w-xl overflow-hidden rounded-2xl bg-white shadow-lg"',
    '<div className="sticky top-3 self-start rounded-2xl border border-slate-300 bg-slate-200/70 p-4"><div className="mx-auto max-h-[78vh] max-w-xl overflow-y-auto overflow-x-hidden rounded-2xl bg-white shadow-lg"',
    'prévia sticky do formulário',
  );

  // Variáveis: remove sugestões permanentes e troca roxo por verde institucional nas áreas principais.
  source = source.replace(/\{similarVariableSuggestions\.length > 0 && <div className=\{`\$\{panelClass\} p-4`\}>[\s\S]*?<\/div>\}\n            <div className="grid gap-4 xl:grid-cols-\[\.75fr_1\.25fr\]">/, '<div className="grid gap-4 xl:grid-cols-[.75fr_1.25fr]">');
  source = source
    .replaceAll('border-violet-700 bg-violet-700 text-white hover:bg-violet-800', 'border-[#286a4d] bg-[#337959] text-white hover:brightness-95')
    .replaceAll('border-violet-300 bg-violet-50 text-violet-800', 'border-slate-300 bg-white text-slate-800')
    .replaceAll('text-violet-700', 'text-[#337959]')
    .replaceAll('border-violet-500 bg-violet-50 shadow-sm', 'portal-selected-editor-item shadow-sm')
    .replaceAll('text-violet-950', 'text-slate-950')
    .replaceAll('text-violet-800', 'text-slate-700')
    .replaceAll('border-violet-200 bg-violet-50', 'border-slate-300 bg-[#f1f5f9]');

  write(path, source);
}

console.log('v1049 structural UI migration applied');
