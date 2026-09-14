import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Plus, Search, Upload, UserCheck, UserX } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { AuthorizedStudent } from '../types';
import { parseStudentImportFile, studentImportTemplateCsv, type StudentImportRow } from '../utils/studentImport';

const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-500 bg-slate-600 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-slate-700 disabled:opacity-50';
const inputClass = 'w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200';

export const AuthorizedStudentsPanel: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const [students, setStudents] = useState<AuthorizedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [importRows, setImportRows] = useState<StudentImportRow[]>([]);

  const load = async () => {
    setLoading(true);
    try { setStudents(await apiClient.getAuthorizedStudents()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar a lista.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const add = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      await apiClient.addAuthorizedStudent({ nome, email });
      setNome('');
      setEmail('');
      setMessage('Aluno autorizado com sucesso.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao autorizar aluno.');
    } finally { setSaving(false); }
  };

  const toggle = async (student: AuthorizedStudent) => {
    try { await apiClient.updateAuthorizedStudent(student.id, { active: !student.active }); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao alterar o acesso.'); }
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

  const confirmImport = async () => {
    setSaving(true); setMessage('');
    try {
      const result = await apiClient.importAuthorizedStudents(importRows);
      setMessage(result.reused ? 'Este mesmo lote já havia sido importado.' : `Importação concluída: ${result.created} criado(s), ${result.updated} atualizado(s).`);
      setImportRows([]);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao importar alunos.');
    } finally { setSaving(false); }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([studentImportTemplateCsv()], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_lista_alunos.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const visible = useMemo(
    () => students.filter((student) => `${student.nome} ${student.email} ${student.matricula || ''}`.toLowerCase().includes(search.toLowerCase())),
    [students, search]
  );
  const activeCount = students.filter((student) => student.active).length;
  const linkedCount = students.filter((student) => student.processIds.length > 0).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-slate-600" />
            <h3 className="font-black text-slate-950">Autorização de acesso</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">Controle dos alunos autorizados a iniciar TCC. Participantes cadastrados no formulário entram automaticamente com o papel correspondente.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-black">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{students.length} cadastrados</span>
          <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-slate-700">{activeCount} ativos</span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{linkedCount} vinculados a TCC</span>
        </div>
      </div>

      {canManage ? (
        <div className="grid gap-3 border-b border-slate-200 p-3 xl:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={add} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-600">Liberação individual</h4>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <input required value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Nome completo do aluno" className={inputClass} />
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail institucional do aluno" className={inputClass} />
            </div>
            <button disabled={saving} className={`${primaryButton} mt-2`}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Liberar aluno
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <FileSpreadsheet className="mt-0.5 h-4 w-4 text-slate-600" />
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-600">Importação CSV/XLSX</h4>
                  <p className="mt-1 text-[11px] leading-4 text-slate-500">Colunas: nome, e-mail e matrícula. O arquivo é lido localmente e não fica armazenado.</p>
                </div>
              </div>
              <button type="button" onClick={downloadTemplate} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[11px] font-black text-slate-800 hover:bg-slate-50">
                <Download className="h-3.5 w-3.5" />Baixar modelo
              </button>
            </div>
            <label className={`${primaryButton} mt-2 cursor-pointer`}>
              <Upload className="h-4 w-4" />Selecionar planilha
              <input className="sr-only" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void readImport(event.target.files?.[0])} />
            </label>
          </div>

          {importRows.length > 0 && (
            <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-3">
              <div className="max-h-52 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-[#344125] text-white"><tr><th className="p-2">Linha</th><th className="p-2">Nome</th><th className="p-2">E-mail</th><th className="p-2">Matrícula</th></tr></thead>
                  <tbody>{importRows.slice(0, 100).map((row) => <tr key={`${row.row}-${row.email}`} className="border-t border-slate-100"><td className="p-2">{row.row}</td><td className="p-2">{row.nome || '—'}</td><td className="p-2">{row.email || '—'}</td><td className="p-2">{row.matricula || '—'}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] text-slate-600">Confira os dados antes de importar. Revogações manuais existentes serão preservadas.</span>
                <button type="button" disabled={saving} onClick={confirmImport} className={primaryButton}>Confirmar {importRows.length} aluno(s)</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="m-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">Somente o usuário Master e a Presidente da Comissão administram a lista de acesso.</p>
      )}

      <div className="p-3">
        {message && <p role="status" className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{message}</p>}
        <label className="relative block">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou matrícula" className="w-full min-h-11 rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
        </label>

        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="bg-[#344125] text-[10px] font-black uppercase tracking-wider text-white">
              <tr><th className="px-3 py-3">Nome</th><th className="px-3 py-3">E-mail</th><th className="px-3 py-3">Matrícula</th><th className="px-3 py-3">Origem / papel</th><th className="px-3 py-3 text-center">TCCs</th><th className="px-3 py-3 text-center">Acesso</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-sm text-slate-500">Carregando…</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-sm text-slate-500">Nenhum acesso encontrado.</td></tr>
              ) : visible.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2.5 text-sm font-bold text-slate-900">{student.nome}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{student.email}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600">{student.matricula || '—'}</td>
                  <td className="px-3 py-3"><div className="flex flex-wrap gap-1"><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-700">{student.origin === 'MASTER_LIST' ? 'Lista prévia' : 'Incluído pelo TCC'}</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-slate-700">{(student.roles || [student.accessType || 'STUDENT']).join(' · ')}</span></div></td>
                  <td className="px-3 py-3 text-center text-xs font-bold text-slate-700">{student.processIds.length}</td>
                  <td className="px-3 py-3 text-center">{canManage ? <button type="button" onClick={() => void toggle(student)} className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black ${student.active ? 'border-emerald-300 bg-emerald-50 text-slate-700' : 'border-slate-300 bg-slate-100 text-slate-700'}`}>{student.active ? <CheckCircle2 className="h-4 w-4" /> : <UserX className="h-4 w-4" />}{student.active ? 'Ativo' : 'Inativo'}</button> : <span className="text-xs">{student.active ? 'Ativo' : 'Inativo'}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};