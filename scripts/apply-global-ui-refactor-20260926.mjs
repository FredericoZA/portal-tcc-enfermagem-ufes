import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(file, before, after, label) {
  let content = read(file);
  const count = content.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: esperado 1 trecho em ${file}, encontrado ${count}`);
  content = content.replace(before, after);
  write(file, content);
}

function replaceRegex(file, regex, replacement, label) {
  const content = read(file);
  const matches = content.match(regex);
  if (!matches) throw new Error(`${label}: trecho não encontrado em ${file}`);
  write(file, content.replace(regex, replacement));
}

// ---------------------------------------------------------------------------
// Calendário: resumo rico e mesma semântica de cor entre calendário e lista.
// ---------------------------------------------------------------------------
replaceOnce(
  'src/pages/HomePage.tsx',
  "import { DefenseFilter, DefenseState, formatDefenseCalendarSummary, getDefenseState, getDefenseStateFromTimes, matchesDefenseFilter } from '../utils/defenseSemantics';",
  "import { DefenseFilter, DefenseState, formatDefenseCalendarSummary, getDefenseCalendarSummaryParts, getDefenseState, getDefenseStateFromTimes, matchesDefenseFilter } from '../utils/defenseSemantics';",
  'import summary parts',
);

replaceOnce(
  'src/pages/HomePage.tsx',
`                        {dayDefenses.map((proc) => {
                          const defenseState = getDefenseState(proc);
                          return (
                            <span
                              key={proc.id}
                              className="portal-calendar-defense-summary portal-semantic-tone"
                              style={getPortalToneCssVars(defenseState)}
                              data-defense-state={defenseState}
                              title={formatDefenseCalendarSummary(proc, 160)}
                            >
                              {formatDefenseCalendarSummary(proc)}
                            </span>
                          );
                        })}`,
`                        {dayDefenses.map((proc) => {
                          const defenseState = getDefenseState(proc);
                          const summary = getDefenseCalendarSummaryParts(proc);
                          return (
                            <span
                              key={proc.id}
                              className="portal-calendar-defense-summary portal-semantic-tone"
                              style={getPortalToneCssVars(defenseState)}
                              data-defense-state={defenseState}
                              title={summary.fullText}
                            >
                              <span className="portal-calendar-defense-primary">{summary.primary}</span>
                              <span className="portal-calendar-defense-secondary">{summary.secondary}</span>
                            </span>
                          );
                        })}`,
  'structured portal calendar summary',
);

replaceOnce(
  'src/pages/HomePage.tsx',
`                          const summary = [startLabel, parsed.trabalho, parsed.aluno, parsed.local].filter(Boolean).join(' · ');
                          return (
                            <span
                              key={ev.id}
                              className="portal-calendar-defense-summary portal-semantic-tone"
                              style={getPortalToneCssVars(defenseState)}
                              data-defense-state={defenseState}
                              title={summary}
                            >
                              {summary}
                            </span>
                          );`,
`                          const primary = [startLabel, parsed.trabalho].filter(Boolean).join(' · ');
                          const secondary = parsed.aluno || 'Discente não identificado';
                          const summary = [primary, secondary].filter(Boolean).join('\\n');
                          return (
                            <span
                              key={ev.id}
                              className="portal-calendar-defense-summary portal-semantic-tone"
                              style={getPortalToneCssVars(defenseState)}
                              data-defense-state={defenseState}
                              title={summary}
                            >
                              <span className="portal-calendar-defense-primary">{primary}</span>
                              <span className="portal-calendar-defense-secondary">{secondary}</span>
                            </span>
                          );`,
  'structured google calendar summary',
);

// Indicador de cor: o botão não muda de tamanho, apenas a bolinha cresce ~30%.
for (const file of ['src/pages/HomePage.tsx', 'src/pages/CoordenadorPage.tsx']) {
  if (!fs.existsSync(path.join(root, file))) continue;
  let content = read(file);
  if (!content.includes('getFilterChipProps')) continue;
  content = content.replaceAll(
    '{chip.emoji && <span>{chip.emoji}</span>}\n                          <span>{chip.label}</span>',
    '{chip.emoji && <span>{chip.emoji}</span>}\n                          {chip.dotColor && <span className="portal-filter-color-dot" aria-hidden="true" style={{ backgroundColor: chip.dotColor }} />}\n                          <span>{chip.label}</span>',
  );
  content = content.replaceAll(
    '{chip.emoji && <span>{chip.emoji}</span>}<span>{chip.label}</span>',
    '{chip.emoji && <span>{chip.emoji}</span>}{chip.dotColor && <span className="portal-filter-color-dot" aria-hidden="true" style={{ backgroundColor: chip.dotColor }} />}<span>{chip.label}</span>',
  );
  write(file, content);
}

// ---------------------------------------------------------------------------
// Configurações: seis barras = mesmo verde + texto branco.
// Single-table workspaces são resolvidos pelo SettingsWorkspaceModal canônico.
// ---------------------------------------------------------------------------
replaceOnce(
  'src/pages/ConfiguracoesPage.tsx',
`className="portal-settings-title-bar flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-[#d5dce0] px-3.5 py-3 text-left shadow-sm">
                <Icon className="h-5 w-5 shrink-0 text-[#337959]" />
                <span className="min-w-0 flex-1"><strong className="block text-xs font-black uppercase tracking-wide text-black">{title}</strong><span className="mt-0.5 block text-[10px] text-slate-600">{text}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" />`,
`className="portal-settings-title-bar flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-white shadow-sm" style={{ backgroundColor: 'var(--portal-green-action)', borderColor: 'var(--portal-green-action-border)' }}>
                <Icon className="h-5 w-5 shrink-0 text-white" />
                <span className="min-w-0 flex-1"><strong className="block text-xs font-black uppercase tracking-wide text-white">{title}</strong><span className="mt-0.5 block text-[10px] text-white/85">{text}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/80" />`,
  'settings title bars',
);

