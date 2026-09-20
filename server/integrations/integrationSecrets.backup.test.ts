import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptPortalBackupPayload, encryptPortalBackupPayload, getSecretStoreStatus } from './integrationSecrets';

function restoreEnv(name:string,value:string|undefined){if(value===undefined)delete process.env[name];else process.env[name]=value;}

test('backup v1 do portal é cifrado e restaura sem perda', () => {
  const before=process.env.PORTAL_SECRET_ENCRYPTION_KEY;
  const beforeV2=process.env.PORTAL_SECRET_ENCRYPTION_KEY_V2;
  process.env.PORTAL_SECRET_ENCRYPTION_KEY='11'.repeat(32);
  delete process.env.PORTAL_SECRET_ENCRYPTION_KEY_V2;
  try {
    const source=JSON.stringify({processes:[{id:'p1'}],secret:'não deve aparecer em claro'});
    const encrypted=encryptPortalBackupPayload(source);
    assert.ok(!encrypted.toString('utf8').includes('não deve aparecer em claro'));
    assert.equal(JSON.parse(encrypted.toString('utf8')).schema,'portal-tcc-backup-v1');
    assert.equal(decryptPortalBackupPayload(encrypted),source);
    const parsed=JSON.parse(encrypted.toString('utf8')); parsed.ciphertext=Buffer.from('adulterado').toString('base64');
    assert.throws(()=>decryptPortalBackupPayload(Buffer.from(JSON.stringify(parsed))));
  } finally { restoreEnv('PORTAL_SECRET_ENCRYPTION_KEY',before); restoreEnv('PORTAL_SECRET_ENCRYPTION_KEY_V2',beforeV2); }
});

test('ativar v2 cifra novos backups sem perder leitura de backup v1', () => {
  const before=process.env.PORTAL_SECRET_ENCRYPTION_KEY;
  const beforeV2=process.env.PORTAL_SECRET_ENCRYPTION_KEY_V2;
  process.env.PORTAL_SECRET_ENCRYPTION_KEY='22'.repeat(32);
  delete process.env.PORTAL_SECRET_ENCRYPTION_KEY_V2;
  try {
    const oldBackup=encryptPortalBackupPayload('backup-antigo');
    process.env.PORTAL_SECRET_ENCRYPTION_KEY_V2='33'.repeat(32);
    const newBackup=encryptPortalBackupPayload('backup-novo');
    const parsed=JSON.parse(newBackup.toString('utf8'));
    assert.equal(parsed.schema,'portal-tcc-backup-v2');
    assert.equal(parsed.kid,'v2');
    assert.equal(decryptPortalBackupPayload(oldBackup),'backup-antigo');
    assert.equal(decryptPortalBackupPayload(newBackup),'backup-novo');
    const status=getSecretStoreStatus();
    assert.equal(status.activeKeyId,'v2');
    assert.equal(status.keyCount,2);
    assert.equal(status.rotationReady,true);
  } finally { restoreEnv('PORTAL_SECRET_ENCRYPTION_KEY',before); restoreEnv('PORTAL_SECRET_ENCRYPTION_KEY_V2',beforeV2); }
});
