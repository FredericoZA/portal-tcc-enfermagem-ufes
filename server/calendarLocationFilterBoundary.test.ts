import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarDefenseLocationOptions,calendarLocationKey,matchesCalendarLocation,calendarGoogleEventLocation,toggleCalendarLocation} from '../src/utils/calendarDefenseLocations';
import {MANAGED_DEFENSE_LOCATIONS} from '../src/utils/reservationLocation';
const process=(id:string,local:string,status='PENDENTE')=>({id,protocolo:`TCC - ${id}`,defesa:{local,startAt:'2026-11-09T14:00:00-03:00',localStatus:status}} as any);

test('all locations include department and custom spaces; matching does not merge different rooms',()=>{
 const data=[process('00001',MANAGED_DEFENSE_LOCATIONS[0]),process('00002','Sala de Pesquisa'),process('00003',' sala DE pesquisa '),process('00004','Sala de Reuniões do Hospital'),process('00005','Sala recusada','RECUSADO')];
 const options=calendarDefenseLocationOptions(data,[]);
 assert.equal(options.length,4);
 assert.ok(options.some(o=>o.label===MANAGED_DEFENSE_LOCATIONS[1]));
 assert.ok(!options.some(o=>o.label==='Sala recusada'));
 assert.equal(data.filter(p=>matchesCalendarLocation(p.defesa.local,null)).length,data.length);
 assert.equal(data.filter(p=>matchesCalendarLocation(p.defesa.local,[])).length,0);
 const selected=[calendarLocationKey('SALA DE PESQUISA')];
 assert.deepEqual(data.filter(p=>matchesCalendarLocation(p.defesa.local,selected)).map(p=>p.id),['00002','00003']);
 assert.equal(matchesCalendarLocation('Sala de Reuniões do Hospital',[calendarLocationKey(MANAGED_DEFENSE_LOCATIONS[1])]),false);
});
test('old Google copies cannot add a stale room; standalone events use their actual location',()=>{
 const p=process('00001','Novo Local');
 const events=[{id:'gcal-00001',location:'Local antigo',start:p.defesa.startAt},{id:'external',location:'Auditório externo',description:'Local: Sala externa\nOutro dado: exemplo',start:p.defesa.startAt}] as any;
 const options=calendarDefenseLocationOptions([p],events);
 assert.ok(!options.some(o=>o.label==='Local antigo'));
 assert.ok(options.some(o=>o.label==='Novo Local'));
 assert.ok(options.some(o=>o.label==='Sala externa'));
 assert.equal(calendarGoogleEventLocation(events[1]),'Sala externa');
});
test('missing location is explicit and selecting all keeps future rooms visible',()=>{
 const options=calendarDefenseLocationOptions([process('00001','')],[]);
 assert.ok(options.some(o=>o.label==='Sem local informado'));
 const missing=options.find(o=>o.label==='Sem local informado')!.key;
 assert.equal(matchesCalendarLocation('',[missing]),true);
 let selected:readonly string[]|null=[];
 for(const option of options)selected=toggleCalendarLocation(selected,option.key,options);
 assert.equal(selected,null);
 assert.equal(matchesCalendarLocation('Nova sala cadastrada depois',selected),true);
});
