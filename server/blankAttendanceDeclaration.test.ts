import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {attendanceBootstrap,attendancePublication,publishedAttendanceBytes,sameAttendancePublication} from './documents/publicAttendanceDeclaration';
const active=()=>({driveFileId:attendanceBootstrap.sourceFileId,contentSha256:attendanceBootstrap.sourceContentSha256,activeVersion:1} as any);
test('distribuição aprovada contém exatamente o PDF convertido do DOCX v1 oficial',async()=>{
 const publication=attendancePublication(active());assert.ok(publication?.bootstrap);
 const pdf=await publishedAttendanceBytes(publication!);
 assert.equal(pdf.length,75191);assert.equal(createHash('sha256').update(pdf).digest('hex'),attendanceBootstrap.sha256);
 assert.equal((await PDFDocument.load(pdf)).getPageCount(),1);
 assert.equal(await publishedAttendanceBytes(publication!),pdf);
});
test('modelo removido, origem/hash/versão divergentes não recebem fallback antigo',()=>{
 assert.equal(attendancePublication(undefined),null);
 for(const patch of [{driveFileId:'outro_arquivo'},{contentSha256:'f'.repeat(64)},{activeVersion:2}])assert.equal(attendancePublication({...active(),...patch}),null);
});
test('derivado versionado precisa corresponder à origem ativa',()=>{
 const publicPdf={driveFileId:'private_pdf_12345',sourceVersion:2,sourceContentSha256:'f'.repeat(64),sha256:'e'.repeat(64),byteLength:42,publishedAt:'2026-11-07'};
 assert.equal(attendancePublication({...active(),publicPdf}),null);
 assert.equal(attendancePublication({...active(),activeVersion:2,contentSha256:'f'.repeat(64),publicPdf})?.artifact,publicPdf);
});
test('download e catálogo usam o PDF publicado; GET não cria nem converte artefatos',()=>{
 const client=readFileSync('src/utils/blankAttendanceDeclaration.ts','utf8');assert.match(client,/fetch\('\/api\/public\/attendance-declaration.pdf'\)/);assert.doesNotMatch(client,/PDFDocument|createBlankAttendanceDeclarationPdf/);
 const server=readFileSync('server.ts','utf8');const route=server.slice(server.indexOf("app.get('/api/public/attendance-declaration.pdf'"),server.indexOf("app.get('/api/public/templates/access-list.xlsx'"));
 assert.match(route,/status\(410\)/);assert.match(route,/publishedAttendanceBytes/);assert.doesNotMatch(route,/prepareAttendance|renderGoogle|ProcessData|publishMaster|req.params|req.query/);
 for(const pattern of ["app.post('/api/admin/models/:type',requireAuthenticated,requireAdministrator", "app.post('/api/admin/models/:type/link',requireAuthenticated,requireAdministrator", "app.post('/api/admin/models/:type/versions/:version/restore',requireAuthenticated,requireAdministrator"])assert.ok(server.includes(pattern));
 assert.match(server,/const requireAdministrator=requireGlobalRoles\('MASTER_ADMIN'\)/);
 assert.equal(server.split('await prepareAttendanceReferencePdf(').length-1,3);
 assert.match(server,/currentSettings.documentModels\?\.\[type\]!==observedAttendance/);
 assert.match(server,/persistModelPublication\(type,model,before\)/);
 const converter=readFileSync('server/integrations/googleDocsRenderer.ts','utf8').split('export async function renderBlankAttendanceReferencePdf')[1];assert.doesNotMatch(converter,/ProcessData|presentation|replaceAllText|batchUpdate/);assert.match(converter,/finally\{await removeTemporaryFile/);
});

test('falha durável reverte somente publicação07 e não sobrescreve edição concorrente',async()=>{
 const {runInNewContext}=await import('node:vm');
 const source=readFileSync('server.ts','utf8');
 const body=source.slice(source.indexOf('  async function persistModelPublication('),source.indexOf("  app.post('/api/admin/models/:type',"));
 // Exercise the actual publication helper in isolation; no application/environment or integration is started.
 const previous={id:'old'},active={id:'new'};let republished=0;
 const context:any={Error,ATTENDANCE_MODEL:'DECLARACAO_COMPARECIMENTO',currentSettings:{documentModels:{DECLARACAO_COMPARECIMENTO:active}},auditLogsStore:[{entityType:'document_model',entityId:'DECLARACAO_COMPARECIMENTO'}],persistPortalStateDurably:async()=>{throw Error('write failed');},publishRuntimeTemplatesFromSettings:()=>{republished++;},getSupabaseRuntimeStatus:()=>({durablePersistenceReady:false})};
 const {transpileModule}=await import('typescript');
 runInNewContext(transpileModule(body+';globalThis.persist=persistModelPublication;',{}).outputText,context);
 await assert.rejects(context.persist('DECLARACAO_COMPARECIMENTO',active,previous),/write failed/);
 assert.equal(context.currentSettings.documentModels.DECLARACAO_COMPARECIMENTO,previous);assert.equal(context.auditLogsStore.length,0);assert.equal(republished,1);
 const concurrent={id:'other-session'};context.currentSettings.documentModels.DECLARACAO_COMPARECIMENTO=concurrent;
 await assert.rejects(context.persist('DECLARACAO_COMPARECIMENTO',active,previous),/write failed/);
 assert.equal(context.currentSettings.documentModels.DECLARACAO_COMPARECIMENTO,concurrent);
});

test('conversor de referência exporta cópia privada e sempre limpa sem editar modelo ou criar processo',async()=>{
 const {renderBlankAttendanceReferencePdf}=await import('./integrations/googleDocsRenderer');
 const methods:string[]=[];
 const fetchImpl=async(input:any,init:any={})=>{
  const url=String(input);methods.push(`${init.method||'GET'} ${url}`);
  if(url.includes('/files/source123456?'))return Response.json({id:'source123456',name:'reference.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  if(url.includes('/upload/drive/')){assert.match(String(init.body),/privateFolder/);return Response.json({id:'temporary12345'});}
  if(url.includes('/export?'))return new Response(Buffer.from('%PDF-1.4 approved'));
  if(url.includes('/files/temporary12345')&&init.method==='DELETE')return new Response(null,{status:204});
  throw Error(`Unexpected operation ${url}`);
 };
 const pdf=await renderBlankAttendanceReferencePdf({accessToken:'unit-token',fileId:'source123456',verifiedDocxBytes:Buffer.from('PKverified'),temporaryParentId:'privateFolder',fetchImpl:fetchImpl as typeof fetch});
 assert.equal(pdf.toString(),'%PDF-1.4 approved');assert.equal(methods.length,4);assert.ok(methods.at(-1)?.startsWith('DELETE '));assert.ok(methods.every(method=>!method.includes('batchUpdate')&&!method.includes('/documents/')));
 const broken=async(input:any,init:any)=>String(input).includes('/export?')?new Response('invalid PDF'):fetchImpl(input,init);
 await assert.rejects(renderBlankAttendanceReferencePdf({accessToken:'unit-token',fileId:'source123456',verifiedDocxBytes:Buffer.from('PKverified'),temporaryParentId:'privateFolder',fetchImpl:broken as typeof fetch}),/PDF válido/);assert.ok(methods.at(-1)?.startsWith('DELETE '));
});


test('ACK perdido só confirma publicação exata por readback; outro Master e falha de leitura não reenviam',async()=>{
 const {runInNewContext}=await import('node:vm');const {transpileModule}=await import('typescript');
 const source=readFileSync('server.ts','utf8');const body=source.slice(source.indexOf('  async function persistModelPublication('),source.indexOf("  app.post('/api/admin/models/:type',"));
 const active={activeVersion:2,driveFileId:'source_docx_new',contentSha256:'a'.repeat(64),publicPdf:{driveFileId:'approved_pdf_new',sha256:'b'.repeat(64),byteLength:75191,sourceContentSha256:'a'.repeat(64),sourceVersion:2}};
 let reads=0,writes=0,applied=0;let authoritative:any=structuredClone(active);let failRead=false;
 const context:any={Error,remotePersistenceQueue:Promise.reject(Error('lost ACK')),ATTENDANCE_MODEL:'DECLARACAO_COMPARECIMENTO',currentSettings:{documentModels:{DECLARACAO_COMPARECIMENTO:active}},auditLogsStore:[],sameAttendancePublication,getSupabaseRuntimeStatus:()=>({durablePersistenceReady:true}),persistPortalStateDurably:async()=>{writes++;throw Error('ACK lost');},loadPortalRuntimeState:async()=>{reads++;if(failRead)throw Error('read failed');return{settings:{documentModels:{DECLARACAO_COMPARECIMENTO:authoritative}}};},applyPersistedState:(remote:any)=>{applied++;context.currentSettings=remote.settings;},publishRuntimeTemplatesFromSettings:()=>assert.fail('Do not rollback an authoritative result.')};
 context.remotePersistenceQueue.catch(()=>undefined);
 runInNewContext(transpileModule(body+';globalThis.persist=persistModelPublication;',{}).outputText,context);
 await context.persist('DECLARACAO_COMPARECIMENTO',active,{});assert.equal(reads,1);assert.equal(writes,1);assert.equal(applied,1);await context.remotePersistenceQueue;
 authoritative={...structuredClone(active),activeVersion:3};
 await assert.rejects(context.persist('DECLARACAO_COMPARECIMENTO',active,{}),/ACK lost/);assert.equal(context.currentSettings.documentModels.DECLARACAO_COMPARECIMENTO,authoritative);assert.equal(writes,2);assert.equal(applied,2);
 failRead=true;await assert.rejects(context.persist('DECLARACAO_COMPARECIMENTO',active,{}),/resultado é incerto/);assert.equal(writes,3);assert.equal(applied,2);
 context.persistPortalStateDurably=async()=>{throw Error('Conflito de concorrência');};const beforeConflictReads=reads;await assert.rejects(context.persist('DECLARACAO_COMPARECIMENTO',active,{}),/Conflito de concorrência/);assert.equal(reads,beforeConflictReads);
 for(const patch of [{driveFileId:'another_source'},{contentSha256:'f'.repeat(64)},{activeVersion:4},{publicPdf:{...active.publicPdf,driveFileId:'another_pdf'}},{publicPdf:{...active.publicPdf,sha256:'c'.repeat(64)}}])assert.equal(sameAttendancePublication(active,{...active,...patch}),false);
});
