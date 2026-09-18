import { portalConfirm } from '../services/portalDialogs';
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, FilePlus2, FileUp, Link2, Loader2, ShieldAlert, Trash2 } from 'lucide-react';
import { apiClient } from '../services/apiClient';

const BASE_SLOTS: Array<[string, string]> = [
  ['CONVITE', 'Carta-convite'],
  ['ATA', 'Ata de defesa'],
  ['TERMO', 'Termo de autorização para publicação'],
  ['DECLARACAO', 'Declaração de participação na banca']
];

const normalizeModelKey = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
const humanizeModelKey = (value: string) => value.toLowerCase().split('_').filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
const primaryAction = 'portal-model-action-primary inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide shadow-sm disabled:opacity-40';
const secondaryAction = 'portal-model-action-secondary inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide shadow-sm disabled:opacity-40';
const compactInput = 'min-h-8 min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[10px] text-slate-800 outline-none focus:border-[#337959]';

export const MasterDocumentModelsPanel: React.FC = () => {
  const [models, setModels] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [links, setLinks] = useState<Record<string, string>>({});
  const [newModelName, setNewModelName] = useState('');
  const [pendingSlots, setPendingSlots] = useState<Array<[string, string]>>([]);
  const linkImportEnabled = Boolean(models.__capabilities?.existingModelLinkImportEnabled);

  const slots = useMemo(() => {
    const persisted: Array<[string, string]> = Object.entries(models)
      .filter(([key, value]) => key !== '__capabilities' && value && typeof value === 'object')
      .map(([key, value]) => [key, String((value as any).label || humanizeModelKey(key))]);
    const merged = [...BASE_SLOTS, ...persisted, ...pendingSlots];
    const seen = new Set<string>();
    return merged.filter(([type]) => { if (seen.has(type)) return false; seen.add(type); return true; });
  }, [models, pendingSlots]);

  const load = async () => {
    setLoading(true);
    try { setModels(await apiClient.getDocumentModels()); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Falha ao carregar os modelos.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const addSlot = () => {
    const label = newModelName.trim();
    const type = normalizeModelKey(label);
    if (label.length < 3 || type.length < 2) { setMessage('Informe um nome descritivo para o novo modelo.'); return; }
    if (slots.some(([current]) => current === type)) { setMessage('Já existe um modelo com esse identificador.'); return; }
    setPendingSlots(current => [...current, [type, label]]); setNewModelName(''); setMessage('Novo espaço criado. Envie o DOCX para publicá-lo e versioná-lo no Drive.');
  };

  const upload = async (type: string, file?: File) => {
    if (!file) return;
    if (file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || !file.name.toLowerCase().endsWith('.docx')) { setMessage('Envie um arquivo DOCX válido.'); return; }
    if (file.size > 12 * 1024 * 1024) { setMessage('O arquivo ultrapassa o limite de 12 MB.'); return; }
    setWorking(type); setMessage('');
    try { await apiClient.uploadDocumentModelFile(type, file); setPendingSlots(current => current.filter(([slot]) => slot !== type)); setMessage('Modelo cadastrado, versionado e publicado no Google Drive.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar o modelo.'); }
    finally { setWorking(''); }
  };

  const importLink = async (type: string) => {
    const link = (links[type] || '').trim();
    if (!link) { setMessage('Informe o link ou ID do modelo no Google Drive.'); return; }
    setWorking(type); setMessage('');
    try { await apiClient.importDocumentModelFromDrive(type, link); setLinks(current => ({ ...current, [type]: '' })); setPendingSlots(current => current.filter(([slot]) => slot !== type)); setMessage('Modelo copiado para a pasta ativa do portal, validado e versionado.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível importar o modelo.'); }
    finally { setWorking(''); }
  };

  const restore = async (type: string, version: number) => {
    if (!(await portalConfirm(`Restaurar a versão ${version} deste modelo?`))) return;
    setWorking(`${type}-${version}`);
    try { await apiClient.restoreDocumentModelVersion(type, version); await load(); setMessage(`Versão ${version} restaurada como modelo ativo.`); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível restaurar a versão.'); }
    finally { setWorking(''); }
  };

  const removeModel = async (type: string, label: string) => {
    const persisted = Boolean(models[type]);
    if (!persisted) { setPendingSlots(current => current.filter(([slot]) => slot !== type)); setLinks(current => { const next = { ...current }; delete next[type]; return next; }); setMessage('Espaço ainda não publicado removido.'); return; }
    if (!(await portalConfirm(`Excluir o modelo “${label}” do catálogo ativo? A exclusão será bloqueada se o fluxo publicado ainda depender dele.`))) return;
    setWorking(`delete-${type}`); setMessage('');
    try { await apiClient.deleteDocumentModel(type); setLinks(current => { const next = { ...current }; delete next[type]; return next; }); setMessage('Modelo removido do catálogo ativo. O histórico operacional permanece preservado para auditoria.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível excluir o modelo.'); }
    finally { setWorking(''); }
  };

  return <section className="portal-master-document-models mb-3 overflow-hidden rounded-xl border shadow-sm">
    <div className="portal-models-heading flex flex-col gap-2 border-b-2 border-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2"><FileUp className="h-4 w-4 shrink-0" /><div><h3 className="text-xs font-black uppercase tracking-wide">Modelos documentais</h3><p className="text-[9px] text-white/80">DOCX versionados no Drive; integridade validada por SHA-256.</p></div></div>
      <div className="flex min-w-0 flex-1 gap-1.5 sm:max-w-xl"><input id="new-master-model" value={newModelName} onChange={event => setNewModelName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addSlot(); } }} placeholder="Novo tipo de documento" className={`${compactInput} flex-1`} /><button type="button" onClick={addSlot} disabled={!newModelName.trim()} className={secondaryAction}><FilePlus2 className="h-3.5 w-3.5" />Adicionar modelo</button></div>
    </div>

    <div className="p-2.5">
      {message && <p role="status" className="mb-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-700">{message}</p>}
      {!linkImportEnabled && <p className="mb-2 rounded-lg border border-slate-200 bg-[#f7f9fa] px-2.5 py-1.5 text-[9px] text-slate-600">Envio de DOCX é o método padrão. Importação por link permanece oculta quando o escopo Google ampliado não está autorizado.</p>}

      <div className="grid gap-2 md:grid-cols-2">{slots.map(([type, label]) => {
        const model = models[type];
        const hasFile = Boolean(model?.driveFileId);
        const integrityReady = Boolean(model?.configured && model?.contentSha256);
        const deleting = working === `delete-${type}`;
        return <article key={type} className="portal-model-card rounded-lg border p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><strong className="truncate text-[10px] text-slate-900">{model?.label || label}</strong>{integrityReady ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#337959]" /> : <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" />}</div><p className="mt-0.5 truncate text-[9px] text-slate-500">{hasFile ? `${model.fileName} · v${model.activeVersion || 1}` : 'Nenhum DOCX publicado'}</p>{integrityReady && <p className="mt-0.5 truncate font-mono text-[8px] text-slate-400">SHA-256 {String(model.contentSha256).slice(0, 12)}… · {model?.variables?.length || 0} variável(is)</p>}</div>
            <button type="button" onClick={() => void removeModel(type, String(model?.label || label))} disabled={Boolean(working)} aria-label={`Excluir modelo ${model?.label || label}`} className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-lg border">{deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</button>
          </div>

          {linkImportEnabled && <div className="mt-2 flex gap-1.5"><input aria-label={`Link do modelo ${label}`} value={links[type] || ''} onChange={event => setLinks(current => ({ ...current, [type]: event.target.value }))} placeholder="Link ou ID do Google Docs/Drive" className={`${compactInput} flex-1`} /><button type="button" onClick={() => void importLink(type)} disabled={Boolean(working) || !(links[type] || '').trim()} className={secondaryAction}><Link2 className="h-3.5 w-3.5" />Importar</button></div>}

          <div className="mt-2 flex flex-wrap gap-1.5"><label className={`${primaryAction} cursor-pointer`}>{working === type ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}{hasFile ? 'Substituir DOCX' : 'Enviar DOCX'}<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" disabled={Boolean(working)} onChange={event => { void upload(type, event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>{model?.driveFileUrl && <a href={model.driveFileUrl} target="_blank" rel="noreferrer" className={secondaryAction}><ExternalLink className="h-3.5 w-3.5" />Abrir no Drive</a>}</div>

          {model?.versions?.length > 1 && <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5"><summary className="cursor-pointer text-[9px] font-black uppercase text-slate-600">Histórico ({model.versions.length})</summary><div className="mt-1 space-y-1">{model.versions.slice().reverse().map((version: any) => <div key={version.version} className="flex items-center justify-between gap-2 rounded-md bg-white p-1.5 text-[9px]"><span className="truncate"><strong>v{version.version}</strong> · {version.fileName}</span>{version.version !== model.activeVersion && version.contentSha256 && <button type="button" onClick={() => void restore(type, version.version)} className={secondaryAction}>Restaurar</button>}</div>)}</div></details>}
        </article>;
      })}</div>
      {loading && <p className="mt-2 text-[10px] text-slate-500">Consultando modelos…</p>}
    </div>
  </section>;
};
