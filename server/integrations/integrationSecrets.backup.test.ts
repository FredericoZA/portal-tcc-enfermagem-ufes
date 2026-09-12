import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptPortalBackupPayload, encryptPortalBackupPayload } from './integrationSecrets';

test('backup do portal é cifrado e restaura sem perda', () => {
  const before=process.env.PORTAL_SECRET_ENCRYPTION_KEY;
  process.env.PORTAL_SECRET_ENCRYPTION_KEY='11'.repeat(32);
  try {
    const source=JSON.stringify({processes:[{id:'p1'}],secret:'não deve aparecer em claro'});
    const encrypted=encryptPortalBackupPayload(source);
    assert.ok(!encrypted.toString('utf8').includes('não deve aparecer em claro'));
    assert.equal(decryptPortalBackupPayload(encrypted),source);
    const parsed=JSON.parse(encrypted.toString('utf8')); parsed.ciphertext=Buffer.from('adulterado').toString('base64');
    assert.throws(()=>decryptPortalBackupPayload(Buffer.from(JSON.stringify(parsed))));
  } finally { if(before===undefined) delete process.env.PORTAL_SECRET_ENCRYPTION_KEY; else process.env.PORTAL_SECRET_ENCRYPTION_KEY=before; }
});
