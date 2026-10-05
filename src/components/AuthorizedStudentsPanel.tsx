import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { AuthorizedStudent, ProcessRole } from '../types';
import {
  parseStudentImportFile,
  parseStudentImportText,
  studentImportTemplateGoogleSheetsTsv,
  studentImportTemplateXlsx,
  type StudentImportRow,
} from '../utils/studentImport';
import { portalConfirm, portalNotice } from '../services/portalDialogs';
import { SearchPopover } from './SearchPopover';
import { HeaderSettingsPopover } from './HeaderSettingsPopover';
import { TableScrollWrapper } from './TableScrollWrapper';
import { loadTableConfig, type ColumnDef } from './TableColumnSelectorPanel';
import { loadGlobalTableConfig, type TableTextFormat } from '../utils/tableFormatters';
import { SettingsWorkspaceHeaderPortal } from './SettingsWorkspaceModal';

const whiteButton = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-white bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-50';
const inputClass = 'w-full min-h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 outline-none focus:border-slate-400';

const roleLabels: Record<ProcessRole, string> = {
  STUDENT: 'Aluno',
  ADVISOR: 'Orientador',
  CO_ADVISOR: 'Coorientador',
  EXAMINER: 'Membro da banca',
};
const roles: ProcessRole[] = ['STUDENT', 'ADVISOR', 'CO_ADVISOR', 'EXAMINER'];
function administrativeRole(entry: AuthorizedStudent): ProcessRole { return (entry.accessType || entry.roles?.[0] || 'STUDENT') as ProcessRole; }

const ACCESS_COLUMNS: ColumnDef[] = [
  { key: 'nome', label: 'Nome', isFixed: true },
  { key: 'email', label: 'E-mail' },
  { key: 'matricula', label: 'Matrícula' },
  { key: 'origin', label: 'Origem' },
  { key: 'active', label: 'Acesso' },
  { key: 'actions', label: 'Excluir' },
];
const DEFAULT_ORDER = ACCESS_COLUMNS.map((column) => column.key);
const DEFAULT_VISIBLE = Object.fromEntries(ACCESS_COLUMNS.map((column) => [column.key, true]));

function CompactModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000012] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-3xl overflow-hidden rounded-xl border border-slate-300 shadow-2xl" style={{ backgroundColor: 'var(--portal-surface-panel)' }}>
        <div className="flex items-center justify-between border-b-[16px] border-white px-3 py-2 text-white" style={{ backgroundColor: 'var(--portal-brand-header)' }}>
          <h3 className="text-xs font-black uppercase tracking-wide">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md border border-white bg-white p-1 text-slate-900 hover:bg-slate-100" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto p-3">{children}</div>
      </div>
    </div>, document.body,
  );
}

