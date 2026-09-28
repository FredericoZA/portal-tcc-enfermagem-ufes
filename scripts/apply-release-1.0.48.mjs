import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const changed = new Set();
const read = (p) => readFileSync(path.join(ROOT,p),'utf8');
const write = (p,s) => { writeFileSync(path.join(ROOT,p),s); changed.add(p); };
const must = (cond,msg) => { if(!cond) throw new Error(msg); };
const replaceExact = (p, from, to, label=from.slice(0,80)) => {
  const src=read(p); must(src.includes(from),`[${p}] padrão ausente: ${label}`); write(p,src.replace(from,to));
};
const replaceRegex = (p, rx, to, label=String(rx)) => {
  const src=read(p); must(rx.test(src),`[${p}] regex sem correspondência: ${label}`); rx.lastIndex=0; write(p,src.replace(rx,to));
};

// ---------------------------------------------------------------------------
// Release/version source of truth.
// ---------------------------------------------------------------------------
{
  const pkg=JSON.parse(read('package.json')); pkg.version='1.0.48'; write('package.json',JSON.stringify(pkg,null,2)+'\n');
  const lock=JSON.parse(read('package-lock.json')); lock.version='1.0.48'; if(lock.packages?.['']) lock.packages[''].version='1.0.48'; write('package-lock.json',JSON.stringify(lock,null,2)+'\n');
}

// ---------------------------------------------------------------------------
// Semantic palette: clearly distinct role families while remaining muted.
// ---------------------------------------------------------------------------
{
  let src=read('src/utils/portalSemanticTokens.ts');
  src=src
    .replace("student: { bg: '#eadc9b', border: '#9a7a12', text: '#44380d' }","student: { bg: '#ead89a', border: '#92720a', text: '#3f3408' }")
    .replace("board: { bg: '#e2b3ad', border: '#9a5149', text: '#472621' }","board: { bg: '#e8b6aa', border: '#a24f3f', text: '#4b241c' }")
    .replace("evaluator: { bg: '#b8d4df', border: '#4f8092', text: '#1f3d48' }","evaluator: { bg: '#aed6d0', border: '#3f8077', text: '#173d38' }")
    .replace("viewer: { bg: '#cdb9df', border: '#765493', text: '#372945' }","viewer: { bg: '#c9c1e6', border: '#6657a0', text: '#30284d' }");
  write('src/utils/portalSemanticTokens.ts',src);
}

// ---------------------------------------------------------------------------
// Global filter rule: button is neutral; ONLY the dot carries semantic color.
// ---------------------------------------------------------------------------
replaceRegex('src/utils/tableFormatters.ts',/export function getFilterChipProps\([\s\S]*?\n}\n\nexport interface PortalTablePreset/,`export function getFilterChipProps(
  key: string,
  isSelected: boolean,
  format: TableTextFormat = {},
  fallbackLabel?: string,
  fallbackEmoji?: string
) {
  const defaultConfigs = DEFAULT_TABLE_TEXT_FORMAT.filterItemsConfig || {};
  const customConfigs = format.filterItemsConfig || {};
  const itemConfig = customConfigs[key] || defaultConfigs[key] || {
    key,
    label: fallbackLabel || key.toUpperCase(),
    emoji: fallbackEmoji || '',
    dotColor: '#64748b',
    bgColor: '#ffffff',
    textColor: '#0f172a',
    borderColor: '#cbd5e1',
    badgeBgColor: '#e5e7eb',
    badgeTextColor: '#111827',
  };

  const label = itemConfig.label || fallbackLabel || key.toUpperCase();
  const semanticTone =
    resolvePortalFilterTone(key) ||
    resolvePortalFilterTone(itemConfig.key || '') ||
    resolvePortalFilterTone(label) ||
    resolvePortalFilterTone(fallbackLabel || '');
  const toneStyle = semanticTone ? getPortalToneStyle(semanticTone) : null;
  const dotColor = String(toneStyle?.borderColor || itemConfig.dotColor || '#64748b');

  return {
    label,
    emoji: '',
    dotColor,
    buttonStyle: {
      backgroundColor: isSelected ? '#AEB0B3' : '#ffffff',
      color: '#111827',
      borderColor: isSelected ? '#979a9d' : '#cbd5e1',
      opacity: 1,
      boxShadow: 'none',
    } as CSSProperties,
    badgeStyle: {
      backgroundColor: '#e5e7eb',
      color: '#111827',
    } as CSSProperties,
    mode: 'dot',
    itemConfig,
  };
}

export interface PortalTablePreset`,'substituir getFilterChipProps');

// Canonical display label: Processo (data keys remain unchanged).
{
  let src=read('src/utils/tableFormatters.ts');
  src=src.replaceAll("label: '📄 Nº Processo'","label: 'Processo'")
         .replaceAll("label: 'Nº do Processo'","label: 'Processo'")
         .replaceAll("label: 'Número do Processo'","label: 'Processo'");
  write('src/utils/tableFormatters.ts',src);
}

