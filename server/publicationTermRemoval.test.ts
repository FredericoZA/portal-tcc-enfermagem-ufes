import test from 'node:test';
import assert from 'node:assert/strict';
import {destroyPreviousPublicationTerms} from './publicationTermRemoval';
import {beginPublicationChoice,finishPublicationRevocation} from './workflow/publicationChoice';
const fixture=()=>({id:'process-one',dataRevision:1,status:'CONCLUIDO',acervo:{submittedAt:'2026-11-16',publishFullWork:true,trabalhoCompletoFileId:'academic-original',publicationAuthorizationFileIds:['legacy-term']},avaliacao:{},aluno1:{},orientador:{}} as any);
const term=()=>({id:'old-term',processId:'process-one',documentType:'TERMO',status:'ARCHIVED',driveSignedFileId:'signed-term',driveUnsignedFileId:'unsigned-term'} as any);
function prepare(){const jobs=[term()];return {jobs,p:beginPublicationChoice(fixture(),{publishFullWork:false,publishExpandedAbstract:false},jobs,'author@example.invalid','request','2026-11-16')};}
test('restriction destroys only old authorization PDFs and cancels the obsolete signature job',async()=>{
 const {p,jobs}=prepare();let removed:string[]=[];
 await destroyPreviousPublicationTerms(p,jobs,async ids=>{removed=ids;});
 assert.deepEqual(removed.sort(),['legacy-term','signed-term','unsigned-term']);
 assert.equal(jobs[0].status,'CANCELED');assert.equal(jobs[0].driveSignedFileId,undefined);
 assert.equal(p.acervo.trabalhoCompletoFileId,'academic-original');
 assert.deepEqual(p.acervo.publicationAuthorizationFileIds,[]);
});
test('failed deletion retains references so a later retry can complete',async()=>{
 const {p,jobs}=prepare();
 await assert.rejects(destroyPreviousPublicationTerms(p,jobs,async()=>{throw Error('Drive unavailable');}));
 assert.equal(jobs[0].status,'ARCHIVED');assert.equal(jobs[0].driveSignedFileId,'signed-term');
 await destroyPreviousPublicationTerms(p,jobs,async()=>{});
 assert.equal(jobs[0].status,'CANCELED');
});
test('a document belonging to another job or an academic PDF is never deleted',async()=>{
 const {p,jobs}=prepare();jobs.push({id:'ata',processId:'process-one',documentType:'ATA',driveSignedFileId:'signed-term'} as any);
 await assert.rejects(destroyPreviousPublicationTerms(p,jobs,async()=>assert.fail('must not delete')),/conflitantes/);
 const other=prepare();other.p.acervo.publicationChange.previousTermFileIds.push('academic-original');
 await assert.rejects(destroyPreviousPublicationTerms(other.p,other.jobs,async()=>assert.fail('must not delete')),/conflitantes/);
});

test('a second restriction omits terms whose deletion already completed',async()=>{
 const initial=fixture();initial.acervo.publishFullWork=false;
 const jobs=[term()];
 const pending=beginPublicationChoice(initial,{publishFullWork:true,publishExpandedAbstract:false},jobs,'author@example.invalid','renew','2026-11-16');
 await destroyPreviousPublicationTerms(pending,jobs,async()=>{});
 finishPublicationRevocation(pending,'2026-11-16');
 const restricted=beginPublicationChoice(pending,{publishFullWork:false,publishExpandedAbstract:false},jobs,'author@example.invalid','veto','2026-11-17');
 assert.deepEqual(restricted.acervo.publicationChange.previousTermFileIds,[]);
 await destroyPreviousPublicationTerms(restricted,jobs,async ids=>assert.deepEqual(ids,[]));
 finishPublicationRevocation(restricted,'2026-11-17');
 assert.equal(restricted.acervo.publicationChange.status,'COMPLETED');
});
test('another restriction retains every pending public-copy revocation',()=>{
 const initial=fixture();initial.acervo.publicFullWorkFileId='retired-public-copy';
 const pending=beginPublicationChoice(initial,{publishFullWork:true,publishExpandedAbstract:false},[],'author@example.invalid','edit','2026-11-16',true);
 assert.equal(pending.acervo.publicFullWorkFileId,undefined);
 const restricted=beginPublicationChoice(pending,{publishFullWork:false,publishExpandedAbstract:false},[],'author@example.invalid','veto','2026-11-17');
 assert.ok(restricted.acervo.publicationChange.revokeFileIds.includes('retired-public-copy'));
});
