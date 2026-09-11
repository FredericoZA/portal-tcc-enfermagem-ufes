import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Loader2, Plus, Search, Upload, UserCheck, UserX } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { AuthorizedStudent } from '../types';
import { parseStudentImportFile, studentImportTemplateCsv, type StudentImportRow } from '../utils/studentImport';

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
    try { await apiClient.addAuthorizedStudent({ nome, email }); setNome(''); setEmail(''); setMessage('Aluno autorizado com sucesso.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao autorizar aluno.'); }
    finally { setSaving(false); }
  };

  const toggle = async (student: AuthorizedStudent) => {
    try { await apiClient.updateAuthorizedStudent(student.id, { active: !student.active }); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao alterar o acesso.'); }
  };

  const readImport = async (file?: File) => {
    if (!file) return;
    setMessage('');
    try { const rows = await parseStudentImportFile(file); setImportRows(rows); setMessage(`${rows.length} linha(s) pronta(s) para conferência.`); }
    catch (error) { setImportRows([]); setMessage(error instanceof Error ? error.message : 'Não foi possível ler a planilha.'); }
  };

  const confirmImport = async () => {
    setSaving(true); setMessage('');
    try { const result = await apiClient.importAuthorizedStudents(importRows); setMessage(result.reused ? 'Este mesmo lote já havia sido importado.' : `Importação concluída: ${result.created} criado(s), ${result.updated} atualizado(s).`); setImportRows([]); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao importar alunos.'); }
    finally { setSaving(false); }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([studentImportTemplateCsv()], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'modelo_lista_alunos.csv'; link.click(); URL.revokeObjectURL(url);
  };

  const visible = useMemo(() => students.filter((student) => `${student.nome} ${student.email} ${student.matricula || ''}`.toLowerCase().includes(search.toLowerCase())), [students, search]);

  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div><div className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-emerald-700"/><h3 className="font-black text-slate-900">Lista de autorização de acesso</h3></div><p className="mt-1 text-xs text-slate-600">Master e Presidente liberam os alunos que iniciarão TCC. Participantes informados no primeiro formulário entram automaticamente com o papel correto.</p></div>
      <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black">{students.filter((student) => student.active).length} acessos ativos</div>
    </div>
    {canManage ? <>
      <form onSubmit={add} className="mt-4 grid gap-2 md:grid-cols-[1fr_1.2fr_auto]"><input required value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Nome completo do aluno" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail institucional do aluno" className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/><button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4"/>}Liberar aluno</button></form>
      <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-blue-700"/><div><strong className="text-xs text-blue-950">Importação assistida CSV/XLSX</strong><p className="text-[11px] text-blue-800">Colunas: nome, email e matrícula. Nenhum arquivo é armazenado.</p></div></div><button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-2 text-[11px] font-black text-blue-900"><Download className="h-3.5 w-3.5"/>Baixar modelo</button></div>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-800 px-3 py-2 text-xs font-black text-white"><Upload className="h-4 w-4"/>Selecionar planilha<input className="sr-only" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void readImport(event.target.files?.[0])}/></label>
        {importRows.length > 0 && <div className="mt-3"><div className="max-h-44 overflow-auto rounded-lg border border-blue-200 bg-white"><table className="w-full text-left text-[11px]"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Linha</th><th className="p-2">Nome</th><th className="p-2">E-mail</th><th className="p-2">Matrícula</th></tr></thead><tbody>{importRows.slice(0, 100).map((row) => <tr key={`${row.row}-${row.email}`} className="border-t"><td className="p-2">{row.row}</td><td className="p-2">{row.nome || '—'}</td><td className="p-2">{row.email || '—'}</td><td className="p-2">{row.matricula || '—'}</td></tr>)}</tbody></table></div><div className="mt-2 flex items-center justify-between gap-2"><span className="text-[11px] text-blue-900">Confira antes de confirmar. Revogações manuais serão preservadas.</span><button type="button" disabled={saving} onClick={confirmImport} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50">Confirmar {importRows.length} aluno(s)</button></div></div>}
      </div>
    </> : <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">Somente o usuário Master e o Presidente da Comissão administram a lista de acesso.</p>}
    {message && <p role="status" className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{message}</p>}
    <label className="relative mt-4 block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, e-mail ou matrícula" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"/></label>
    <div className="mt-3 max-h-72 divide-y overflow-auto rounded-xl border border-slate-200">{loading ? <div className="p-6 text-center text-sm text-slate-500">Carregando…</div> : visible.map((student) => <div key={student.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-center"><div><strong className="text-sm">{student.nome}</strong><div className="mt-1 flex flex-wrap gap-1"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase">{(student.roles || [student.accessType || 'STUDENT']).join(' · ')}</span><span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase text-blue-700">{student.origin === 'MASTER_LIST' ? 'Lista prévia' : 'Incluído pelo TCC'}</span></div>{student.matricula && <p className="mt-1 text-xs text-slate-500">Matrícula {student.matricula}</p>}</div><div className="text-xs text-slate-600">{student.email}{student.processIds.length > 0 && <p>{student.processIds.length} processo(s) vinculado(s)</p>}</div>{canManage ? <button type="button" onClick={() => void toggle(student)} className={`inline-flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-black ${student.active ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-100 text-slate-700'}`}>{student.active ? <CheckCircle2 className="h-4 w-4"/> : <UserX className="h-4 w-4"/>}{student.active ? 'Ativo' : 'Inativo'}</button> : null}</div>)}</div>
  </section>;
};