replaceOnce(
  'src/pages/ConfiguracoesPage.tsx',
  "import { MasterDocumentModelsPanel } from '../components/MasterDocumentModelsPanel';\n",
  '',
  'remove duplicate master model import',
);
replaceOnce(
  'src/pages/ConfiguracoesPage.tsx',
  '<div id="portal-models-workspace" className="space-y-3"><MasterDocumentModelsPanel /><IntegrationStudioPanel',
  '<div id="portal-models-workspace"><IntegrationStudioPanel',
  'remove duplicate master model block',
);

// ---------------------------------------------------------------------------
// Estúdio: uma única navegação lateral e Modelos como primeira área.
// ---------------------------------------------------------------------------
replaceOnce(
  'src/components/IntegrationStudioPanel.tsx',
  "import { OperationalDesignerPanel } from './OperationalDesignerPanel';\n",
  "import { OperationalDesignerPanel } from './OperationalDesignerPanel';\nimport { MasterDocumentModelsPanel } from './MasterDocumentModelsPanel';\n",
  'import master models panel',
);
replaceOnce(
  'src/components/IntegrationStudioPanel.tsx',
  "type StudioTab = 'operation' | 'overview' | 'brand' | 'documents' | 'emails' | 'forms' | 'workflow' | 'variables' | 'audit';",
  "type StudioTab = 'models' | 'operation' | 'overview' | 'brand' | 'documents' | 'emails' | 'forms' | 'workflow' | 'variables' | 'audit';",
  'studio models tab type',
);
replaceOnce(
  'src/components/IntegrationStudioPanel.tsx',
  "const [activeTab, setActiveTab] = useState<StudioTab>('documents');",
  "const [activeTab, setActiveTab] = useState<StudioTab>('models');",
  'default studio tab',
);
replaceOnce(
  'src/components/IntegrationStudioPanel.tsx',
  "const [selectedFormId, setSelectedFormId] = useState(formTemplates[0]?.id || '');",
  "const [selectedFormId, setSelectedFormId] = useState(formTemplates[0]?.id || '');\n  const [selectedQuestionId, setSelectedQuestionId] = useState(formTemplates[0]?.questions?.[0]?.id || '');\n  const [expandedWorkflowStageId, setExpandedWorkflowStageId] = useState(workflowStages[0]?.id || '');",
  'progressive editor state',
);
replaceOnce(
  'src/components/IntegrationStudioPanel.tsx',
`  const tabs: Array<{ id: StudioTab; label: string; icon: React.ElementType }> = [
    { id: 'documents', label: 'Documentos', icon: FileText },`,
`  const tabs: Array<{ id: StudioTab; label: string; icon: React.ElementType }> = [
    { id: 'models', label: 'Modelos', icon: Layers },
    { id: 'documents', label: 'Documentos', icon: FileText },`,
  'models first in studio nav',
);
replaceOnce(
  'src/components/IntegrationStudioPanel.tsx',
  '<div className="min-h-[68vh]" style={{ backgroundColor: \'var(--portal-surface-layer-1)\' }}>\n        <nav className="portal-studio-tabs flex flex-wrap items-center gap-1.5 border-b border-slate-300 p-2.5" style={{ backgroundColor: \'var(--portal-surface-layer-2)\' }} aria-label="Áreas de modelos e variáveis">',
  '<div className="grid min-h-[68vh] md:grid-cols-[220px_minmax(0,1fr)]" style={{ backgroundColor: \'var(--portal-surface-layer-1)\' }}>\n        <nav className="portal-studio-tabs flex flex-row flex-wrap items-stretch gap-1.5 border-b border-slate-300 p-2.5 md:flex-col md:flex-nowrap md:border-b-0 md:border-r" style={{ backgroundColor: \'var(--portal-surface-layer-2)\' }} aria-label="Áreas de modelos e variáveis">',
  'studio single sidebar layout',
);
replaceOnce(
  'src/components/IntegrationStudioPanel.tsx',
  "              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-black uppercase transition-colors ${selected ? 'text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-[#337959]'}`}",
  "              className={`inline-flex min-w-[132px] items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-black uppercase transition-colors md:w-full ${selected ? 'text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-[#337959]'}`}",
  'studio nav item width',
);
replaceOnce(
  'src/components/IntegrationStudioPanel.tsx',
  "        {activeTab === 'operation' && <OperationalDesignerPanel",
  "        {activeTab === 'models' && <MasterDocumentModelsPanel />}\n        {activeTab === 'operation' && <OperationalDesignerPanel",
  'models section content',
);

