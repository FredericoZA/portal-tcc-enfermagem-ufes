import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
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
  studentImportTemplateCsv,
  type StudentImportRow,
} from '../utils/studentImport';
import { portalConfirm } from '../services/portalDialogs';

const primaryButton =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#2d6c50] bg-[#337959] px-3 py-2 text-[11px] font-black uppercase tracking-wide text-white shadow-sm transition hover:brightness-95 disabled:opacity-50';
const inputClass =
  'w-full min-h-10 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400';

const roleLabels: Record<ProcessRole, string> = {
  STUDENT: 'Aluno',
  ADVISOR: 'Orientador',
  CO_ADVISOR: 'Coorientador',
  EXAMINER: 'Membro da banca',
};

const roles: ProcessRole[] = ['STUDENT', 'ADVISOR', 'CO_ADVISOR', 'EXAMINER'];

export const AuthorizedStudentsPanel: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const [entries, setEntries] = useState<AuthorizedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [matricula, setMatricula] = useState('');
  const [role, setRole] = useState<ProcessRole>('STUDENT');
  const [memberType, setMemberType] = useState<'INTERNAL' | 'EXTERNAL'>('INTERNAL');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [importRows, setImportRows] = useState<StudentImportRow[]>([]);

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

  useEffect(() => {
    void load();
  }, []);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await apiClient.addAuthorizedStudent({
        nome,
        email,
        matricula: role === 'STUDENT' ? matricula || undefined : undefined,
        role,
        memberType,
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

  const addRole = async (entry: AuthorizedStudent, nextRole: ProcessRole) => {
    if ((entry.roles || []).includes(nextRole)) return;
    try {
      await apiClient.updateAuthorizedStudent(entry.id, { role: nextRole });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao acrescentar o papel.');
    }
  };

  const remove = async (entry: AuthorizedStudent) => {
    if (!(await portalConfirm('Excluir este acesso manual? Esta ação não remove vínculos acadêmicos de TCC.'))) {
      return;
    }
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

  const confirmImport = async () => {
    setSaving(true);
    setMessage('');
    try {
      const result = await apiClient.importAuthorizedStudents(importRows);
      setMessage(
        result.reused
          ? 'Este mesmo lote já havia sido importado.'
          : `Importação concluída: ${result.created} criado(s), ${result.updated} atualizado(s).`,
      );
      setImportRows([]);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao importar alunos.');
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(
      new Blob([studentImportTemplateCsv()], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_lista_alunos.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const visible = useMemo(
    () =>
      entries.filter((entry) =>
        `${entry.nome} ${entry.email} ${entry.matricula || ''} ${(entry.roles || []).join(' ')} ${entry.memberType || ''}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [entries, search],
  );

  const activeCount = entries.filter((entry) => entry.active).length;
  const linkedCount = entries.filter((entry) => entry.processIds.length > 0).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-[#337959]" />
            <h3 className="font-black text-slate-950">Autorização de acesso</h3>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-600">
            Quem pode entrar no Portal e em qual qualidade. Vínculos criados por um TCC são
            identificados automaticamente e não podem ser apagados por engano.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-black">
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
            {entries.length} cadastrados
          </span>
          <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1">
            {activeCount} ativos
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
            {linkedCount} vinculados
          </span>
        </div>
      </div>

      {canManage && (
        <div className="grid gap-3 border-b border-slate-200 p-3 xl:grid-cols-[1.35fr_.65fr]">
          <form onSubmit={add} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600">
              Adicionar acesso individual
            </h4>
            <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
              <input
                required
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Nome completo"
                className={inputClass}
              />
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="E-mail"
                className={inputClass}
              />
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as ProcessRole)}
                className={inputClass}
              >
                {roles.map((item) => (
                  <option key={item} value={item}>
                    {roleLabels[item]}
                  </option>
                ))}
              </select>
              <select
                value={memberType}
                onChange={(event) => setMemberType(event.target.value as 'INTERNAL' | 'EXTERNAL')}
                className={inputClass}
              >
                <option value="INTERNAL">Interno</option>
                <option value="EXTERNAL">Externo</option>
              </select>
              <input
                required={role === 'STUDENT'}
                disabled={role !== 'STUDENT'}
                value={matricula}
                onChange={(event) => setMatricula(event.target.value)}
                placeholder={role === 'STUDENT' ? 'Matrícula' : 'Matrícula — não se aplica'}
                className={inputClass}
              />
            </div>
            <button disabled={saving} className={`${primaryButton} mt-2`}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar acesso
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-[#337959]" />
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600">
                    Lista prévia de alunos
                  </h4>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">
                  CSV/XLSX: nome, e-mail e matrícula. Importação em lote é exclusiva de estudantes.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                className="min-h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-[10px] font-black"
              >
                <Download className="mr-1 inline h-3.5 w-3.5" />
                Modelo
              </button>
            </div>
            <label className={`${primaryButton} mt-2 cursor-pointer`}>
              <Upload className="h-4 w-4" />
              Selecionar planilha
              <input
                className="sr-only"
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => void readImport(event.target.files?.[0])}
              />
            </label>
          </div>

          {importRows.length > 0 && (
            <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-3">
              <div className="max-h-48 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-[#005830] text-white">
                    <tr>
                      <th className="p-2">Linha</th>
                      <th className="p-2">Nome</th>
                      <th className="p-2">E-mail</th>
                      <th className="p-2">Matrícula</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 100).map((row) => (
                      <tr key={`${row.row}-${row.email}`} className="border-t border-slate-100">
                        <td className="p-2">{row.row}</td>
                        <td className="p-2">{row.nome || '—'}</td>
                        <td className="p-2">{row.email || '—'}</td>
                        <td className="p-2">{row.matricula || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center justify-end">
                <button type="button" disabled={saving} onClick={confirmImport} className={primaryButton}>
                  Confirmar {importRows.length} aluno(s)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-3">
        {message && (
          <p role="status" className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
            {message}
          </p>
        )}
        <label className="relative block">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, e-mail, matrícula ou papel"
            className="w-full min-h-10 rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs outline-none"
          />
        </label>

        <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1040px] border-collapse text-left">
            <thead className="bg-[#005830] text-[10px] font-black uppercase tracking-wider text-white">
              <tr>
                <th className="px-3 py-2.5">Nome</th>
                <th className="px-3 py-2.5">E-mail</th>
                <th className="px-3 py-2.5">Matrícula</th>
                <th className="px-3 py-2.5">Origem</th>
                <th className="px-3 py-2.5">Papel</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5 text-center">TCCs</th>
                <th className="px-3 py-2.5 text-center">Acesso</th>
                <th className="px-3 py-2.5 text-center">Excluir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm text-slate-500">Carregando…</td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-sm text-slate-500">Nenhum acesso encontrado.</td>
                </tr>
              ) : (
                visible.map((entry) => {
                  const entryRoles = (entry.roles?.length
                    ? entry.roles
                    : [entry.accessType || 'STUDENT']) as ProcessRole[];
                  const canDelete = entry.origin !== 'TCC_FORM' && entry.processIds.length === 0;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5 text-xs font-bold text-slate-900">{entry.nome}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{entry.email}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-600">{entry.matricula || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase text-slate-700">
                          {entry.origin === 'MASTER_LIST' ? 'Lista prévia/manual' : 'Incluído pelo TCC'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {entryRoles.map((item) => (
                            <span key={item} className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase text-slate-700">
                              {roleLabels[item]}
                            </span>
                          ))}
                          {canManage && entryRoles.length < roles.length && (
                            <select
                              aria-label={`Adicionar papel para ${entry.nome}`}
                              defaultValue=""
                              onChange={(event) => {
                                if (!event.target.value) return;
                                void addRole(entry, event.target.value as ProcessRole);
                                event.currentTarget.value = '';
                              }}
                              className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-[9px] font-bold"
                            >
                              <option value="">+ papel</option>
                              {roles
                                .filter((item) => !entryRoles.includes(item))
                                .map((item) => (
                                  <option key={item} value={item}>{roleLabels[item]}</option>
                                ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[10px] font-bold text-slate-600">
                        {entry.memberType === 'EXTERNAL' ? 'Externo' : 'Interno'}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs font-bold text-slate-700">
                        {entry.processIds.length}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => void toggle(entry)}
                            className={`inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border px-2.5 text-[10px] font-black ${entry.active ? 'border-slate-300 bg-white text-slate-800' : 'border-slate-300 bg-[#AEB0B3] text-slate-900'}`}
                          >
                            {entry.active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                            {entry.active ? 'Ativo' : 'Inativo'}
                          </button>
                        ) : (
                          <span className="text-xs">{entry.active ? 'Ativo' : 'Inativo'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {canManage ? (
                          <button
                            type="button"
                            disabled={!canDelete}
                            onClick={() => void remove(entry)}
                            title={canDelete ? 'Excluir acesso manual' : 'Vínculo acadêmico: desative o acesso em vez de excluir'}
                            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
