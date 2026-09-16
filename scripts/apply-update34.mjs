import fs from 'node:fs';

function read(file){return fs.readFileSync(file,'utf8');}
function write(file,text){fs.writeFileSync(file,text);}
function replaceRequired(text,from,to,label){if(!text.includes(from))throw new Error(`Trecho não encontrado: ${label}`);return text.replace(from,to);}
function regexRequired(text,re,to,label){if(!re.test(text))throw new Error(`Padrão não encontrado: ${label}`);return text.replace(re,to);}

// Configurações: abrir editor principal diretamente e eliminar duplicações conceituais.
{
  const file='src/pages/ConfiguracoesPage.tsx'; let t=read(file);
  t=t.replace("import { AuditAndSecuritySection, AuditLogsTable, MasterAndPresidentConfigForm } from '../components/AuditAndSecuritySection';","import { AuditAndSecuritySection, AuditLogsTable } from '../components/AuditAndSecuritySection';");
  t=t.replace("import { PortalPersonalizationHubModal } from '../components/PortalPersonalizationHubModal';\n",'');
  t=t.replace("  const [personalizationHubOpen, setPersonalizationHubOpen] = useState(false);\n",'');
  t=replaceRequired(t,'onClick={() => setPersonalizationHubOpen(true)}',"onClick={() => openUnifiedEditor('quick_presets')}",'entrada direta da personalização');
  t=t.replace(/\n\s*\{personalizationHubOpen && \(\s*<PortalPersonalizationHubModal[\s\S]*?\/>\s*\)\}\n?/m,'\n');
  t=t.replace(/\n\s*\{isMasterAdmin && settings && \(\s*<MasterAndPresidentConfigForm[\s\S]*?\/>\s*\)\}\n?/m,'\n');
  write(file,t);
}

// Sincronização: Comissão uma vez, sem bloco operacional redundante, nomenclatura clara.
{
  const file='src/components/InfrastructureIntegrationsPanel.tsx'; let t=read(file);
  t=t.replace("import { CommissionIdentityPanel } from './CommissionIdentityPanel';\n",'');
  t=t.replace('    <CommissionIdentityPanel isMaster={isMaster} />\n','');
  t=t.replace("{label:'Runtime v6',ok:Boolean(status?.persistence.transactionalRuntimeReady)}","{label:'Persistência segura',ok:Boolean(status?.persistence.transactionalRuntimeReady)}");
  t=t.replace(/\n\s*<section className=\{card\} aria-label="Operação e confiabilidade">[\s\S]*?<\/section>\n\s*<div className="grid gap-3 lg:grid-cols-2">/m,'\n    <div className="grid gap-3 lg:grid-cols-2">');
  write(file,t);
}

// Editor visual: cabeçalho padronizado e navegação apenas do que existe no Portal real.
{
  const file='src/components/UnifiedPortalEditorModal.tsx'; let t=read(file);
  t=replaceRequired(t,'<div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">','<div id="portal-customization-modal-header" className="bg-[#337959] border-b border-[#2d6c50] px-4 py-3 flex items-center justify-between shrink-0 text-white">','cabeçalho do editor');
  t=replaceRequired(t,'<div className="p-2 bg-slate-100 text-slate-700 rounded-xl border border-slate-200">\n              <Palette className="w-5 h-5 text-slate-700" />\n            </div>','<div className="portal-customization-icon">\n              <Palette className="w-5 h-5 text-white" />\n            </div>','ícone do editor');
  t=t.replace('Personalização do Portal do TCC','Personalização do Portal TCC');
  t=t.replace('className="px-3 py-1.5 text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"','className="portal-customization-secondary-action px-3 py-1.5 text-xs font-black rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border"');
  t=t.replace('className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"','className="portal-customization-secondary-action px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border"');
  for(const row of [
    "              {renderNavRow('global_table_buttons', 'Botões no Topo', Square)}\n",
    "              {renderNavRow('global_table_style', 'Estilo Base Planilhas', LayoutTemplate)}\n",
    "              {renderNavRow('table_columns', 'Colunas, ordem e linhas', Columns)}\n",
    "              {renderNavRow('global_popup_style', 'Estilo Base Pop-ups', Sliders)}\n",
    "              {renderNavRow('popup_hipoar', 'Análise Hipoar', Award)}\n",
    "              {renderNavRow('popup_correction', 'Solicitação de Correção', HelpCircle)}\n",
  ]) t=t.replace(row,'');
  write(file,t);
}

