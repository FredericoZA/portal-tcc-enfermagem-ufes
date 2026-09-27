import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);

function replaceOnce(path, from, to, label) {
  const source = read(path);
  if (!source.includes(from)) throw new Error(`${label}: padrão não encontrado em ${path}`);
  if (source.indexOf(from) !== source.lastIndexOf(from)) throw new Error(`${label}: padrão ambíguo em ${path}`);
  write(path, source.replace(from, to));
}

function replaceRegex(path, regex, to, label, expected = 1) {
  const source = read(path);
  const matches = [...source.matchAll(regex)];
  if (matches.length !== expected) throw new Error(`${label}: esperado ${expected}, encontrado ${matches.length} em ${path}`);
  write(path, source.replace(regex, to));
}

// ---------------------------------------------------------------------------
// 1. Fonte semântica única: remover cores paralelas das camadas legadas.
// ---------------------------------------------------------------------------
{
  const path = 'src/portal-core-1043.css';
  let css = read(path);
  css = css
    .replace('--portal-defended-bg: #c2d0c2;', '--portal-defended-bg: var(--portal-defense-defended-bg);')
    .replace('--portal-defended-border: #7e907e;', '--portal-defended-border: var(--portal-defense-defended-border);')
    .replace('--portal-defended-text: #263728;', '--portal-defended-text: var(--portal-defense-defended-text);')
    .replace('--portal-upcoming-bg: #d8c58e;', '--portal-upcoming-bg: var(--portal-defense-upcoming-bg);')
    .replace('--portal-upcoming-border: #a38a4b;', '--portal-upcoming-border: var(--portal-defense-upcoming-border);')
    .replace('--portal-upcoming-text: #3f351c;', '--portal-upcoming-text: var(--portal-defense-upcoming-text);')
    .replace('background: #f8fafc !important;\n  color: #64748b !important;', 'background: var(--portal-calendar-inactive-bg) !important;\n  color: #64748b !important;');
  write(path, css);
}

