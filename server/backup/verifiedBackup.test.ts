import test from 'node:test';import assert from 'node:assert/strict';import {createVerifiedPortalBackup} from './verifiedBackup';
test('backup cifrado é relido e validado sem alterar o estado; bytes adulterados são recusados',async()=>{
 const old=process.env.PORTAL_SECRET_ENCRYPTION_KEY;process.env.PORTAL_SECRET_ENCRYPTION_KEY='c'.repeat(64);
 try{
  const snapshot={settings:{masterEmail:'master@example.invalid'},processes:[{id:'p',protocolo:'P'}],signatureJobs:[{id:'sig',status:'ARCHIVED'}]};const before=JSON.stringify(snapshot);let encrypted:Buffer=Buffer.alloc(0);
  const dependencies={token:async()=>'test-token',store:async(input:any)=>{assert.equal(input.rootFolderId,'private-root');encrypted=Buffer.from(input.content);assert.ok(!encrypted.toString().includes('master@example.invalid'));return {id:'backup-id',name:input.fileName,webViewLink:'https://drive.google.com/file/d/backup-id/view',folderId:'backup-folder'};},read:async()=>encrypted};
  const report=await createVerifiedPortalBackup(snapshot,'private-root',dependencies,new Date('2026-10-16T03:00:00Z'));assert.equal(report.restorable,true);assert.equal(report.counts.processes,1);assert.equal(JSON.stringify(snapshot),before);
  await assert.rejects(createVerifiedPortalBackup(snapshot,'private-root',{...dependencies,read:async()=>Buffer.from('corrupto')}),/diverge/);
  await assert.rejects(createVerifiedPortalBackup({...snapshot,processes:[{id:'p',protocolo:'P'},{id:'p',protocolo:'P2'}]},'private-root',dependencies),/restauração isolada/);
 }finally{if(old===undefined)delete process.env.PORTAL_SECRET_ENCRYPTION_KEY;else process.env.PORTAL_SECRET_ENCRYPTION_KEY=old;}
});
