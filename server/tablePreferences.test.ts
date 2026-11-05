import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeTablePreference,readStoredTablePreference,tablePreferenceKey,validTableKey,mergeTablePreferences} from '../src/utils/tablePreferences';
test('table preference accepts bounded presentation and discards data, identity and executable styles',()=>{
 const value=sanitizeTablePreference(JSON.parse('{"columnOrder":["titulo","titulo","__proto__"],"visibleColumns":{"titulo":true,"constructor":false},"customLabels":{"titulo":"Trabalho"},"resizedWidths":{"titulo":280,"email":999999},"pageSize":50,"wrapMode":"nowrap","updatedBy":"private@example.invalid","textFormat":{"background":"url(https://bad.invalid)"},"masterEmail":"attacker@example.invalid"}'));
 assert.deepEqual(value,{columnOrder:['titulo'],visibleColumns:{titulo:true},customLabels:{titulo:'Trabalho'},resizedWidths:{titulo:280},pageSize:50,recordsLimit:'all',wrapMode:'nowrap'});
 assert.equal(validTableKey('__proto__'),false);assert.equal(validTableKey('acervo'),true);assert.equal(validTableKey('invented_table'),false);
 assert.throws(()=>sanitizeTablePreference(null));assert.throws(()=>sanitizeTablePreference({customLabels:{x:'x'.repeat(25000)}}));
});
test('personal preferences override the shared default only for their own account',()=>{
 const entries=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>entries.get(k)||null}});
 try{
 entries.set('default_table_config_acervo',JSON.stringify({pageSize:50,wrapMode:'nowrap',columnOrder:['protocolo','titulo'],visibleColumns:{titulo:true}}));
 entries.set(tablePreferenceKey('a@example.invalid','acervo'),JSON.stringify({pageSize:100,wrapMode:'wrap'}));
 entries.set(tablePreferenceKey('b@example.invalid','acervo'),JSON.stringify({pageSize:25}));
 assert.equal(readStoredTablePreference('acervo').pageSize,50);
 assert.equal(readStoredTablePreference('acervo','a@example.invalid').pageSize,100);
 assert.equal(readStoredTablePreference('acervo','b@example.invalid').pageSize,25);
 assert.equal(readStoredTablePreference('acervo','new@example.invalid').pageSize,50);
 assert.equal(readStoredTablePreference('acervo','a@example.invalid',false).pageSize,50);
 }finally{delete(globalThis as any).localStorage;}
});

test('restore waits for pending writes and a failed save cannot block later writes',async()=>{
 const {enqueueTablePreferenceWrite}=await import('../src/services/tablePreferenceWrites');
 const operations:string[]=[];let release!:()=>void;
 const first=enqueueTablePreferenceWrite('a/acervo',async()=>{await new Promise<void>(resolve=>{release=resolve;});operations.push('save');throw new Error('offline');});
 const restored=enqueueTablePreferenceWrite('a/acervo',async()=>{operations.push('restore');return 'done';});
 await Promise.resolve();await Promise.resolve();release();await assert.rejects(first,/offline/);assert.equal(await restored,'done');assert.deepEqual(operations,['save','restore']);
});

test('partial personal columns inherit the rest of the Master layout',()=>{
 assert.deepEqual(mergeTablePreferences({visibleColumns:{titulo:false,email:false}},{visibleColumns:{email:true}}).visibleColumns,{titulo:false,email:true});
});
