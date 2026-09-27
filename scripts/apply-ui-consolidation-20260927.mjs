import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);
const assertReplace = (source, needle, replacement, label) => {
  if (!source.includes(needle)) throw new Error(`Padrão não encontrado: ${label}`);
  return source.replace(needle, replacement);
};

// 1) Calendário: resumo em duas linhas, sem alterar datas/dados.
{
  const file = 'src/pages/HomePage.tsx';
  let s = read(file);
  s = s.replace(
    "import { DefenseFilter, DefenseState, formatDefenseCalendarSummary, getDefenseState, getDefenseStateFromTimes, matchesDefenseFilter } from '../utils/defenseSemantics';",
    "import { DefenseFilter, DefenseState, formatDefenseCalendarSummary, getDefenseCalendarSummaryParts, getDefenseState, getDefenseStateFromTimes, matchesDefenseFilter } from '../utils/defenseSemantics';"
  );
  s = s.replace(
    '{formatDefenseCalendarSummary(proc)}',
    '{(() => { const summary = getDefenseCalendarSummaryParts(proc); return <><span className="portal-calendar-defense-primary">{summary.primary}</span>{summary.secondary && <span className="portal-calendar-defense-secondary">{summary.secondary}</span>}</>; })()}'
  );
  s = s.replace(
    "const summary = [startLabel, parsed.trabalho, parsed.aluno, parsed.local].filter(Boolean).join(' · ');",
    "const primary = [startLabel, parsed.trabalho].filter(Boolean).join(' · ');\n                          const secondary = parsed.aluno || '';\n                          const summary = [primary, secondary, parsed.local].filter(Boolean).join('\\n');"
  );
  s = s.replace(
    /title=\{summary\}\n\s*>\n\s*\{summary\}\n\s*<\/span>/,
    'title={summary}\n                            >\n                              <span className="portal-calendar-defense-primary">{primary}</span>\n                              {secondary && <span className="portal-calendar-defense-secondary">{secondary}</span>}\n                            </span>'
  );
  write(file, s);
}

// 2) Filtros: aumenta apenas o ponto cromático ~30%, sem alterar o chip.
for (const dir of ['src/pages', 'src/components']) {
  for (const name of fs.readdirSync(path.join(root, dir))) {
    if (!name.endsWith('.tsx')) continue;
    const file = path.join(dir, name);
    let s = read(file);
    const before = s;
    s = s
      .replaceAll('className="w-1.5 h-1.5 rounded-full', 'className="portal-filter-dot w-1.5 h-1.5 rounded-full')
      .replaceAll('className="h-1.5 w-1.5 rounded-full', 'className="portal-filter-dot h-1.5 w-1.5 rounded-full')
      .replaceAll('className="w-2 h-2 rounded-full', 'className="portal-filter-dot w-2 h-2 rounded-full')
      .replaceAll('className="h-2 w-2 rounded-full', 'className="portal-filter-dot h-2 w-2 rounded-full');
    if (s !== before) write(file, s);
  }
}

