import test from 'node:test';
import assert from 'node:assert/strict';
import {safeApiLogPath} from './requestLogging';
import {reservationToken} from '../workflow/reservationConfirmation';

test('request logs redact reservation capabilities on decision and receipt routes', () => {
  const token = reservationToken({processId: 'private-process', recipient: 'private@example.invalid', revision: 1, expiresAt: Date.now() + 60000}, 'logging-test-secret-0123456789');
  for (const suffix of ['', '/receipt', '?decision=accept', '/receipt?download=1']) {
    const result = safeApiLogPath(`/api/reservation-confirmation/${token}${suffix}`);
    assert.equal(result, `/api/reservation-confirmation/[redacted]${suffix.startsWith('/receipt') ? '/receipt' : ''}`);
    assert.ok(!result.includes(token));
  }
  assert.equal(safeApiLogPath('/api/reservation-confirmation/%invalid.secret/receipt'), '/api/reservation-confirmation/[redacted]/receipt');
  assert.equal(safeApiLogPath('/API/RESERVATION-CONFIRMATION/invalid'), '/API/RESERVATION-CONFIRMATION/[redacted]');
});

test('request logs preserve ordinary paths without query strings or injected log lines', () => {
  assert.equal(safeApiLogPath('/api/processes/abc/documents?email=private@example.invalid'), '/api/processes/abc/documents');
  assert.equal(safeApiLogPath('/api/test\nFORGED\r\u0000'), '/api/testFORGED');
  assert.equal(safeApiLogPath('/api/' + 'a'.repeat(1000)).length, 256);
});
