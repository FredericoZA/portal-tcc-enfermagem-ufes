import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {bindReservationContact} from '../src/utils/reservationContact';
import {configuredReservationContact,ReservationEmailSettingsControl} from '../src/components/ReservationEmailSettings';

test('shared contact shows the effective published email before migration and the shared email afterward',()=>{
  const settings:any={integrationStudio:{emailTemplates:[{id:'email-reserva',recipient:'recent@ufes.br'}]},emailConfig:{roomReservationDepartmentEmail:'older@ufes.br'}};
  assert.equal(configuredReservationContact(settings),'recent@ufes.br');
  settings.emailConfig.roomReservationEmailCentralized=true;
  assert.equal(configuredReservationContact(settings),'older@ufes.br');
  settings.emailConfig.roomReservationDepartmentEmail='new@ufes.br';
  assert.equal(configuredReservationContact(settings),'new@ufes.br');
});

test('shared contact has one labeled email input, explicit save and advisor guidance',()=>{
  const markup=renderToStaticMarkup(React.createElement(ReservationEmailSettingsControl,{email:'new@ufes.br',saving:true,message:'',error:'',onChange:()=>{},onSave:()=>{}}));
  assert.match(markup,/Responsável pela reserva de salas/);
  assert.match(markup,/id="reservation-contact"[^>]*type="email"/);
  assert.match(markup,/auditório e a sala de reuniões/);
  assert.match(markup,/orientador/);
  assert.match(markup,/disabled=""/);
});


test('published model and legacy operational copies bind to the shared role without rewriting history',()=>{
  const source:any={operationalConfig:{reservation:{departmentEmail:'outdated@ufes.br',locations:['Auditório']}},emailTemplates:[{id:'email-reserva',recipient:'outdated@ufes.br'},{id:'email-resposta-departamento',recipient:'another-old@ufes.br'},{id:'custom',recipient:'custom@ufes.br'}]};
  const bound=bindReservationContact(source,'current@ufes.br');
  assert.equal(bound.operationalConfig.reservation.departmentEmail,'current@ufes.br');
  assert.equal(bound.emailTemplates[0].recipient,'<<DEPARTAMENTO_EMAIL>>');
  assert.equal(bound.emailTemplates[1].recipient,'<<DEPARTAMENTO_EMAIL>>');
  assert.equal(bound.emailTemplates[2].recipient,'custom@ufes.br');
  assert.equal(source.operationalConfig.reservation.departmentEmail,'outdated@ufes.br');
  assert.equal(source.emailTemplates[0].recipient,'outdated@ufes.br');
});


test('saving an unrelated legacy studio does not replace its newer published address with the legacy global field',()=>{
  const source:any={emailTemplates:[{id:'email-reserva',recipient:'recent@ufes.br'}],operationalConfig:{reservation:{departmentEmail:'outdated@ufes.br'}}};
  const before:any={integrationStudio:source,emailConfig:{roomReservationDepartmentEmail:'outdated@ufes.br'}};
  const updated=bindReservationContact(source,configuredReservationContact(before),false);
  assert.equal(configuredReservationContact({...before,integrationStudio:updated}),'recent@ufes.br');
  assert.equal(updated.operationalConfig.reservation.departmentEmail,'recent@ufes.br');
  assert.equal(updated.emailTemplates[0].recipient,'recent@ufes.br');
});
