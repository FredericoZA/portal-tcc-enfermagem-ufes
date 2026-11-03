import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectAstenDelivery} from './astenReadiness';
const ports=()=>({status:async()=>({dispatchEnabled:true,securityMessage:'Pronto'}),inbox:async()=>true,folder:async()=>2528,google:async()=>({connected:true}),hasDriveRoot:true});
test('readiness checks provider access, target folder, callback inbox and document generator without dispatching',async()=>{
 assert.equal((await inspectAstenDelivery(ports())).ready,true);
 let folderCalls=0;const disabled=await inspectAstenDelivery({...ports(),status:async()=>({dispatchEnabled:false,securityMessage:'Envio desativado'}),folder:async()=>{folderCalls++;}});assert.deepEqual(disabled,{ready:false,reason:'Envio desativado'});assert.equal(folderCalls,0);
 assert.match((await inspectAstenDelivery({...ports(),folder:async()=>{throw Error('Acesso não autorizado!');}})).reason,/Acesso não autorizado/);
 assert.equal((await inspectAstenDelivery({...ports(),inbox:async()=>false})).ready,false);
 assert.match((await inspectAstenDelivery({...ports(),hasDriveRoot:false})).reason,/pasta raiz/);
 assert.match((await inspectAstenDelivery({...ports(),google:async()=>({connected:false})})).reason,/Google Workspace/);
});
test('declaration review uses fresh server checks rather than a stale page dispatch flag',()=>{
 const modal=readFileSync('src/components/AstenDeclarationBatchModal.tsx','utf8');const server=readFileSync('server.ts','utf8');
 assert.doesNotMatch(modal,/dispatchReady/);assert.match(modal,/inspectAstenDeclarations/);assert.match(modal,/!ready.length/);assert.match(modal,/item.recipientEmail/);assert.match(server,/inspectAstenDelivery\(\{status:getPersistentAstenStatus/);assert.match(server,/SOLICITACAO_ASSINATURA_FALHOU/);
});
