import test from 'node:test';
import assert from 'node:assert/strict';
import {createDebouncedSettingsWriter} from '../src/utils/debouncedSettingsWriter';

test('autosave coalesce digitação e grava contatos diferentes em sequência',async()=>{
 const calls:string[]=[];let active=0;let peak=0;
 const writer=createDebouncedSettingsWriter<string,string>(async(key,value)=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,5));calls.push(`${key}:${value}`);active--;},10);
 writer.schedule('audit','a');writer.schedule('audit','ab');writer.schedule('audit','abc');writer.schedule('reservation','room');
 await new Promise(resolve=>setTimeout(resolve,40));await writer.flushAll();
 assert.deepEqual(calls,['audit:abc','reservation:room']);assert.equal(peak,1);
});
test('blur/saída salva a última edição e falha de um contato não bloqueia o seguinte',async()=>{
 const calls:string[]=[];const writer=createDebouncedSettingsWriter<string,string>(async(key,value)=>{calls.push(`${key}:${value}`);if(value==='fail')throw new Error('offline');},10000);
 writer.schedule('audit','fail');await assert.rejects(writer.flush('audit'),/offline/);
 writer.schedule('audit','corrected');writer.schedule('reservation','room');await writer.flushAll();await writer.flush('audit');
 assert.deepEqual(calls,['audit:fail','audit:corrected','reservation:room']);
});
test('edição feita durante uma gravação permanece na fila para salvar depois',async()=>{
 let finish:()=>void=()=>{};const calls:string[]=[];
 const writer=createDebouncedSettingsWriter<string,string>(async(_key,value)=>{calls.push(value);if(value==='first')await new Promise<void>(resolve=>{finish=resolve;});},10000);
 writer.schedule('audit','first');const first=writer.flush('audit');await Promise.resolve();writer.schedule('audit','latest');const latest=writer.flush('audit');finish();await Promise.all([first,latest]);assert.deepEqual(calls,['first','latest']);
});
