import type {ProcessDeletionSummary} from '../../server/workflow/processDeletion';
import type {ReadableAuditLog} from './auditLogPresentation';

/** Only the live deletion projection offers a continuation of an already authorized cleanup. */
export function auditDeletionTaskId(log: ReadableAuditLog): string | undefined {
  const id = log.after?.cleanupTaskId;
  if (log.action !== 'EXCLUSAO_PROCESSO_TCC' || log.entityType !== 'process_deletion'
    || log.after?.cleanupPending !== true || !log.processProtocol
    || typeof id !== 'string' || id !== log.entityId || !/^delete_[\w-]{1,250}$/.test(id)) return;
  return id;
}

export function auditDeletionIsProcessing(log: ReadableAuditLog, now = Date.now()): boolean {
  return Date.parse(log.after?.processingUntil || '') > now;
}

export async function resumeDeletionFromAudit(log: ReadableAuditLog, ports: {
  isMaster: boolean;
  load: () => Promise<ProcessDeletionSummary[]>;
  retry: (id: string) => Promise<ProcessDeletionSummary>;
  confirm: (message: string) => Promise<boolean>;
  now?: () => number;
}): Promise<string> {
  if (!ports.isMaster) throw new Error('Apenas o Master pode retomar a limpeza.');
  const id = auditDeletionTaskId(log);
  if (!id) throw new Error('Este registro não possui uma limpeza pendente vinculada.');
  // Refresh the task before asking for continuation; an old open modal cannot authorize a new target.
  const task = (await ports.load()).find(item => item.id === id && item.protocol === log.processProtocol);
  if (!task || task.status !== 'PENDING') return 'Esta limpeza não está mais pendente. Confira o registro atualizado.';
  if (Date.parse(task.processingUntil || '') > (ports.now?.() ?? Date.now())) return 'A limpeza já está em processamento. Aguarde a atualização do registro.';
  const confirmed = await ports.confirm(`Retomar a limpeza de ${task.protocol}, já excluído do Portal?\nSerão conferidos os recursos ainda pendentes. Arquivos de outros trabalhos e envelopes com assinaturas continuam protegidos.`);
  if (!confirmed) return '';
  // A single request: timeouts never trigger an automatic repeat from this action.
  const result = await ports.retry(id);
  if (result.id !== id || result.protocol !== task.protocol) throw new Error('A resposta não corresponde à limpeza solicitada. Atualize o registro antes de continuar.');
  return result.status === 'COMPLETED'
    ? 'Limpeza concluída. A numeração pode ser reutilizada no próximo cadastro, após a conferência normal do banco.'
    : 'A limpeza continua pendente. Confira os motivos e a próxima tentativa no registro atualizado.';
}
