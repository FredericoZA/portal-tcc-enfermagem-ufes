import test from 'node:test';import assert from 'node:assert/strict';import {restoreChangesPublicFiles} from './publicationRestoreGuard';import {canonicalLegacyRecord} from '../legacyArchive';
test('backup restoration cannot orphan public historical copies or republish refused content',()=>{
 const r:any=canonicalLegacyRecord({id:'legado-0001',titulo:'Fixture',autores:['Person'],orientador:'Advisor',coorientador:'',examinadores:[],attachments:[{driveFileId:'source-file-123',fileName:'x.pdf',kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64)}],provenance:{originalConsent:['Sim']}} as any);
 const b={processes:[],jobs:[],legacy:[r]};assert.equal(restoreChangesPublicFiles(b,{...b,legacy:[structuredClone(r)]}),false);
 assert.equal(restoreChangesPublicFiles(b,{...b,legacy:[]}),true);
 const denied=canonicalLegacyRecord({...r,provenance:{originalConsent:['Não']}});
 assert.equal(restoreChangesPublicFiles(b,{...b,legacy:[denied]}),true);assert.equal(restoreChangesPublicFiles({...b,legacy:[denied]},b),true);
 assert.equal(restoreChangesPublicFiles({processes:[],jobs:[],legacy:[]},b),false);
});
