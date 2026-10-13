import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const entry=fileURLToPath(new URL('../scripts/prepare-local.mjs',import.meta.url));
function fixture(content='NODE_ENV="development"\nPORTAL_SESSION_SECRET=""\nPORTAL_OTP_PEPPER=""\n') {
  const cwd=mkdtempSync(join(tmpdir(),'portal-tcc-local-'));
  mkdirSync(join(cwd,'node_modules','.bin'),{recursive:true});
  writeFileSync(join(cwd,'node_modules','.bin',process.platform==='win32'?'vite.cmd':'vite'),'');
  writeFileSync(join(cwd,'.env.development.example'),content);
  const exec=()=>spawnSync(process.execPath,[entry],{cwd,encoding:'utf8',timeout:10_000});
  return {cwd,exec,cleanup:()=>rmSync(cwd,{recursive:true,force:true})};
}
function secret(env,key){return env.match(new RegExp('^'+key+'="([^"]+)"$','m'))?.[1]||'';}

test('preparador local tem sintaxe JavaScript válida',()=>{
  const result=spawnSync(process.execPath,['--check',entry],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});

test('preparação cria segredos fortes e é idempotente',()=>{
  const f=fixture();
  try{
    const first=f.exec();assert.equal(first.status,0,first.stderr);
    const env1=readFileSync(join(f.cwd,'.env.local'),'utf8');
    assert.ok(secret(env1,'PORTAL_SESSION_SECRET').length>=32);
    assert.ok(secret(env1,'PORTAL_OTP_PEPPER').length>=32);
    if(process.platform!=='win32')assert.equal(statSync(join(f.cwd,'.env.local')).mode&0o777,0o600);
    assert.notEqual(secret(env1,'PORTAL_SESSION_SECRET'),secret(env1,'PORTAL_OTP_PEPPER'));
    const second=f.exec();assert.equal(second.status,0,second.stderr);
    assert.equal(readFileSync(join(f.cwd,'.env.local'),'utf8'),env1);
  }finally{f.cleanup();}
});

test('não sobrescreve segredos existentes e recusa credenciais de produção',()=>{
  const content='PORTAL_SESSION_SECRET="'+'A'.repeat(40)+'"\nPORTAL_OTP_PEPPER="'+'B'.repeat(40)+'"\n';
  const f=fixture(content);
  try{
    assert.equal(f.exec().status,0);
    assert.match(readFileSync(join(f.cwd,'.env.local'),'utf8'),/PORTAL_SESSION_SECRET="A{40}"/);
    const saved=readFileSync(join(f.cwd,'.env.local'),'utf8')+'PORTAL_PERSISTENCE_PROVIDER="supabase"\n';
    writeFileSync(join(f.cwd,'.env.local'),saved);
    const blocked=f.exec();assert.equal(blocked.status,2);
    assert.equal(readFileSync(join(f.cwd,'.env.local'),'utf8'),saved);
  }finally{f.cleanup();}
});


test('não permite credenciais externas em .env nem herdadas pelo processo',()=>{
  const f=fixture();
  try{
    writeFileSync(join(f.cwd,'.env'),'SUPABASE_SECRET_KEY="conta-remota"\n');
    const blocked=f.exec();assert.equal(blocked.status,2);
    rmSync(join(f.cwd,'.env'));
    const inherited=spawnSync(process.execPath,[entry],{cwd:f.cwd,encoding:'utf8',timeout:10_000,env:{...process.env,PORTAL_PERSISTENCE_PROVIDER:'supabase'}});
    assert.equal(inherited.status,2);
  }finally{f.cleanup();}
});

test('não confia na primeira de duas variáveis com o mesmo nome',()=>{
  const f=fixture('PORTAL_PERSISTENCE_PROVIDER="local_file"\nPORTAL_PERSISTENCE_PROVIDER="supabase"\nPORTAL_SESSION_SECRET=""\nPORTAL_OTP_PEPPER=""\n');
  try{
    assert.equal(f.exec().status,2);
    writeFileSync(join(f.cwd,'.env.local'),'PORTAL_SESSION_SECRET=""\nPORTAL_OTP_PEPPER=""\n');
    writeFileSync(join(f.cwd,'.env'),'PORTAL_PERSISTENCE_PROVIDER="local_file"\nPORTAL_PERSISTENCE_PROVIDER="supabase"\n');
    assert.equal(f.exec().status,2);
  }finally{f.cleanup();}
});