// Strip legacy CSS color overrides from filter chips so component semantics win.
for (const name of readdirSync('src').filter(n=>n.endsWith('.css'))) {
  const p=`src/${name}`; let src=read(p);
  src=src.replace(/([^{}]*(?:\.portal-standard-filter-chip|\.portal-table-filter-chip)[^{]*)\{([^{}]*)\}/g,(whole,selector,body)=>{
    let next=body
      .replace(/(?:background|background-color|border-color|color|opacity|box-shadow)\s*:[^;]+;?/gi,'')
      .replace(/\n\s*\n/g,'\n');
    return `${selector}{${next}}`;
  });
  // Positional legacy color rules for defense/filters must not exist.
  src=src.replace(/([^{}]*(?:portal-standard-filter-chip|portal-table-filter-chip):nth-child\([^)]*\)[^{]*)\{[^{}]*\}/g,'');
  write(p,src);
}

// Home defense filters: explicit semantic dot; button remains neutral.
{
  let src=read('src/pages/HomePage.tsx');
  src=src.replace(
    "{chip.emoji && <span>{chip.emoji}</span>}\n                              <span className=\"whitespace-nowrap\">{chip.label}</span>",
    "<span className=\"portal-filter-dot rounded-full shrink-0\" style={{ backgroundColor: chip.dotColor }} aria-hidden=\"true\" />\n                              <span className=\"whitespace-nowrap\">{chip.label}</span>"
  );
  write('src/pages/HomePage.tsx',src);
}

// Coordinator filters: neutral button / colored dot only; Envio is plain text.
{
  let src=read('src/pages/CoordenadorPage.tsx');
  src=src.replace(
    "style={{ backgroundColor: semanticTone.bg, color: semanticTone.text, borderColor: semanticTone.border, opacity: isSelected ? 1 : 0.62, boxShadow: isSelected ? `inset 0 0 0 1px ${semanticTone.border}` : 'none' }}",
    "style={chip.buttonStyle}"
  );
  src=src.replace(
    "<span className=\"text-[9px] px-1.5 py-0.2 rounded-full font-black shadow-2xs\" style={{ backgroundColor: semanticTone.border, color: '#ffffff' }}>{filter.count}</span>",
    "<span className=\"text-[9px] px-1.5 py-0.2 rounded-full font-black bg-slate-200 text-slate-900\">{filter.count}</span>"
  );
  src=src.replace(
`                return (
                  <span className={\`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black uppercase \${signatureStatus.tone}\`}>
                    {signatureStatus.label}
                  </span>
                );`,
`                return <span className="text-[9px] font-semibold text-slate-700">{signatureStatus.label}</span>;`
  );
  src=src.replace(
`                <>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 rounded-full select-none leading-none">
                    🟢 Enviada
                  </span>
                  <span className="text-[9.5px] text-emerald-800 font-bold flex items-center gap-0.5 select-none leading-none">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" /> Publicada
                  </span>
                </>`,
`                <span className="text-[9px] font-semibold text-slate-700">Assinada</span>`
  );
  write('src/pages/CoordenadorPage.tsx',src);
}

// ---------------------------------------------------------------------------
// Footer: names visibly centered; e-mails remain hidden and copied on click.
// ---------------------------------------------------------------------------
{
  let src=read('src/components/Footer.tsx');
  src=src.replace('className="inline-flex max-w-full items-center justify-center gap-1 rounded px-1 text-center font-bold', 'className="inline-flex w-full max-w-full items-center justify-center gap-1 rounded px-1 text-center font-bold');
  src=src.replace('className="font-bold">{name}</span>', 'className="block w-full text-center font-bold">{name}</span>');
  src=src.replace('className="mt-1 grid items-start gap-x-4 gap-y-1 text-center sm:grid-cols-2"','className="mt-1 grid items-start justify-items-center gap-x-4 gap-y-1 text-center sm:grid-cols-2"');
  write('src/components/Footer.tsx',src);
}

// ---------------------------------------------------------------------------
// Access backend: any valid email; multiple TCCs per student; participant links
// remain the authorization source through synchronizeProcessParticipants.
// ---------------------------------------------------------------------------
{
  let src=read('server.ts');
  src=src.replace(
    "const profile=resolveInstallationProfile(currentSettings);const invalid=normalized.filter(record=>!record.nome||!isValidPortalEmail(record.email)||!emailMatchesDomains(record.email,profile.studentEmailDomains)||duplicateEmails.has(record.email));",
    "const invalid=normalized.filter(record=>!record.nome||!isValidPortalEmail(record.email)||duplicateEmails.has(record.email));"
  );
  src=src.replace("'Nome, e-mail institucional ou domínio inválido'","'Nome ou e-mail inválido'");
  src=src.replace(/\s*const studentEmails=\[aluno1Email,aluno2\?\.email\?normalizeEmail\(aluno2\.email\):''\]\.filter\(Boolean\);const installationProfile=resolveInstallationProfile\(currentSettings\);\s*if\(studentEmails\.some\(email=>!emailMatchesDomains\(email,installationProfile\.studentEmailDomains\)\)\)return res\.status\(400\)\.json\(\{error:`Os alunos autores devem usar um dos domínios institucionais configurados: \$\{installationProfile\.studentEmailDomains\.join\(', '\)\}\.`\}\);\s*const existingTcc=processesStore\.find\(process=>studentEmails\.some\(email=>\[process\.aluno1\.email,process\.aluno2\?\.email\]\.filter\(Boolean\)\.map\(normalizeEmail\)\.includes\(email\)\)\);\s*if \(existingTcc\) \{\s*return res\.status\(409\)\.json\(\{\s*error: `Cada aluno pode autuar apenas um TCC\. Já existe o processo \$\{existingTcc\.protocolo\}\.`\s*\}\);\s*\}/g,'');
  src=src.replace(/\s*\{const studentEmails=\[updated\.aluno1\.email,updated\.aluno2\?\.email\]\.filter\(Boolean\)\.map\(email=>normalizeEmail\(String\(email\)\)\);const profile=resolveInstallationProfile\(currentSettings\);if\(studentEmails\.some\(email=>!emailMatchesDomains\(email,profile\.studentEmailDomains\)\)\)return res\.status\(400\)\.json\(\{error:`Os alunos autores devem usar os domínios institucionais configurados: \$\{profile\.studentEmailDomains\.join\(', '\)\}\.`\}\);const conflict=processesStore\.find\(process=>process\.id!==existing\.id&&studentEmails\.some\(email=>\[process\.aluno1\.email,process\.aluno2\?\.email\]\.filter\(Boolean\)\.map\(value=>normalizeEmail\(String\(value\)\)\)\.includes\(email\)\)\);if\(conflict\)return res\.status\(409\)\.json\(\{error:`Cada aluno pode participar como autor de apenas um TCC\. Já existe o processo \$\{conflict\.protocolo\}\.`\}\);\}/g,'');
  src=src.replace(/\s*const duplicateStudentEmail = \[aluno1Email, aluno2Email\][\s\S]*?code: 'STUDENT_TCC_ALREADY_EXISTS'\s*\}\);\s*\}/g,'');
  write('server.ts',src);
}