// Formulários: lista compacta + um único campo aberto por vez.
const oldFormFields = `              <div className="space-y-2">
                <div className="flex items-center justify-between"><span className={labelClass}>Campos, regras e variáveis</span><button type="button" onClick={() => updateSelectedForm({ questions: [...selectedForm.questions, { id: \`question-\${Date.now()}\`, fieldKey: '', label: 'Novo campo', fieldType: 'text', expectedAnswer: '', required: false, validation: {} }] })} className={\`\${actionClass} border-sky-300 bg-sky-50 text-sky-800\`}><Plus className="h-3 w-3" />Adicionar campo</button></div>
                {selectedForm.questions.map((question, index) => <div key={question.id} className="space-y-1"><div className="flex justify-end gap-1"><button type="button" className="portal-action" disabled={index===0} onClick={()=>moveSelectedFormQuestion(index,-1)} aria-label={\`Mover \${question.label} para cima\`}>↑</button><button type="button" className="portal-action" disabled={index===selectedForm.questions.length-1} onClick={()=>moveSelectedFormQuestion(index,1)} aria-label={\`Mover \${question.label} para baixo\`}>↓</button></div><FormQuestionEditor question={question} index={index} variables={matrixColumns} previousQuestions={selectedForm.questions.slice(0, index)} onChange={(updates) => updateSelectedForm({ questions: selectedForm.questions.map((item) => item.id === question.id ? { ...item, ...updates } : item) })} onDelete={() => updateSelectedForm({ questions: selectedForm.questions.filter((item) => item.id !== question.id) })}/></div>) }
              </div>`;
