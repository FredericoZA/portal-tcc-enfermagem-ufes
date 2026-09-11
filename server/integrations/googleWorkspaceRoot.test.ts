import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapGoogleDriveStructure } from './googleWorkspace';

const rootId = 'pasta_raiz_institucional_123';
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

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
  assert.deepEqual(created.slice(0,4).map(file=>file.parents[0]),[rootId,rootId,rootId,rootId]);
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
