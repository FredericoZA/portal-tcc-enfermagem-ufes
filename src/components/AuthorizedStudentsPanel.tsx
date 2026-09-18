import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  Search,
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
  studentImportTemplateCsv,
  type StudentImportRow,
} from '../utils/studentImport';
import { portalConfirm } from '../services/portalDialogs';

const whiteButton = 'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50';
const inputClass = 'w-full min-h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 outline-none focus:border-slate-400';

const roleLabels: Record<ProcessRole, string> = {
  STUDENT: 'Aluno',
  ADVISOR: 'Orientador',
  CO_ADVISOR: 'Coorientador',
  EXAMINER: 'Membro da banca',
};
const roles: ProcessRole[] = ['STUDENT', 'ADVISOR', 'CO_ADVISOR', 'EXAMINER'];
function administrativeRole(entry: AuthorizedStudent): ProcessRole { return (entry.accessType || entry.roles?.[0] || 'STUDENT') as ProcessRole; }

function CompactModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-3xl overflow-hidden rounded-xl border border-slate-300 bg-[#e1e6e9] shadow-2xl">
        <div className="flex items-center justify-between border-b-2 border-white bg-[#005830] px-3 py-2 text-white">
          <h3 className="text-xs font-black uppercase tracking-wide">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md border border-white/70 bg-white p-1 text-slate-800 hover:bg-slate-100" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto p-3">{children}</div>
      </div>
    </div>, document.body,
  );
}

