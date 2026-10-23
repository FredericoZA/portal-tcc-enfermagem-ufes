import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureProcessDriveStructure} from '../../src/services/googleDriveOrganizer';
import {ensurePortalRenderFolder,resolvePortalTechnicalRoot,storePrivatePortalBackup,upsertLivingIntelligenceFile} from './googleWorkspace';

const academic='academic_root_123456';
const technical='technical_root_123456';
const reply=(body:unknown)=>new Response(JSON.stringify(body),{status:200});
function configured(t:any){
 const previous=process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;
 process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID=technical;
 t.after(()=>{if(previous===undefined)delete process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;else process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID=previous;});
}

test('organizar processo cria apenas sua pasta e não recria formulários antigos ou resumo opcional',async t=>{
 const writes:any[]=[];
 t.mock.method(globalThis,'fetch',async(_input:unknown,init?:RequestInit)=>{
  if(init?.method==='POST'){const body=JSON.parse(String(init.body));writes.push(body);return reply({id:'process_folder',...body});}
  return reply({files:[]});
 });
 const result=await ensureProcessDriveStructure('test-token',academic,{id:'p1',protocolo:'TCC-2026-0001'});
 assert.equal(result.createdCount,1);
 assert.deepEqual(writes.map(item=>({name:item.name,parents:item.parents})),[{name:'TCC-2026-0001',parents:[academic]}]);
});

test('conversões, backups e relatórios usam a raiz técnica sem criar outro Sistema',async t=>{
 configured(t);const writes:any[]=[];
 t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
  const url=String(input);
  if(url.includes('/permissions?'))return reply({permissions:[{type:'user',role:'owner'}]});
  if(url.includes(`/files/${technical}?`))return reply({id:technical,mimeType:'application/vnd.google-apps.folder',parents:['owner_root'],capabilities:{canAddChildren:true}});
  if(init?.method==='POST'){
   if(url.includes('uploadType=multipart'))return reply({id:'artifact',name:'file'});
   const body=JSON.parse(String(init.body));writes.push(body);return reply({id:`destination_${writes.length}`,name:body.name});
  }
  return reply({files:[]});
 });
 await ensurePortalRenderFolder('test-token',academic);
 await storePrivatePortalBackup({accessToken:'test-token',rootFolderId:academic,fileName:'PORTAL_TCC_BACKUP_2026-10-22T12-00-00Z.ptb',content:Buffer.from('encrypted fixture'),sha256:'a'.repeat(64)});
 await upsertLivingIntelligenceFile({accessToken:'test-token',rootFolderId:academic,fileName:'RELATORIO.md',content:'Relatório agregado',kind:'TCC_STATISTICAL_REPORT',sha256:'b'.repeat(64),version:1,generatedAt:new Date().toISOString()});
 assert.deepEqual(writes.map(item=>item.name),['03_TEMPORARIOS_DOCUMENTAIS','02_BACKUPS_CIFRADOS','01_INTELIGENCIA_CONTINUA']);
 assert.ok(writes.every(item=>item.parents[0]===technical));
});

test('destino técnico público ou dentro da raiz acadêmica é recusado antes de gravar',async t=>{
 configured(t);let writes=0;
 const mock=t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
  if(init?.method==='POST')writes++;
  if(String(input).includes('/permissions?'))return reply({permissions:[{type:'anyone',role:'reader'}]});
  return reply({id:technical,mimeType:'application/vnd.google-apps.folder',parents:['owner_root'],capabilities:{canAddChildren:true}});
 });
 await assert.rejects(resolvePortalTechnicalRoot('test-token',academic),/compartilhada/);
 mock.mock.restore();
 t.mock.method(globalThis,'fetch',async()=>reply({id:technical,mimeType:'application/vnd.google-apps.folder',parents:[academic],capabilities:{canAddChildren:true}}));
 await assert.rejects(resolvePortalTechnicalRoot('test-token',academic),/fora da raiz/);
 assert.equal(writes,0);
});

test('produção sem destino técnico configurado falha sem recriar pastas acadêmicas',async t=>{
 const previous=process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;const previousMode=process.env.NODE_ENV;
 delete process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;process.env.NODE_ENV='production';
 t.after(()=>{if(previous===undefined)delete process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;else process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID=previous;if(previousMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousMode;});
 t.mock.method(globalThis,'fetch',async()=>{throw new Error('Não deve chamar o provedor.');});
 await assert.rejects(resolvePortalTechnicalRoot('test-token',academic),/PORTAL_DRIVE_TECHNICAL_FOLDER_ID/);
});
