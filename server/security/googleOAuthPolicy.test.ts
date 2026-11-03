import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCurrentGoogleOAuthActor } from './googleOAuthPolicy';
const now = 1_792_100_000;
const state = { email: 'master@example.org', bootstrap: true, exp: (now + 600) * 1000 };
const base = { state, masterEmail: 'master@example.org', administrator: false, recentAuthentication: false };
test('primeira conexão mantém o Master durável e normaliza o e-mail', () => {
  assert.equal(assertCurrentGoogleOAuthActor({ ...base, masterEmail: 'MASTER@example.org' }), 'master@example.org');
});
test('antigo Master não recupera controle ao reconectar Google depois da recuperação', () => {
  assert.throws(() => assertCurrentGoogleOAuthActor({ ...base, masterEmail: 'novo@example.org' }), /Master atual/);
  assert.throws(() => assertCurrentGoogleOAuthActor({ ...base, sessionValidAfter: now + 1 }), /revogada/);
  assert.throws(() => assertCurrentGoogleOAuthActor({ ...base, state: { ...state, email: undefined } }), /revogada/);
});
test('reconexão revalida sessão, papel atual e autenticação recente no callback', () => {
  const reconnect = { ...base, state: { ...state, bootstrap: false }, identityEmail: state.email, administrator: true, recentAuthentication: true };
  assert.equal(assertCurrentGoogleOAuthActor(reconnect), state.email);
  for (const patch of [{ identityEmail: undefined }, { identityEmail: 'outro@example.org' }, { administrator: false }, { recentAuthentication: false }]) {
    assert.throws(() => assertCurrentGoogleOAuthActor({ ...reconnect, ...patch }), /administrador/);
  }
});
