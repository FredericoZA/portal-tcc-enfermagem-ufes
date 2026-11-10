import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import {buildRecoveryQueue} from './recovery';
import {initialEmailDelivery} from '../integrations/trackedGmail';
import type {WorkflowRun} from '../../src/types/automation';

test('old reservation failures leave the active queue but original records remain unchanged',()=>{
 const processes=[6,15].map((revision,index)=>{const p=structuredClone(DEMO_PROCESSES[0]);p.id='history-'+index;p.dataRevision=revision;p.defesa.reservationRevision=index+1;p.defesa.localStatus=index?'CONFIRMADO':'RECUSADO';p.defesa.departmentResponse={decision:index?'CONFIRMED':'UNAVAILABLE',revision:index+1,respondedAt:'2026-11-07T19:00:00Z',respondedBy:'responsavel@example.invalid',startAt:p.defesa.startAt,endAt:p.defesa.endAt};return p;});
 const runs=processes.map((p,index)=>({id:'old-run-'+index,processId:p.id,eventCode:'RESERVATION_RESCHEDULED',sourceDataRevision:index?3:5,startedAt:'2026-11-05T18:00:00Z',status:'PARTIAL_FAILURE',actions:[{actionId:'mail',status:'FAILED',error:'Timeout antigo.'}],issues:[]}) as WorkflowRun);
 const emails=processes.map((p,index)=>({...initialEmailDelivery({processId:p.id,recipient:'responsavel@example.invalid',subject:'Solicitação de reserva',text:'Pedido antigo.',idempotencyKey:'old-mail-'+index,templateId:'email-reserva'}),dispatchState:'SENDING' as const,workflowEventVariables:{RESERVATION_REVISION:'1'}}));
 const input={processes,runs,emails,jobs:[],forms:[],customForms:[]};const before=JSON.stringify(input);
 assert.deepEqual(buildRecoveryQueue(input),[]);assert.equal(JSON.stringify(input),before,'historical evidence and uncertain dispatch state must not be rewritten');
 const current={...runs[1],id:'current',eventCode:'REPOSITORY_SUBMITTED' as const,sourceDataRevision:15};
 assert.deepEqual(buildRecoveryQueue({...input,runs:[...runs,current]}).map(item=>item.id),['current'],'current failures remain actionable');
});

test('an unresolved current email remains in the queue even with an uncertain dispatch state',()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);p.dataRevision=1;p.defesa.localStatus='PENDENTE';p.defesa.departmentResponse=undefined;p.defesa.invitationSentAt=undefined;p.defesa.invitationDriveFileId=undefined;p.defesa.reservationRevision=1;
 const mail={...initialEmailDelivery({processId:p.id,recipient:'responsavel@example.invalid',subject:'Solicitação de reserva',text:'Pedido atual.',idempotencyKey:'current-mail',templateId:'email-reserva'}),dispatchState:'UNCERTAIN' as const,sourceDataRevision:1,workflowEventVariables:{RESERVATION_REVISION:'1'}};
 assert.equal(buildRecoveryQueue({processes:[p],runs:[],emails:[mail],jobs:[],forms:[],customForms:[]}).length,1);
});
