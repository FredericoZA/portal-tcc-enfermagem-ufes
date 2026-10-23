import test from 'node:test';
import assert from 'node:assert/strict';
import {portalOperations,withPortalOperation} from '../src/services/portalOperations';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};};
test('mantém o indicador enquanto houver operações concorrentes e libera ao terminar',async()=>{
 const first=deferred(),second=deferred();
 const a=withPortalOperation('Enviando o trabalho…',()=>first.promise);
 const b=withPortalOperation('Preparando download…',()=>second.promise);
 assert.equal(portalOperations.getSnapshot().pending,2);
 assert.equal(portalOperations.getSnapshot().label,'Enviando o trabalho…');
 first.resolve();await a;
 assert.equal(portalOperations.getSnapshot().pending,1);
 assert.equal(portalOperations.getSnapshot().label,'Preparando download…');
 second.resolve();await b;
 assert.deepEqual(portalOperations.getSnapshot(),{label:'',pending:0});
});
test('falha na transferência remove o indicador e preserva o erro para a tela',async()=>{
 const error=new Error('Falha simulada de envio');
 await assert.rejects(withPortalOperation('Enviando…',async()=>{throw error;}),cause=>cause===error);
 assert.equal(portalOperations.getSnapshot().pending,0);
});
test('upload composto mantém o rótulo entre etapas e encerra as notificações após remover o assinante',async()=>{
 let notifications=0;const unsubscribe=portalOperations.subscribe(()=>{notifications++;});
 await withPortalOperation('Enviando e conferindo…',async()=>{
  await withPortalOperation('Solicitando autorização…',async()=>{});
  assert.equal(portalOperations.getSnapshot().label,'Enviando e conferindo…');
  assert.equal(portalOperations.getSnapshot().pending,1);
  await withPortalOperation('Conferindo envio…',async()=>{});
 });
 assert.equal(notifications,6);unsubscribe();
 await withPortalOperation('Outra operação…',async()=>{});
 assert.equal(notifications,6);
});
