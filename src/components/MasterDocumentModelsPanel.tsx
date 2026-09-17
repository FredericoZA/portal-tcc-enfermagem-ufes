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

const normalizeModelKey = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 48);

const humanizeModelKey = (value: string) => value
  .toLowerCase()
  .split('_')
  .filter(Boolean)
  .map(part => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

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
    return merged.filter(([type]) => {
      if (seen.has(type)) return false;
      seen.add(type);
      return true;
    });
  }, [models, pendingSlots]);

  const load = async () => {
    setLoading(true);
    try {
      setModels(await apiClient.getDocumentModels());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao carregar os modelos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const addSlot = () => {
    const label = newModelName.trim();
    const type = normalizeModelKey(label);
    if (label.length < 3 || type.length < 2) {
      setMessage('Informe um nome descritivo para o novo modelo.');
      return;
    }
    if (slots.some(([current]) => current === type)) {
      setMessage('Já existe um modelo com esse identificador.');
      return;
    }
    setPendingSlots(current => [...current, [type, label]]);
    setNewModelName('');
    setMessage('Novo espaço criado. Envie o DOCX para publicá-lo e versioná-lo no Drive.');
  };

  const upload = async (type: string, file?: File) => {
    if (!file) return;
    if (file.type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || !file.name.toLowerCase().endsWith('.docx')) {
      setMessage('Envie um arquivo DOCX válido.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setMessage('O arquivo ultrapassa o limite de 12 MB.');
      return;
    }
    setWorking(type);
    setMessage('');
    try {
      await apiClient.uploadDocumentModelFile(type, file);
      setPendingSlots(current => current.filter(([slot]) => slot !== type));
      setMessage('Modelo cadastrado, versionado e publicado no Google Drive.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível cadastrar o modelo.');
    } finally {
      setWorking('');
    }
  };

  const importLink = async (type: string) => {
    const link = (links[type] || '').trim();
    if (!link) {
      setMessage('Informe o link ou ID do modelo no Google Drive.');
      return;
    }
    setWorking(type);
    setMessage('');
    try {
      await apiClient.importDocumentModelFromDrive(type, link);
      setLinks(current => ({ ...current, [type]: '' }));
      setPendingSlots(current => current.filter(([slot]) => slot !== type));
      setMessage('Modelo copiado para a pasta ativa do portal, validado e versionado.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível importar o modelo.');
    } finally {
      setWorking('');
    }
  };

  const restore = async (type: string, version: number) => {
    if (!(await portalConfirm(`Restaurar a versão ${version} deste modelo?`))) return;
    setWorking(`${type}-${version}`);
    try {
      await apiClient.restoreDocumentModelVersion(type, version);
      await load();
      setMessage(`Versão ${version} restaurada como modelo ativo.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível restaurar a versão.');
    } finally {
      setWorking('');
    }
  };

  const removeModel = async (type: string, label: string) => {
    const persisted = Boolean(models[type]);
    if (!persisted) {
      setPendingSlots(current => current.filter(([slot]) => slot !== type));
      setLinks(current => { const next = { ...current }; delete next[type]; return next; });
      setMessage('Espaço ainda não publicado removido.');
      return;
    }
    if (!(await portalConfirm(`Excluir o modelo “${label}” do catálogo ativo? A exclusão será bloqueada se o fluxo publicado ainda depender dele.`))) return;
    setWorking(`delete-${type}`);
    setMessage('');
    try {
      await apiClient.deleteDocumentModel(type);
      setLinks(current => { const next = { ...current }; delete next[type]; return next; });
      setMessage('Modelo removido do catálogo ativo. O histórico operacional permanece preservado para auditoria.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir o modelo.');
    } finally {
      setWorking('');
    }
  };

  return <section className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
    <div className="flex gap-3">
      <FileUp className="mt-0.5 h-5 w-5 text-emerald-700" />
      <div>
        <h3 className="font-black text-emerald-950">Modelos documentais do usuário Master</h3>
        <p className="mt-1 text-sm leading-6 text-emerald-900">Cadastre quantos modelos DOCX forem necessários. Os quatro modelos institucionais do fluxo principal permanecem disponíveis por padrão, mas o catálogo não fica limitado a eles. Cada publicação fixa revisão e SHA-256; edição direta do arquivo ativo no Drive bloqueia a geração até nova publicação consciente.</p>
      </div>
    </div>

    <div className="mt-3 grid gap-2 rounded-xl border border-emerald-200 bg-white p-3 sm:grid-cols-[1fr_auto]">
      <div>
        <label htmlFor="new-master-model" className="text-[10px] font-black uppercase text-slate-600">Novo tipo de documento</label>
        <input id="new-master-model" value={newModelName} onChange={event => setNewModelName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addSlot(); } }} placeholder="Ex.: Parecer de homologação" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
      </div>
      <button type="button" onClick={addSlot} disabled={!newModelName.trim()} className="inline-flex min-h-11 self-end items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-40"><FilePlus2 className="h-4 w-4" />Adicionar modelo</button>
    </div>

    {message && <p role="status" className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">{message}</p>}
    {!linkImportEnabled && <p className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">O envio de DOCX é o método seguro padrão. A importação por link fica oculta porque exige um escopo Google mais amplo e nova autorização administrativa.</p>}

    <div className="mt-4 grid gap-3 md:grid-cols-2">{slots.map(([type, label]) => {
      const model = models[type];
      const hasFile = Boolean(model?.driveFileId);
      const integrityReady = Boolean(model?.configured && model?.contentSha256);
      const deleting = working === `delete-${type}`;
      return <article key={type} className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <strong className="text-sm text-slate-900">{model?.label || label}</strong>
            <p className="mt-1 truncate text-xs text-slate-500">{hasFile ? `${model.fileName} · versão ${model.activeVersion || 1}` : 'Nenhum modelo cadastrado'}</p>
            {!hasFile && !BASE_SLOTS.some(([baseType]) => baseType === type) && <p className="mt-1 font-mono text-[10px] text-slate-400">ID: {type}</p>}
            {hasFile && !integrityReady && <p className="mt-1 text-xs font-bold text-amber-700">Versão legada: publique novamente para fixar a integridade.</p>}
            {integrityReady && <p className="mt-1 break-all font-mono text-xs text-slate-500" title={model.contentSha256}>SHA-256 {String(model.contentSha256).slice(0, 12)}…</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {integrityReady ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-amber-600" />}
            <button type="button" onClick={() => void removeModel(type, String(model?.label || label))} disabled={Boolean(working)} aria-label={`Excluir modelo ${model?.label || label}`} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 disabled:opacity-40">{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button>
          </div>
        </div>
        {model?.variables?.length > 0 && <p className="mt-2 text-xs text-slate-500">{model.variables.length} variável(is) identificada(s)</p>}
        {linkImportEnabled && <div className="mt-3 flex flex-col gap-2 sm:flex-row"><input aria-label={`Link do modelo ${label}`} value={links[type] || ''} onChange={event => setLinks(current => ({ ...current, [type]: event.target.value }))} placeholder="Link ou ID do Google Docs/Drive" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /><button type="button" onClick={() => void importLink(type)} disabled={Boolean(working) || !(links[type] || '').trim()} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black uppercase text-emerald-900 disabled:opacity-40"><Link2 className="h-4 w-4" />Importar</button></div>}
        <div className="mt-3 flex flex-wrap gap-2"><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black uppercase text-white">{working === type ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}{hasFile ? 'Substituir DOCX' : 'Enviar DOCX'}<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" disabled={Boolean(working)} onChange={event => { void upload(type, event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>{model?.driveFileUrl && <a href={model.driveFileUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black uppercase text-blue-800"><ExternalLink className="h-4 w-4" />Abrir no Drive</a>}</div>
        {model?.versions?.length > 1 && <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2"><summary className="cursor-pointer py-1 text-xs font-black uppercase text-slate-600">Histórico ({model.versions.length})</summary><div className="mt-2 space-y-1">{model.versions.slice().reverse().map((version: any) => <div key={version.version} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 text-xs"><span><strong>v{version.version}</strong> · {version.fileName}{!version.contentSha256 ? ' · legada' : ''}</span>{version.version !== model.activeVersion && version.contentSha256 && <button type="button" onClick={() => void restore(type, version.version)} className="min-h-11 rounded-md border border-slate-300 px-3 py-2 font-black">Restaurar</button>}</div>)}</div></details>}
      </article>;
    })}</div>
    {loading && <p className="mt-3 text-sm text-slate-500">Consultando modelos…</p>}
  </section>;
};