// 3) Estúdio: o navegador externo controla a área; o navegador interno pode ser ocultado.
{
  const file = 'src/components/IntegrationStudioPanel.tsx';
  let s = read(file);
  s = assertReplace(s,
`  notify: (message: string) => void;
}`,
`  notify: (message: string) => void;
  initialTab?: 'documents' | 'emails' | 'forms' | 'workflow' | 'variables';
  hideTabs?: boolean;
}`,
    'props IntegrationStudioPanel');
  s = assertReplace(s,
`    onConnectDrive, onScanDrive, isScanningDrive, notify
  } = props;`,
`    onConnectDrive, onScanDrive, isScanningDrive, notify, initialTab, hideTabs = false
  } = props;`,
    'desestruturação IntegrationStudioPanel');
  s = assertReplace(s,
`  const [activeTab, setActiveTab] = useState<StudioTab>('documents');`,
`  const [activeTab, setActiveTab] = useState<StudioTab>(initialTab || 'documents');`,
    'activeTab inicial');
  s = assertReplace(s,
`  const selectedDoc = docTemplates.find((item) => item.id === selectedDocId) || docTemplates[0];`,
`  useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);

  const selectedDoc = docTemplates.find((item) => item.id === selectedDocId) || docTemplates[0];`,
    'sincronização de tab');
  s = assertReplace(s,
`        <nav className="portal-studio-tabs flex flex-wrap items-center gap-1.5 border-b border-slate-300 p-2.5" style={{ backgroundColor: 'var(--portal-surface-layer-2)' }} aria-label="Áreas de modelos e variáveis">`,
`        <nav className={\`${'${'}hideTabs ? 'hidden' : 'portal-studio-tabs flex flex-wrap items-center gap-1.5 border-b border-slate-300 p-2.5'\}\`} style={{ backgroundColor: 'var(--portal-surface-layer-2)' }} aria-label="Áreas de modelos e variáveis">`,
    'ocultar navegação interna');
  s = s.replace('similarVariableSuggestions.length > 0 &&', 'false && similarVariableSuggestions.length > 0 &&');

  // Formulários: lista compacta; um editor por vez; prévia continua visível.
  s = assertReplace(s,
`  const [selectedVariableId, setSelectedVariableId] = useState(matrixColumns[0]?.id || '');`,
`  const [selectedVariableId, setSelectedVariableId] = useState(matrixColumns[0]?.id || '');
  const [selectedFormQuestionId, setSelectedFormQuestionId] = useState(formTemplates[0]?.questions?.[0]?.id || '');`,
    'estado de campo selecionado');
  s = assertReplace(s,
`  const selectedForm = formTemplates.find((item) => item.id === selectedFormId) || formTemplates[0];`,
`  const selectedForm = formTemplates.find((item) => item.id === selectedFormId) || formTemplates[0];
  useEffect(() => {
    if (!selectedForm) return;
    if (!selectedForm.questions.some((question) => question.id === selectedFormQuestionId)) {
      setSelectedFormQuestionId(selectedForm.questions[0]?.id || '');
    }
  }, [selectedForm?.id, selectedForm?.questions, selectedFormQuestionId]);`,
    'sincronização do campo selecionado');
  const oldFields = `{selectedForm.questions.map((question, index) => <div key={question.id} className="space-y-1"><div className="flex justify-end gap-1"><button type="button" className="portal-action" disabled={index===0} onClick={()=>moveSelectedFormQuestion(index,-1)} aria-label={\`Mover ${'${'}question.label} para cima\`}>↑</button><button type="button" className="portal-action" disabled={index===selectedForm.questions.length-1} onClick={()=>moveSelectedFormQuestion(index,1)} aria-label={\`Mover ${'${'}question.label} para baixo\`}>↓</button></div><FormQuestionEditor question={question} index={index} variables={matrixColumns} previousQuestions={selectedForm.questions.slice(0, index)} onChange={(updates) => updateSelectedForm({ questions: selectedForm.questions.map((item) => item.id === question.id ? { ...item, ...updates } : item) })} onDelete={() => updateSelectedForm({ questions: selectedForm.questions.filter((item) => item.id !== question.id) })}/></div>) }`;
  const newFields = `<div className="grid gap-3 lg:grid-cols-[minmax(220px,.55fr)_minmax(0,1.45fr)]"><div className="max-h-[520px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">{selectedForm.questions.map((question,index)=><button key={question.id} type="button" onClick={()=>setSelectedFormQuestionId(question.id)} className={\`w-full rounded-lg border px-3 py-2 text-left ${'${'}selectedFormQuestionId===question.id?'border-[#337959] bg-[#eef4f0]':'border-slate-200 bg-white hover:bg-slate-50'\}\`}><span className="mr-2 text-[9px] font-black text-slate-500">{index+1}.</span><span className="text-[10px] font-bold text-slate-800">{question.label}</span></button>)}</div>{selectedForm.questions.map((question,index)=>question.id===selectedFormQuestionId?<div key={question.id} className="space-y-1"><div className="flex justify-end gap-1"><button type="button" className="portal-action" disabled={index===0} onClick={()=>moveSelectedFormQuestion(index,-1)} aria-label={\`Mover ${'${'}question.label} para cima\`}>↑</button><button type="button" className="portal-action" disabled={index===selectedForm.questions.length-1} onClick={()=>moveSelectedFormQuestion(index,1)} aria-label={\`Mover ${'${'}question.label} para baixo\`}>↓</button></div><FormQuestionEditor question={question} index={index} variables={matrixColumns} previousQuestions={selectedForm.questions.slice(0,index)} onChange={(updates)=>updateSelectedForm({questions:selectedForm.questions.map((item)=>item.id===question.id?{...item,...updates}:item)})} onDelete={()=>updateSelectedForm({questions:selectedForm.questions.filter((item)=>item.id!==question.id)})}/></div>:null)}</div>`;
  s = assertReplace(s, oldFields, newFields, 'editor compacto de formulários');
  write(file, s);
}

