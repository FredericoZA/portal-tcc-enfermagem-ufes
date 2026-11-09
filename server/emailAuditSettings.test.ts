import test from 'node:test';
import assert from 'node:assert/strict';
import type { GlobalSettings } from '../src/types';
import { emailAuditMailbox, isEmailAuditEnabled } from '../src/utils/emailAuditSettings';

const settings = (emailConfig?: GlobalSettings['emailConfig'], masterEmail = 'master@example.invalid') => ({ masterEmail, emailConfig });

test('auditoria existente da UFES acompanha o Master e permite desligamento explícito', () => {
  assert.equal(isEmailAuditEnabled(settings()), true);
  assert.equal(emailAuditMailbox(settings()), 'master@example.invalid');
  assert.equal(emailAuditMailbox(settings({ auditEmailsEnabled: false })), undefined);
  assert.equal(emailAuditMailbox(settings({ auditEmailsEnabled: true }, ' NEW-MASTER@example.invalid ')), 'new-master@example.invalid');
});

test('destino configurado substitui somente cópia de auditoria; inválido explícito não usa endereço antigo', () => {
  assert.equal(emailAuditMailbox(settings({ auditEmailsEnabled: true, auditCopyEmail: ' NEW-AUDIT@example.invalid ' })), 'new-audit@example.invalid');
  for(const auditCopyEmail of ['', 'invalid','one@example.invalid,two@example.invalid','one@example.invalid\r\nBcc:foreign@example.invalid'])assert.equal(emailAuditMailbox(settings({auditEmailsEnabled:true,auditCopyEmail})),undefined);
  assert.equal(emailAuditMailbox(settings({ auditEmailsEnabled: true }, '')), undefined);
  assert.equal(emailAuditMailbox(settings({ auditEmailsEnabled: true }, 'master@example.invalid\r\nBcc:foreign@example.invalid')), undefined);
  assert.equal(isEmailAuditEnabled(settings({ auditEmailsEnabled: 'false' } as unknown as GlobalSettings['emailConfig'])), false);
});

test('instalação replicada só habilita cópia após escolha explícita', () => {
  const replicated = { ...settings(), installationProfile: { installationId: 'other-course' } as GlobalSettings['installationProfile'] };
  assert.equal(isEmailAuditEnabled(replicated), false);
  assert.equal(emailAuditMailbox(replicated), undefined);
  assert.equal(emailAuditMailbox({ ...replicated, emailConfig: { auditEmailsEnabled: true } }), 'master@example.invalid');
});
