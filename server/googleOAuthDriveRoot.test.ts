import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test,{type TestContext} from 'node:test';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {bootstrapGoogleDriveStructure,safeGoogleReturnTo} from './integrations/googleWorkspace';
import {assertCurrentGoogleOAuthActor,googleAccountMatchesAuthorizedActor} from './security/googleOAuthPolicy';
import {DRIVE_DOCUMENT_MODEL_FOLDERS} from '../src/utils/driveDocumentModels';

const folderMime='application/vnd.google-apps.folder';

function existingRenamedTree(t:TestContext,rootId:string){
  const folder=(id:string,name:string,parent:string)=>({id,name,mimeType:folderMime,parents:[parent],trashed:false});
  const files=[folder('documents_oauth_123','Documentos',rootId),folder('processes_oauth_123','Processos',rootId)];
  for(const [type,definition] of Object.entries(DRIVE_DOCUMENT_MODEL_FOLDERS)){
    const id=`category_oauth_${type}`;
    files.push(folder(id,definition.name,'documents_oauth_123'),folder(`active_oauth_${type}`,'00 - Modelo ativo',id),folder(`history_oauth_${type}`,'01 - Histórico de modelos',id));
  }
  t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
    assert.equal(init?.method||'GET','GET','Reauthorization cannot create, rename or move the existing academic tree');
    const url=new URL(String(input));
    if(url.pathname.endsWith('/permissions'))return Response.json({permissions:[{type:'user',role:'owner'}]});
    if(url.pathname.endsWith(`/files/${rootId}`))return Response.json({...folder(rootId,'Raiz renomeada pela instituição','owner_root_123'),capabilities:{canAddChildren:true}});
    const query=url.searchParams.get('q');
    assert.ok(query&&query.includes(' in parents'),'The saved root must be resolved by ID rather than searched by its former display name');
    return Response.json({files:files.filter(file=>query.includes(`name = '${file.name}'`)&&query.includes(`'${file.parents[0]}' in parents`))});
  });
}

function callback(initialSettings:Record<string,unknown>){
  let handler:((req:unknown,res:unknown)=>Promise<void>)|undefined;
  let savedCredentials=0,persistedState=0;
  const master='master@example.invalid';
  const state={email:master,bootstrap:false,exp:Date.now()+600_000,returnTo:'/configuracoes?google=connected'};
  const ports={
    app:{get:(_path:string,...args:unknown[])=>{handler=args.at(-1) as typeof handler;}},rateLimit:()=>()=>{},
    currentSettings:{masterEmail:master,...initialSettings} as Record<string,unknown>,auditLogsStore:[] as unknown[],
    decodeGoogleOAuthState:()=>state,getPortalIdentity:()=>({email:master}),hasFullAdministration:()=>true,hasRecentAuthentication:()=>true,
    assertCurrentGoogleOAuthActor,googleAccountMatchesAuthorizedActor,
    exchangeGoogleAuthorizationCode:async()=>({accessToken:'fixture-token',email:master}),
    persistGoogleWorkspaceAuthorization:async()=>{savedCredentials++;},bootstrapGoogleDriveStructure,
    resolveInstallationProfile:()=>({driveRootFolderName:'Nome anterior da raiz'}),
    getUserRolesForEmail:()=>({globalRoles:['MASTER']}),persistPortalStateDurably:async()=>{persistedState++;},
    safeGoogleReturnTo,escapeHtml:(value:string)=>value
  };
  const server=readFileSync('server.ts','utf8'),start=server.indexOf("  app.get('/api/integrations/google/oauth/callback'");
  assert.ok(start>=0);
  const source=server.slice(start,server.indexOf('\n  });',start)+6);
  runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ports);
  return {ports,async request(){
    assert.ok(handler);const response:{status:number;redirect?:string;error?:string}={status:200};
    await handler({query:{state:'signed-state',code:'fixture-code'}},{
      status(status:number){response.status=status;return this;},send(error:string){response.error=error;},redirect(url:string){response.redirect=url;}
    });
    return {...response,savedCredentials,persistedState};
  }};
}

test('Google reauthorization retains the saved renamed root ID instead of creating a second academic tree',async t=>{
  const rootId='saved_academic_root_123',previous=process.env.PORTAL_DRIVE_ROOT_FOLDER_ID;
  process.env.PORTAL_DRIVE_ROOT_FOLDER_ID='fallback_environment_root_123';
  t.after(()=>{if(previous===undefined)delete process.env.PORTAL_DRIVE_ROOT_FOLDER_ID;else process.env.PORTAL_DRIVE_ROOT_FOLDER_ID=previous;});
  existingRenamedTree(t,rootId);
  const route=callback({driveRootFolderId:rootId});
  const result=await route.request();
  assert.equal(result.status,200);assert.equal(result.error,undefined);assert.equal(result.redirect,'/configuracoes?google=connected');
  assert.equal(result.savedCredentials,1);assert.equal(result.persistedState,1);
  assert.equal(route.ports.currentSettings.driveRootFolderId,rootId);
});

test('Google callback preserves the helper environment fallback when no root ID was saved yet',async t=>{
  const rootId='environment_academic_root_123',previous=process.env.PORTAL_DRIVE_ROOT_FOLDER_ID;
  process.env.PORTAL_DRIVE_ROOT_FOLDER_ID=rootId;
  t.after(()=>{if(previous===undefined)delete process.env.PORTAL_DRIVE_ROOT_FOLDER_ID;else process.env.PORTAL_DRIVE_ROOT_FOLDER_ID=previous;});
  existingRenamedTree(t,rootId);
  const route=callback({});
  const result=await route.request();
  assert.equal(result.status,200);assert.equal(result.error,undefined);assert.equal(result.persistedState,1);
  assert.equal(route.ports.currentSettings.driveRootFolderId,rootId);
});
