import assert from 'node:assert/strict';
import test from 'node:test';
import { compactSettingsAudit } from './settingsAuditCompact';

test('alteracao administrativa conserva campos e hashes, sem copiar configuracao inteira', () => {
  const before = {
    emailConfig: { roomReservationDepartmentEnabled: false, auditCopyEmail: 'private@example.invalid' },
    integrationStudio: { templates: ['x'.repeat(170_000)] },
    updatedAt: '2026-11-10',
  };
  const after = {
    ...before,
    emailConfig: {...before.emailConfig, roomReservationDepartmentEnabled: true },
    updatedAt: '2026-11-11',
  };
  const result = compactSettingsAudit(before, after);
  assert.deepEqual(result.after.changedPaths, ['emailConfig.roomReservationDepartmentEnabled']);
  assert.match(result.before.fingerprint, /^[0-9a-f]{64}$/);
  assert.match(result.after.fingerprint, /^[0-9a-f]{64}$/);
  assert.notEqual(result.before.fingerprint, result.after.fingerprint);
  assert.ok(JSON.stringify(result).length < 500);
  assert.doesNotMatch(JSON.stringify(result), /private@example|templates|x{20}/);
});
test('log compacto não interpreta rascunhos grandes nem perde indicacao de mudancas', () => {
  const before = { integrationStudio: { matrixRows: [{name:'antiga'}], other:'stable'} };
  const after = { integrationStudio: { matrixRows: [{name:'nova'}], other:'stable'} };
  const x = compactSettingsAudit(before, after);
  assert.deepEqual(x.after.changedPaths, ['integrationStudio.matrixRows']);
  assert.equal(x.after.truncated, false);
});
