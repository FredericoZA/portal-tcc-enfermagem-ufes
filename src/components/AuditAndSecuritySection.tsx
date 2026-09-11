import { portalNotice, portalConfirm } from '../services/portalDialogs';
import React, { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';
import { GlobalSettings, AuditLog } from '../types';
import { FileCheck2 } from 'lucide-react';

interface AuditAndSecuritySectionProps {
  settings: GlobalSettings;
  onSettingsUpdated: (updated: GlobalSettings) => void;
  showNotification: (msg: string) => void;
  viewMode?: 'all' | 'accounts_only' | 'logs_only';
}

export const MasterAndPresidentConfigForm: React.FC<Omit<AuditAndSecuritySectionProps, 'viewMode'>> = ({
  settings,
  onSettingsUpdated,
  showNotification
}) => {
  const [masterName, setMasterName] = useState(
    settings.ownerName || settings.portalMaintainerName || 'Administrador Master'
  );
  const [masterEmail, setMasterEmail] = useState(
    settings.masterEmail || ''
  );
  const [presidentName, setPresidentName] = useState(
    settings.commissionPresidentName || 'Prof.ª Drª. Márcia Valéria de Souza Almeida'
  );
  const [presidentEmail, setPresidentEmail] = useState(
    settings.commissionPresidentEmail || ''
  );
  const [recoveryEmails,setRecoveryEmails]=useState((settings.masterRecoveryEmails||[]).join('\n'));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMasterName(settings.ownerName || settings.portalMaintainerName || 'Administrador Master');
    setMasterEmail(settings.masterEmail || '');
    setPresidentName(settings.commissionPresidentName || 'Prof.ª Drª. Márcia Valéria de Souza Almeida');
    setPresidentEmail(settings.commissionPresidentEmail || '');
    setRecoveryEmails((settings.masterRecoveryEmails||[]).join('\n'));
  }, [settings]);

  const handleSaveAccounts = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const normMasterEmail = masterEmail.trim().toLowerCase();
      const normPresidentEmail = presidentEmail.trim().toLowerCase();

      const updated: Partial<GlobalSettings> = {
        ownerName: masterName.trim(),
        commissionPresidentName: presidentName.trim()
      };
      let res = await apiClient.updateSettings(updated);
      const contacts:string[]=Array.from(new Set<string>(recoveryEmails.split(/[\n,;]+/).map(value=>value.trim().toLowerCase()).filter(Boolean)));
      res=await apiClient.updateRecoveryEmails(contacts);
      const transfers:string[]=[];
      if(normMasterEmail&&normMasterEmail!==(settings.masterEmail||'').toLowerCase()){await apiClient.createAdministrationTransfer('MASTER_ADMIN',normMasterEmail);transfers.push('Master');}
      if(normPresidentEmail&&normPresidentEmail!==(settings.commissionPresidentEmail||'').toLowerCase()){await apiClient.createAdministrationTransfer('COMMISSION_PRESIDENT',normPresidentEmail);transfers.push('Presidência');}
      onSettingsUpdated(res);
      showNotification(transfers.length?`Dados salvos. Convite de transferência enviado para: ${transfers.join(' e ')}.`:'Dados administrativos e contatos de recuperação atualizados.');
    } catch (err: any) {
      portalNotice('Erro ao salvar contas do sistema: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
      <div className="border-b border-slate-200 pb-2">
        <h3 className="text-xs font-black uppercase text-slate-900 tracking-wide">
          Contas de Acesso Master & Presidente da Comissão
        </h3>
      </div>

      <form onSubmit={handleSaveAccounts} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Usuário Master */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2.5">
            <div className="border-b border-slate-200 pb-1.5">
              <span className="text-xs font-black uppercase text-slate-800 tracking-wide">
                Usuário Master
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                Nome do Administrador Master:
              </label>
              <input
                type="text"
                required
                value={masterName}
                onChange={(e) => setMasterName(e.target.value)}
                placeholder="Ex: Administrador do Portal"
                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-slate-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                E-mail do Usuário Master:
              </label>
              <input
                type="email"
                required
                value={masterEmail}
                onChange={(e) => setMasterEmail(e.target.value)}
                placeholder="Ex.: master@instituicao.br"
                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-slate-400 outline-none"
              />
            </div>
          </div>

          {/* Presidente da Comissão */}
          <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2.5">
            <div className="border-b border-slate-200 pb-1.5">
              <span className="text-xs font-black uppercase text-slate-800 tracking-wide">
                Presidente da Comissão
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                Nome do Presidente da Comissão:
              </label>
              <input
                type="text"
                required
                value={presidentName}
                onChange={(e) => setPresidentName(e.target.value)}
                placeholder="Ex: Prof.ª Drª. Márcia Valéria de Souza Almeida"
                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-slate-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                E-mail do Presidente da Comissão:
              </label>
              <input
                type="email"
                required
                value={presidentEmail}
                onChange={(e) => setPresidentEmail(e.target.value)}
                placeholder="Ex.: presidente.comissao@instituicao.br"
                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-slate-400 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-700">E-mails de recuperação do Master</label>
          <textarea value={recoveryEmails} onChange={event=>setRecoveryEmails(event.target.value)} required rows={3} placeholder="Um e-mail por linha (máximo 5)" className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"/>
          <p className="mt-1 text-[11px] text-slate-600">A troca de Master ou Presidente nunca é imediata: o novo titular recebe um código e precisa aceitar o convite.</p>
        </div>

        <div className="pt-2 flex items-center justify-end border-t border-slate-200">
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs uppercase tracking-wider rounded-lg border border-slate-300 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <span>{isSaving ? 'Salvando...' : 'Salvar Contas Administrativas'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export const AuditLogsTable: React.FC<Omit<AuditAndSecuritySectionProps, 'viewMode'>> = ({
  settings,
  showNotification
}) => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isRollingBackId, setIsRollingBackId] = useState<string | null>(null);
  const [selectedLogForDiff, setSelectedLogForDiff] = useState<AuditLog | null>(null);

  // Filters and Pagination State
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [referenceFilter, setReferenceFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [pageSize, setPageSize] = useState<number | 'all'>(25);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadAuditLogs();
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [userFilter, actionFilter, referenceFilter, startDateFilter, endDateFilter, pageSize]);

  const loadAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await apiClient.getAuditLogs();
      setAuditLogs(logs || []);
    } catch (err) {
      console.error('Erro ao carregar logs de auditoria:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleRollbackLog = async (logId: string) => {
    if (!(await portalConfirm('Deseja realmente retroceder a esta versão do histórico?'))) {
      return;
    }

    setIsRollingBackId(logId);
    try {
      const res = await apiClient.rollbackAuditLog(logId);
      showNotification(`${res.message}`);
      await loadAuditLogs();
    } catch (err: any) {
      portalNotice('Erro ao realizar restauração: ' + err.message);
    } finally {
      setIsRollingBackId(null);
    }
  };

  const handleDownloadFullBackup = async () => {
    try {
      const fullBackup = await apiClient.getFullBackup();

      const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-portal-tcc-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showNotification('Backup JSON do portal baixado com sucesso!');
    } catch (err: any) {
      portalNotice('Erro ao gerar arquivo de backup: ' + err.message);
    }
  };

  const handleImportBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result as string;
        const parsed = JSON.parse(content);

        if (!parsed.processes && !parsed.settings) {
          portalNotice('Arquivo JSON de backup inválido.');
          return;
        }

        const preview=await apiClient.restoreFullBackup(parsed);
        if(!preview.requiresConfirmation||!preview.confirmHash)throw new Error('O servidor não devolveu a prévia segura da restauração.');
        const count=preview.summary?.processCount??'?';
        if ((await portalConfirm(`Backup validado: ${count} processo(s). Master, Presidente e auditoria atual serão preservados. Deseja confirmar a restauração?`))) {
          const result=await apiClient.restoreFullBackup({...parsed,confirmHash:preview.confirmHash});
          showNotification(result.message||'Portal restaurado com sucesso!');window.location.reload();
        }
      } catch (err: any) {
        portalNotice('Erro ao importar arquivo JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Filtered logs computation
  const filteredLogs = auditLogs.filter((log) => {
    if (userFilter.trim()) {
      const term = userFilter.toLowerCase().trim();
      const userMatch = (log.actorEmail || '').toLowerCase().includes(term);
      if (!userMatch) return false;
    }

    if (actionFilter.trim()) {
      const term = actionFilter.toLowerCase().trim();
      const actionMatch = (log.action || '').toLowerCase().includes(term);
      if (!actionMatch) return false;
    }

    if (referenceFilter.trim()) {
      const term = referenceFilter.toLowerCase().trim();
      const refStr = `${log.processId || ''} ${log.entityType || ''} ${log.entityId || ''}`.toLowerCase();
      if (!refStr.includes(term)) return false;
    }

    if (startDateFilter) {
      const logDate = new Date(log.timestamp).getTime();
      const startDate = new Date(`${startDateFilter}T00:00:00`).getTime();
      if (!isNaN(logDate) && !isNaN(startDate) && logDate < startDate) return false;
    }

    if (endDateFilter) {
      const logDate = new Date(log.timestamp).getTime();
      const endDate = new Date(`${endDateFilter}T23:59:59`).getTime();
      if (!isNaN(logDate) && !isNaN(endDate) && logDate > endDate) return false;
    }

    return true;
  });

  // Unique actions list for dropdown
  const uniqueActions = Array.from(new Set(auditLogs.map(l => l.action).filter(Boolean)));

  // Pagination calculation
  const totalLogs = filteredLogs.length;
  const effectivePageSize = pageSize === 'all' ? totalLogs || 1 : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalLogs / effectivePageSize));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * effectivePageSize;
  const paginatedLogs = pageSize === 'all' ? filteredLogs : filteredLogs.slice(startIndex, startIndex + effectivePageSize);

  const resetAllFilters = () => {
    setUserFilter('');
    setActionFilter('');
    setReferenceFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setPageSize(25);
    setCurrentPage(1);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
        <div>
          <h3 className="text-xs font-black uppercase text-slate-900 tracking-wide flex items-center gap-2">
            <span>Registro de Logs e Auditoria de Segurança</span>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded-full font-mono border border-slate-200">
              {totalLogs} de {auditLogs.length} registro(s)
            </span>
          </h3>
          <p className="text-[11px] text-slate-500">
            Histórico detalhado de alterações, submissões, avaliações e exclusões com suporte a restauração.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadFullBackup}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
          >
            <span>📥</span>
            <span>Baixar Backup JSON</span>
          </button>

          <label className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1">
            <span>📤</span>
            <span>Restaurar Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackupJson}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* COMPREHENSIVE FILTERS TOOLBAR */}
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-700 flex items-center gap-1">
            🔍 Filtrar Registros do Sistema:
          </span>
          {(userFilter || actionFilter || referenceFilter || startDateFilter || endDateFilter || pageSize !== 25) && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-[10.5px] font-bold text-rose-700 hover:text-rose-900 underline cursor-pointer"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {/* Filter 1: User */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">Usuário (Quem)</label>
            <input
              type="text"
              placeholder="Buscar por e-mail..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Filter 2: Action */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">Ação / Atividade</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">Todas as ações</option>
              {uniqueActions.map(act => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          </div>

          {/* Filter 3: Work / Process Reference */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">Referência do Trabalho</label>
            <input
              type="text"
              placeholder="Nº TCC, ID ou Módulo..."
              value={referenceFilter}
              onChange={(e) => setReferenceFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Filter 4: Start Date */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">Data Inicial</label>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Filter 5: End Date */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">Data Final</label>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Filter 6: Lines limit per page */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">Linhas por Página</label>
            <select
              value={pageSize === 'all' ? 'all' : String(pageSize)}
              onChange={(e) => {
                const val = e.target.value;
                setPageSize(val === 'all' ? 'all' : Number(val));
              }}
              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-extrabold text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="25">25 por página</option>
              <option value="50">50 por página</option>
              <option value="100">100 por página</option>
              <option value="all">Ver Todas ({totalLogs})</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABELA DE LOGS */}
      {isLoadingLogs ? (
        <div className="p-8 text-center text-xs text-slate-500 font-medium">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-emerald-600 border-t-transparent mb-2"></div>
          <p>Carregando histórico de alterações...</p>
        </div>
      ) : paginatedLogs.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 font-medium border border-dashed border-slate-300 rounded-xl bg-slate-50/50 space-y-1">
          <p className="font-bold text-slate-700">Nenhum registro de log encontrado com os filtros selecionados.</p>
          <p className="text-[11px]">Tente alterar a busca por usuário, período de datas ou ação.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <th className="p-2.5">Data / Hora</th>
                  <th className="p-2.5">Usuário (Quem)</th>
                  <th className="p-2.5">Ação / Atividade</th>
                  <th className="p-2.5">Referência do Trabalho</th>
                  <th className="p-2.5 text-right">Ação / Opção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {paginatedLogs.map((log) => {
                  const isRolling = isRollingBackId === log.id;
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </td>

                      <td className="p-2.5 font-bold text-slate-900">
                        {log.actorEmail}
                      </td>

                      <td className="p-2.5 font-bold text-slate-800 uppercase text-[11px]">
                        <span className="inline-block bg-slate-100 text-slate-800 border border-slate-300 px-2 py-0.5 rounded text-[10px]">
                          {log.action}
                        </span>
                      </td>

                      <td className="p-2.5 text-slate-700 font-medium">
                        {log.processId ? (
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            TCC #{log.processId}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500">
                            {log.entityType || 'Sistema'}
                          </span>
                        )}
                      </td>

                      <td className="p-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {(log.before || log.after) && (
                            <button
                              type="button"
                              onClick={() => setSelectedLogForDiff(log)}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded text-[10.5px] font-bold border border-slate-300 cursor-pointer"
                            >
                              Detalhes
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isRolling}
                            onClick={() => handleRollbackLog(log.id)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 rounded text-[10.5px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <span>{isRolling ? 'Restaurando...' : 'Restaurar'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* PAGINATION FOOTER CONTROLS */}
          {pageSize !== 'all' && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 border-t border-slate-200 text-xs">
              <span className="text-slate-600 font-medium text-[11px]">
                Mostrando <strong className="text-slate-900">{startIndex + 1}</strong> a <strong className="text-slate-900">{Math.min(startIndex + effectivePageSize, totalLogs)}</strong> de <strong className="text-slate-900">{totalLogs}</strong> registros
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={validPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  ◄ Anterior
                </button>

                <span className="px-3 py-1 bg-slate-100 text-slate-800 font-bold text-xs rounded border border-slate-200">
                  Página {validPage} de {totalPages}
                </span>

                <button
                  type="button"
                  disabled={validPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Próxima ►
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Log Diff Modal */}
      {selectedLogForDiff && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 overflow-y-auto p-4 backdrop-blur-xs flex items-center justify-center animate-fadeIn">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden relative p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h4 className="font-black text-xs sm:text-sm uppercase text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-slate-700" />
                <span>Registro de Edição #{selectedLogForDiff.id}</span>
              </h4>
              <button
                type="button"
                onClick={() => setSelectedLogForDiff(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-xs cursor-pointer"
              >
                ✕ Fechar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-extrabold text-slate-800 uppercase block text-[10px]">Estado Anterior:</span>
                <pre className="font-mono text-[10px] bg-slate-100 p-2 rounded max-h-48 overflow-y-auto custom-scrollbar">
                  {selectedLogForDiff.before ? JSON.stringify(selectedLogForDiff.before, null, 2) : '(Nenhum estado prévio)'}
                </pre>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-extrabold text-slate-800 uppercase block text-[10px]">Estado Atual:</span>
                <pre className="font-mono text-[10px] bg-slate-100 p-2 rounded max-h-48 overflow-y-auto custom-scrollbar">
                  {selectedLogForDiff.after ? JSON.stringify(selectedLogForDiff.after, null, 2) : '(Sem dados registrados)'}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLogForDiff(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AuditAndSecuritySection: React.FC<AuditAndSecuritySectionProps> = ({
  settings,
  onSettingsUpdated,
  showNotification,
  viewMode = 'all'
}) => {
  return (
    <div className="space-y-4">
      {(viewMode === 'all' || viewMode === 'accounts_only') && (
        <MasterAndPresidentConfigForm
          settings={settings}
          onSettingsUpdated={onSettingsUpdated}
          showNotification={showNotification}
        />
      )}
      {(viewMode === 'all' || viewMode === 'logs_only') && (
        <AuditLogsTable
          settings={settings}
          onSettingsUpdated={onSettingsUpdated}
          showNotification={showNotification}
        />
      )}
    </div>
  );
};
