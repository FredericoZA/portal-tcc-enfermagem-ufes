#!/usr/bin/env node

import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const serverBundle=path.join(root,'dist/server/server.cjs');
const clientDirectory=path.join(root,'dist/client');
if(!existsSync(serverBundle)||!existsSync(path.join(clientDirectory,'index.html')))throw new Error('Execute npm run build antes do smoke test HTTP.');

const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');
const address=socket.address();if(!address||typeof address==='string')throw new Error('Não foi possível reservar uma porta local.');
const port=address.port;socket.close();await once(socket,'close');
const dataDirectory=await mkdtemp(path.join(tmpdir(),'portal-tcc-http-'));
const child=spawn(process.execPath,[serverBundle],{cwd:root,env:{...process.env,NODE_ENV:'development',PORT:String(port),PORTAL_DATA_DIR:dataDirectory,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_SERVE_COMPILED_CLIENT:'true',PORTAL_SESSION_SECRET:'http-test-session-secret-0123456789',PORTAL_OTP_PEPPER:'http-test-otp-pepper-0123456789'},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',chunk=>{output+=String(chunk);});child.stderr.on('data',chunk=>{output+=String(chunk);});
const base=`http://127.0.0.1:${port}`;
async function request(url){let last;for(let attempt=0;attempt<60;attempt++){try{return await fetch(base+url,{redirect:'manual'});}catch(error){last=error;await new Promise(resolve=>setTimeout(resolve,100));}}throw last;}
try{
  const health=await request('/api/health');if(!health.ok)throw new Error(`Saúde HTTP retornou ${health.status}.`);
  const healthBody=await health.json();if(healthBody.status!=='ok')throw new Error('Saúde HTTP não confirmou status ok.');
  const index=await request('/');const html=await index.text();if(!index.ok||!html.includes('<div id="root"></div>')||!html.includes('/assets/index-'))throw new Error('Frontend compilado não foi servido corretamente.');
  for(const [name,expected] of [['x-content-type-options','nosniff'],['x-frame-options','DENY'],['referrer-policy','strict-origin-when-cross-origin']])if(index.headers.get(name)!==expected)throw new Error(`Cabeçalho ${name} ausente ou incorreto.`);
  const scriptPolicy = index.headers.get('content-security-policy')?.split(';').find(value => value.trim().startsWith('script-src'))?.trim();
  if(scriptPolicy!=="script-src 'self'")throw new Error('O cliente compilado deve manter a política de scripts restrita à própria origem.');
  const attemptedSource=await request('/server.ts');const attemptedText=await attemptedSource.text();if(attemptedText.includes('PersistedPortalState')||attemptedText.includes('createPortalServer'))throw new Error('Código-fonte do servidor ficou acessível no diretório público.');
  const publicFiles=await readdir(clientDirectory,{recursive:true});if(publicFiles.some(name=>String(name).endsWith('.map')||String(name).includes('server.cjs')))throw new Error('Bundle do servidor ou sourcemap encontrado em dist/client.');
  console.log('Smoke HTTP: saúde, SPA, cabeçalhos e separação cliente/servidor aprovados.');
}finally{
  child.kill('SIGTERM');
  await Promise.race([once(child,'exit'),new Promise(resolve=>setTimeout(resolve,2000))]);
  if(child.exitCode===null)child.kill('SIGKILL');
  await rm(dataDirectory,{recursive:true,force:true});
}
if(child.exitCode&&child.exitCode!==0)throw new Error(`Servidor compilado encerrou com ${child.exitCode}. ${output.slice(-1000)}`);
