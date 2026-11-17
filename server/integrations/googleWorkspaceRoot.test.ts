import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapGoogleDriveStructure,ensurePortalRenderFolder,readPrivatePortalBackup,resolveReferenceDocumentModelFolder,verifyPrivateDriveFolder } from './googleWorkspace';

const rootId = 'pasta_raiz_institucional_123';
test('destinos privados rejeitam grupos e permissões desconhecidas, preservando acesso nominal',async t=>{
  let permissions:any[]=[];
  t.mock.method(globalThis,'fetch',async()=>reply({permissions}));
  for(const permission of [{type:'group',role:'reader'},{type:'user',role:'unknown'},{type:'unknown',role:'reader'}]){
    permissions=[{type:'user',role:'owner'},permission];
    await assert.rejects(verifyPrivateDriveFolder('test-token',rootId),/compartilhada|permissão|grupo/);
  }
  permissions=[{type:'user',role:'owner'},{type:'user',role:'writer'},{type:'user',role:'reader'}];
  await assert.doesNotReject(verifyPrivateDriveFolder('test-token',rootId));
});

test('permissão ampla na segunda página impede o uso do destino privado',async t=>{
  const pages:string[]=[];
  t.mock.method(globalThis,'fetch',async(input:unknown)=>{
    const query=new URL(String(input)).searchParams;
    assert.match(query.get('fields')||'',/nextPageToken/);
    const page=query.get('pageToken')||'';pages.push(page);
    return page?reply({permissions:[{type:'group',role:'reader'}]}):reply({permissions:[{type:'user',role:'owner'}],nextPageToken:'second/page+'});
  });
  await assert.rejects(verifyPrivateDriveFolder('test-token',rootId),/grupo/);
  assert.deepEqual(pages,['','second/page+']);
});

test('releitura de backup privado aplica limite antes de consumir o corpo',async t=>{
  let cancelled=false;
  t.mock.method(globalThis,'fetch',async(input:unknown)=>{
    if(String(input).includes('/permissions?'))return reply({permissions:[{type:'user',role:'owner'}]});
    return new Response(new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(new Uint8Array(4));},cancel(){cancelled=true;}},{highWaterMark:0}),{headers:{'content-length':String(32*1024*1024+1)}});
  });
  await assert.rejects(readPrivatePortalBackup('test-token','backup-file-id-123'),/limite seguro/);
  assert.equal(cancelled,true);
});
test('conversões usam uma raiz técnica externa sem recriar Sistema na raiz acadêmica',async t=>{
  const created:any[]=[];
  const previous=process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;
  process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID='technical_root_123456';
  t.after(()=>{if(previous===undefined)delete process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;else process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID=previous;});
  t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
    if(String(input).includes('/permissions?'))return reply({permissions:[{type:'user',role:'owner'}]});
    if(String(input).includes('/files/technical_root_123456?'))return reply({id:'technical_root_123456',mimeType:'application/vnd.google-apps.folder',parents:['owner_root'],capabilities:{canAddChildren:true}});
    if(String(input).includes('/files/owner_root?'))return reply({id:'owner_root',mimeType:'application/vnd.google-apps.folder',parents:[]});
    if(init?.method==='POST'){const body=JSON.parse(String(init.body));created.push(body);return reply({id:`folder-${created.length}`,name:body.name});}
    return reply({files:[]});
  });
  assert.equal(await ensurePortalRenderFolder('test-token',rootId),'folder-1');
  assert.deepEqual(created.map(file=>({name:file.name,parents:file.parents})),[{name:'03_TEMPORARIOS_DOCUMENTAIS',parents:['technical_root_123456']}]);
});
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('DOCX de referência encontra apenas a pasta privada existente dentro de 01_DOCUMENTOS', async t => {
  const documentsId='pasta_de_documentos';
  const attendanceId='pasta_comparecimento';
  const receiptsId='pasta_de_comprovantes';
  const folderMime='application/vnd.google-apps.folder';
  const folder=(id:string,name:string,parentId:string)=>({id,name,parents:[parentId],mimeType:folderMime});
  let attendanceFolders=[folder(attendanceId,'07_DECLARACAO_COMPARECIMENTO',documentsId)];
  let broadPermission=false;
  let writable=true;
  t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
    assert.ok(!init?.method||init.method==='GET','A localização nunca cria ou move pastas');
    const url=new URL(String(input));
    if(url.pathname.endsWith('/permissions'))return reply({permissions:broadPermission&&url.pathname.includes(attendanceId)?[{type:'anyone',role:'reader'}]:[{type:'user',role:'owner'}]});
    if(url.pathname.endsWith(`/files/${rootId}`))return reply({id:rootId,mimeType:folderMime,trashed:false});
    if(url.pathname.endsWith(`/files/${attendanceId}`))return reply({id:attendanceId,capabilities:{canAddChildren:writable}});
    const query=url.searchParams.get('q')||'';
    assert.match(query,/trashed = false/);
    if(query.includes(`'${rootId}' in parents`)){
      return reply({files:query.includes("name = '01_DOCUMENTOS'")?[folder(documentsId,'01_DOCUMENTOS',rootId)]:[]});
    }
    assert.ok(query.includes(`'${documentsId}' in parents`));
    if(query.includes("name = '06_COMPORVANTES_RESERVA'"))return reply({files:[folder(receiptsId,'06_COMPORVANTES_RESERVA',documentsId)]});
    return reply({files:attendanceFolders.filter(({name})=>query.includes(`name = '${name}'`))});
  });
  assert.deepEqual(await resolveReferenceDocumentModelFolder('fixture','DECLARACAO_COMPARECIMENTO',rootId,true),{id:attendanceId,name:'07_DECLARACAO_COMPARECIMENTO',url:`https://drive.google.com/drive/folders/${attendanceId}`,rootFolderId:rootId});
  assert.equal((await resolveReferenceDocumentModelFolder('fixture','COMPROVANTES_RESERVA',rootId)).id,receiptsId);
  writable=false;
  await assert.rejects(resolveReferenceDocumentModelFolder('fixture','DECLARACAO_COMPARECIMENTO',rootId,true),/permissão para gravar/);
  broadPermission=true;
  await assert.rejects(resolveReferenceDocumentModelFolder('fixture','DECLARACAO_COMPARECIMENTO',rootId),/compartilhada/);
  broadPermission=false;
  attendanceFolders.push(folder('pasta_comparecimento_copia','07_DECLARACAO_COMPARECIMENTO',documentsId));
  await assert.rejects(resolveReferenceDocumentModelFolder('fixture','DECLARACAO_COMPARECIMENTO',rootId),/mais de um item/);
  attendanceFolders=[folder('pasta_107_legado','107 — Declaração Comparecimento',documentsId)];
  await assert.rejects(resolveReferenceDocumentModelFolder('fixture','DECLARACAO_COMPARECIMENTO',rootId),/não foi localizada/);
});