const newFormFields = `              <div className="space-y-2">
                <div className="flex items-center justify-between"><span className={labelClass}>Campos, regras e variáveis</span><button type="button" onClick={() => { const id = \`question-\${Date.now()}\`; updateSelectedForm({ questions: [...selectedForm.questions, { id, fieldKey: '', label: 'Novo campo', fieldType: 'text', expectedAnswer: '', required: false, validation: {} }] }); setSelectedQuestionId(id); }} className={\`\${actionClass} border-[#286a4d] bg-[#337959] text-white\`}><Plus className="h-3 w-3" />Adicionar campo</button></div>
                <div className="grid gap-2 lg:grid-cols-[.78fr_1.22fr]">
                  <div className="max-h-[430px] overflow-y-auto rounded-xl border border-slate-300 bg-[var(--portal-surface-layer-2)] p-2">
                    {selectedForm.questions.map((question, index) => <button key={question.id} type="button" onClick={() => setSelectedQuestionId(question.id)} className={\`mb-1 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left \${(selectedQuestionId || selectedForm.questions[0]?.id) === question.id ? 'border-[#286a4d] bg-[#337959] text-white' : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'}\`}><span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-current/20 bg-white/15 text-[9px] font-black">{index + 1}</span><span className="min-w-0 flex-1"><strong className="block truncate text-[10px]">{question.label || 'Campo sem título'}</strong><span className="block truncate text-[8.5px] opacity-75">{question.fieldKey || 'sem variável'} · {question.fieldType}</span></span></button>)}
                  </div>
                  <div className="min-w-0">{(() => { const index = Math.max(0, selectedForm.questions.findIndex((item) => item.id === selectedQuestionId)); const question = selectedForm.questions[index] || selectedForm.questions[0]; if (!question) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">Adicione um campo para iniciar a edição.</div>; return <div className="space-y-1"><div className="flex justify-end gap-1"><button type="button" className="portal-action" disabled={index===0} onClick={()=>moveSelectedFormQuestion(index,-1)} aria-label={\`Mover \${question.label} para cima\`}>↑</button><button type="button" className="portal-action" disabled={index===selectedForm.questions.length-1} onClick={()=>moveSelectedFormQuestion(index,1)} aria-label={\`Mover \${question.label} para baixo\`}>↓</button></div><FormQuestionEditor question={question} index={index} variables={matrixColumns} previousQuestions={selectedForm.questions.slice(0, index)} onChange={(updates) => updateSelectedForm({ questions: selectedForm.questions.map((item) => item.id === question.id ? { ...item, ...updates } : item) })} onDelete={() => { updateSelectedForm({ questions: selectedForm.questions.filter((item) => item.id !== question.id) }); setSelectedQuestionId(selectedForm.questions.find((item) => item.id !== question.id)?.id || ''); }}/></div>; })()}</div>
                </div>
              </div>`;
replaceOnce('src/components/IntegrationStudioPanel.tsx', oldFormFields, newFormFields, 'progressive form editor');