// ---------------------------------------------------------------------------
// Reservation e-mail: runtime consumes the configured destination/subject/body.
// ---------------------------------------------------------------------------
{
  let src=read('server.ts');
  const needle="sendEmail:async({template,to,subject,text,html,eventVariables,idempotencyKey})=>{const templateId=String(template.id||'');const attachments=await resolveWorkflowEmailAttachments(process,template);const records=[];";
  must(src.includes(needle),'server.ts: callback sendEmail não localizado');
  const replacement="sendEmail:async({template,to,subject,text,html,eventVariables,idempotencyKey})=>{const templateId=String(template.id||'');const reservation=operationalConfig(studio).reservation;const configuredRecipient=normalizeEmail(reservation.departmentEmail||'');const isReservationRequest=eventCode==='TCC_CREATED'&&Boolean(configuredRecipient)&&to.some(recipient=>normalizeEmail(recipient)===configuredRecipient);const resolvedSubject=isReservationRequest&&reservation.emailSubject?mergeWorkflowVariables(reservation.emailSubject,effectiveVariables):subject;const resolvedText=isReservationRequest&&reservation.emailBody?mergeWorkflowVariables(reservation.emailBody,effectiveVariables):text;const resolvedHtml=isReservationRequest&&reservation.emailBody?undefined:html;const attachments=await resolveWorkflowEmailAttachments(process,template);const records=[];";
  src=src.replace(needle,replacement);
  src=src.replace("records.push(await sendTrackedPortalEmail({process,recipient,subject,text,html,templateId,workflowEventCode:eventCode,workflowEventVariables:eventVariables,idempotencyKey:`${idempotencyKey}:${recipient}`,attachments}));","records.push(await sendTrackedPortalEmail({process,recipient,subject:resolvedSubject,text:resolvedText,html:resolvedHtml,templateId,workflowEventCode:eventCode,workflowEventVariables:eventVariables,idempotencyKey:`${idempotencyKey}:${recipient}`,attachments}));");
  write('server.ts',src);
}

