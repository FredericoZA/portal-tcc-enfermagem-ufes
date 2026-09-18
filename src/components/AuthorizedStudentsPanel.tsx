import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
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

const primaryButton =
  'inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50';
const inputClass =
  'w-full min-h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 outline-none focus:border-slate-400';

const roleLabels: Record<ProcessRole, string> = {
  STUDENT: 'Aluno',
  ADVISOR: 'Orientador',
  CO_ADVISOR: 'Coorientador',
  EXAMINER: 'Membro da banca',
};

const roles: ProcessRole[] = ['STUDENT', 'ADVISOR', 'CO_ADVISOR', 'EXAMINER'];

function administrativeRole(entry: AuthorizedStudent): ProcessRole {
  return (entry.accessType || entry.roles?.[0] || 'STUDENT') as ProcessRole;
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

  const load = async () => {
    setLoading(true);
    try {
      setEntries(await apiClient.getAuthorizedStudents());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar a lista.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await apiClient.addAuthorizedStudent({
        nome,
        email,
        matricula: matricula.trim() || undefined,
        role,
      });
      setNome('');
      setEmail('');
      setMatricula('');
      setMessage('Acesso cadastrado com sucesso.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao cadastrar acesso.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (entry: AuthorizedStudent) => {
    try {
      await apiClient.updateAuthorizedStudent(entry.id, { active: !entry.active });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao alterar o acesso.');
    }
  };

  const changeRole = async (entry: AuthorizedStudent, nextRole: ProcessRole) => {
    if (administrativeRole(entry) === nextRole) return;
    try {
      await apiClient.updateAuthorizedStudent(entry.id, { role: nextRole, replaceRole: true });
      setMessage(`Qualidade administrativa de ${entry.nome} atualizada para ${roleLabels[nextRole]}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao alterar a qualidade de acesso.');
    }
  };

  const remove = async (entry: AuthorizedStudent) => {
    if (!(await portalConfirm('Excluir este acesso manual? Esta ação não remove vínculos acadêmicos de TCC.'))) return;
    try {
      await apiClient.deleteAuthorizedStudent(entry.id);
      setMessage('Acesso manual excluído.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao excluir o acesso.');
    }
  };

  const readImport = async (file?: File) => {
    if (!file) return;
    setMessage('');
    try {
      const rows = await parseStudentImportFile(file);
      setImportRows(rows);
      setMessage(`${rows.length} linha(s) pronta(s) para conferência.`);
    } catch (error) {
      setImportRows([]);
      setMessage(error instanceof Error ? error.message : 'Não foi possível ler a planilha.');
    }
  };

  const readPaste = () => {
    setMessage('');
    try {
      const rows = parseStudentImportText(pasteText);
      if (!rows.length) throw new Error('Cole ao menos o cabeçalho e uma linha da planilha.');
      setImportRows(rows);
      setMessage(`${rows.length} linha(s) colada(s) e pronta(s) para conferência.`);
    } catch (error) {
      setImportRows([]);
      setMessage(error instanceof Error ? error.message : 'Não foi possível interpretar os dados colados.');
    }
  };

  const confirmImport = async () => {
    setSaving(true);
    setMessage('');
    try {
      const result = await apiClient.importAuthorizedStudents(importRows);
      setMessage(result.reused ? 'Este mesmo lote já havia sido importado.' : `Importação concluída: ${result.created} criado(s), ${result.updated} atualizado(s).`);
      setImportRows([]);
      setPasteText('');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao importar alunos.');
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([studentImportTemplateCsv()], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_lista_alunos.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const visible = useMemo(() => entries.filter((entry) =>
    `${entry.nome} ${entry.email} ${entry.matricula || ''} ${roleLabels[administrativeRole(entry)] || ''}`.toLowerCase().includes(search.toLowerCase()),
  ), [entries, search]);

  const activeCount = entries.filter((entry) => entry.active).length;

  return (
    <section id="authorized-access-panel" className="overflow-hidden rounded-xl border border-slate-300 bg-[#e1e6e9] shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-300 px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-[#337959]" /><h3 className="font-black text-slate-950">Autorização de acesso</h3></div>
          <p className="mt-1 text-[11px] leading-4 text-slate-600">Cadastre quem pode entrar no Portal. O papel acadêmico específico de cada TCC é definido pelo próprio processo.</p>
        </div>
        <div className="flex gap-2 text-[10px] font-black"><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{entries.length} cadastrados</span><span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1">{activeCount} ativos</span></div>
      </div>

      {canManage && <div className="grid gap-2 border-b border-slate-300 p-2.5 xl:grid-cols-[1fr_1fr]">
        <form onSubmit={add} className="rounded-lg border border-slate-300 bg-[#d5dce0] p-2.5">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600">Adicionar acesso individual</h4>
          <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <input required value={nome} onChange={event => setNome(event.target.value)} placeholder="Nome completo" className={inputClass}/>
            <input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="E-mail" className={inputClass}/>
            <input value={matricula} onChange={event => setMatricula(event.target.value)} placeholder="Matrícula — opcional" className={inputClass}/>
            <select value={role} onChange={event => setRole(event.target.value as ProcessRole)} className={inputClass}>{roles.map(item => <option key={item} value={item}>{roleLabels[item]}</option>)}</select>
          </div>
          <button disabled={saving} className={`${primaryButton} mt-2`}>{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4"/>}Adicionar acesso</button>
        </form>

        <div className="rounded-lg border border-slate-300 bg-[#d5dce0] p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div><div className="flex items-center gap-1.5"><FileSpreadsheet className="h-4 w-4 text-[#337959]"/><h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600">Lista prévia de alunos</h4></div><p className="mt-1 text-[10px] leading-4 text-slate-500">Cole diretamente do Excel ou envie CSV/XLSX. O lote entra automaticamente como Aluno.</p></div>
            <button type="button" onClick={downloadTemplate} className={primaryButton}><Download className="h-3.5 w-3.5"/>Modelo</button>
          </div>
          <textarea value={pasteText} onChange={event => setPasteText(event.target.value)} rows={3} className={`${inputClass} mt-2 min-h-[64px] font-mono`} placeholder={'nome\temail\tmatricula\nMaria Silva\tmaria@ufes.br\t202612345'}/>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={readPaste} className={primaryButton}><ClipboardPaste className="h-4 w-4"/>Interpretar dados colados</button>
            <label className={`${primaryButton} cursor-pointer`}><Upload className="h-4 w-4"/>Selecionar planilha<input className="sr-only" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => void readImport(event.target.files?.[0])}/></label>
          </div>
        </div>

        {importRows.length > 0 && <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="max-h-48 overflow-auto rounded-lg border border-slate-200"><table className="w-full text-left text-[11px]"><thead className="sticky top-0 bg-[#005830] text-white"><tr><th className="p-2">Linha</th><th className="p-2">Nome</th><th className="p-2">E-mail</th><th className="p-2">Matrícula</th></tr></thead><tbody>{importRows.slice(0,100).map(row => <tr key={`${row.row}-${row.email}`} className="border-t border-slate-100"><td className="p-2">{row.row}</td><td className="p-2">{row.nome || '—'}</td><td className="p-2">{row.email || '—'}</td><td className="p-2">{row.matricula || '—'}</td></tr>)}</tbody></table></div>
          <div className="mt-2 flex justify-end"><button type="button" disabled={saving} onClick={confirmImport} className={primaryButton}>Confirmar {importRows.length} aluno(s)</button></div>
        </div>}
      </div>}

      <div className="p-2.5">
        {message && <p role="status" className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{message}</p>}
        <label className="relative block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail, matrícula ou qualidade" className="w-full min-h-9 rounded-lg border border-slate-300 py-1.5 pl-9 pr-3 text-xs outline-none"/></label>
        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead className="bg-[#005830] text-[10px] font-black uppercase tracking-wider text-white"><tr><th className="px-3 py-2.5">Nome</th><th className="px-3 py-2.5">E-mail</th><th className="px-3 py-2.5">Matrícula</th><th className="px-3 py-2.5">Origem</th><th className="px-3 py-2.5">Qualidade</th><th className="px-3 py-2.5 text-center">Acesso</th><th className="px-3 py-2.5 text-center">Excluir</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={7} className="p-5 text-center text-xs text-slate-500">Carregando…</td></tr> : visible.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-sm text-slate-500">Nenhum acesso encontrado.</td></tr> : visible.map((entry, entryIndex) => {
                const adminRole = administrativeRole(entry);
                const canDelete = entry.origin !== 'TCC_FORM' && entry.processIds.length === 0;
                return <tr key={`${entry.id}-${entry.origin}-${entryIndex}`} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2.5 text-xs font-bold text-slate-900">{entry.nome}</td><td className="px-3 py-2.5 text-xs text-slate-600">{entry.email}</td><td className="px-3 py-2.5 text-xs text-slate-600">{entry.matricula || '—'}</td>
                  <td className="px-3 py-2.5"><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-700">{entry.origin === 'MASTER_LIST' ? 'Lista prévia/manual' : 'Processo/Formulário'}</span></td>
                  <td className="px-3 py-2.5">{canManage && entry.origin === 'MASTER_LIST' ? <select aria-label={`Qualidade de ${entry.nome}`} value={adminRole} onChange={event => void changeRole(entry, event.target.value as ProcessRole)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold">{roles.map(item => <option key={item} value={item}>{roleLabels[item]}</option>)}</select> : <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-slate-700">{roleLabels[adminRole]}</span>}</td>
                  <td className="px-3 py-2.5 text-center">{canManage ? <button type="button" onClick={() => void toggle(entry)} className={`inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border px-2.5 text-[10px] font-black ${entry.active ? 'border-slate-300 bg-white text-slate-800' : 'border-slate-300 bg-[#AEB0B3] text-slate-900'}`}>{entry.active ? <CheckCircle2 className="h-3.5 w-3.5"/> : <UserX className="h-3.5 w-3.5"/>}{entry.active ? 'Ativo' : 'Inativo'}</button> : <span className="text-xs">{entry.active ? 'Ativo' : 'Inativo'}</span>}</td>
                  <td className="px-3 py-2.5 text-center">{canManage ? <button type="button" disabled={!canDelete} onClick={() => void remove(entry)} title={canDelete ? 'Excluir acesso manual' : 'Vínculo acadêmico: desative o acesso em vez de excluir'} className="inline-flex min-h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-3.5 w-3.5"/></button> : '—'}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};