test('raiz existente é reutilizada e todas as novas pastas ficam dentro dela', async (t) => {
  const created: Array<{name: string; parents: string[]}> = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(`/files/${rootId}?`)) return reply({id:rootId,name:'TCC Enfermagem',mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:true}});
    if (url.includes('/permissions?')) return reply({permissions:[{type:'user',role:'owner'}]});
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      created.push(body);
      return reply({id:`child_${created.length}`,name:body.name,parents:body.parents});
    }
    return reply({files:[]});
  });
  const result = await bootstrapGoogleDriveStructure('test-token', {rootFolderId:rootId});
  assert.equal(result.rootFolderId, rootId);
  assert.equal(result.existingFolders, 1);
  assert.ok(created.length > 4);
  assert.ok(created.every(file=>file.parents?.length===1));
  assert.deepEqual(created.filter(file=>file.parents[0]===rootId).map(file=>file.name),['Documentos','Processos']);
  assert.equal(result.folders['documents.CONVITE.03_ASSINADOS'],undefined);
  assert.equal(result.folders['documents.ATA.03_ASSINADOS'],undefined);
  assert.equal(created.filter(file=>file.parents[0]===result.folders.models).length,10);
  assert.equal(created.some(file=>/GERADOS|ASSINADOS|SUPORTE/.test(file.name)),false);
  assert.ok(result.folders['documents.ATA.00_MODELO_ATIVO']);
  assert.ok(result.folders['documents.ATA.01_HISTORICO_MODELOS']);
  assert.ok(created.every(file=>file.name!=='03_REPOSITORIO_PUBLICO'));
  assert.ok(created.every(file=>file.name!=='PORTAL_TCC'));
});

test('raiz indisponível interrompe o bootstrap sem criar pasta substituta', async (t) => {
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (_input: unknown, init?: RequestInit) => {
    if(init?.method==='POST') writes++;
    return reply({error:{message:'File not found'}},404);
  });
  await assert.rejects(bootstrapGoogleDriveStructure('test-token',{rootFolderId:rootId}),/File not found/);
  assert.equal(writes,0);
});

test('raiz sem escrita ou publicamente compartilhada não recebe subpastas', async (t) => {
  for (const writable of [false,true]) {
    let writes=0;
    const mock=t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
      if(init?.method==='POST') writes++;
      if(String(input).includes('/permissions?'))return reply({permissions:[{type:'anyone',role:'reader'}]});
      return reply({id:rootId,name:'TCC',mimeType:'application/vnd.google-apps.folder',capabilities:{canAddChildren:writable}});
    });
    await assert.rejects(bootstrapGoogleDriveStructure('test-token',{rootFolderId:rootId}),writable?/compartilhada/:/permissão/);
    assert.equal(writes,0);
    mock.mock.restore();
  }
});

test('ID de raiz definido no servidor tem precedência sobre o nome da pasta', async (t) => {
  const previous=process.env.PORTAL_DRIVE_ROOT_FOLDER_ID;
  process.env.PORTAL_DRIVE_ROOT_FOLDER_ID=rootId;
  t.after(()=>{if(previous===undefined)delete process.env.PORTAL_DRIVE_ROOT_FOLDER_ID;else process.env.PORTAL_DRIVE_ROOT_FOLDER_ID=previous;});
  t.mock.method(globalThis,'fetch',async(input:unknown)=>{
    assert.ok(String(input).includes(`/files/${rootId}?`));
    return reply({error:{message:'configured-root-not-accessible'}},403);
  });
  await assert.rejects(bootstrapGoogleDriveStructure('test-token',{rootFolderName:'Outra pasta'}),/configured-root-not-accessible/);
});
