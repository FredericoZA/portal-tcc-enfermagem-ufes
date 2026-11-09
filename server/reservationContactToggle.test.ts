import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {reservationDepartmentEnabled,reservationContact} from '../src/utils/reservationContact';
import {isManagedDefenseLocation,MANAGED_DEFENSE_LOCATIONS} from '../src/utils/reservationLocation';

test('contato desativado bloqueia somente novas reservas gerenciadas; ausência preserva legado',()=>{
 assert.equal(reservationDepartmentEnabled(),true);
 assert.equal(reservationDepartmentEnabled({}),true);
 assert.equal(reservationDepartmentEnabled({roomReservationDepartmentEnabled:true}),true);
 const config={roomReservationDepartmentEnabled:false};
 assert.equal(reservationDepartmentEnabled(config),false);
 for(const location of [...MANAGED_DEFENSE_LOCATIONS,'Auditório','Sala de reuniões'])assert.equal(!reservationDepartmentEnabled(config)&&isManagedDefenseLocation(location),true);
 assert.equal(!reservationDepartmentEnabled(config)&&isManagedDefenseLocation('Sala externa escolhida pelo aluno'),false);
 // Disabling a new-request gate must not erase or replace the shared address.
 assert.equal(reservationContact('old@ufes.br','current@ufes.br',true),'current@ufes.br');
});

test('pedido emitido mantém aprovador vinculado mesmo se contato for desativado/trocado',async()=>{
 const source=await readFile('server.ts','utf8');
 const start=source.indexOf('function reservationApproverEmail(');
 const body=source.slice(start,source.indexOf('function nativeReservationWorkflowStudio(',start));
 const context:any={currentSettings:{emailConfig:{roomReservationDepartmentEnabled:false}},normalizeEmail:(value:string)=>value.trim().toLowerCase(),isManagedDefenseLocation,operationalConfig:()=>({reservation:{locations:MANAGED_DEFENSE_LOCATIONS}}),configuredRoomReservationDepartmentEmail:()=>{throw new Error('Must not resolve a new recipient for an issued request');}};
 runInNewContext(ts.transpileModule(body+';globalThis.approver=reservationApproverEmail;',{}).outputText,context);
 for(const local of [...MANAGED_DEFENSE_LOCATIONS,'Sala externa']){
  const p={defesa:{local,reservationRequestRecipient:'original@ufes.br'},orientador:{email:'advisor@ufes.br'}};
  assert.equal(context.approver(p),'original@ufes.br');
  p.defesa.reservationRequestRecipient='';(p.defesa as any).departmentResponse={respondedBy:'answered@ufes.br'};
  assert.equal(context.approver(p),'answered@ufes.br');
 }
});