export const AuthorizedStudentsPanel: React.FC<{ canManage: boolean; embedded?: boolean }> = ({ canManage, embedded = false }) => {
  const initialConfig = loadTableConfig('authorized_access', DEFAULT_ORDER, DEFAULT_VISIBLE, 25);
  const [entries, setEntries] = useState<AuthorizedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [matricula, setMatricula] = useState('');
  const [role, setRole] = useState<ProcessRole>('STUDENT');
  const [search, setSearch] = useState('');
  const [recordsLimit, setRecordsLimit] = useState<number | 'all'>(initialConfig.recordsLimit || 25);
  const [columnOrder, setColumnOrder] = useState<string[]>(initialConfig.columnOrder || DEFAULT_ORDER);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(initialConfig.visibleColumns || DEFAULT_VISIBLE);
  const [textFormat] = useState<TableTextFormat>(() => ({ ...loadGlobalTableConfig(), ...(initialConfig.textFormat || {}) }));
  const [importRows, setImportRows] = useState<StudentImportRow[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [modal, setModal] = useState<'add' | 'list' | null>(null);

  const load = async () => {
    setLoading(true);
    try { setEntries(await apiClient.getAuthorizedStudents()); }
    catch (error) { portalNotice(error instanceof Error ? error.message : 'Falha ao carregar a lista de acesso.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const add = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try {
      await apiClient.addAuthorizedStudent({ nome, email, matricula: matricula.trim() || undefined, role });
      setNome(''); setEmail(''); setMatricula(''); setRole('STUDENT'); setModal(null); await load();
    } catch (error) { portalNotice(error instanceof Error ? error.message : 'Falha ao cadastrar acesso.'); }
    finally { setSaving(false); }
  };

  const toggle = async (entry: AuthorizedStudent) => {
    try { await apiClient.updateAuthorizedStudent(entry.id, { active: !entry.active }); await load(); }
    catch (error) { portalNotice(error instanceof Error ? error.message : 'Falha ao alterar o acesso.'); }
  };

  const changeRole = async (entry: AuthorizedStudent, nextRole: ProcessRole) => {
    if (administrativeRole(entry) === nextRole) return;
    try { await apiClient.updateAuthorizedStudent(entry.id, { role: nextRole, replaceRole: true }); await load(); }
    catch (error) { portalNotice(error instanceof Error ? error.message : 'Falha ao alterar a qualidade de acesso.'); }
  };

  const remove = async (entry: AuthorizedStudent) => {
    if (!(await portalConfirm('Excluir este acesso manual? Esta ação não remove vínculos acadêmicos de TCC.'))) return;
    try { await apiClient.deleteAuthorizedStudent(entry.id); await load(); }
    catch (error) { portalNotice(error instanceof Error ? error.message : 'Falha ao excluir o acesso.'); }
  };

  const readImport = async (file?: File) => {
    if (!file) return;
    try { setImportRows(await parseStudentImportFile(file)); }
    catch (error) { setImportRows([]); portalNotice(error instanceof Error ? error.message : 'Não foi possível ler a planilha.'); }
  };

  const readPaste = () => {
    try {
      const rows = parseStudentImportText(pasteText);
      if (!rows.length) throw new Error('Cole ao menos o cabeçalho e uma linha da planilha.');
      setImportRows(rows);
    } catch (error) { setImportRows([]); portalNotice(error instanceof Error ? error.message : 'Não foi possível interpretar os dados colados.'); }
  };

  const confirmImport = async () => {
    setSaving(true);
    try {
      await apiClient.importAuthorizedStudents(importRows);
      setImportRows([]); setPasteText(''); setModal(null); await load();
    } catch (error) { portalNotice(error instanceof Error ? error.message : 'Falha ao importar acessos.'); }
    finally { setSaving(false); }
  };

  const downloadExcelTemplate = async () => {
    try {
      const blob = await studentImportTemplateXlsx();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'modelo_lista_acesso.xlsx'; link.click(); URL.revokeObjectURL(url);
    } catch { portalNotice('Não foi possível gerar o modelo em Excel.'); }
  };

  const openGoogleSheetsTemplate = async () => {
    const sheetWindow = window.open('https://sheets.new', '_blank', 'noopener,noreferrer');
    try {
      await navigator.clipboard.writeText(studentImportTemplateGoogleSheetsTsv());
      portalNotice('O modelo foi copiado. Na planilha do Google que abriu, cole na célula A1.');
    } catch {
      if (sheetWindow) sheetWindow.close();
      portalNotice('Não foi possível copiar o modelo automaticamente. Use o modelo Excel ou copie os dados diretamente da sua planilha.');
    }
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return entries
      .filter((entry) => !term || `${entry.nome} ${entry.email} ${entry.matricula || ''} ${roleLabels[administrativeRole(entry)] || ''} ${entry.origin || ''}`.toLocaleLowerCase('pt-BR').includes(term))
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
  }, [entries, search]);
  const shown = filtered;
  const activeColumns = columnOrder.filter((key) => visibleColumns[key] !== false || key === 'nome');

  const renderCell = (entry: AuthorizedStudent, key: string) => {
    const adminRole = administrativeRole(entry);
    const canDelete = entry.origin !== 'TCC_FORM' && (entry.processIds?.length || 0) === 0;
    if (key === 'nome') return <span className="font-bold">{entry.nome}</span>;
    if (key === 'email') return <span className="break-all">{entry.email}</span>;
    if (key === 'matricula') return entry.matricula || '—';
    if (key === 'origin') return <span className="text-[9px] font-bold">{entry.origin === 'MASTER_LIST' ? 'Lista / manual' : 'Processo'}</span>;
    if (key === 'role') return canManage && entry.origin === 'MASTER_LIST'
      ? <select aria-label={`Qualidade de ${entry.nome}`} value={adminRole} onChange={(event) => void changeRole(entry, event.target.value as ProcessRole)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[9px] font-bold">{roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select>
      : <span className="text-[9px] font-bold">{roleLabels[adminRole]}</span>;
    if (key === 'active') return canManage
      ? <button type="button" onClick={() => void toggle(entry)} className={`inline-flex min-h-7 items-center gap-1 rounded-md border px-2 py-1 text-[8px] font-black uppercase ${entry.active ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-slate-100 text-slate-700'}`}>{entry.active ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}{entry.active ? 'Ativo' : 'Inativo'}</button>
      : <span className="text-[9px]">{entry.active ? 'Ativo' : 'Inativo'}</span>;
    if (key === 'actions') return canManage && canDelete
      ? <button type="button" onClick={() => void remove(entry)} className="rounded-md border border-slate-200 bg-white p-1.5 text-rose-700 hover:bg-rose-50" aria-label={`Excluir ${entry.nome}`}><Trash2 className="h-3.5 w-3.5" /></button>
      : <span className="text-slate-300">—</span>;
    return '—';
  };

  const toolbar = <div className="flex flex-wrap items-center justify-end gap-1.5">
    {canManage && <>
      <button type="button" onClick={() => setModal('add')} className={whiteButton}><Plus className="h-3.5 w-3.5" />Adicionar acesso</button>
      <button type="button" onClick={() => setModal('list')} className={whiteButton}><FileSpreadsheet className="h-3.5 w-3.5" />Envio de lista</button>
    </>}
    <SearchPopover value={search} onChange={setSearch} placeholder="Buscar por nome, e-mail ou matrícula" textFormat={textFormat}/>
    <HeaderSettingsPopover recordsLimit={recordsLimit} setRecordsLimit={setRecordsLimit} allowedLimits={[25,50,100,'all']} allColumns={ACCESS_COLUMNS} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} columnOrder={columnOrder} setColumnOrder={setColumnOrder} storageKey="authorized_access" defaultColumnOrder={DEFAULT_ORDER} defaultVisibleColumns={DEFAULT_VISIBLE} defaultRecordsLimit={25} defaultTableTitle="Acesso"/>
  </div>;

  return <section id="authorized-access-panel" data-settings-sheet="true" data-embedded={embedded ? 'true' : 'false'} className={embedded ? 'min-h-full' : 'overflow-hidden rounded-xl border border-slate-300 shadow-sm'} style={{ backgroundColor: 'var(--portal-surface-card)' }}>
    {embedded ? <SettingsWorkspaceHeaderPortal>{toolbar}</SettingsWorkspaceHeaderPortal> : <header className="flex flex-wrap items-center justify-between gap-3 border-b-[16px] border-white px-3 py-2 text-white" style={{ backgroundColor: 'var(--portal-brand-header)' }}><div className="flex items-center gap-2"><UserCheck className="h-4 w-4"/><h3 className="text-xs font-black uppercase tracking-wide">Acesso</h3></div>{toolbar}</header>}

    <div className="p-0">
      {loading ? <div className="m-3 rounded-xl border border-slate-300 bg-white p-8 text-center text-xs font-semibold text-slate-500">Carregando acessos…</div> : shown.length === 0 ? <div className="m-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs font-semibold text-slate-500">Nenhum acesso encontrado.</div> : <TableScrollWrapper>
        <table className="portal-spreadsheet-table w-full min-w-[900px] border-collapse text-left text-xs">
          <thead><tr>{activeColumns.map((key) => <th key={key} data-portal-column-key={key} className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${['active','actions'].includes(key) ? 'text-center' : ''}`}>{ACCESS_COLUMNS.find((column) => column.key === key)?.label || key}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-200">{shown.map((entry, entryIndex) => <tr key={`${entry.id}-${entry.origin}-${entryIndex}`}>{activeColumns.map((key) => <td key={key} className={`px-3 py-1 text-slate-950 ${['active','actions'].includes(key) ? 'text-center' : ''}`}>{renderCell(entry, key)}</td>)}</tr>)}</tbody>
        </table>
      </TableScrollWrapper>}
    </div>

    {modal === 'add' && <CompactModal title="Adicionar acesso" onClose={() => setModal(null)}><form onSubmit={add} className="space-y-2"><div className="grid gap-2 sm:grid-cols-2"><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Nome completo</span><input required value={nome} onChange={(event) => setNome(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">E-mail</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="usuario@gmail.com" /></label><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Matrícula — opcional</span><input value={matricula} onChange={(event) => setMatricula(event.target.value)} className={inputClass} /></label></div><p className="text-[10px] leading-4 text-slate-600">O acesso é definido por esta lista. O e-mail não precisa pertencer a um domínio institucional.</p><div className="flex justify-end pt-1"><button disabled={saving} className={whiteButton}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Adicionar</button></div></form></CompactModal>}

    {modal === 'list' && <CompactModal title="Envio de lista" onClose={() => setModal(null)}><div className="space-y-3"><p className="text-[10px] leading-4 text-slate-600">Use uma planilha Excel normal, uma planilha do Google ou simplesmente copie e cole as colunas. O Portal faz a leitura e conversão internamente.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void downloadExcelTemplate()} className={whiteButton}><Download className="h-3.5 w-3.5" />Modelo Excel</button><button type="button" onClick={() => void openGoogleSheetsTemplate()} className={whiteButton}><FileSpreadsheet className="h-3.5 w-3.5" />Modelo Google Planilhas</button></div><textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} rows={4} className={`${inputClass} min-h-[86px] font-mono`} placeholder={'nome\temail\tmatricula\nMaria Silva\tmaria@gmail.com\t202612345'} /><div className="flex flex-wrap gap-2"><button type="button" onClick={readPaste} className={whiteButton}><ClipboardPaste className="h-3.5 w-3.5" />Interpretar dados colados</button><label className={`${whiteButton} cursor-pointer`}><Upload className="h-3.5 w-3.5" />Selecionar planilha<input className="sr-only" type="file" accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain" onChange={(event) => void readImport(event.target.files?.[0])} /></label></div>{importRows.length > 0 && <div className="overflow-hidden rounded-lg border border-slate-300 bg-white"><div className="border-b border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-700">{importRows.length} pessoa(s) pronta(s) para conferência</div><div className="max-h-48 overflow-auto"><table className="portal-spreadsheet-table w-full text-left text-[10px]"><thead><tr><th className="p-1.5">Linha</th><th className="p-1.5">Nome</th><th className="p-1.5">E-mail</th><th className="p-1.5">Matrícula</th></tr></thead><tbody>{importRows.slice(0, 100).map((row) => <tr key={`${row.row}-${row.email}`} className="border-t border-slate-100"><td className="p-1.5">{row.row}</td><td className="p-1.5">{row.nome || '—'}</td><td className="p-1.5">{row.email || '—'}</td><td className="p-1.5">{row.matricula || '—'}</td></tr>)}</tbody></table></div><div className="flex justify-end border-t border-slate-200 p-2"><button type="button" disabled={saving} onClick={() => void confirmImport()} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-900 shadow-sm disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Importar {importRows.length}</button></div></div>}</div></CompactModal>}
  </section>;
};
