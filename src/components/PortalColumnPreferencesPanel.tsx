import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, List, Lock, RotateCcw, Save, Shield, Star, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ColumnDef } from './TableColumnSelectorPanel';

interface Props {
  storageKey: string;
  tabTitle: string;
  allColumns: ColumnDef[];
  columnOrder: string[];
  setColumnOrder: (order: string[]) => void;
  visibleColumns: Record<string, boolean>;
  setVisibleColumns: (visible: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
  defaultColumnOrder: string[];
  defaultVisibleColumns: Record<string, boolean>;
  onClose: () => void;
}

function normalizeLayout(allColumns: ColumnDef[], order: string[], visible: Record<string, boolean>) {
  const keys = allColumns.map((column) => column.key);
  const fixed = allColumns.find((column) => column.isFixed)?.key || (keys.includes('protocolo') ? 'protocolo' : keys[0]);
  const nextOrder = Array.from(new Set(order.filter((key) => keys.includes(key))));
  keys.forEach((key) => { if (!nextOrder.includes(key)) nextOrder.push(key); });
  if (fixed) {
    const rest = nextOrder.filter((key) => key !== fixed);
    nextOrder.splice(0, nextOrder.length, fixed, ...rest);
  }
  return { fixed, order: nextOrder, visible: { ...visible, ...(fixed ? { [fixed]: true } : {}) } };
}

async function preferenceRequest(storageKey: string, init?: RequestInit) {
  const response = await fetch(`/api/table-preferences?table=${encodeURIComponent(storageKey)}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Falha ao salvar preferências (${response.status}).`);
  return data;
}

export const PortalColumnPreferencesPanel: React.FC<Props> = ({
  storageKey, tabTitle, allColumns, columnOrder, setColumnOrder, visibleColumns, setVisibleColumns,
  defaultColumnOrder, defaultVisibleColumns, onClose,
}) => {
  const { globalRoles } = useAuth();
  const isMaster = globalRoles.includes('MASTER_ADMIN');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const layout = useMemo(() => normalizeLayout(allColumns, columnOrder, visibleColumns), [allColumns, columnOrder, visibleColumns]);
  const columnMap = useMemo(() => new Map(allColumns.map((column) => [column.key, column])), [allColumns]);

  const persistUser = async (order: string[], visible: Record<string, boolean>) => {
    try {
      await preferenceRequest(storageKey, {
        method: 'PATCH',
        body: JSON.stringify({ tableKey: storageKey, scope: 'USER', config: { columnOrder: order, visibleColumns: visible } }),
      });
      setMessage('Visualização salva para o seu usuário.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar sua visualização.');
    }
  };

  const applyAndPersist = (order: string[], visible: Record<string, boolean>) => {
    const normalized = normalizeLayout(allColumns, order, visible);
    setColumnOrder(normalized.order);
    setVisibleColumns(normalized.visible);
    void persistUser(normalized.order, normalized.visible);
  };

  const move = (index: number, delta: -1 | 1) => {
    const firstMovable = layout.fixed ? 1 : 0;
    const target = index + delta;
    if (index < firstMovable || target < firstMovable || target >= layout.order.length) return;
    const next = [...layout.order];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    applyAndPersist(next, layout.visible);
  };

  const toggle = (key: string, checked: boolean) => {
    if (key === layout.fixed) return;
    applyAndPersist(layout.order, { ...layout.visible, [key]: checked });
  };

  const markAll = (checked: boolean) => {
    const next = { ...layout.visible };
    allColumns.forEach((column) => { next[column.key] = column.key === layout.fixed ? true : checked; });
    applyAndPersist(layout.order, next);
  };

  const setAsDefault = async () => {
    setSaving(true); setMessage('');
    try {
      await preferenceRequest(storageKey, {
        method: 'PATCH',
        body: JSON.stringify({ tableKey: storageKey, scope: 'DEFAULT', config: { columnOrder: layout.order, visibleColumns: layout.visible } }),
      });
      setMessage('Padrão global atualizado. Usuários sem personalização passarão a herdá-lo.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível definir o padrão global.');
    } finally { setSaving(false); }
  };

  const restoreDefault = async () => {
    setSaving(true); setMessage('');
    try {
      const result = await preferenceRequest(storageKey, { method: 'DELETE' });
      const effective = result.effectiveConfig || {};
      const normalized = normalizeLayout(
        allColumns,
        Array.isArray(effective.columnOrder) ? effective.columnOrder : defaultColumnOrder,
        effective.visibleColumns && typeof effective.visibleColumns === 'object' ? { ...defaultVisibleColumns, ...effective.visibleColumns } : defaultVisibleColumns,
      );
      setColumnOrder(normalized.order);
      setVisibleColumns(normalized.visible);
      setMessage('Sua personalização foi removida. Esta planilha voltou ao padrão do Master.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível restaurar o padrão.');
    } finally { setSaving(false); }
  };

  return (
    <section className="space-y-3" aria-label={`Configurar colunas de ${tabTitle}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <List className="h-4 w-4 shrink-0 text-[#337959]" />
          <span className="truncate text-[10px] font-black uppercase tracking-wider text-slate-900">Colunas e ordem — {tabTitle}</span>
          {isMaster && <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[8px] font-black uppercase text-slate-700"><Shield className="h-2.5 w-2.5" />Master</span>}
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Fechar configuração de colunas"><X className="h-4 w-4" /></button>
      </div>

      <p className="text-[10px] leading-4 text-slate-600">Escolha quais colunas deseja ver e altere a ordem. A primeira coluna estrutural do TCC permanece sempre visível e na primeira posição.</p>

      <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {layout.order.map((key, index) => {
          const column = columnMap.get(key) || { key, label: key };
          const fixed = key === layout.fixed;
          const checked = fixed || layout.visible[key] !== false;
          return <div key={key} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${fixed ? 'border-[#9fb8ad] bg-[#e1e6e9]' : checked ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
            <label className="flex min-w-0 flex-1 items-center gap-2 text-[10px] font-bold">
              <input type="checkbox" checked={checked} disabled={fixed} onChange={(event) => toggle(key, event.target.checked)} className="accent-[#337959]" />
              <span className="truncate">{column.label}</span>
            </label>
            {fixed ? <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[8px] font-black uppercase text-slate-600"><Lock className="h-2.5 w-2.5" />1º fixo</span> : <div className="flex gap-0.5"><button type="button" disabled={index <= 1} onClick={() => move(index, -1)} className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-20" aria-label={`Mover ${column.label} para cima`}><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" disabled={index >= layout.order.length - 1} onClick={() => move(index, 1)} className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-20" aria-label={`Mover ${column.label} para baixo`}><ArrowDown className="h-3.5 w-3.5" /></button></div>}
          </div>;
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
        <button type="button" onClick={() => markAll(true)} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[9px] font-black uppercase text-slate-700 hover:bg-slate-50"><Check className="mr-1 inline h-3 w-3" />Mostrar todas</button>
        <button type="button" onClick={restoreDefault} disabled={saving} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[9px] font-black uppercase text-slate-700 hover:bg-slate-50"><RotateCcw className="mr-1 inline h-3 w-3" />Restaurar padrão</button>
        {isMaster && <button type="button" onClick={setAsDefault} disabled={saving} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[#2d6c50] bg-[#337959] px-2.5 py-1.5 text-[9px] font-black uppercase text-white hover:brightness-95"><Star className="h-3 w-3" />Definir padrão para todos</button>}
      </div>
      {message && <div role="status" className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[9px] font-semibold text-slate-700"><Save className="h-3 w-3 text-[#337959]" />{message}</div>}
    </section>
  );
};