// ---------------------------------------------------------------------------
// Commission identity: remove duplicated admin-transfer UI and refresh shared
// settings after every successful autosave to prevent stale overwrite/F5 loss.
// ---------------------------------------------------------------------------
{
  let src=read('src/components/CommissionIdentityPanel.tsx');
  src=src.replace("import { Mail, Plus, Save, Trash2, UserRoundCog, Users } from 'lucide-react';","import { Mail, Plus, Save, Trash2, Users } from 'lucide-react';");
  src=src.replace(/\n\s*const \[presidentTransferEmail[\s\S]*?const \[transferring[^\n]*\n/,'\n');
  src=src.replace(/\n\s*const startTransfer = async[\s\S]*?\n\s*};\n/,'\n');
  src=src.replace(/\n\s*<details className="portal-president-master-transfer[\s\S]*?<\/details>/,'');
  src=src.replace('if (manual) await refreshAuth();','await refreshAuth();');
  src=src.replace('className="portal-commission-identity-panel overflow-hidden rounded-xl border border-slate-300 shadow-sm"','className="portal-commission-identity-panel overflow-hidden"');
  write('src/components/CommissionIdentityPanel.tsx',src);
}

// ---------------------------------------------------------------------------
// Settings shell: direct, single-purpose modal, no internal sidebar and no X.
// ESC/backdrop close remain available.
// ---------------------------------------------------------------------------
write('src/components/SettingsWorkspaceModal.tsx',`import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SettingsWorkspaceSection {
  id: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

interface SettingsWorkspaceModalProps {
  open: boolean;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  sections: SettingsWorkspaceSection[];
  sectionId?: string;
  onClose: () => void;
}

type EmbeddedCapableProps = { embedded?: boolean };
const SettingsWorkspaceHeaderHostContext = createContext<HTMLDivElement | null>(null);
export const SettingsWorkspaceHeaderPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const host = useContext(SettingsWorkspaceHeaderHostContext);
  return host ? createPortal(children, host) : null;
};

export const SettingsWorkspaceModal: React.FC<SettingsWorkspaceModalProps> = ({ open, title, icon: TitleIcon, sections, sectionId, onClose }) => {
  const [headerHost, setHeaderHost] = useState<HTMLDivElement | null>(null);
  const current = useMemo(() => sections.find(section => section.id === sectionId) || sections[0], [sections, sectionId]);
  useEffect(() => {
    if (!open) setHeaderHost(null);
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open || !current) return null;
  const content = React.isValidElement(current.content)
    ? React.cloneElement(current.content as React.ReactElement<EmbeddedCapableProps>, { embedded: true })
    : current.content;
  return <div className="fixed inset-0 z-[1000005] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="portal-settings-workspace flex max-h-[94vh] w-full max-w-[1600px] flex-col overflow-hidden rounded-2xl border border-slate-300 shadow-2xl" style={{ backgroundColor: 'var(--portal-surface-page)' }}>
      <header className="portal-settings-workspace-header flex min-h-[58px] items-center justify-between gap-3 border-b-[16px] border-white px-4 py-3 text-white" style={{ backgroundColor: 'var(--portal-green-header)' }}>
        <div className="flex min-w-0 items-center gap-2">{TitleIcon && <TitleIcon className="h-5 w-5 shrink-0"/>}<h2 className="truncate text-sm font-black uppercase tracking-wide">{title}</h2></div>
        <div ref={setHeaderHost} className="flex min-w-0 flex-wrap items-center justify-end gap-1.5" data-settings-workspace-header-actions="true" />
      </header>
      <SettingsWorkspaceHeaderHostContext.Provider value={headerHost}>
        <main className="portal-settings-single-pane min-w-0 flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--portal-surface-layer-1)' }}>{content}</main>
      </SettingsWorkspaceHeaderHostContext.Provider>
    </section>
  </div>;
};
`);

// ---------------------------------------------------------------------------
// Reservation configuration is a first-class part of Integrations.
// ---------------------------------------------------------------------------
write('src/components/ReservationEmailConfigPanel.tsx',`import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import { operationalConfig } from '../utils/operationalConfig';

export const ReservationEmailConfigPanel: React.FC<{ isMaster: boolean }> = ({ isMaster }) => {
  const { settings, refreshAuth } = useAuth();
  const config = useMemo(() => operationalConfig(settings?.integrationStudio), [settings?.integrationStudio]);
  const [recipientName,setRecipientName]=useState(config.reservation.recipientName||'');
  const [departmentEmail,setDepartmentEmail]=useState(config.reservation.departmentEmail||'');
  const [emailSubject,setEmailSubject]=useState(config.reservation.emailSubject||'');
  const [emailBody,setEmailBody]=useState(config.reservation.emailBody||'');
  const [locationsText,setLocationsText]=useState(config.reservation.locations.join('\n'));
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{setRecipientName(config.reservation.recipientName||'');setDepartmentEmail(config.reservation.departmentEmail||'');setEmailSubject(config.reservation.emailSubject||'');setEmailBody(config.reservation.emailBody||'');setLocationsText(config.reservation.locations.join('\n'));},[config]);
  if(!isMaster)return null;
  const save=async()=>{
    if(!departmentEmail.trim()||!/^\\S+@\\S+\\.\\S+$/.test(departmentEmail.trim())){setMessage('Informe um e-mail de destino válido.');return;}
    setSaving(true);setMessage('');
    try{
      const currentStudio=settings?.integrationStudio||{};
      const currentConfig=operationalConfig(currentStudio);
      const reservation={...currentConfig.reservation,recipientName:recipientName.trim(),departmentEmail:departmentEmail.trim(),emailSubject:emailSubject.trim(),emailBody,locations:locationsText.split(/\\r?\\n/).map(v=>v.trim()).filter(Boolean)};
      await apiClient.updateSettings({integrationStudio:{...currentStudio,operationalConfig:{...currentConfig,reservation}}} as any);
      await refreshAuth();setMessage('Configuração do pedido de reserva salva.');
    }catch(error){setMessage(error instanceof Error?error.message:'Falha ao salvar a configuração.');}
    finally{setSaving(false);}
  };
  const field='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#337959]';
  return <section className="mt-3 overflow-hidden rounded-xl border border-slate-300" style={{backgroundColor:'var(--portal-surface-layer-2)'}}>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 px-3 py-2"><div><h3 className="flex items-center gap-1.5 text-[11px] font-black uppercase text-slate-950"><Mail className="h-4 w-4 text-[#337959]"/>Solicitação de espaço físico</h3><p className="mt-0.5 text-[9px] text-slate-600">Destino e conteúdo usados pelo fluxo real quando um TCC é cadastrado.</p></div><button type="button" onClick={()=>void save()} disabled={saving} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 text-[9px] font-black uppercase text-slate-900"><Save className="h-3.5 w-3.5"/>{saving?'Salvando…':'Salvar'}</button></div>
    <div className="grid gap-3 p-3 md:grid-cols-2" style={{backgroundColor:'var(--portal-surface-inner)'}}>
      <label className="text-[10px] font-bold text-slate-700">Destinatário<input className={field} value={recipientName} onChange={e=>setRecipientName(e.target.value)} placeholder="Departamento de Enfermagem"/></label>
      <label className="text-[10px] font-bold text-slate-700">E-mail de solicitação de espaço físico<input className={field} type="email" value={departmentEmail} onChange={e=>setDepartmentEmail(e.target.value)} placeholder="destino@instituicao.br"/></label>
      <label className="text-[10px] font-bold text-slate-700 md:col-span-2">Assunto<input className={field} value={emailSubject} onChange={e=>setEmailSubject(e.target.value)} placeholder="Solicitação de reserva — {{TITULO}}"/></label>
      <label className="text-[10px] font-bold text-slate-700 md:col-span-2">Texto do e-mail<textarea className={field} rows={7} value={emailBody} onChange={e=>setEmailBody(e.target.value)}/></label>
      <label className="text-[10px] font-bold text-slate-700 md:col-span-2">Locais disponíveis — um por linha<textarea className={field} rows={4} value={locationsText} onChange={e=>setLocationsText(e.target.value)}/></label>
      <p className="md:col-span-2 text-[9px] text-slate-600">Variáveis: {{TITULO}}, {{ALUNOS_NOMES}}, {{ORIENTADOR_NOME}}, {{DEFESA_DATA_HORA}}, {{DEFESA_LOCAL}} e {{LOCAL_ALTERNATIVO}}.</p>
      {message&&<p role="status" className="md:col-span-2 text-[10px] font-semibold text-slate-700">{message}</p>}
    </div>
  </section>;
};
`);

// ---------------------------------------------------------------------------
// Configurations hub: direct rows. Models=>6, Synchronization=>2. Each row
// opens exactly one section through sectionId (no lateral navigation).
// ---------------------------------------------------------------------------
{
  let src=read('src/pages/ConfiguracoesPage.tsx');
  src=src.replace("import { InfrastructureIntegrationsPanel } from '../components/InfrastructureIntegrationsPanel';","import { InfrastructureIntegrationsPanel } from '../components/InfrastructureIntegrationsPanel';\nimport { ReservationEmailConfigPanel } from '../components/ReservationEmailConfigPanel';");
  src=src.replace(
    "const [activeSettingsPanel, setActiveSettingsPanel] = useState<'sync' | 'access' | 'models' | 'signatures' | 'logs' | null>(null);",
    "const [activeSettingsPanel, setActiveSettingsPanel] = useState<'sync' | 'access' | 'models' | 'signatures' | 'logs' | null>(null);\n  const [activeSettingsSection, setActiveSettingsSection] = useState<string | null>(null);"
  );
  const oldItems=`{ id: 'personalization', title: 'Personalização do Portal', text: 'Aparência, navegação, páginas, tabelas e pop-ups.', icon: Palette },
              { id: 'sync', title: 'Sincronização', text: 'Rodapé, Asten, Google, Supabase, Vercel e demais integrações.', icon: Sliders },
              { id: 'access', title: 'Acesso', text: 'Autorizações e pessoas com acesso ao Portal.', icon: Lock },
              { id: 'models', title: 'Modelos e Variáveis', text: 'Documentos, e-mails, formulários, fluxos e variáveis.', icon: Layers },
              { id: 'signatures', title: 'Registros de Assinatura', text: 'Fila, método, situação e histórico de assinatura.', icon: FileCheck2 },
              { id: 'logs', title: 'Registro de Logs', text: 'Auditoria, histórico técnico e rastreabilidade.', icon: ClipboardList },`;
  const newItems=`{ id: 'personalization', panel: null, section: null, title: 'Personalização do Portal', text: 'Aparência, navegação, páginas, tabelas e pop-ups.', icon: Palette },
              { id: 'models', panel: 'models', section: 'models-catalog', title: 'Modelos', text: 'Catálogo de modelos documentais oficiais.', icon: FileText },
              { id: 'documents', panel: 'models', section: 'documents', title: 'Documentos', text: 'Variáveis, conteúdo e pré-visualização dos documentos.', icon: FileText },
              { id: 'emails', panel: 'models', section: 'emails', title: 'E-mails', text: 'Modelos, destinatários, anexos e pré-visualização.', icon: Mail },
              { id: 'forms', panel: 'models', section: 'forms', title: 'Formulários', text: 'Campos, opções, validações e prévia.', icon: ClipboardList },
              { id: 'workflow', panel: 'models', section: 'workflow', title: 'Fluxos', text: 'Etapas e ações do fluxo operacional.', icon: Layers },
              { id: 'variables', panel: 'models', section: 'variables', title: 'Variáveis', text: 'Definições canônicas, usos, mescla e propagação.', icon: Sliders },
              { id: 'identity', panel: 'sync', section: 'identity', title: 'Rodapé e identidade', text: 'Presidência, secretaria, comissão e contatos do Portal.', icon: Building2 },
              { id: 'integrations', panel: 'sync', section: 'integrations', title: 'Integrações e plataformas', text: 'Asten, Google, Supabase, Vercel e reserva de espaço físico.', icon: Globe },
              { id: 'access', panel: 'access', section: 'authorizations', title: 'Acesso', text: 'Autorizações e pessoas com acesso ao Portal.', icon: Lock },
              { id: 'signatures', panel: 'signatures', section: 'signature-ledger', title: 'Registros de Assinatura', text: 'Quem assinou, qual documento, quando e situação do fluxo.', icon: FileCheck2 },
              { id: 'logs', panel: 'logs', section: 'audit-ledger', title: 'Registro de Logs', text: 'Auditoria, histórico técnico e rastreabilidade.', icon: ClipboardList },`;
  must(src.includes(oldItems),'ConfiguracoesPage: itens antigos do hub não encontrados');
  src=src.replace(oldItems,newItems);
  src=src.replace("].map(({ id, title, text, icon: Icon }) => (","].map(({ id, panel, section, title, text, icon: Icon }) => (");
  src=src.replace("onClick={() => id === 'personalization' ? setPersonalizationHubOpen(true) : setActiveSettingsPanel(id as any)}","onClick={() => { if (id === 'personalization') { setPersonalizationHubOpen(true); return; } setActiveSettingsSection(section); setActiveSettingsPanel(panel as any); }}");
  src=src.replace("title={activeSettingsPanel === 'sync' ? 'Sincronização' : activeSettingsPanel === 'access' ? 'Acesso' : activeSettingsPanel === 'models' ? 'Modelos e Variáveis' : activeSettingsPanel === 'signatures' ? 'Registros de Assinatura' : 'Registro de Logs'}",
  "title={activeSettingsSection === 'identity' ? 'Rodapé e identidade' : activeSettingsSection === 'integrations' ? 'Integrações e plataformas' : activeSettingsSection === 'models-catalog' ? 'Modelos' : activeSettingsSection === 'documents' ? 'Documentos' : activeSettingsSection === 'emails' ? 'E-mails' : activeSettingsSection === 'forms' ? 'Formulários' : activeSettingsSection === 'workflow' ? 'Fluxos' : activeSettingsSection === 'variables' ? 'Variáveis' : activeSettingsPanel === 'access' ? 'Acesso' : activeSettingsPanel === 'signatures' ? 'Registros de Assinatura' : 'Registro de Logs'}");
  src=src.replace("onClose={() => setActiveSettingsPanel(null)}","onClose={() => { setActiveSettingsPanel(null); setActiveSettingsSection(null); }}\n              sectionId={activeSettingsSection || undefined}");
  src=src.replace("{ id: 'integrations', label: 'Integrações e plataformas', description: 'Asten, Google, Supabase, Vercel e serviços externos.', icon: Globe, content: <InfrastructureIntegrationsPanel isMaster /> },",
    "{ id: 'integrations', label: 'Integrações e plataformas', description: 'Asten, Google, Supabase, Vercel e serviços externos.', icon: Globe, content: <div className=\"p-3\"><InfrastructureIntegrationsPanel isMaster /><ReservationEmailConfigPanel isMaster /></div> },");
  write('src/pages/ConfiguracoesPage.tsx',src);
}

// ---------------------------------------------------------------------------
// Remove duplicated reservation editor from the workflow workshop; settings is
// the canonical administration surface. Keep real-form/catalog actions.
// ---------------------------------------------------------------------------
{
  let src=read('src/components/OperationalDesignerPanel.tsx');
  src=src.replace(/\n\s*const changeReservation = \(updates: Partial<OperationalConfig\['reservation'\]>\) => onChange\([^\n]+\);/,'');
  src=src.replace(/<div className="mt-4 grid gap-4 md:grid-cols-2">[\s\S]*?<\/div>\n\s*<div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">[\s\S]*?<\/div>/,
    '<p className="mt-4 text-sm text-slate-700">Destinatário, assunto, texto do pedido de reserva e locais disponíveis são administrados em Configurações → Integrações e plataformas.</p>');
  write('src/components/OperationalDesignerPanel.tsx',src);
}

// ---------------------------------------------------------------------------
// Access modal polish: no X; ESC/backdrop close; toolbar pills are consistent.
// ---------------------------------------------------------------------------
{
  let src=read('src/components/AuthorizedStudentsPanel.tsx');
  src=src.replace(/\n\s*X,\n/,'\n');
  src=src.replace("const whiteButton = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg", "const whiteButton = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full");
  src=src.replace(/function CompactModal\(\{ title, onClose, children \}: \{ title: string; onClose: \(\) => void; children: React\.ReactNode \}\) \{[\s\S]*?\n\}/,`function CompactModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  React.useEffect(() => { const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();}; window.addEventListener('keydown',onKey); return()=>window.removeEventListener('keydown',onKey); }, [onClose]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000012] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-3xl overflow-hidden rounded-xl border border-slate-300 shadow-2xl" style={{ backgroundColor: 'var(--portal-surface-layer-1)' }}>
        <div className="border-b-[16px] border-white px-3 py-2 text-white" style={{ backgroundColor: 'var(--portal-green-header)' }}><h3 className="text-xs font-black uppercase tracking-wide">{title}</h3></div>
        <div className="max-h-[78vh] overflow-y-auto p-3">{children}</div>
      </div>
    </div>, document.body,
  );
}`);
  write('src/components/AuthorizedStudentsPanel.tsx',src);
}

// Audit log polish.
{
  let src=read('src/pages/AuditLogsPage.tsx');
  src=src.replace("const whiteButton = 'inline-flex min-h-8 items-center gap-1.5 rounded-lg", "const whiteButton = 'inline-flex min-h-8 items-center gap-1.5 rounded-full");
  src=src.replace('<span className="inline-flex rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-black uppercase">{log.action || \'—\'}</span>','<span className="text-[10px] font-semibold uppercase text-slate-900">{log.action || \'—\'}</span>');
  src=src.replace('<div className="portal-audit-toolbar flex flex-wrap items-center justify-end gap-1.5">\n    <button type="button" onClick={() => void downloadBackup()} className={whiteButton}><Download className="h-3.5 w-3.5"/>Backup</button>\n    <button type="button" onClick={() => restoreInputRef.current?.click()} className={whiteButton}><Upload className="h-3.5 w-3.5"/>Restaurar</button>', '<div className="portal-audit-toolbar flex flex-wrap items-center justify-end gap-1.5">\n    <div className="mr-1 flex items-center gap-1.5 border-r border-white/50 pr-2">\n      <button type="button" onClick={() => void downloadBackup()} className={whiteButton}><Download className="h-3.5 w-3.5"/>Backup</button>\n      <button type="button" onClick={() => restoreInputRef.current?.click()} className={whiteButton}><Upload className="h-3.5 w-3.5"/>Restaurar</button>\n    </div>');
  src=src.replace('<div className="overflow-x-auto bg-white">','<div className="max-h-[70vh] overflow-auto bg-white">');
  write('src/pages/AuditLogsPage.tsx',src);
}

// Signature ledger: never infer signedAt from archive/completion timestamp.
{
  let src=read('src/pages/AstenLogsPage.tsx');
  src=src.replace("if (key === 'signedAt') return dateTime(job.signedAt || job.completedAt);","if (key === 'signedAt') return dateTime(job.signedAt);");
  src=src.replace("if (key === 'completedAt') return dateTime(job.completedAt || job.signedAt);","if (key === 'completedAt') return dateTime(job.completedAt);");
  src=src.replace("{ key: 'completedAt', label: 'Concluído em' },","{ key: 'completedAt', label: 'Concluído / arquivado em' },");
  write('src/pages/AstenLogsPage.tsx',src);
}

// ---------------------------------------------------------------------------
// 1.0.48 visual foundation: one surface system, no legacy full-color filters,
// consistent round admin toolbar actions and centered footer commission names.
// ---------------------------------------------------------------------------
write('src/portal-release-1048.css',`/* Portal TCC 1.0.48 — finalização estrutural. */
:root{--portal-release:1.0.48;}
.portal-standard-filter-chip,.portal-table-filter-chip{background:#fff!important;border-color:#cbd5e1!important;color:#111827!important;opacity:1!important;box-shadow:none!important;}
.portal-standard-filter-chip[aria-pressed="true"],.portal-table-filter-chip[data-selected="true"],.portal-table-filter-chip[aria-pressed="true"]{background:#AEB0B3!important;border-color:#979a9d!important;color:#111827!important;}
.portal-filter-dot{width:.65rem!important;height:.65rem!important;min-width:.65rem!important;min-height:.65rem!important;flex:0 0 .65rem!important;}
.portal-semantic-tone{background:var(--portal-tone-bg)!important;border-color:var(--portal-tone-border)!important;color:var(--portal-tone-text)!important;}
#home-page-footer-notes .grid>div,#home-page-footer-notes [class*="member"]{text-align:center!important;justify-items:center!important;}
#home-page-footer-notes button[aria-label^="Copiar e-mail"]{justify-content:center!important;text-align:center!important;}
.portal-settings-workspace main{background:var(--portal-surface-layer-1)!important;}
.portal-settings-single-pane>[data-embedded="true"]{border:0!important;border-radius:0!important;box-shadow:none!important;}
.portal-settings-single-pane .portal-spreadsheet-table thead th{background:var(--portal-green-header)!important;color:#fff!important;}
.portal-settings-workspace-header button,.portal-audit-toolbar button,[data-settings-workspace-header-actions="true"] button{border-radius:9999px!important;}
#coordenador-page-root td:nth-child(2) span{background:transparent!important;border-color:transparent!important;color:#334155!important;box-shadow:none!important;}
`);

// Import release CSS last.
{
  let src=read('src/main.tsx');
  const importLine="import './portal-release-1048.css';";
  if(!src.includes(importLine)) src=src.replace(/(import ['"]\.\/portal-version-1046\.css['"];?)/,`$1\n${importLine}`);
  if(!src.includes(importLine)) src=`${importLine}\n${src}`;
  write('src/main.tsx',src);
}

// ---------------------------------------------------------------------------
// Release-specific regression contracts.
// ---------------------------------------------------------------------------
write('server/release1048CompletionContract.test.ts',`import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');

test('1.0.48 usa estado temporal único e filtro com apenas bolinha colorida',()=>{
  const semantics=read('src/utils/defenseSemantics.ts');
  const formatters=read('src/utils/tableFormatters.ts');
  assert.match(semantics,/start < now \? 'defended' : 'upcoming'/);
  assert.match(formatters,/mode: 'dot'/);
  assert.match(formatters,/backgroundColor: isSelected \? '#AEB0B3' : '#ffffff'/);
});

test('1.0.48 remove domínio institucional e limite de um TCC por aluno',()=>{
  const server=read('server.ts');
  const importRoute=server.slice(server.indexOf("app.post('/api/admin/access-list/import'"),server.indexOf("app.post('/api/admin/access-list/import'")+6000);
  assert.doesNotMatch(importRoute,/emailMatchesDomains/);
  assert.doesNotMatch(server,/Cada aluno pode autuar apenas um TCC/);
  assert.doesNotMatch(server,/Cada aluno pode participar como autor de apenas um TCC/);
  assert.doesNotMatch(server,/STUDENT_TCC_ALREADY_EXISTS/);
});

test('1.0.48 Configurações abre funções diretamente sem navegação lateral',()=>{
  const page=read('src/pages/ConfiguracoesPage.tsx');
  const modal=read('src/components/SettingsWorkspaceModal.tsx');
  for(const title of ['Modelos','Documentos','E-mails','Formulários','Fluxos','Variáveis','Rodapé e identidade','Integrações e plataformas','Acesso','Registros de Assinatura','Registro de Logs']) assert.ok(page.includes(\`title: '\${title}'\`));
  assert.doesNotMatch(modal,/>Navegação</);
  assert.doesNotMatch(modal,/lucide-react.*X/);
});

test('1.0.48 e-mail de reserva é configurável e consumido no runtime',()=>{
  const server=read('server.ts');
  const panel=read('src/components/ReservationEmailConfigPanel.tsx');
  assert.match(panel,/E-mail de solicitação de espaço físico/);
  assert.match(server,/resolvedSubject/);
  assert.match(server,/reservation\.emailBody/);
});

test('1.0.48 não falsifica horário de assinatura',()=>{
  const logs=read('src/pages/AstenLogsPage.tsx');
  assert.match(logs,/signedAt'\) return dateTime\(job\.signedAt\)/);
  assert.doesNotMatch(logs,/job\.signedAt \|\| job\.completedAt/);
});

test('versão da release é 1.0.48',()=>{
  assert.equal(JSON.parse(read('package.json')).version,'1.0.48');
});
`);

// Update stale finalization contract expectations that explicitly require old behavior.
{
  let src=read('scripts/test-finalization-contract.mjs');
  src=src.replace("assert.match(server, /STUDENT_TCC_ALREADY_EXISTS/);","assert.doesNotMatch(server, /STUDENT_TCC_ALREADY_EXISTS/);");
  write('scripts/test-finalization-contract.mjs',src);
}

console.log(`1.0.48 migrada. Arquivos alterados: ${[...changed].sort().join(', ')}`);
