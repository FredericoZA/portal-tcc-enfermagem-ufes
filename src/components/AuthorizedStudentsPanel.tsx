import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Plus, Search, Trash2, Upload, UserCheck } from 'lucide-react';
import { apiClient } from '../services/apiClient';
import type { AuthorizedStudent, ProcessRole } from '../types';
import { parseStudentImportFile, studentImportTemplateCsv, type StudentImportRow } from '../utils/studentImport';
import { portalConfirm } from '../services/portalDialogs';

const primaryButton = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[#2d6c50] bg-[#337959] px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm transition hover:brightness-95 disabled:opacity-50';
const inputClass = 'w-full min-h-9 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-slate-400';
const roles: ProcessRole[] = ['STUDENT', 'ADVISOR', 'CO_ADVISOR', 'EXAMINER'];
const roleLabels: Record<ProcessRole, string> = { STUDENT:'Aluno', ADVISOR:'Orientador', CO_ADVISOR:'Coorientador', EXAMINER:'Membro da banca' };

function parsePastedStudents(value: string): StudentImportRow[] {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows: StudentImportRow[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const parts = line.includes('\t') ? line.split('\t') : line.includes(';') ? line.split(';') : line.split(',');
    const cells = parts.map((part) => part.trim().replace(/^"|"$/g, ''));
    if (index === 0 && cells.join(' ').toLowerCase().includes('e-mail')) continue;
    const [nome = '', email = '', matricula = ''] = cells;
    if (!nome && !email) continue;
    rows.push({ row:index + 1, nome, email, matricula });
  }
  return rows;
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
  const [pasteValue, setPasteValue] = useState('');

  const load = async () => {
    setLoading(true); setMessage('');
    try { setEntries(await apiClient.getAuthorizedStudents()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível confirmar as permissões atuais. Tente novamente.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const add = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('');
    try {
      await apiClient.addAuthorizedStudent({ nome, email, matricula: matricula.trim() || undefined, role });
      setNome(''); setEmail(''); setMatricula(''); setMessage('Acesso cadastrado com sucesso.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao cadastrar acesso.'); }
    finally { setSaving(false); }
  };

  const setQuality = async (entry: AuthorizedStudent, nextRole: ProcessRole) => {
    try { await apiClient.updateAuthorizedStudent(entry.id, { role: nextRole }); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao alterar a qualidade do acesso.'); }
  };
  const toggle = async (entry: AuthorizedStudent) => {
    try { await apiClient.updateAuthorizedStudent(entry.id, { active: !entry.active }); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao alterar o acesso.'); }
  };
  const remove = async (entry: AuthorizedStudent) => {
    if (!(await portalConfirm(`Excluir o acesso de ${entry.nome}? Vínculos acadêmicos criados por TCC não serão apagados.`))) return;
    try { await apiClient.deleteAuthorizedStudent(entry.id); setMessage('Acesso manual excluído.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao excluir o acesso.'); }
  };

  const readImport = async (file?: File) => {
    if (!file) return;
    try { const rows = await parseStudentImportFile(file); setImportRows(rows); setMessage(`${rows.length} aluno(s) pronto(s) para conferência.`); }
    catch (error) { setImportRows([]); setMessage(error instanceof Error ? error.message : 'Não foi possível ler a planilha.'); }
  };
  const preparePaste = () => {
    const rows = parsePastedStudents(pasteValue);
    setImportRows(rows);
    setMessage(rows.length ? `${rows.length} aluno(s) reconhecido(s) no conteúdo colado.` : 'Nenhuma linha válida foi reconhecida. Use Nome, E-mail e Matrícula em colunas.');
  };
  const confirmImport = async () => {
    if (!importRows.length) return;
    setSaving(true);
    try {
      const result = await apiClient.importAuthorizedStudents(importRows);
      setMessage(result.reused ? 'Este mesmo lote já havia sido importado.' : `Importação concluída: ${result.created} criado(s), ${result.updated} atualizado(s).`);
      setImportRows([]); setPasteValue(''); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao importar alunos.'); }
    finally { setSaving(false); }
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([studentImportTemplateCsv()], { type:'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href=url; link.download='modelo_lista_alunos.csv'; link.click(); URL.revokeObjectURL(url);
  };

  const visible = useMemo(() => entries.filter((entry) => `${entry.nome} ${entry.email} ${entry.matricula || ''} ${(entry.roles || []).join(' ')}`.toLowerCase().includes(search.toLowerCase())), [entries, search]);
  const activeCount = entries.filter((entry) => entry.active).length;

  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
      <div><div className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-[#337959]"/><h3 className="font-black text-slate-950">Autorização de acesso</h3></div><p className="mt-1 text-[11px] leading-4 text-slate-600">Defina quem entra no Portal e sua qualidade principal. O papel operacional em cada TCC continua sendo definido pelo próprio processo.</p></div>
      <div className="flex gap-2 text-[10px] font-black"><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{entries.length} cadastrados</span><span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1">{activeCount} ativos</span></div>
    </div>

    {canManage && <div className="grid gap-3 border-b border-slate-200 p-3 xl:grid-cols-[1.05fr_.95fr]">
      <form onSubmit={add} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600">Adicionar acesso individual</h4>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <input required value={nome} onChange={(e)=>setNome(e.target.value)} placeholder="Nome completo" className={inputClass}/>
          <input required type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="E-mail" className={inputClass}/>
          <input value={matricula} onChange={(e)=>setMatricula(e.target.value)} placeholder="Matrícula (opcional)" className={inputClass}/>
          <select value={role} onChange={(e)=>setRole(e.target.value as ProcessRole)} className={inputClass}>{roles.map((item)=><option key={item} value={item}>{roleLabels[item]}</option>)}</select>
        </div>
        <button disabled={saving} className={`${primaryButton} mt-2`}>{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Plus className="h-4 w-4"/>}Adicionar acesso</button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
        <div className="flex items-start justify-between gap-2"><div><div className="flex items-center gap-1.5"><FileSpreadsheet className="h-4 w-4 text-[#337959]"/><h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600">Lista prévia de alunos</h4></div><p className="mt-1 text-[10px] leading-4 text-slate-500">Cole diretamente do Excel ou importe CSV/XLSX. Nesta entrada em lote todos recebem a qualidade Aluno.</p></div><button type="button" onClick={downloadTemplate} className="min-h-8 rounded-lg border border-slate-300 bg-white px-2 text-[10px] font-black"><Download className="mr-1 inline h-3.5 w-3.5"/>Modelo</button></div>
        <textarea value={pasteValue} onChange={(e)=>setPasteValue(e.target.value)} rows={3} className={`${inputClass} mt-2 resize-y`} placeholder={'Cole aqui: Nome\tE-mail\tMatrícula'} />
        <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={preparePaste} className={primaryButton}>Analisar dados colados</button><label className={`${primaryButton} cursor-pointer`}><Upload className="h-4 w-4"/>Selecionar planilha<input className="sr-only" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e)=>void readImport(e.target.files?.[0])}/></label></div>
      </div>

      {importRows.length>0&&<div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-3"><div className="max-h-44 overflow-auto rounded-lg border border-slate-200"><table className="w-full text-left text-[11px]"><thead className="sticky top-0 bg-[#005830] text-white"><tr><th className="p-2">Nome</th><th className="p-2">E-mail</th><th className="p-2">Matrícula</th></tr></thead><tbody>{importRows.slice(0,100).map((row)=><tr key={`${row.row}-${row.email}`} className="border-t border-slate-100"><td className="p-2">{row.nome||'—'}</td><td className="p-2">{row.email||'—'}</td><td className="p-2">{row.matricula||'—'}</td></tr>)}</tbody></table></div><div className="mt-2 flex justify-end"><button type="button" disabled={saving} onClick={confirmImport} className={primaryButton}>Confirmar {importRows.length} aluno(s)</button></div></div>}
    </div>}

    <div className="p-3">
      {message&&<div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700" role="status"><span>{message}</span><button type="button" onClick={()=>void load()} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] font-black">Tentar novamente</button></div>}
      <label className="relative block"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar por nome, e-mail, matrícula ou qualidade" className="w-full min-h-9 rounded-xl border border-slate-300 py-1.5 pl-9 pr-3 text-xs outline-none"/></label>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[820px] border-collapse text-left"><thead className="bg-[#005830] text-[10px] font-black uppercase tracking-wider text-white"><tr><th className="px-3 py-2.5">Nome</th><th className="px-3 py-2.5">E-mail</th><th className="px-3 py-2.5">Matrícula</th><th className="px-3 py-2.5">Origem</th><th className="px-3 py-2.5">Qualidade</th><th className="px-3 py-2.5 text-center">Acesso</th><th className="px-3 py-2.5 text-center">Excluir</th></tr></thead><tbody className="divide-y divide-slate-100">
        {loading?<tr><td colSpan={7} className="p-8 text-center text-sm text-slate-500">Carregando…</td></tr>:visible.length===0?<tr><td colSpan={7} className="p-8 text-center text-sm text-slate-500">Nenhum acesso encontrado.</td></tr>:visible.map((entry)=>{const currentRole=((entry.roles?.[0]||entry.accessType||'STUDENT') as ProcessRole);const canDelete=entry.origin!=='TCC_FORM'&&entry.processIds.length===0;return <tr key={entry.id} className="hover:bg-slate-50/70"><td className="px-3 py-2 font-semibold">{entry.nome}</td><td className="px-3 py-2">{entry.email}</td><td className="px-3 py-2">{entry.matricula||'—'}</td><td className="px-3 py-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase">{entry.origin==='TCC_FORM'?'Formulário/TCC':'Lista prévia/manual'}</span></td><td className="px-3 py-2"><select disabled={!canManage} value={currentRole} onChange={(e)=>void setQuality(entry,e.target.value as ProcessRole)} className="min-h-8 rounded-lg border border-slate-300 bg-white px-2 text-[10px] font-black">{roles.map((item)=><option key={item} value={item}>{roleLabels[item]}</option>)}</select></td><td className="px-3 py-2 text-center"><button type="button" disabled={!canManage} onClick={()=>void toggle(entry)} className={`min-h-8 rounded-lg border px-3 text-[10px] font-black ${entry.active?'border-[#2d6c50] bg-[#337959] text-white':'border-slate-300 bg-[#AEB0B3] text-slate-900'}`}>{entry.active?'Ativo':'Inativo'}</button></td><td className="px-3 py-2 text-center"><button type="button" disabled={!canManage||!canDelete} onClick={()=>void remove(entry)} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 disabled:cursor-not-allowed disabled:opacity-35" title={canDelete?'Excluir acesso manual':'Vínculo criado por TCC: desative o acesso em vez de excluir'}><Trash2 className="h-4 w-4"/></button></td></tr>;})}
      </tbody></table></div>
    </div>
  </section>;
};