export const AuthorizedStudentsPanel: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const [entries, setEntries] = useState<AuthorizedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [matricula, setMatricula] = useState('');
  const [role, setRole] = useState<ProcessRole>('STUDENT');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [importRows, setImportRows] = useState<StudentImportRow[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [modal, setModal] = useState<'add' | 'list' | null>(null);

  const load = async () => {
    setLoading(true);
    try { setEntries(await apiClient.getAuthorizedStudents()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar a lista.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const add = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      await apiClient.addAuthorizedStudent({ nome, email, matricula: matricula.trim() || undefined, role });
      setNome(''); setEmail(''); setMatricula(''); setModal(null); setMessage('Acesso cadastrado com sucesso.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao cadastrar acesso.'); }
    finally { setSaving(false); }
  };
  const toggle = async (entry: AuthorizedStudent) => { try { await apiClient.updateAuthorizedStudent(entry.id, { active: !entry.active }); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao alterar o acesso.'); } };
  const changeRole = async (entry: AuthorizedStudent, nextRole: ProcessRole) => {
    if (administrativeRole(entry) === nextRole) return;
    try { await apiClient.updateAuthorizedStudent(entry.id, { role: nextRole, replaceRole: true }); setMessage(`Qualidade administrativa de ${entry.nome} atualizada para ${roleLabels[nextRole]}.`); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao alterar a qualidade de acesso.'); }
  };
  const remove = async (entry: AuthorizedStudent) => {
    if (!(await portalConfirm('Excluir este acesso manual? Esta ação não remove vínculos acadêmicos de TCC.'))) return;
    try { await apiClient.deleteAuthorizedStudent(entry.id); setMessage('Acesso manual excluído.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao excluir o acesso.'); }
  };
  const readImport = async (file?: File) => {
    if (!file) return; setMessage('');
    try { const rows = await parseStudentImportFile(file); setImportRows(rows); setMessage(`${rows.length} linha(s) pronta(s) para conferência.`); }
    catch (error) { setImportRows([]); setMessage(error instanceof Error ? error.message : 'Não foi possível ler a planilha.'); }
  };
  const readPaste = () => {
    setMessage('');
    try { const rows = parseStudentImportText(pasteText); if (!rows.length) throw new Error('Cole ao menos o cabeçalho e uma linha da planilha.'); setImportRows(rows); setMessage(`${rows.length} linha(s) pronta(s) para conferência.`); }
    catch (error) { setImportRows([]); setMessage(error instanceof Error ? error.message : 'Não foi possível interpretar os dados colados.'); }
  };
  const confirmImport = async () => {
    setSaving(true); setMessage('');
    try { const result = await apiClient.importAuthorizedStudents(importRows); setMessage(result.reused ? 'Este mesmo lote já havia sido importado.' : `Importação concluída: ${result.created} criado(s), ${result.updated} atualizado(s).`); setImportRows([]); setPasteText(''); setModal(null); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao importar alunos.'); }
    finally { setSaving(false); }
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([studentImportTemplateCsv()], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'modelo_lista_alunos.csv'; link.click(); URL.revokeObjectURL(url);
  };

  const visible = useMemo(() => entries.filter((entry) => `${entry.nome} ${entry.email} ${entry.matricula || ''} ${roleLabels[administrativeRole(entry)] || ''}`.toLowerCase().includes(search.toLowerCase())), [entries, search]);
  const activeCount = entries.filter((entry) => entry.active).length;

  return (
    <section id="authorized-access-panel" className="overflow-hidden rounded-xl border border-slate-300 bg-[#e1e6e9] shadow-sm">
      <div className="flex flex-col gap-2 border-b-2 border-white bg-[#005830] px-3 py-2 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex items-center gap-2"><UserCheck className="h-4 w-4" /><h3 className="text-xs font-black uppercase tracking-wide">Autorização de acesso</h3><span className="rounded-full border border-white/50 bg-white/15 px-2 py-0.5 text-[9px] font-black">{entries.length} cadastrados · {activeCount} ativos</span></div>
        {canManage && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setModal('add')} className={whiteButton}><Plus className="h-3.5 w-3.5" />Adicionar acesso</button><button type="button" onClick={() => setModal('list')} className={whiteButton}><FileSpreadsheet className="h-3.5 w-3.5" />Envio de lista</button></div>}
      </div>

      <div className="p-2.5">
        {message && <p role="status" className="mb-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-700">{message}</p>}
        <label className="relative block"><Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail, matrícula ou qualidade" className="w-full min-h-8 rounded-lg border border-slate-300 bg-white py-1 pl-8 pr-3 text-[11px] outline-none" /></label>
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-300 bg-white">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead className="bg-[#005830] text-[9px] font-black uppercase tracking-wider text-white"><tr><th className="px-2.5 py-2">Nome</th><th className="px-2.5 py-2">E-mail</th><th className="px-2.5 py-2">Matrícula</th><th className="px-2.5 py-2">Origem</th><th className="px-2.5 py-2">Qualidade</th><th className="px-2.5 py-2 text-center">Acesso</th><th className="px-2.5 py-2 text-center">Excluir</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={7} className="p-4 text-center text-[10px] text-slate-500">Carregando…</td></tr> : visible.length === 0 ? <tr><td colSpan={7} className="p-4 text-center text-[10px] text-slate-500">Nenhum acesso encontrado.</td></tr> : visible.map((entry, entryIndex) => {
                const adminRole = administrativeRole(entry); const canDelete = entry.origin !== 'TCC_FORM' && entry.processIds.length === 0;
                return <tr key={`${entry.id}-${entry.origin}-${entryIndex}`} className="hover:bg-slate-50/70"><td className="px-2.5 py-1.5 text-[10px] font-bold text-slate-900">{entry.nome}</td><td className="px-2.5 py-1.5 text-[10px] text-slate-600">{entry.email}</td><td className="px-2.5 py-1.5 text-[10px] text-slate-600">{entry.matricula || '—'}</td><td className="px-2.5 py-1.5"><span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-black uppercase text-slate-700">{entry.origin === 'MASTER_LIST' ? 'Lista/manual' : 'Processo'}</span></td><td className="px-2.5 py-1.5">{canManage && entry.origin === 'MASTER_LIST' ? <select aria-label={`Qualidade de ${entry.nome}`} value={adminRole} onChange={(event) => void changeRole(entry, event.target.value as ProcessRole)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[9px] font-bold">{roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select> : <span className="text-[9px] font-bold text-slate-700">{roleLabels[adminRole]}</span>}</td><td className="px-2.5 py-1.5 text-center">{canManage ? <button type="button" onClick={() => void toggle(entry)} className={`inline-flex min-h-7 items-center gap-1 rounded-md border px-2 py-1 text-[8px] font-black uppercase ${entry.active ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-slate-100 text-slate-700'}`}>{entry.active ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}{entry.active ? 'Ativo' : 'Inativo'}</button> : <span className="text-[9px]">{entry.active ? 'Ativo' : 'Inativo'}</span>}</td><td className="px-2.5 py-1.5 text-center">{canManage && canDelete ? <button type="button" onClick={() => void remove(entry)} className="rounded-md border border-slate-200 bg-white p-1.5 text-rose-700 hover:bg-rose-50" aria-label={`Excluir ${entry.nome}`}><Trash2 className="h-3.5 w-3.5" /></button> : <span className="text-slate-300">—</span>}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'add' && <CompactModal title="Adicionar acesso" onClose={() => setModal(null)}><form onSubmit={add} className="space-y-2"><div className="grid gap-2 sm:grid-cols-2"><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Nome completo</span><input required value={nome} onChange={(event) => setNome(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">E-mail</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Matrícula — opcional</span><input value={matricula} onChange={(event) => setMatricula(event.target.value)} className={inputClass} /></label><label><span className="mb-1 block text-[9px] font-black uppercase text-slate-600">Qualidade</span><select value={role} onChange={(event) => setRole(event.target.value as ProcessRole)} className={inputClass}>{roles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}</select></label></div><div className="flex justify-end pt-1"><button disabled={saving} className={whiteButton}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Adicionar acesso</button></div></form></CompactModal>}

      {modal === 'list' && <CompactModal title="Envio de lista de alunos" onClose={() => setModal(null)}><div className="space-y-2"><div className="flex items-start justify-between gap-2"><p className="text-[10px] leading-4 text-slate-600">Cole dados do Excel ou envie CSV/XLSX. O lote entra como Aluno e pode ser ajustado depois na tabela.</p><button type="button" onClick={downloadTemplate} className={whiteButton}><Download className="h-3.5 w-3.5" />Modelo</button></div><textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} rows={4} className={`${inputClass} min-h-[86px] font-mono`} placeholder={'nome\temail\tmatricula\nMaria Silva\tmaria@ufes.br\t202612345'} /><div className="flex flex-wrap gap-2"><button type="button" onClick={readPaste} className={whiteButton}><ClipboardPaste className="h-3.5 w-3.5" />Interpretar dados</button><label className={`${whiteButton} cursor-pointer`}><Upload className="h-3.5 w-3.5" />Selecionar planilha<input className="sr-only" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void readImport(event.target.files?.[0])} /></label></div>{importRows.length > 0 && <div className="rounded-lg border border-slate-300 bg-white p-2"><div className="max-h-48 overflow-auto"><table className="w-full text-left text-[10px]"><thead className="sticky top-0 bg-[#005830] text-white"><tr><th className="p-1.5">Linha</th><th className="p-1.5">Nome</th><th className="p-1.5">E-mail</th><th className="p-1.5">Matrícula</th></tr></thead><tbody>{importRows.slice(0, 100).map((row) => <tr key={`${row.row}-${row.email}`} className="border-t border-slate-100"><td className="p-1.5">{row.row}</td><td className="p-1.5">{row.nome || '—'}</td><td className="p-1.5">{row.email || '—'}</td><td className="p-1.5">{row.matricula || '—'}</td></tr>)}</tbody></table></div><div className="mt-2 flex justify-end"><button type="button" disabled={saving} onClick={() => void confirmImport()} className={whiteButton}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Confirmar {importRows.length} aluno(s)</button></div></div>}</div></CompactModal>}
    </section>
  );
};