// Calendário: linha única, dias brancos, células distinguíveis com tons já usados.
{
  const file='src/pages/HomePage.tsx'; let t=read(file);
  t=t.replace('className={`${defStyles.calendarDaysHeaderClass} py-2.5 px-4 sm:px-6 select-none`}','className={`${defStyles.calendarDaysHeaderClass} portal-calendar-weekdays py-2.5 px-4 sm:px-6 select-none`}');
  t=t.replace('<div className="text-rose-400">DOM</div>','<div>DOM</div>');
  t=t.replace('<div className="opacity-70">SÁB</div>','<div>SÁB</div>');
  t=t.replace("'bg-slate-100/60 text-slate-400 h-16 sm:h-20 opacity-65'","'portal-calendar-day-cell portal-calendar-weekend bg-slate-100 text-slate-400 h-16 sm:h-20'");
  t=t.replace("'bg-white hover:bg-slate-50 border-slate-200 cursor-default h-16 sm:h-20'","'portal-calendar-day-cell bg-slate-50 hover:bg-slate-100 border-slate-200 cursor-default h-16 sm:h-20'");
  write(file,t);
}

// Acesso: qualidade global é única; o papel contextual continua pertencendo a cada TCC.
{
  const file='server.ts'; let t=read(file);
  const from="const roles=requestedRole?Array.from(new Set([...(before.roles||[before.accessType||'STUDENT']),requestedRole])) as ProcessRole[]:(before.roles||[before.accessType||'STUDENT']);";
  const to="const roles=requestedRole?[requestedRole] as ProcessRole[]:([before.roles?.[0]||before.accessType||'STUDENT'] as ProcessRole[]);";
  t=replaceRequired(t,from,to,'qualidade única de acesso');
  t=t.replace("roles,accessType:(before.accessType||roles[0]),memberType","roles,accessType:roles[0],memberType");
  write(file,t);
}

// Studio: autosave, sem botão global Salvar e documentos mais enxutos.
{
  const file='src/components/IntegrationStudioPanel.tsx'; let t=read(file);
  t=t.replace('if (!validationReport.ready) {','if (withAudit && !validationReport.ready) {');
  const marker="  };\n\n  const selectedDoc =";
  if(t.includes(marker)){
    // Não é o persistSnapshot; não inserir aqui.
  }
  const persistEnd="    } finally {\n      setIsSaving(false);\n    }\n  };";
  t=replaceRequired(t,persistEnd,`${persistEnd}\n\n  useEffect(() => {\n    if (!hasHydratedRef.current || !isDirty || isSaving) return;\n    const timer = window.setTimeout(() => { void persistSnapshot(false); }, 850);\n    return () => window.clearTimeout(timer);\n  }, [isDirty, isSaving]);`,'autosave do Studio');
  t=t.replace(/\n\s*<button type="button" onClick=\{\(\) => void persistSnapshot\(true\)\}[\s\S]*?\{isSaving \? 'Salvando…' : 'Salvar'\}<\/button>/m,'');
  t=t.replace(/\n\s*<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-\[11px\] leading-5 text-slate-600">\s*<strong>Fonte oficial única\.<\/strong>[\s\S]*?<\/div>/m,'');
  t=t.replace(/\n\s*<div><label className=\{labelClass\}>Finalidade no fluxo<\/label><textarea[\s\S]*?<\/div>/m,'');
  t=t.replace(/\n\s*<button type="button" onClick=\{registerDocUpdate\}[\s\S]*?Salvar metadados do fluxo<\/button>/m,'');
  t=t.replace('className="rounded-2xl border border-slate-300 bg-slate-100 p-5 sm:p-8"','className="portal-studio-compact-card rounded-2xl border border-slate-300 bg-slate-100 p-3"');
  t=t.replace('className="mx-auto flex min-h-[420px] max-w-[720px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"','className="portal-studio-preview mx-auto flex min-h-[240px] max-w-[720px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm"');
  t=t.replace('<article className="rounded-xl border border-slate-200 bg-slate-50 p-3"','<article className="portal-studio-compact-question rounded-xl border border-slate-200 bg-slate-50 p-2"');
  write(file,t);
}

console.log('Atualização 34 aplicada aos arquivos estruturais.');
