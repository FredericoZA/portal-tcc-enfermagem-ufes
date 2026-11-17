import assert from 'node:assert/strict';
import test from 'node:test';
import { DRIVE_DOCUMENT_MODEL_FOLDERS } from '../../src/utils/driveDocumentModels';
import { accessListGoogleSheetsTemplate, bootstrapGoogleDriveStructure, resolvePortalTechnicalRoot, resolveReferenceDocumentModelFolder } from './googleWorkspace';

const rootId='academic_root_123456';
const folderMime='application/vnd.google-apps.folder';
const reply=(body:unknown)=>new Response(JSON.stringify(body),{status:200});
const folder=(id:string,name:string,parentId:string)=>({id,name,mimeType:folderMime,parents:[parentId],trashed:false});

test('bootstrap reuses all ten legacy folders including 05_INSTRUMENTO_AVALIACAO (Legado), without creating an eleventh or touching model IDs',async t=>{
  const files=[folder('documents_123456','01_DOCUMENTOS',rootId),folder('processes_123456','02_PROCESSOS',rootId)];
  for(const [type,names] of Object.entries(DRIVE_DOCUMENT_MODEL_FOLDERS)){
    const id=`model_type_${type}`;
    files.push(folder(id,names.aliases.at(-1)!,'documents_123456'));
    files.push(folder(`active_${type}`,'00_MODELO_ATIVO',id),folder(`history_${type}`,'01_HISTORICO_MODELOS',id));
  }
  t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
    assert.ok(!init?.method||init.method==='GET','Bootstrap must preserve every existing folder/model ID');
    const url=new URL(String(input));
    if(url.pathname.endsWith('/permissions'))return reply({permissions:[{type:'user',role:'owner'}]});
    if(url.pathname.endsWith(`/files/${rootId}`))return reply({...folder(rootId,'Portal de TCC','owner_root'),capabilities:{canAddChildren:true}});
    const q=url.searchParams.get('q');
    assert.ok(q,'Existing models must not be downloaded, rewritten or deleted');
    return reply({files:files.filter(file=>q.includes(`name = '${file.name}'`)&&q.includes(`'${file.parents[0]}' in parents`))});
  });
  const manifest=await bootstrapGoogleDriveStructure('fixture-token',{rootFolderId:rootId});
  assert.equal(manifest.createdFolders,0);
  assert.equal(manifest.folders.models,'documents_123456');
  assert.equal(manifest.folders.processes,'processes_123456');
  assert.ok(files.some(file=>file.name==='05_INSTRUMENTO_AVALIACAO (Legado)'));
  assert.equal(Object.keys(manifest.folders).filter(key=>/^documents\.[^.]+$/.test(key)).length,10);
  for(const type of Object.keys(DRIVE_DOCUMENT_MODEL_FOLDERS)){
    assert.equal(manifest.folders[`documents.${type}`],`model_type_${type}`);
    assert.equal(manifest.folders[`documents.${type}.00_MODELO_ATIVO`],`active_${type}`);
    assert.equal(manifest.folders[`documents.${type}.01_HISTORICO_MODELOS`],`history_${type}`);
    assert.equal(manifest.folders[`documents.${type}.02_GERADOS`],undefined);
  }
});

test('reference lookup accepts renamed folders while returning the same stored ID and rejecting a second alias destination',async t=>{
  let duplicate=false;
  const files=[folder('documents_123456','Documentos',rootId),folder('reference_123456','07 - Declaração de comparecimento','documents_123456')];
  t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
    assert.ok(!init?.method||init.method==='GET');
    const url=new URL(String(input));
    if(url.pathname.endsWith('/permissions'))return reply({permissions:[{type:'user',role:'owner'}]});
    if(url.pathname.endsWith(`/files/${rootId}`))return reply(folder(rootId,'Portal de TCC','owner_root'));
    const q=url.searchParams.get('q')||'';
    const matches=files.filter(file=>q.includes(`name = '${file.name}'`)&&q.includes(`'${file.parents[0]}' in parents`));
    if(duplicate&&q.includes("name = '07_DECLARACAO_COMPARECIMENTO'"))matches.push(folder('other_reference_123456','07_DECLARACAO_COMPARECIMENTO','documents_123456'));
    return reply({files:matches});
  });
  assert.equal((await resolveReferenceDocumentModelFolder('fixture-token','DECLARACAO_COMPARECIMENTO',rootId)).id,'reference_123456');
  duplicate=true;
  await assert.rejects(resolveReferenceDocumentModelFolder('fixture-token','DECLARACAO_COMPARECIMENTO',rootId),/pastas antigas e novas/);
});

test('missing technical root never creates a third academic folder in development either',async t=>{
  const previous=process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;
  delete process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;
  t.after(()=>{if(previous===undefined)delete process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;else process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID=previous;});
  t.mock.method(globalThis,'fetch',async()=>{throw new Error('No provider call is needed without a configured destination');});
  await assert.rejects(resolvePortalTechnicalRoot('fixture-token',rootId),/PORTAL_DRIVE_TECHNICAL_FOLDER_ID/);
});

test('technical folders nested inside Documentos fail before writes, even when not direct academic-root children',async t=>{
  const previous=process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;
  process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID='technical_root_123456';
  t.after(()=>{if(previous===undefined)delete process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;else process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID=previous;});
  t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
    assert.ok(!init?.method||init.method==='GET');
    const url=new URL(String(input));
    if(url.pathname.endsWith('/files/technical_root_123456'))return reply({...folder('technical_root_123456','Sistema','documents_123456'),capabilities:{canAddChildren:true}});
    assert.ok(url.pathname.endsWith('/files/documents_123456'));
    return reply(folder('documents_123456','Documentos',rootId));
  });
  await assert.rejects(resolvePortalTechnicalRoot('fixture-token',rootId),/fora da raiz acadêmica/);
});

test('access-list template reads its old ID without recreating Sistema or uploading a duplicate',async t=>{
  const files=[folder('documents_123456','01_DOCUMENTOS',rootId),folder('old_system_123456','00_SISTEMA',rootId),
    {id:'access_template_123456',name:'MODELO_LISTA_ACESSO_V3',mimeType:'application/vnd.google-apps.spreadsheet',parents:['old_system_123456'],trashed:false}];
  t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
    assert.ok(!init?.method||init.method==='GET');
    const url=new URL(String(input));
    if(url.pathname.endsWith('/permissions'))return reply({permissions:[{type:'user',role:'owner'}]});
    const q=url.searchParams.get('q')||'';
    return reply({files:files.filter(file=>q.includes(`name = '${file.name}'`)&&q.includes(`'${file.parents[0]}' in parents`))});
  });
  const result=await accessListGoogleSheetsTemplate({accessToken:'fixture-token',rootFolderId:rootId,content:Buffer.from('unused')});
  assert.equal(result.id,'access_template_123456');
  assert.equal(result.created,false);
});