// Workflow: só a etapa selecionada expõe os detalhes; visão geral permanece sempre visível.
replaceOnce(
  'src/components/IntegrationStudioPanel.tsx',
  '<button type="button" onClick={()=>removeWorkflowStage(stage.id)} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700"><Trash2 className="h-3.5 w-3.5"/></button>',
  '<button type="button" onClick={()=>setExpandedWorkflowStageId(expandedWorkflowStageId === stage.id ? \'\' : stage.id)} className="rounded-lg border border-[#286a4d] bg-[#337959] px-2.5 py-1 text-[9px] font-black uppercase text-white">{expandedWorkflowStageId === stage.id ? \'Recolher\' : \'Editar\'}</button><button type="button" onClick={()=>removeWorkflowStage(stage.id)} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700"><Trash2 className="h-3.5 w-3.5"/></button>',
  'workflow progressive toggle',
);
replaceOnce(
  'src/components/IntegrationStudioPanel.tsx',
  '<div className="space-y-3 p-4">\n                  <div className="grid gap-3 md:grid-cols-[.8fr_1.2fr]">',
  '<div className={`${expandedWorkflowStageId === stage.id ? \'block\' : \'hidden\'} space-y-3 p-4`}>\n                  <div className="grid gap-3 md:grid-cols-[.8fr_1.2fr]">',
  'workflow collapse body',
);

// Variáveis: remover bloco passivo de sugestões e reduzir roxo fora da paleta.
replaceRegex(
  'src/components/IntegrationStudioPanel.tsx',
  /\n\s*\{similarVariableSuggestions\.length > 0 && <div className=\{`\$\{panelClass\} p-4`\}>[\s\S]*?<\/div>\}\n\s*<div className="grid gap-4 xl:grid-cols-\[\.75fr_1\.25fr\]">/,
  '\n            <div className="grid gap-4 xl:grid-cols-[.75fr_1.25fr]">',
  'remove passive variable suggestions',
);
let studio = read('src/components/IntegrationStudioPanel.tsx');
studio = studio
  .replaceAll('text-violet-700', 'text-[#337959]')
  .replaceAll('border-violet-700 bg-violet-700 text-white', 'border-[#286a4d] bg-[#337959] text-white')
  .replaceAll('border-violet-300 bg-violet-50 text-violet-800', 'border-slate-300 bg-white text-slate-800')
  .replaceAll('border-violet-200 bg-violet-50', 'border-slate-300 bg-white')
  .replaceAll('text-violet-950', 'text-slate-900')
  .replaceAll('text-violet-800', 'text-slate-700')
  .replaceAll('border-violet-500 bg-violet-50 shadow-sm', 'border-[#286a4d] bg-[#e1e6e9] shadow-sm');
write('src/components/IntegrationStudioPanel.tsx', studio);

// ---------------------------------------------------------------------------
// CSS canônico: fins de semana desaparecem no fundo; eventos legíveis;
// indicador de filtro +30%; workspaces e títulos reutilizam os mesmos tokens.
// ---------------------------------------------------------------------------
let css = read('src/portal-semantic-ui.css');
css += `\n\n/* Reforma estrutural 2026-09-26 */\n.portal-filter-color-dot {\n  display: inline-block;\n  width: 10.5px;\n  height: 10.5px;\n  flex: 0 0 10.5px;\n  border-radius: 9999px;\n  box-shadow: inset 0 0 0 1px rgba(15,23,42,.18);\n}\n.portal-core-calendar-weekend,\n.portal-calendar-empty-cell {\n  background: var(--portal-surface-layer-1) !important;\n  border-color: transparent !important;\n  box-shadow: none !important;\n}\n.portal-core-calendar-weekend:hover { background: var(--portal-surface-layer-1) !important; }\n.portal-calendar-defense-summary {\n  display: block !important;\n  white-space: normal !important;\n  overflow: visible !important;\n  text-overflow: clip !important;\n  line-height: 1.18;\n}\n.portal-calendar-defense-primary,\n.portal-calendar-defense-secondary { display: block; overflow-wrap: anywhere; }\n.portal-calendar-defense-primary { font-weight: 700; color: var(--portal-tone-text); }\n.portal-calendar-defense-secondary { margin-top: 2px; font-weight: 500; color: var(--portal-tone-text); opacity: .9; }\n.portal-settings-title-bar { color: #fff !important; }\n.portal-settings-title-bar * { color: inherit !important; }\n.portal-settings-workspace-content { color: #0f172a; }\n`;
write('src/portal-semantic-ui.css', css);

console.log('Reforma estrutural aplicada com sucesso.');
