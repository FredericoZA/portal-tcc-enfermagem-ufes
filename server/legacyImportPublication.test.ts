import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalLegacyRecord,publicLegacyAcademicView} from './legacyArchive';
test('adding archived PDFs never widens the historical public kind/hash whitelist',()=>{
 const file=(kind:string,sha256:string)=>({kind,sha256,driveFileId:kind+'-original',fileName:'source.pdf',evidence:'verified'});
 const p:any={id:'legado-0001',titulo:'Title',autores:['Author'],orientador:'Advisor',coorientador:'',examinadores:[],provenance:{originalConsent:['Sim'],publicationImportBaseline:{publicFiles:[{kind:'TRABALHO_COMPLETO',sha256:'a'.repeat(64)}]}},attachments:[file('TRABALHO_COMPLETO','a'.repeat(64)),file('RESUMO_EXPANDIDO','b'.repeat(64))],palavrasChave:[]};
 const next=canonicalLegacyRecord(p);
 assert.equal(next.publishFullWork,true);assert.equal(next.publishExpandedAbstract,false);
 assert.equal(publicLegacyAcademicView(next).publicFiles.length,1);
 p.provenance.publicationImportBaseline.publicFiles=[];
 const privateRecord=canonicalLegacyRecord(p);assert.equal(privateRecord.isPublic,false);
 assert.deepEqual(publicLegacyAcademicView(privateRecord).publicFiles,[]);
});
