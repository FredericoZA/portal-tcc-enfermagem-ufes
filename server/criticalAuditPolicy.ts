import type {AuditLog} from '../src/types';
import type {EmailDeliveryRecord} from '../src/types/automation';

// Explicit exclusions keep unfamiliar/new events rather than losing accountability.
const routine = new Set([
  'EMAIL_CODIGO_ACESSO_SIMULADO', 'EMAIL_CODIGO_ACESSO_ACEITO_GMAIL',
  'CONVITE_GERADO_PELO_FLUXO', 'FLUXO_CONVITE_CONCLUIDO',
  'PUBLICACAO_DRIVE_SINCRONIZADA', 'SINCRONIZACAO_CALENDARIO_GOOGLE',
  'SINCRONIZACAO_GOOGLE_CALENDAR', 'VERIFICACAO_INTEGRIDADE_DRIVE',
  'CALLBACK_ASTEN_RECONCILIADO', 'CALLBACK_ASTEN_VERSAO_ENCERRADA',
  'DETECCAO_VARIAVEIS_MODELO',
  'SALVAMENTO_AUTOMATICO_ESTUDIO', 'ALTERACAO_IMAGEM_ESTUDIO', 'PADRAO_PLANILHA_ATUALIZADO',
]);
// These rows still coordinate deduplication/recovery; they are not user history.
const internal = new Set([
  'BACKUP_CIFRADO_AUTOMATICO', 'COMPROVANTE_AGUARDA_CONVERSA_ORIGINAL',
  'COPIA_COMUNICACAO_EMAIL_SOLICITADA',
]);
export const criticalAuditExcludedActions:readonly string[]=Object.freeze([...routine,...internal,'SIGNATARIOS_CONFIRMADOS_PELO_PROVEDOR']);
export const retainPortalAudit = (log: Pick<AuditLog, 'action'>): boolean => !routine.has(log.action);
export const visibleCriticalAudit = (log: Pick<AuditLog, 'action'>): boolean =>
  retainPortalAudit(log) && !internal.has(log.action) && log.action !== 'SIGNATARIOS_CONFIRMADOS_PELO_PROVEDOR';

/** Keep failed/uncertain deliveries visible without removing the operational journal. */
export function criticalEmailDelivery(record: EmailDeliveryRecord, now = Date.now()): boolean {
  return (record.status !== 'ACCEPTED_BY_GMAIL' && record.dispatchState !== 'SENDING') || record.dispatchState === 'UNCERTAIN' ||
    (record.dispatchState === 'SENDING' && !(record.dispatchLeaseUntil && Date.parse(record.dispatchLeaseUntil) > now));
}

/** Preserve all loaded history and object identities used by rollback handlers. */
export function createCriticalAuditJournal(logs: AuditLog[]): AuditLog[] {
  Object.defineProperty(logs, 'push', {configurable: true, value: (...rows: AuditLog[]) =>
    Array.prototype.push.apply(logs, rows.filter(retainPortalAudit))});
  return logs;
}
