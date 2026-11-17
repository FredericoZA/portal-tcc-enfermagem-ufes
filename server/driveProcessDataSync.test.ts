import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {buildDriveProcessDataMarkdown,buildDriveProcessFileName} from '../src/utils/driveProcessLayout';

const source=readFileSync('server.ts','utf8');
function functions(names:string[],ports:Record<string,unknown>){
  const parsed=ts.createSourceFile('server.ts',source,ts.ScriptTarget.ES2022,true);
  const declarations=parsed.statements.filter(ts.isFunctionDeclaration).filter(node=>node.name&&names.includes(node.name.text));
  assert.equal(declarations.length,names.length);
  const code=ts.transpileModule(declarations.map(node=>node.getText(parsed)).join('\n')+`\n({${names.join(',')}})`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  return runInNewContext(code,{Date,buildDriveProcessDataMarkdown,buildDriveProcessFileName,processesStore:[],currentPublicationProcess:()=>true,currentPortalRuntimeRevision:()=>null,productionRuntime:false,...ports});
}
test('persisted registration updates keep their revision and explicit pending state when Drive fails',async()=>{
  const process=structuredClone(DEMO_PROCESSES[0]);process.driveFolderId='original_process_folder';process.dataRevision=8;
  process.driveDataSync={status:'PENDING',revision:8,updatedAt:new Date().toISOString()};
  let commits=0,uploads=0;
  const {syncPersistedProcessData}=functions(['syncPersistedProcessData'],{
    processesStore:[process],localReviewFilesEnabled:()=>false,getGoogleWorkspaceAccessToken:async()=> 'fixture',
    syncStoredProcessData:async()=>{uploads++;throw Error('provider unavailable');},
    persistPortalStateDurably:async()=>{commits++;assert.equal(process.driveDataSync?.status,'PENDING');},
  });
  await syncPersistedProcessData(process);
  assert.equal(uploads,1);assert.equal(commits,1);assert.equal(process.dataRevision,8);assert.equal(process.driveFolderId,'original_process_folder');
  assert.equal(process.driveDataSync?.status,'PENDING');assert.match(process.driveDataSync!.lastError!,/salvos no Portal/);
});
test('the data mirror uses the linked folder and marks only the actual synchronized revision',async()=>{
  const process=structuredClone(DEMO_PROCESSES[0]);process.driveFolderId='original_process_folder';process.dataRevision=12;
  let writes=0;
  const {syncStoredProcessData}=functions(['syncStoredProcessData'],{
    processesStore:[process],localReviewFilesEnabled:()=>false,
    syncProcessDataMarkdown:async(input:any)=>{writes++;assert.equal(input.processFolderId,process.driveFolderId);assert.equal(input.processId,process.id);assert.match(input.fileName,/^00 - Dados.*\.md$/);assert.ok(input.markdown.includes(process.aluno1.nome));assert.ok(!input.markdown.includes(process.aluno1.email));return {id:'stable_data_original'};},
  });
  await syncStoredProcessData(process,'fixture');assert.equal(writes,1);assert.equal(process.driveDataSync?.status,'SYNCED');assert.equal(process.driveDataSync?.revision,12);assert.equal(process.driveDataSync?.fileId,'stable_data_original');
  process.driveFolderId=undefined;await assert.rejects(syncStoredProcessData(process,'fixture'),/vinculada/);assert.equal(writes,1);
});
test('historical publication never manufactures an unbound process folder',async()=>{
  const process=structuredClone(DEMO_PROCESSES[0]);process.legacyRecord=true;process.driveFolderId=undefined;let calls=0;
  const {ensureStoredProcessFolder}=functions(['ensureStoredProcessFolder'],{
    localReviewFilesEnabled:()=>false,ensurePortalProcessDriveFolder:async()=>{calls++;},syncStoredProcessData:async()=>{calls++;},
  });
  await assert.rejects(ensureStoredProcessFolder(process,'fixture','root_folder'),/pasta original do legado/);assert.equal(calls,0);
});
test('existing folder identity and full academic author names reach the shared archive helper',async()=>{
  const process=structuredClone(DEMO_PROCESSES[0]);process.driveFolderId='linked_original_folder';let synchronized=false;
  const {ensureStoredProcessFolder}=functions(['ensureStoredProcessFolder'],{
    localReviewFilesEnabled:()=>false,
    ensurePortalProcessDriveFolder:async(input:any)=>{assert.equal(input.folderId,'linked_original_folder');assert.equal(input.protocol,process.protocolo);assert.equal(input.studentNames[0],process.aluno1.nome);return {id:input.folderId,webViewLink:'https://drive.google.com/drive/folders/'+input.folderId};},
    syncStoredProcessData:async()=>{synchronized=true;},
  });
  assert.equal(await ensureStoredProcessFolder(process,'fixture','root_folder'),'linked_original_folder');assert.equal(synchronized,true);assert.equal(process.driveFolderId,'linked_original_folder');
});
test('a replaced canonical object, changed registration revision or newer durable snapshot cannot be marked synchronized',async()=>{
  for(const mutation of ['object','revision','durable']){
    const process=structuredClone(DEMO_PROCESSES[0]);process.driveFolderId='canonical_folder_123';process.driveDataSync={status:'PENDING',revision:process.dataRevision,updatedAt:new Date().toISOString()};
    const processes=[process];let runtimeRevision=10;
    const {syncStoredProcessData}=functions(['syncStoredProcessData'],{
      processesStore:processes,localReviewFilesEnabled:()=>false,productionRuntime:true,
      currentPortalRuntimeRevision:()=>10,readPortalRuntimeRevision:async()=>runtimeRevision,
      syncProcessDataMarkdown:async(input:any)=>{
        assert.equal(await input.assertCurrent(),true);assert.equal(input.revision,process.dataRevision);
        if(mutation==='object')processes[0]=structuredClone(process);
        else if(mutation==='revision')process.dataRevision++;
        else runtimeRevision=11;
        assert.equal(await input.assertCurrent(),false,mutation);
        return {id:'unchanged_data_original'};
      },
    });
    await assert.rejects(syncStoredProcessData(process,'fixture'),/alterados durante/);
    assert.equal(processes[0].driveDataSync?.status,'PENDING',mutation);
  }
});
test('the mirror pins a generated file ID durably before creation and retains that ID on pending retries',async()=>{
  const process=structuredClone(DEMO_PROCESSES[0]);process.driveFolderId='canonical_folder_123';let commits=0;
  const {syncStoredProcessData}=functions(['syncStoredProcessData'],{
    processesStore:[process],localReviewFilesEnabled:()=>false,
    persistPortalStateDurably:async()=>{commits++;assert.equal(process.driveDataSync?.status,'PENDING');assert.equal(process.driveDataSync?.fileId,'reserved_data_original_123');},
    syncProcessDataMarkdown:async(input:any)=>{assert.equal(await input.assertCurrent(),true);await input.bindFileId('reserved_data_original_123');assert.equal(commits,1);return {id:'reserved_data_original_123'};},
  });
  await syncStoredProcessData(process,'fixture');assert.equal(process.driveDataSync?.status,'SYNCED');assert.equal(process.driveDataSync?.fileId,'reserved_data_original_123');
});