{
  const path = 'src/portal-public-ux-1044.css';
  let css = read(path);
  css = css
    .replace('background: #c2d0c2 !important;\n  border-color: #7e907e !important;\n  color: #263728 !important;', 'background: var(--portal-defense-defended-bg) !important;\n  border-color: var(--portal-defense-defended-border) !important;\n  color: var(--portal-defense-defended-text) !important;')
    .replace('background: #d4c69a !important;\n  border-color: #9e8f63 !important;\n  color: #453d25 !important;', 'background: var(--portal-defense-upcoming-bg) !important;\n  border-color: var(--portal-defense-upcoming-border) !important;\n  color: var(--portal-defense-upcoming-text) !important;')
    .replace(/--portal-role-student-bg:#d8c98f; --portal-role-student-border:#9b884b;\n  --portal-role-board-bg:#c9a39a; --portal-role-board-border:#8c5e55;\n  --portal-role-evaluator-bg:#9db8c0; --portal-role-evaluator-border:#587884;\n  --portal-role-viewer-bg:#b4a6be; --portal-role-viewer-border:#75647f;/, '--portal-role-student-bg:var(--portal-role-student-bg); --portal-role-student-border:var(--portal-role-student-border);\n  --portal-role-board-bg:var(--portal-role-board-bg); --portal-role-board-border:var(--portal-role-board-border);\n  --portal-role-evaluator-bg:var(--portal-role-evaluator-bg); --portal-role-evaluator-border:var(--portal-role-evaluator-border);\n  --portal-role-viewer-bg:var(--portal-role-viewer-bg); --portal-role-viewer-border:var(--portal-role-viewer-border);')
    .replace('.portal-tone-defended,.portal-tone-signed{background:#c2d0c2;border-color:#7e907e;color:#263728}.portal-tone-upcoming,.portal-tone-pending{background:#d4c69a;border-color:#9e8f63;color:#453d25}.portal-tone-student{background:#d8c98f;border-color:#9b884b;color:#3e361c}.portal-tone-board{background:#c9a39a;border-color:#8c5e55;color:#402824}.portal-tone-evaluator{background:#9db8c0;border-color:#587884;color:#20363e}.portal-tone-viewer{background:#b4a6be;border-color:#75647f;color:#342b39}.portal-tone-neutral{background:#eef1f2;border-color:#aeb7bc;color:#1f2937}', '.portal-tone-defended,.portal-tone-signed{background:var(--portal-defense-defended-bg);border-color:var(--portal-defense-defended-border);color:var(--portal-defense-defended-text)}.portal-tone-upcoming,.portal-tone-pending{background:var(--portal-defense-upcoming-bg);border-color:var(--portal-defense-upcoming-border);color:var(--portal-defense-upcoming-text)}.portal-tone-student{background:var(--portal-role-student-bg);border-color:var(--portal-role-student-border);color:var(--portal-role-student-text)}.portal-tone-board{background:var(--portal-role-board-bg);border-color:var(--portal-role-board-border);color:var(--portal-role-board-text)}.portal-tone-evaluator{background:var(--portal-role-evaluator-bg);border-color:var(--portal-role-evaluator-border);color:var(--portal-role-evaluator-text)}.portal-tone-viewer{background:var(--portal-role-viewer-bg);border-color:var(--portal-role-viewer-border);color:var(--portal-role-viewer-text)}.portal-tone-neutral{background:var(--portal-neutral-bg);border-color:var(--portal-neutral-border);color:var(--portal-neutral-text)}');
  // Remove autorreferências criadas pelo legado: os tokens já vêm do runtime.
  css = css.replace(/:root \{\n  --portal-role-student-bg:var\(--portal-role-student-bg\);[\s\S]*?--portal-role-viewer-border:var\(--portal-role-viewer-border\);\n\}/, ':root {\n  /* cores semânticas são injetadas por portalSemanticTokens.ts */\n}');
  write(path, css);
}

// ---------------------------------------------------------------------------
// 2. Marcador cromático global dos filtros (~30% maior) sem alterar o chip.
// ---------------------------------------------------------------------------
{
  const path = 'src/utils/tableFormatters.ts';
  let source = read(path);
  const semanticNeedle = `      buttonStyle: {\n        ...semanticStyle,\n        opacity: isSelected ? 1 : 0.7,\n        boxShadow: 'none',\n      } as CSSProperties,`;
  const semanticReplacement = `      buttonStyle: {\n        ...semanticStyle,\n        opacity: isSelected ? 1 : 0.7,\n        boxShadow: 'none',\n        '--portal-filter-dot-color': String(semanticStyle.borderColor || dotColor),\n      } as CSSProperties,`;
  if (!source.includes(semanticNeedle)) throw new Error('filter semantic style: padrão não encontrado');
  source = source.replace(semanticNeedle, semanticReplacement);
  const returnNeedle = `  return {\n    label,\n    emoji,\n    dotColor,\n    buttonStyle,`;
  if (!source.includes(returnNeedle)) throw new Error('filter return: padrão não encontrado');
  source = source.replace(returnNeedle, `  (buttonStyle as CSSProperties & Record<string, string>)['--portal-filter-dot-color'] = dotColor;\n\n${returnNeedle}`);
  write(path, source);
}

{
  const path = 'src/portal-semantic-ui.css';
  let css = read(path);
  if (!css.includes('.portal-table-filter-chip::before')) {
    css += `\n/* O ponto de cor pertence ao componente do filtro, não ao conteúdo do botão. */\n.portal-table-filter-chip::before {\n  content: '';\n  display: block;\n  width: var(--portal-filter-dot-size);\n  height: var(--portal-filter-dot-size);\n  min-width: var(--portal-filter-dot-size);\n  min-height: var(--portal-filter-dot-size);\n  flex: 0 0 var(--portal-filter-dot-size);\n  border-radius: 999px;\n  background: var(--portal-filter-dot-color, currentColor);\n}\n`;
  }
  write(path, css);
}

// ---------------------------------------------------------------------------
// 3. Calendário: inativos unificados e resumo em duas camadas.
// ---------------------------------------------------------------------------
{
  const path = 'src/pages/HomePage.tsx';
  let source = read(path);
  source = source.replace(/portal-calendar-empty-cell(?! portal-calendar-inactive-cell)/g, 'portal-calendar-empty-cell portal-calendar-inactive-cell');
  source = source.replace(/portal-core-calendar-weekend(?! portal-calendar-inactive-cell)/g, 'portal-core-calendar-weekend portal-calendar-inactive-cell');

  const processSummary = `                          return (\n                            <span\n                              key={proc.id}\n                              className=\"portal-calendar-defense-summary portal-semantic-tone\"\n                              style={getPortalToneCssVars(defenseState)}\n                              data-defense-state={defenseState}\n                              title={formatDefenseCalendarSummary(proc, 160)}\n                            >\n                              {formatDefenseCalendarSummary(proc)}\n                            </span>\n                          );`;
  const processSummaryNext = `                          const students = formatStudentsString(proc.aluno1, proc.aluno2, false);\n                          const summary = formatDefenseCalendarSummary(proc, 240);\n                          return (\n                            <div\n                              key={proc.id}\n                              className=\"portal-calendar-defense-summary portal-semantic-tone\"\n                              style={getPortalToneCssVars(defenseState)}\n                              data-defense-state={defenseState}\n                              title={\`${'${summary}'} — ${'${students}'}\`}\n                            >\n                              <span className=\"portal-calendar-defense-primary\">{summary}</span>\n                              <span className=\"portal-calendar-defense-students\">{students}</span>\n                            </div>\n                          );`;
  if (!source.includes(processSummary)) throw new Error('calendar process summary: padrão não encontrado');
  source = source.replace(processSummary, processSummaryNext);

  const gcalSummary = `                          return (\n                            <span\n                              key={ev.id}\n                              className=\"portal-calendar-defense-summary portal-semantic-tone\"\n                              style={getPortalToneCssVars(defenseState)}\n                              data-defense-state={defenseState}\n                              title={summary}\n                            >\n                              {summary}\n                            </span>\n                          );`;
  const gcalSummaryNext = `                          return (\n                            <div\n                              key={ev.id}\n                              className=\"portal-calendar-defense-summary portal-semantic-tone\"\n                              style={getPortalToneCssVars(defenseState)}\n                              data-defense-state={defenseState}\n                              title={\`${'${summary}'} — ${'${parsed.aluno}'}\`}\n                            >\n                              <span className=\"portal-calendar-defense-primary\">{summary}</span>\n                              <span className=\"portal-calendar-defense-students\">{parsed.aluno}</span>\n                            </div>\n                          );`;
  if (!source.includes(gcalSummary)) throw new Error('calendar gcal summary: padrão não encontrado');
  source = source.replace(gcalSummary, gcalSummaryNext);
  write(path, source);
}

// ---------------------------------------------------------------------------
// 4. Configurações: barras verdes e ModelsVariablesWorkspace único.
// ---------------------------------------------------------------------------
{
  const path = 'src/pages/ConfiguracoesPage.tsx';
  let source = read(path);
  source = source.replace(`import { IntegrationStudioPanel } from '../components/IntegrationStudioPanel';\n`, `import { ModelsVariablesWorkspace } from '../components/ModelsVariablesWorkspace';\n`);
  source = source.replace(`import { MasterDocumentModelsPanel } from '../components/MasterDocumentModelsPanel';\n`, '');

  source = source.replace(
    `className=\"portal-settings-title-bar flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-[#d5dce0] px-3.5 py-3 text-left shadow-sm\"`,
    `className=\"portal-settings-title-bar flex w-full items-center gap-3 rounded-xl border border-[var(--portal-brand-moss)] bg-[var(--portal-brand-moss)] px-3.5 py-3 text-left text-white shadow-sm\"`
  );
  source = source.replace(`<Icon className=\"h-5 w-5 shrink-0 text-[#337959]\" />`, `<Icon className=\"h-5 w-5 shrink-0 text-white\" />`);
  source = source.replace(`<strong className=\"block text-xs font-black uppercase tracking-wide text-black\">{title}</strong><span className=\"mt-0.5 block text-[10px] text-slate-600\">{text}</span>`, `<strong className=\"block text-xs font-black uppercase tracking-wide text-white\">{title}</strong><span className=\"mt-0.5 block text-[10px] text-white/80\">{text}</span>`);
  source = source.replace(`<ChevronRight className=\"h-4 w-4 shrink-0 text-slate-600\" />`, `<ChevronRight className=\"h-4 w-4 shrink-0 text-white/80\" />`);

  const modelsRegex = /\{ id: 'studio', label: 'Estúdio de modelos e variáveis',[\s\S]*?content: <div id=\"portal-models-workspace\" className=\"space-y-3\"><MasterDocumentModelsPanel \/><IntegrationStudioPanel([\s\S]*?) \/><\/div> \},/;
  const match = source.match(modelsRegex);
  if (!match) throw new Error('Configuracoes models workspace: padrão não encontrado');
  const props = match[1];
  source = source.replace(modelsRegex, `{ id: 'studio', label: 'Modelos e variáveis', description: 'Modelos, documentos, e-mails, formulários, fluxo e variáveis em uma única navegação.', icon: Layers, content: <ModelsVariablesWorkspace${props} /> },`);
  write(path, source);
}

// ---------------------------------------------------------------------------
// 5. Estúdio: modo controlado sem segunda sidebar + edição progressiva.
// ---------------------------------------------------------------------------
{
  const path = 'src/components/IntegrationStudioPanel.tsx';
  let source = read(path);
  source = source.replace(`type StudioTab = 'operation' | 'overview' | 'brand' | 'documents' | 'emails' | 'forms' | 'workflow' | 'variables' | 'audit';`, `export type StudioTab = 'operation' | 'overview' | 'brand' | 'documents' | 'emails' | 'forms' | 'workflow' | 'variables' | 'audit';`);
  source = source.replace(`interface IntegrationStudioPanelProps {`, `interface IntegrationStudioPanelProps {\n  activeTab?: StudioTab;\n  onActiveTabChange?: (tab: StudioTab) => void;\n  hideNavigation?: boolean;\n  hideHeader?: boolean;`);
  source = source.replace(
    `    onConnectDrive, onScanDrive, isScanningDrive, notify\n  } = props;`,
    `    onConnectDrive, onScanDrive, isScanningDrive, notify,\n    activeTab: controlledActiveTab, onActiveTabChange, hideNavigation = false, hideHeader = false\n  } = props;`
  );
  source = source.replace(
    `  const [activeTab, setActiveTab] = useState<StudioTab>('documents');`,
    `  const [internalActiveTab, setInternalActiveTab] = useState<StudioTab>('documents');\n  const activeTab = controlledActiveTab ?? internalActiveTab;\n  const setActiveTab = (tab: StudioTab) => {\n    if (controlledActiveTab === undefined) setInternalActiveTab(tab);\n    onActiveTabChange?.(tab);\n  };`
  );
  source = source.replace(
    `  const [selectedVariableId, setSelectedVariableId] = useState(matrixColumns[0]?.id || '');`,
    `  const [selectedVariableId, setSelectedVariableId] = useState(matrixColumns[0]?.id || '');\n  const [selectedFormQuestionId, setSelectedFormQuestionId] = useState(formTemplates[0]?.questions[0]?.id || '');\n  const [selectedWorkflowStageId, setSelectedWorkflowStageId] = useState(workflowStages[0]?.id || '');`
  );
  source = source.replace(
    `  const selectedVariable = matrixColumns.find((item) => item.id === selectedVariableId) || matrixColumns[0];`,
    `  const selectedVariable = matrixColumns.find((item) => item.id === selectedVariableId) || matrixColumns[0];\n  const selectedFormQuestion = selectedForm?.questions.find((item) => item.id === selectedFormQuestionId) || selectedForm?.questions[0];`
  );
  source = source.replace(
    `  useEffect(() => {\n    setVariableDraft(selectedVariable ? { ...selectedVariable, aliases: [...(selectedVariable.aliases || [])], format: { ...(selectedVariable.format || {}) } } : null);\n  }, [selectedVariableId, selectedVariable?.id]);`,
    `  useEffect(() => {\n    setVariableDraft(selectedVariable ? { ...selectedVariable, aliases: [...(selectedVariable.aliases || [])], format: { ...(selectedVariable.format || {}) } } : null);\n  }, [selectedVariableId, selectedVariable?.id]);\n\n  useEffect(() => {\n    if (!selectedForm?.questions.some((item) => item.id === selectedFormQuestionId)) setSelectedFormQuestionId(selectedForm?.questions[0]?.id || '');\n  }, [selectedForm?.id, selectedForm?.questions, selectedFormQuestionId]);\n\n  useEffect(() => {\n    if (!workflowStages.some((stage) => stage.id === selectedWorkflowStageId)) setSelectedWorkflowStageId(workflowStages[0]?.id || '');\n  }, [workflowStages, selectedWorkflowStageId]);`
  );

  const heading = `      <div className=\"portal-studio-heading flex flex-wrap items-center justify-between gap-2 border-b border-[#286a4d] bg-[#337959] px-3 py-2.5 text-white\">\n        <div><h3 className=\"text-xs font-black uppercase tracking-wide\">Editor de modelos e variáveis</h3><p className=\"mt-0.5 text-[9px] text-white/80\">Selecione uma área à esquerda e trabalhe com seleção, edição e visualização no mesmo contexto.</p></div>\n        <div className=\"flex items-center gap-2\"><div className=\"hidden text-right text-[9px] font-semibold text-white/80 md:block\">{isDirty ? (draftSavedAt ? \`Rascunho automático \${new Date(draftSavedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}\` : 'Salvando rascunho…') : (lastSavedAt ? \`Publicado \${new Date(lastSavedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}\` : 'Ainda não publicado')}</div><button type=\"button\" onClick={() => void persistSnapshot(true)} disabled={isSaving} className=\"inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-white bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-black shadow-sm disabled:opacity-50\"><Save className=\"h-3.5 w-3.5\" />{isSaving ? 'Publicando…' : 'Publicar'}</button></div>\n      </div>`;
  if (!source.includes(heading)) throw new Error('studio heading: padrão não encontrado');
  source = source.replace(heading, `      {!hideHeader && (${heading.trim()})}`);

  const aside = `        <aside className=\"w-full shrink-0 border-b border-slate-300 bg-[#d5dce0] p-2 md:w-56 md:border-b-0 md:border-r\">\n          <div className=\"rounded-xl border border-slate-300 bg-white p-2 shadow-sm\"><div className=\"mb-2 border-b border-slate-200 px-2 pb-2 text-[9px] font-black uppercase tracking-wider text-slate-500\">Modelos e variáveis</div><div className=\"space-y-1\">{tabs.map((tab) => { const Icon = tab.icon; const selected = activeTab === tab.id; return <button key={tab.id} type=\"button\" onClick={() => setActiveTab(tab.id)} className={\`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[10px] font-black uppercase transition-colors \${selected ? 'border-[#337959] bg-[#337959] text-white' : 'border-transparent bg-white text-slate-700 hover:border-slate-300'}\`}><Icon className=\"h-3.5 w-3.5 shrink-0\"/>{tab.label}</button>; })}</div></div>\n        </aside>`;
  if (!source.includes(aside)) throw new Error('studio aside: padrão não encontrado');
  source = source.replace(aside, `        {!hideNavigation && (${aside.trim()})}`);
  source = source.replace(`<div className=\"min-w-0 flex-1 bg-slate-50/40 p-3 sm:p-4\">`, `<div className=\"min-w-0 flex-1 bg-[var(--portal-surface-ice)] p-3 sm:p-4\">`);

  // Campo de formulário: lista compacta e um editor detalhado por vez.
  const formFieldsRegex = /<div className=\"space-y-2\">\s*<div className=\"flex items-center justify-between\"><span className=\{labelClass\}>Campos, regras e variáveis<\/span><button[\s\S]*?\{selectedForm\.questions\.map\(\(question, index\) => <div key=\{question\.id\}[\s\S]*?<\/div>\)\) \}\s*<\/div>/;
  const formFields = source.match(formFieldsRegex);
  if (!formFields) throw new Error('form progressive editor: padrão não encontrado');
  source = source.replace(formFieldsRegex, `<div className=\"space-y-2\">\n                <div className=\"flex items-center justify-between\"><span className={labelClass}>Campos, regras e variáveis</span><button type=\"button\" onClick={() => { const id = \`question-\${Date.now()}\`; updateSelectedForm({ questions: [...selectedForm.questions, { id, fieldKey: '', label: 'Novo campo', fieldType: 'text', expectedAnswer: '', required: false, validation: {} }] }); setSelectedFormQuestionId(id); }} className={\`${'${actionClass}'} border-[var(--portal-brand-moss-soft)] bg-[var(--portal-brand-moss-soft)] text-white\`}><Plus className=\"h-3 w-3\" />Adicionar campo</button></div>\n                <div className=\"grid gap-3 lg:grid-cols-[minmax(220px,.72fr)_minmax(0,1.28fr)]\">\n                  <div className=\"max-h-[520px] space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-[var(--portal-surface-soft)] p-2\">{selectedForm.questions.map((question, index) => <button key={question.id} type=\"button\" onClick={() => setSelectedFormQuestionId(question.id)} className={\`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left \${selectedFormQuestion?.id === question.id ? 'border-[var(--portal-brand-moss-soft)] bg-white shadow-sm' : 'border-transparent bg-[var(--portal-surface-ice)] hover:border-slate-300'}\`}><span className=\"inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--portal-brand-moss)] text-[9px] font-black text-white\">{index + 1}</span><span className=\"min-w-0 flex-1\"><strong className=\"block truncate text-[10px] text-black\">{question.label || 'Campo sem título'}</strong><code className=\"block truncate text-[8px] text-slate-500\">{question.fieldKey || 'sem variável'}</code></span><span className=\"flex gap-0.5\"><button type=\"button\" className=\"portal-action\" disabled={index===0} onClick={(event)=>{event.stopPropagation();moveSelectedFormQuestion(index,-1);}} aria-label={\`Mover \${question.label} para cima\`}>↑</button><button type=\"button\" className=\"portal-action\" disabled={index===selectedForm.questions.length-1} onClick={(event)=>{event.stopPropagation();moveSelectedFormQuestion(index,1);}} aria-label={\`Mover \${question.label} para baixo\`}>↓</button></span></button>)}</div>\n                  <div className=\"min-w-0\">{selectedFormQuestion ? (() => { const index = selectedForm.questions.findIndex((item) => item.id === selectedFormQuestion.id); return <FormQuestionEditor question={selectedFormQuestion} index={Math.max(0,index)} variables={matrixColumns} previousQuestions={selectedForm.questions.slice(0, Math.max(0,index))} onChange={(updates) => updateSelectedForm({ questions: selectedForm.questions.map((item) => item.id === selectedFormQuestion.id ? { ...item, ...updates } : item) })} onDelete={() => { const remaining = selectedForm.questions.filter((item) => item.id !== selectedFormQuestion.id); updateSelectedForm({ questions: remaining }); setSelectedFormQuestionId(remaining[0]?.id || ''); }}/>; })() : <div className=\"rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500\">Adicione ou selecione um campo para editar.</div>}</div>\n                </div>\n              </div>`);

  // Fluxo: todos os cabeçalhos permanecem visíveis; somente a etapa selecionada expande.
  source = source.replace(
    `className={\`${'${panelClass}'} overflow-hidden\`}>\n                <div className=\"flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 p-3\">`,
    `className={\`${'${panelClass}'} overflow-hidden\`} onClick={() => setSelectedWorkflowStageId(stage.id)}>\n                <div className=\"flex flex-wrap items-center gap-2 border-b border-slate-200 bg-[var(--portal-surface-soft)] p-3\">`
  );
  source = source.replace(`                <div className=\"space-y-3 p-4\">\n                  <div className=\"grid gap-3 md:grid-cols-[.8fr_1.2fr]\">`, `                <div className={\`${'${selectedWorkflowStageId === stage.id ? \'block\' : \'hidden\'}'} space-y-3 p-4\`}>\n                  <div className=\"grid gap-3 md:grid-cols-[.8fr_1.2fr]\">`);

  // Variáveis: ações de saneamento compactas e sem painel passivo de sugestões.
  const afterDeleteNeedle = `  const deleteSelectedVariable = async () => {`;
  if (!source.includes(afterDeleteNeedle)) throw new Error('variables delete: padrão não encontrado');
  const insertionPoint = `  const workflowEvents = [`;
  if (!source.includes(insertionPoint)) throw new Error('variables workflow insertion: padrão não encontrado');
  const maintenance = `  const focusDuplicateCandidate = () => {\n    const candidate = similarVariableSuggestions[0];\n    if (!candidate) { notify('Varredura concluída: nenhuma duplicação provável encontrada.'); return; }\n    setMergeSourceId(candidate.source.id);\n    setMergeTargetId(candidate.target.id);\n    notify(\`Possível duplicação encontrada: \${candidate.source.label || candidate.source.name} → \${candidate.target.label || candidate.target.name}. Confira o impacto antes de mesclar.\`);\n  };\n\n  const cleanupUnusedVariables = async () => {\n    const unused = matrixColumns.filter((column) => {\n      const usage = getVariableUsage([column.id, column.name, ...(column.aliases || [])], { matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates });\n      return usage.documents.length + usage.emails.length + usage.forms.length === 0;\n    });\n    if (!unused.length) { notify('Saneamento concluído: nenhuma variável sem uso.'); return; }\n    if (!(await portalConfirm(\`Excluir \${unused.length} variável(is) sem qualquer referência ativa? A operação será registrada e não remove variáveis em uso.\`))) return;\n    const ids = new Set(unused.map((column) => column.id));\n    setMatrixColumns((previous) => previous.filter((column) => !ids.has(column.id)));\n    setMatrixRows((previous) => previous.map((row) => { const fields = { ...row.fields }; ids.forEach((id) => delete fields[id]); return { ...row, fields }; }));\n    setAuditTrail((previous) => [createAuditEntry('VARIABLE_DELETED', 'variable', 'unused-cleanup', \`\${unused.length} variável(is) sem uso removida(s) após varredura de referências.\`, actorEmail, { before: unused }), ...previous].slice(0, 500));\n    if (ids.has(selectedVariableId)) setSelectedVariableId(matrixColumns.find((column) => !ids.has(column.id))?.id || '');\n    setIsDirty(true);\n    notify(\`\${unused.length} variável(is) sem uso removida(s) com segurança.\`);\n  };\n\n`;
  source = source.replace(insertionPoint, maintenance + insertionPoint);

  const variableToolbarRegex = /<div className=\"grid gap-4 xl:grid-cols-\[\.85fr_1\.15fr\]\">[\s\S]*?<\/div>\s*\{similarVariableSuggestions\.length > 0 && <div className=\{`\$\{panelClass\} p-4`\}>[\s\S]*?<\/div>\}\s*/;
  const variableToolbarMatch = source.match(variableToolbarRegex);
  if (!variableToolbarMatch) throw new Error('variables toolbar: padrão não encontrado');
  source = source.replace(variableToolbarRegex, `<div className={\`${'${panelClass}'} p-3\`}>\n              <div className=\"flex flex-wrap items-center gap-2\">\n                <input value={newVariableKey} onChange={(e) => setNewVariableKey(e.target.value)} className={\`${'${inputClass}'} min-w-[210px] flex-1\`} placeholder=\"Nova variável, ex.: ALUNO_NOME_COMPLETO\" />\n                <button type=\"button\" onClick={handleCreateVariable} className={\`${'${actionClass}'} border-[var(--portal-brand-moss)] bg-[var(--portal-brand-moss)] text-white\`}><Plus className=\"h-3.5 w-3.5\" />Criar</button>\n                <button type=\"button\" onClick={handleDiscoverVariables} className={\`${'${actionClass}'} border-slate-300 bg-white text-slate-800\`}><RefreshCw className=\"h-3.5 w-3.5\" />Descobrir</button>\n                <button type=\"button\" onClick={focusDuplicateCandidate} className={\`${'${actionClass}'} border-slate-300 bg-white text-slate-800\`}><Merge className=\"h-3.5 w-3.5\" />Procurar duplicações</button>\n                <button type=\"button\" onClick={() => void cleanupUnusedVariables()} className={\`${'${actionClass}'} border-slate-300 bg-white text-slate-800\`}><Trash2 className=\"h-3.5 w-3.5\" />Limpar sem uso</button>\n              </div>\n              <div className=\"mt-2 grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]\"><select value={mergeSourceId} onChange={(e) => setMergeSourceId(e.target.value)} className={inputClass}><option value=\"\">Variável duplicada</option>{matrixColumns.map((column, cIdx) => <option key={\`source-\${column.id}-\${cIdx}\`} value={column.id}>{column.label || column.name}</option>)}</select><div className=\"self-center text-center text-xs font-black text-slate-400\">→</div><select value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)} className={inputClass}><option value=\"\">Variável principal</option>{matrixColumns.map((column, cIdx) => <option key={\`target-\${column.id}-\${cIdx}\`} value={column.id}>{column.label || column.name}</option>)}</select><button type=\"button\" onClick={handleMergeVariables} disabled={!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId} className={\`${'${actionClass}'} border-[var(--portal-brand-moss-soft)] bg-[var(--portal-brand-moss-soft)] text-white\`}><Merge className=\"h-3.5 w-3.5\" />Mesclar</button></div>\n              {variableMergeImpact && <div className=\"mt-2 rounded-xl border border-slate-300 bg-[var(--portal-surface-soft)] p-3 text-[10px] leading-relaxed text-slate-800\"><strong>Impacto:</strong> {variableMergeImpact.affectedArtifacts.length} artefato(s) serão reescritos. {variableMergeImpact.formatChanges && <span className=\"font-bold\">A formatação da variável principal prevalecerá.</span>}</div>}\n            </div>\n            `);

  // Paleta do estúdio: superfícies neutras; verde reservado a ações/títulos.
  source = source
    .replace(/border-violet-700 bg-violet-700 text-white hover:bg-violet-800/g, 'border-[var(--portal-brand-moss)] bg-[var(--portal-brand-moss)] text-white')
    .replace(/border-violet-500 bg-violet-50 shadow-sm/g, 'border-[var(--portal-brand-moss-soft)] bg-[var(--portal-surface-soft)] shadow-sm')
    .replace(/text-violet-700/g, 'text-[var(--portal-brand-moss-soft)]')
    .replace(/text-violet-800/g, 'text-slate-700')
    .replace(/text-violet-950/g, 'text-slate-900')
    .replace(/border-violet-200 bg-violet-50/g, 'border-slate-300 bg-[var(--portal-surface-soft)]');

  write(path, source);
}

// ---------------------------------------------------------------------------
// 6. Barra de Configurações não pode voltar ao cinza no hover.
// ---------------------------------------------------------------------------
{
  const path = 'src/portal-version-1046.css';
  let css = read(path);
  css = css.replace(`#portal-settings-hub .portal-settings-title-bar:hover {\n  background: #cbd4d8 !important;\n  border-color: #9ca9af !important;\n}`, `#portal-settings-hub .portal-settings-title-bar {\n  background: var(--portal-brand-moss) !important;\n  border-color: var(--portal-brand-moss) !important;\n  color: #fff !important;\n}\n#portal-settings-hub .portal-settings-title-bar:hover {\n  background: var(--portal-brand-moss-dark) !important;\n  border-color: var(--portal-brand-moss-dark) !important;\n}\n#portal-settings-hub .portal-settings-title-bar * { color: #fff !important; }`);
  write(path, css);
}

console.log('Migração estrutural 1.0.47 aplicada com sucesso.');