// 4) Configurações: uma única sidebar real para Modelos e Variáveis.
{
  const file = 'src/pages/ConfiguracoesPage.tsx';
  let s = read(file);
  const re = /\] : activeSettingsPanel === 'models' \? \[\n\s*\{ id: 'studio',[\s\S]*?\n\s*\] : activeSettingsPanel === 'signatures' \? \[/;
  if (!re.test(s)) throw new Error('Bloco models de ConfiguracoesPage não encontrado');
  s = s.replace(re, `] : activeSettingsPanel === 'models' ? [
                  { id: 'models-catalog', label: 'Modelos', description: 'Catálogo de modelos documentais do Usuário Master.', icon: FileText, content: <MasterDocumentModelsPanel /> },
                  { id: 'documents', label: 'Documentos', description: 'Seleção, variáveis e pré-visualização dos documentos.', icon: FileText, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-documents" initialTab="documents" hideTabs actorEmail={userEmail || ''} initialStudio={settings?.integrationStudio} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div> },
                  { id: 'emails', label: 'E-mails', description: 'Modelos, variáveis, anexos e pré-visualização.', icon: Mail, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-emails" initialTab="emails" hideTabs actorEmail={userEmail || ''} initialStudio={settings?.integrationStudio} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div> },
                  { id: 'forms', label: 'Formulários', description: 'Campos, regras, variáveis e prévia no mesmo contexto.', icon: ClipboardList, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-forms" initialTab="forms" hideTabs actorEmail={userEmail || ''} initialStudio={settings?.integrationStudio} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div> },
                  { id: 'workflow', label: 'Fluxo', description: 'Etapas e ações do fluxo operacional.', icon: Layers, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-workflow" initialTab="workflow" hideTabs actorEmail={userEmail || ''} initialStudio={settings?.integrationStudio} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div> },
                  { id: 'variables', label: 'Variáveis', description: 'Definições canônicas, usos, mescla e propagação.', icon: Sliders, content: <div id="portal-models-workspace"><IntegrationStudioPanel key="studio-variables" initialTab="variables" hideTabs actorEmail={userEmail || ''} initialStudio={settings?.integrationStudio} matrixColumns={matrixColumns} setMatrixColumns={setMatrixColumns} matrixRows={matrixRows} setMatrixRows={setMatrixRows} emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} formTemplates={formTemplates} setFormTemplates={setFormTemplates} docTemplates={docTemplates} setDocTemplates={setDocTemplates} workflowStages={workflowStages} setWorkflowStages={setWorkflowStages} driveModelosFolderUrl={driveModelosFolderUrl} setDriveModelosFolderUrl={setDriveModelosFolderUrl} onConnectDrive={handleConnectGoogleDrive} onScanDrive={handleUpdateAllDocumentsAndFields} isScanningDrive={isUpdatingAllDocs} notify={showNotification} /></div> },
                ] : activeSettingsPanel === 'signatures' ? [`);
  write(file, s);
}

console.log('Refatoração estrutural 2026-09-27 aplicada.');
