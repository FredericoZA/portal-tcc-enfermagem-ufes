import test from 'node:test';import assert from 'node:assert/strict';
import {executeWorkflowEvent} from './runtime';
import {courseStudioFixture} from '../fixtures/courseStudioFixture';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';

test('a recorded failed document keeps its original provider identity when its safe recovery context is reapplied',async()=>{
 const studio=courseStudioFixture();const process=structuredClone(DEMO_PROCESSES[0]);
 const stage=studio.workflowStages.find(stage=>stage.triggerEvent==='LOCATION_CONFIRMED')!;
 stage.actions=[{id:'document',type:'document',refId:studio.docTemplates.find(doc=>doc.type==='CONVITE')!.id,title:'Carta-convite'}];
 const keys:string[]=[];let fail=true;
 const ports:any={createDocument:async(input:any)=>{keys.push(input.idempotencyKey);if(fail)throw Error('The operation was aborted due to timeout');return{externalId:'existing-artifact'};}};
 const context:any={process,eventCode:'LOCATION_CONFIRMED',actorEmail:'original@example.invalid',actorRoles:[],extraVariables:{RESERVATION_REVISION:'1'}};
 const initial=await executeWorkflowEvent(studio,context,ports);assert.equal(initial.status,'PARTIAL_FAILURE');assert.equal(initial.actions[0].idempotencyKey,keys[0]);
 process.driveFolderUrl='https://drive.google.com/newly-created-private-folder';fail=false;
 const recovered=await executeWorkflowEvent(studio,{...context,preserveActionIdentity:true,completedActions:initial.actions},ports);
 assert.equal(recovered.status,'COMPLETED');assert.equal(keys.length,2);assert.equal(keys[1],keys[0],'a changed generated folder reference cannot create another document job');
 const count=keys.length;await executeWorkflowEvent(studio,{...context,preserveActionIdentity:true,completedActions:recovered.actions},ports);assert.equal(keys.length,count,'completed action is reused without another provider call');
});

test('the invitation saves its completed document and planned email key before calling the mail provider',async()=>{
 const studio=courseStudioFixture(),process=structuredClone(DEMO_PROCESSES[0]);
 const stage=studio.workflowStages.find(stage=>stage.triggerEvent==='LOCATION_CONFIRMED')!;
 const doc=studio.docTemplates.find(item=>item.type==='CONVITE')!;
 const mail=studio.emailTemplates.find(item=>item.id==='convite-email')!;
 stage.actions=[{id:'doc',type:'document',refId:doc.id,title:'Carta-convite'},{id:'mail',type:'email',refId:mail.id,title:'Convite'}];
 let checkpoint:any;
 const context={process,eventCode:'LOCATION_CONFIRMED',actorEmail:'original@example.invalid',actorRoles:[]};
 const ports={
   createDocument:async()=>({externalId:'drive-id'}),
   createFormTask:async()=>assert.fail('unexpected form'),
   resolveEmailRecipients:()=>['exam1@example.invalid','exam2@example.invalid'],
   checkpointBeforeAction:async(run:any)=>{checkpoint=run;throw Error('interrupted after checkpoint');},
   sendEmail:async()=>assert.fail('must not send before durable checkpoint')
 };
 await assert.rejects(executeWorkflowEvent(studio,context,ports),/interrupted/);
 assert.equal(checkpoint.actions[0].externalId,'drive-id');
 const recovered=await executeWorkflowEvent(studio,{...context,completedActions:checkpoint.actions,preserveActionIdentity:true},{
   ...ports,checkpointBeforeAction:undefined,createDocument:async()=>assert.fail('must reuse archived document'),
   sendEmail:async input=>{assert.equal(input.idempotencyKey,checkpoint.actions[1].idempotencyKey);return{externalId:'gmail-id'};}
 });
 assert.equal(recovered.status,'COMPLETED');
});
