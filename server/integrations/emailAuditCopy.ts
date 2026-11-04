/** Audit copies are configured by the installation, never by message recipients. */
export type EmailAuditCopyMode = 'operational' | 'sensitive';

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const normalize = (email: string) => email.trim().toLowerCase();

const ENTITIES: Record<string, string> = {amp:'&',nbsp:' ',quot:'"',apos:"'",lt:'<',gt:'>',oacute:'ó',eacute:'é',atilde:'ã',ccedil:'ç'};
function decodedEmailContent(content: string): string {
  // Inspection only: this value is never rendered as trusted HTML.
  return content.replace(/&(#x[\da-f]{1,6}|#\d{1,7}|[a-z]+);/gi, (original, entity: string) => {
    if (!entity.startsWith('#')) return ENTITIES[entity.toLowerCase()] ?? original;
    const hex = /^#x/i.test(entity);
    const value = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : original;
  });
}

/** Personal decision/access links must remain exclusively with their recipient. */
export function hasPersonalEmailAccess(text: string, html = ''): boolean {
  const content = decodedEmailContent(`${text}\n${html}`);
  const plain = content.replace(/<[^>]*>/g, ' ').normalize('NFD').replace(/\p{M}|\p{Cf}/gu, '').replace(/\s+/g, ' ');
  return /\/api\/reservation-confirmation\/[a-z\d._~-]+/i.test(content)
    || /[?&](?:amp;)?(?:access_token|token|otp|code)=[^\s&"'<>]+/i.test(content)
    || /\/(?:sign|signature|assinar|assinatura)\/[a-z\d._~-]{12,}/i.test(content)
    || /\bcodigo(?:\s+de\s+(?:acesso|confirmacao))?(?:\s+(?:e|eh))?[\s:.-]*(?<!\d)(?:\d\s*){5}\d(?!\d)/i.test(plain)
    || /\bcodigo\s+abaixo\s+para\s+concluir\s+seu\s+acesso[\s:.-]*(?<!\d)(?:\d\s*){5}\d(?!\d)/i.test(plain);
}

export function emailAuditCopy(input: {
  recipient: string;
  cc?: string[];
  text: string;
  html?: string;
  auditCopyMode?: EmailAuditCopyMode;
  auditCopyEmail?: string;
}): { cc: string[]; auditCopyMode: EmailAuditCopyMode; auditCopyEmail?: string } {
  const auditCopyEmail = input.auditCopyEmail ? normalize(input.auditCopyEmail) : undefined;
  if (auditCopyEmail && !EMAIL.test(auditCopyEmail)) throw new Error('E-mail de auditoria inválido.');
  const auditCopyMode = input.auditCopyMode === 'sensitive' || hasPersonalEmailAccess(input.text, input.html)
    ? 'sensitive' : 'operational';
  // A metadata-only audit does not authorize copying any personal bearer link.
  if (auditCopyMode === 'sensitive') return { cc: [], auditCopyMode, auditCopyEmail };
  const recipient = normalize(input.recipient);
  const cc = [...new Set([...(input.cc || []), ...(auditCopyEmail ? [auditCopyEmail] : [])].map(normalize))]
    .filter(email => email !== recipient);
  if (cc.some(email => !EMAIL.test(email))) throw new Error('E-mail de cópia inválido.');
  return { cc, auditCopyMode, auditCopyEmail };
}
