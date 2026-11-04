import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDefenseConflicts} from './defenseConflicts';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
test('reservas de 90 minutos são independentes por sala, respeitam limite e participantes',()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);p.id='sala';p.status='AGUARDANDO_CONFIRMACAO_LOCAL';p.defesa={...p.defesa,startAt:'2026-10-30T08:10:00-03:00',endAt:'2026-10-30T09:10:00-03:00',local:'Auditório',localStatus:'CONFIRMADO'};
 const query={startAt:'2026-10-30T08:10:00-03:00',local:'Sala de reuniões',emails:[]};
 assert.equal(inspectDefenseConflicts([p],query).length,0);
 assert.equal(inspectDefenseConflicts([p],{...query,local:'auditorio'})[0].sameLocation,true);
 assert.equal(inspectDefenseConflicts([p],{...query,local:'Auditório',startAt:'2026-10-30T09:39:00-03:00'}).length,1);
 assert.equal(inspectDefenseConflicts([p],{...query,local:'Auditório',startAt:'2026-10-30T09:40:00-03:00'}).length,0);
 assert.equal(inspectDefenseConflicts([p],{...query,emails:[p.orientador.email]})[0].sharedPeopleCount,1);
 assert.equal(inspectDefenseConflicts([p],{...query,local:'Auditório'},false).length,1,'proteção da sala independe da opção de participantes');
 assert.equal(inspectDefenseConflicts([p],{...query,local:'Auditório',excludeProcessId:p.id}).length,0);
});

test('pedido pendente bloqueia somente o local escolhido e ignora alternativas antigas',()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);p.defesa={...p.defesa,startAt:'2026-10-30T08:10:00-03:00',local:'Auditório',alternateLocation:'Sala de reuniões',localStatus:'PENDENTE',departmentResponse:undefined};
 const query={startAt:p.defesa.startAt,local:'Sala de reuniões',emails:[]};
 assert.equal(inspectDefenseConflicts([p],query,false).length,0);
 assert.equal(inspectDefenseConflicts([p],{...query,local:'Outro local',alternateLocation:'Auditório'},false).length,0);
 assert.equal(inspectDefenseConflicts([p],{...query,local:'Auditório',startAt:'2026-10-30T07:00:00-03:00'},false).length,1);
 assert.equal(inspectDefenseConflicts([p],{...query,startAt:'2026-10-30T09:40:00-03:00'},false).length,0);
 assert.equal(inspectDefenseConflicts([p],{...query,excludeProcessId:p.id},false).length,0);
 p.defesa.alternateLocation=undefined;
 assert.equal(inspectDefenseConflicts([p],query,false).length,0,'sem alternativa, só bloqueia o local solicitado');
});

test('homologação mantém apenas a sala escolhida; negativa libera salas e participantes; reinício bloqueia só o local escolhido',()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);p.defesa={...p.defesa,startAt:'2026-10-30T08:10:00-03:00',local:'Sala de reuniões',alternateLocation:'Auditório',localStatus:'CONFIRMADO',departmentResponse:undefined};
 const query={startAt:p.defesa.startAt,local:'Auditório',emails:[]};
 assert.equal(inspectDefenseConflicts([p],query,false).length,0);
 assert.equal(inspectDefenseConflicts([p],{...query,local:'Sala de reuniões'},false).length,1);
 p.status='CONCLUIDO';
 assert.equal(inspectDefenseConflicts([p],{...query,local:'Sala de reuniões'},false).length,1,'conclusão não apaga a ocupação histórica');
 p.defesa.departmentResponse={revision:0,decision:'UNAVAILABLE',respondedAt:p.defesa.startAt,respondedBy:'department@example.invalid',startAt:p.defesa.startAt,endAt:p.defesa.endAt};
 assert.equal(inspectDefenseConflicts([p],{...query,local:'Sala de reuniões',emails:[p.orientador.email]}).length,0);
 p.status='AGUARDANDO_CONFIRMACAO_LOCAL';p.defesa.departmentResponse=undefined;p.defesa.localStatus='PENDENTE';
 assert.equal(inspectDefenseConflicts([p],query,false).length,0);
});

test('recusa registrada apenas no status do local libera o horário', () => {
  const process = structuredClone(DEMO_PROCESSES[0]);
  process.defesa = {
    ...process.defesa,
    startAt: '2026-12-07T18:30:00.000Z',
    local: 'Auditório',
    localStatus: 'NEGADO',
    departmentResponse: undefined,
  };
  const input = { startAt: process.defesa.startAt, local: 'Auditório', emails: [] };
  assert.deepEqual(inspectDefenseConflicts([process], input), []);
  process.defesa.localStatus = 'PENDENTE';
  assert.equal(inspectDefenseConflicts([process], input).length, 1);
});
