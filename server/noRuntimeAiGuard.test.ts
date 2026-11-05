import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
const guard=path.resolve('scripts/check-no-runtime-ai.mjs');
function run(dependencies:Record<string,string>,source='export const count = (items:unknown[]) => items.length;'){
 const directory=mkdtempSync(path.join(tmpdir(),'portal-no-models-'));
 try{
  for(const folder of ['src','server','api','docs'])mkdirSync(path.join(directory,folder));
  writeFileSync(path.join(directory,'package.json'),JSON.stringify({dependencies}));
  writeFileSync(path.join(directory,'server.ts'),source);
  writeFileSync(path.join(directory,'docs','historico.md'),'Referência histórica à API https://api.openai.com/v1/chat/completions, sem código executável.');
  return spawnSync(process.execPath,[guard],{cwd:directory,encoding:'utf8',env:{PATH:process.env.PATH}});
 }finally{rmSync(directory,{recursive:true,force:true});}
}
test('barreira permite programação convencional e preserva referências históricas',()=>{const result=run({express:'4.21.2'});assert.equal(result.status,0,result.stderr);});
test('barreira bloqueia dependências de provedores de modelos',()=>{for(const name of ['openai','@ai-sdk/openai','@google/genai','@anthropic-ai/sdk']){const result=run({[name]:'1.0.0'});assert.equal(result.status,1,name);}});
test('barreira bloqueia endpoint de modelos adicionado ao servidor',()=>{const result=run({},"fetch('https://api.openai.com/v1/chat/completions');");assert.equal(result.status,1);assert.match(result.stderr,/Endpoint de modelos/);});
