import type { AuditLog } from '../types';
import { formatDateTimeWithWeekday } from './formatters';

type RecordValue = Record<string, unknown>;
export type ReadableAuditLog = AuditLog & {
  processProtocol?: string;
  processTitle?: string;
  actorName?: string;
  source?: 'activity' | 'email';
  emailDeliveryId?: string;
};
export type AuditChange = { field: string; before: string; after: string };
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const labels: Record<string, string> = {
  CRIACAO_PROCESSO: 'Cadastro do TCC concluído', EDICAO_DADOS_PROCESSO: 'Dados do TCC alterados',
  SOLICITACAO_RESERVA_REGISTRADA: 'Solicitação de reserva registrada',
  REENVIO_EMAIL_SOLICITADO: 'Nova tentativa de envio solicitada',
  RECUPERACAO_AVISOS_RESERVA: 'Recuperação de avisos de reserva',
  EMAIL_CODIGO_ACESSO_ACEITO_GMAIL: 'Código de acesso: envio aceito pelo Gmail',
  EMAIL_CODIGO_ACESSO_FALHOU: 'Solicitação de código não concluída',
  EMAIL_CODIGO_ACESSO_SIMULADO: 'Código de acesso: teste local sem envio',
  SOLICITACAO_RESERVA: 'Reserva solicitada', SOLICITACAO_RESERVA_ENVIADA: 'Solicitação de reserva encaminhada',
  REINICIO_SOLICITACAO_RESERVA: 'Nova reserva solicitada', RESERVA_ACEITA: 'Reserva aceita', RESERVA_RECUSADA: 'Reserva recusada',
  CONFIRMACAO_LOCAL_DEPARTAMENTO: 'Reserva aceita', LOCAL_INDISPONIVEL_DEPARTAMENTO: 'Reserva recusada',
  CONFIRMACAO_LOCAL_ADMINISTRATIVA: 'Resposta à reserva registrada', RESPOSTA_RESERVA_REGISTRADA: 'Resposta à reserva registrada',
  FLUXO_CONVITE_CONCLUIDO: 'Convite à banca encaminhado', CONVITE_GERADO_PELO_FLUXO: 'Carta-convite gerada',
  COMPROVANTE_LOCAL_ARQUIVADO: 'Comprovante de reserva arquivado', CONCLUSAO_AVALIACAO: 'Conceito e parecer registrados',
  REABERTURA_AVALIACAO: 'Registro do conceito reaberto', CONCLUSAO_DADOS_REPOSITORIO: 'Entrega final confirmada',
  REABERTURA_ENTREGA_FINAL: 'Entrega final reaberta', SOLICITACAO_ASSINATURA: 'Assinatura solicitada',
  SOLICITACAO_ASSINATURA_FALHOU: 'Não foi possível solicitar a assinatura', REGISTRO_ASSINATURA_EXCLUIDO: 'Registro de assinatura excluído',
  CALLBACK_ASTEN_RECONCILIADO: 'Situação da assinatura atualizada pelo Asten', GOVBR_PDF_RECEBIDO_PARA_CONFERENCIA: 'PDF assinado recebido para conferência',
  GOVBR_CONFERENCIA_MANUAL_APROVADA: 'Assinatura pelo Gov.br conferida', EXCLUSAO_PROCESSO_TCC: 'TCC excluído',
  IMPORTACAO_ALUNOS: 'Lista de acesso importada', CRIACAO_ACESSO_AUTORIZADO: 'Acesso autorizado',
  ATUALIZACAO_ACESSO_AUTORIZADO: 'Cadastro de acesso atualizado', ALTERACAO_ACESSO_AUTORIZADO: 'Situação do acesso alterada',
  EXCLUSAO_ACESSO_AUTORIZADO: 'Cadastro de acesso excluído', ALTERACAO_IMAGEM_ESTUDIO: 'Imagem do modelo alterada',
  PADRAO_PLANILHA_ATUALIZADO: 'Padrão da planilha atualizado', ATUALIZACAO_PERFIL_INSTALACAO: 'Identificação do Portal atualizada',
  ALTERACAO_ADMINISTRACAO_POR_MASTER: 'Responsáveis pela administração alterados', ALTERACAO_CONTATO_RECUPERACAO: 'Contato de recuperação alterado',
  CONFIGURACAO_PASTAS_ASTEN: 'Pastas do Asten configuradas', CONEXAO_ASTEN: 'Conexão com o Asten atualizada',
  CONEXAO_GOOGLE_WORKSPACE: 'Conexão com o Google atualizada', DEFINICAO_PASTA_RAIZ_DRIVE: 'Pasta do Portal no Drive definida',
  SINCRONIZACAO_CALENDARIO_GOOGLE: 'Calendário do Google sincronizado', SINCRONIZACAO_GOOGLE_CALENDAR: 'Calendário do Google sincronizado',
  PUBLICACAO_DRIVE_SINCRONIZADA: 'Publicação dos arquivos atualizada', RETIRADA_PUBLICACAO_REPOSITORIO: 'Publicação dos arquivos retirada',
  MODELO_DOCUMENTAL_PUBLICADO: 'Modelo de documento publicado', MODELO_DOCUMENTAL_IMPORTADO_DO_DRIVE: 'Modelo de documento importado do Drive',
  MODELO_DOCUMENTAL_REMOVIDO: 'Modelo de documento removido', MODELO_DOCUMENTAL_REVISADO_NO_FLUXO_GOVBR: 'Modelo revisado para o Gov.br',
  RESTAURACAO_VERSAO_MODELO: 'Versão do modelo restaurada', RESTAURACAO_VERSAO_ESTUDIO: 'Configuração dos modelos restaurada',
  DETECCAO_VARIAVEIS_MODELO: 'Campos do modelo conferidos', ENVIO_FORMULARIO_PERSONALIZADO: 'Formulário enviado',
  EXPORTACAO_BACKUP_ADMINISTRATIVO: 'Backup administrativo baixado', BACKUP_CIFRADO_AUTOMATICO: 'Backup automático concluído',
  ENSAIO_RESTAURACAO_BACKUP_CIFRADO: 'Recuperação do backup verificada', RESTAURACAO_BACKUP_COMPLETO_JSON: 'Backup restaurado',
  RESTAURACAO_GARANTIA_HISTORICA: 'Versão anterior do TCC restaurada', RESTAURACAO_CONFIGURACOES_HISTORICAS: 'Configuração anterior restaurada',
  FLUXO_CONFIGURADO_COM_PENDENCIA: 'Fluxo executado com pendência', SOLICITACAO_AJUSTE_DOCUMENTO: 'Correção de documento solicitada',
  CRIACAO_PERIODO_ACADEMICO: 'Período acadêmico criado', ALTERACAO_PERIODO_ACADEMICO: 'Período acadêmico alterado',
  ALTERACAO_FEATURE_FLAG: 'Disponibilidade de uma função alterada', HOMOLOGACAO_ASSISTIDA_INTEGRACOES: 'Integrações verificadas',
  VERIFICACAO_INTEGRIDADE_DRIVE: 'Arquivos do Drive conferidos', GERACAO_DOSSIE_INSTITUCIONAL: 'Dossiê do TCC gerado',
  DOWNLOAD_PUBLICO_AUTORIZADO: 'Documento público consultado', INICIO_TRANSFERENCIA_ADMINISTRACAO: 'Transferência da administração solicitada',
  CONCLUSAO_TRANSFERENCIA_ADMINISTRACAO: 'Transferência da administração concluída', CANCELAMENTO_TRANSFERENCIA_ADMINISTRACAO: 'Transferência da administração cancelada',
  TROCA_DONO_EMERGENCIA_MASTER: 'Responsável Master alterado', SOBRESCRITA_CONFLITO_DEFESA: 'Conflito de agendamento autorizado pela administração',
};
const statuses: Record<string, string> = {
  REQUEST_FAILED: 'Solicitação de código não concluída', SIMULATED: 'Teste local sem envio', ACCEPTED_BY_GMAIL: 'Aceito pelo Gmail', RETRY: 'Nova tentativa pendente', FAILED: 'Falha no envio',
  SENDING: 'Envio em processamento', UNCERTAIN: 'Resultado do envio não confirmado; conferir no Gmail', SENT: 'Encaminhado', PENDING: 'Aguardando envio', CANCELED: 'Envio cancelado',
  CONFIRMED: 'Reserva aceita', UNAVAILABLE: 'Reserva recusada', CONFIRMADO: 'Confirmada', RECUSADO: 'Recusada', NEGADO: 'Negada', REJEITADO: 'Recusada',
  form: 'Formulário', email: 'E-mail', receipt: 'Comprovante', headerImageUrl: 'Imagem do cabeçalho', headerLogo: 'Imagem do cabeçalho',
  ORIENTADOR: 'Orientador', ADVISOR: 'Orientador', EXAMINER_2: 'Examinador', EXAMINER_3: 'Examinador',
  STUDENT: 'Aluno autor', CO_ADVISOR: 'Coorientador', MASTER_ADMIN: 'Administrador Master', COMMISSION_PRESIDENT: 'Presidência da comissão',
  CONVITE: 'Carta-convite', ATA: 'Ata', TERMO: 'Termo de autorização', DECLARACAO: 'Declaração de participação',
  PENDENTE: 'Pendente', APROVADO: 'Aprovado', APROVADO_COM_RESSALVA: 'Aprovado com ressalva', REPROVADO: 'Reprovado',
  CONCLUIDO: 'Concluído', SIGNED: 'Assinado', ARCHIVED: 'Arquivado', READY_FOR_REVIEW: 'Aguardando conferência',
  PARTIALLY_SIGNED: 'Assinaturas ainda pendentes', DRIVE_SYNC_PENDING: 'Aguardando arquivamento no Drive',
  SEND_FAILED: 'Falha no envio', DENIED: 'Recusado', APPROVED: 'Aprovado', ASTEN: 'Asten', GOV_BR: 'Gov.br',
};
const entities: Record<string, string> = {
  settings: 'Configurações do Portal', integration_studio: 'Modelos e configurações', process_document: 'Documentos do TCC',
  integration: 'Integrações do Portal', authorized_access: 'Lista de acesso', authorized_student_batch: 'Lista de acesso',
  signature_job: 'Registro de assinatura', system_backup: 'Backup do Portal', installation_profile: 'Identificação do Portal',
  academic_cycle: 'Período acadêmico', feature_flag: 'Funções do Portal', security: 'Segurança do acesso',
  administration_transfer: 'Administração do Portal', workflow_run: 'Fluxos do TCC', publication: 'Publicação dos arquivos',
  email_delivery: 'Envio de e-mail', form_submission: 'Formulários', spreadsheet: 'Padrão das planilhas',
};
const fields: Record<string, string> = {
  kind: 'Tipo de modelo', field: 'Imagem alterada', funcao: 'Função',
  titulo: 'Título do TCC', protocolo: 'Protocolo', nome: 'Nome completo', email: 'E-mail', matricula: 'Matrícula ou registro',
  siape: 'Matrícula, SIAPE ou outro registro', tratamento: 'Tratamento', titulacao: 'Titulação', instituicao: 'Instituição',
  startAt: 'Data e horário da defesa', endAt: 'Fim da defesa', local: 'Local da defesa', localStatus: 'Situação da reserva',
  status: 'Situação', decision: 'Resposta à reserva', recipient: 'Destinatário', recipients: 'Destinatários', cc: 'Em cópia',
  requestedBy: 'Solicitado por', requestedAt: 'Solicitado em', respondedBy: 'Resposta registrada por', respondedAt: 'Resposta registrada em',
  subject: 'Assunto', provider: 'Serviço de envio', acceptedAt: 'Aceito pelo Gmail em', nextRetryAt: 'Nova tentativa pendente a partir de',
  dispatchState: 'Confirmação do envio', dispatchStartedAt: 'Envio iniciado em',
  source: 'Origem', fileName: 'Nome do arquivo', documentType: 'Documento', active: 'Acesso ativo', roles: 'Permissões',
  origin: 'Origem do cadastro', memberType: 'Tipo de participante', resumoSintese: 'Resumo síntese', palavrasChave: 'Palavras-chave',
  allowPublicFullText: 'Publicação do TCC autorizada', allowPublicExtendedAbstract: 'Publicação do resumo expandido autorizada',
  updatedBy: 'Alterado por', createdBy: 'Criado por', courseName: 'Nome do curso', institutionalName: 'Nome da instituição',
  portalName: 'Nome do Portal', masterEmail: 'E-mail do Master', commissionPresidentEmail: 'E-mail da presidência',
  commissionPresidentName: 'Nome da presidência', contactEmail: 'E-mail de contato', title: 'Título', description: 'Descrição',
  headerLogo: 'Imagem do cabeçalho', logoUrl: 'Imagem do cabeçalho', imageUrl: 'Imagem', image: 'Imagem', headerImage: 'Imagem do cabeçalho',
  body: 'Texto do modelo', name: 'Nome', text: 'Texto', enabled: 'Disponível', format: 'Formato', imageMimeType: 'Formato da imagem',
  checked: 'Itens verificados', failed: 'Pendências',
};
const hiddenField = /(?:^|\.)(?:id|processId|entityId|dataRevision|reservationRevision|revision|createdAt|updatedAt|workflowRunId|driveFileId|driveFolderId|sha256|contentSha256|signedSha256|encryptedSha256|sourceSha256|idempotencyKey|rfcMessageId|replyThreadId|replyMessageId|gmailMessageId|gmailThreadId|emailHash|emailHashes|callbackFingerprint|sourceDataRevision)(?:\.|$)|base64|token|secret|password|credential|api[_-]?key|artifact|contentText|htmlBody|renderedHtml|renderedText/i;
const participantField = (path: string) => path.startsWith('aluno1.') || path.startsWith('aluno2.') ? 'Autor' : path.startsWith('orientador.') ? 'Orientador' : path.startsWith('coorientador.') ? 'Coorientador' : /^banca\.\d+\./.test(path) ? 'Examinador' : '';
const words = (value: string) => value.replace(/([a-zá-ú])([A-ZÁ-Ú])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
export function redactAuditText(value: unknown): string {
  return String(value ?? '').replace(/data:[^\s]+/gi, '[imagem preservada no cadastro]')
    .replace(/https?:\/\/[^\s<>"']*(?:reservation-confirmation|signature|signer|assinatura|[?&](?:token|code|key|secret)=)[^\s<>"']*/gi, '[link pessoal omitido na auditoria]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?\b/g, '[credencial omitida]');
}
export function auditStatusLabel(status: unknown): string {
  const raw = String(status || '').trim();
  return statuses[raw] || (raw ? words(raw).replace(/^./u, char => char.toLocaleUpperCase('pt-BR')) : 'Não informado');
}
export function isEmailAudit(log: ReadableAuditLog): boolean {
  return log.source === 'email' || Boolean(log.emailDeliveryId) || log.entityType === 'email_delivery' || log.action.startsWith('EMAIL_CODIGO_ACESSO_');
}
export function auditIsReservationEmailDecision(log: ReadableAuditLog): boolean {
  return ['CONFIRMACAO_LOCAL_DEPARTAMENTO', 'LOCAL_INDISPONIVEL_DEPARTAMENTO'].includes(log.action) || object(log.after).attribution === 'EMAIL_LINK';
}
function queuedWithoutAttempt(data: RecordValue): boolean {
  const count = Array.isArray(data.attempts) ? data.attempts.length : Number(data.attempts || 0);
  return data.status === 'RETRY' && count === 0;
}
export function emailDeliveryStatusLabel(data: RecordValue): string {
  const dispatchState = emailDispatchState(data);
  if (dispatchState === 'SENDING' || dispatchState === 'UNCERTAIN') return auditStatusLabel(dispatchState);
  return queuedWithoutAttempt(data) ? 'Aguardando envio' : auditStatusLabel(data.status);
}
function emailDispatchState(data: RecordValue): unknown {
  if (data.dispatchState === 'SENDING' && !(typeof data.dispatchLeaseUntil === 'string' && Date.parse(data.dispatchLeaseUntil) > Date.now())) return 'UNCERTAIN';
  return data.dispatchState;
}
export function canRetryEmailDelivery(data: { status?: unknown; dispatchState?: unknown }): boolean {
  return !data.dispatchState && (data.status === 'FAILED' || data.status === 'RETRY');
}
export function auditActionLabel(log: ReadableAuditLog): string {
  if (isEmailAudit(log) && object(log.after).dispatchState) return `E-mail: ${emailDeliveryStatusLabel(object(log.after)).replace(/^./u, char => char.toLocaleLowerCase('pt-BR'))}`;
  if (log.action.startsWith('EMAIL_CODIGO_ACESSO_')) return labels[log.action] || 'Solicitação de código de acesso';
  if (isEmailAudit(log) && queuedWithoutAttempt(object(log.after))) return 'E-mail: aguardando envio';
  if (isEmailAudit(log)) return `E-mail: ${emailDeliveryStatusLabel(object(log.after)).replace(/^./u, char => char.toLocaleLowerCase('pt-BR'))}`;
  if (log.action === 'CONFIRMACAO_LOCAL_ADMINISTRATIVA' || log.action === 'RESPOSTA_RESERVA_REGISTRADA') {
    const after = object(log.after), response = object(object(after.defesa).departmentResponse);
    const decision = after.decision || response.decision;
    if (decision === 'UNAVAILABLE' || after.localStatus === 'RECUSADO') return 'Reserva recusada';
    if (decision === 'CONFIRMED' || after.localStatus === 'CONFIRMADO') return 'Reserva aceita';
  }
  return labels[log.action] || words(log.action || 'Evento registrado').replace(/^./u, char => char.toLocaleUpperCase('pt-BR'));
}
export function auditActor(log: ReadableAuditLog): { name: string; email: string } {
  const email = log.actorEmail || '';
  const system = /^(?:system|sistema|cron|webhook)@|^(?:sistema|system)$/i.test(email);
  return { name: log.actorName || (system ? (email.startsWith('webhook@') ? 'Atualização automática do Asten' : 'Sistema do Portal') : email || 'Sistema do Portal'), email: system ? '' : email };
}
export function auditReference(log: ReadableAuditLog): { title: string; detail: string } {
  const before = object(log.before), after = object(log.after);
  const protocol = String(log.processProtocol || after.protocolo || before.protocolo || (/^(?:TCC-|\d{3}\s*-\s*Legado)/i.test(log.processId || '') ? log.processId : ''));
  if (protocol) return { title: protocol, detail: String(log.processTitle || after.titulo || before.titulo || '') };
  if (log.processId) return { title: 'Processo de TCC', detail: log.processTitle || 'Referência histórica sem protocolo disponível' };
  return { title: entities[log.entityType] || 'Administração do Portal', detail: '' };
}
export function auditSearchText(log: ReadableAuditLog): string {
  const actor = auditActor(log), reference = auditReference(log), after = object(log.after);
  return [actor.name, actor.email, auditActionLabel(log), reference.title, reference.detail, after.recipient, ...(Array.isArray(after.cc) ? after.cc : []), after.subject, after.requestedBy, log.action, log.processId].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
}
export function auditDisplayValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Não informado';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (Array.isArray(value)) return value.map(auditDisplayValue).join('; ') || 'Nenhum';
  if (typeof value === 'object') return 'Dados atualizados';
  const raw = String(value);
  if (/^data:/i.test(raw)) return 'Imagem atualizada';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:/.test(raw) && Number.isFinite(Date.parse(raw))) return formatDateTimeWithWeekday(raw);
  return redactAuditText(statuses[raw] || raw);
}
export function auditChangesTable(log: ReadableAuditLog): AuditChange[] {
  const flatten = (value: unknown, prefix = '', out: RecordValue = {}, depth = 0): RecordValue => {
    if (hiddenField.test(prefix) || depth > 6 || Object.keys(out).length >= 250) return out;
    if (Array.isArray(value) && value.every(item => typeof item !== 'object')) { out[prefix] = value; return out; }
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) flatten(item, prefix ? `${prefix}.${key}` : key, out, depth + 1);
    } else if (prefix) out[prefix] = value;
    return out;
  };
  const before = flatten(log.before), after = flatten(log.after);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map(key => {
    const last = key.split('.').at(-1) || key;
    const field = fields[last] || words(last).replace(/^./u, char => char.toLocaleUpperCase('pt-BR'));
    const person = participantField(key);
    return { field: person ? `${person} · ${field}` : field, before: auditDisplayValue(before[key]), after: auditDisplayValue(after[key]) };
  });
}
export function canRestoreAudit(log: ReadableAuditLog): boolean {
  if (isEmailAudit(log)) return false;
  const snapshot = object(log.before || log.after);
  return Boolean(Object.keys(snapshot).length) && (['settings', 'integration_studio'].includes(log.entityType) || Boolean(snapshot.id && snapshot.protocolo));
}
export function emailAuditData(log: ReadableAuditLog) {
  const data = object(log.after);
  const dispatchState = emailDispatchState(data);
  const attempts = Array.isArray(data.attempts) ? data.attempts.map(item => object(item)) : [];
  return {
    recipient: auditDisplayValue(data.recipient), cc: auditDisplayValue(data.cc || []), subject: auditDisplayValue(data.subject),
    sender: data.sender ? auditDisplayValue(data.sender) : 'Não registrado neste envio',
    sensitive: data.auditCopyMode === 'sensitive' || log.action.startsWith('EMAIL_CODIGO_ACESSO_'),
    provider: auditDisplayValue(data.provider || 'Gmail'), requestedBy: data.requestedBy ? auditDisplayValue(data.requestedBy) : auditActor(log).email ? auditDisplayValue(log.actorEmail) : 'Não identificada no registro',
    status: emailDeliveryStatusLabel(data), rawStatus: String(data.status || ''), canRetry: canRetryEmailDelivery(data),
    acceptedAt: !data.dispatchState && data.status === 'ACCEPTED_BY_GMAIL' && data.acceptedAt ? auditDisplayValue(data.acceptedAt) : '',
    nextRetryAt: !data.dispatchState && data.status === 'RETRY' && data.nextRetryAt ? auditDisplayValue(data.nextRetryAt) : '',
    attempts: attempts.map((attempt, index) => ({number: String(attempt.number || index + 1), at: auditDisplayValue(attempt.completedAt || attempt.startedAt), status: auditStatusLabel(attempt.errorCode === 'GMAIL_DELIVERY_UNCERTAIN' ? 'UNCERTAIN' : attempt.status), error: redactAuditText(attempt.errorMessage || '')})),
    attemptCount: Array.isArray(data.attempts) ? attempts.length : Number(data.attempts || 0),
    explanation: dispatchState === 'SENDING' ? 'O envio está em processamento. Aguarde a conclusão e atualize este registro antes de tentar novamente.'
      : dispatchState === 'UNCERTAIN' ? 'A tentativa foi iniciada, mas o retorno do Gmail não foi confirmado. Confira a caixa Enviados do Gmail antes de autorizar outra mensagem.'
      : data.status === 'ACCEPTED_BY_GMAIL'
      ? 'O Gmail aceitou o envio. Este registro não confirma que a mensagem chegou à caixa de entrada ou foi lida.'
      : queuedWithoutAttempt(data) ? 'O e-mail está pendente. Ainda não há tentativa de envio registrada.'
      : data.status === 'RETRY' ? 'O envio não foi confirmado. Há uma nova tentativa pendente; a data indicada não confirma que ela foi executada.'
      : data.status === 'FAILED' ? 'O envio falhou. Confira o destinatário e a situação da integração antes de tentar novamente.'
      : data.status === 'REQUEST_FAILED' ? 'A solicitação não foi concluída. Este registro não confirma que uma tentativa de envio chegou a ser iniciada.'
      : data.status === 'SIMULATED' ? 'Este registro pertence a um teste local. Nenhuma mensagem foi enviada pelo Gmail.'
      : data.status === 'CANCELED' ? 'O envio foi cancelado; esse registro é mantido para auditoria.' : 'Acompanhe a situação e as tentativas registradas pelo serviço de envio.',
  };
}
