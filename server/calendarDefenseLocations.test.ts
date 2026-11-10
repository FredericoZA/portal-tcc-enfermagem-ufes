import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {calendarDefenseLocationOptions,calendarStandaloneGoogleEvents,calendarGoogleEventDuplicatesDefense,calendarGoogleEventLocation,calendarLocationKey,matchesCalendarLocation,toggleCalendarLocation} from '../src/utils/calendarDefenseLocations';
import {calendarEventMatchesProcess,isDefenseOnCalendar} from '../src/utils/defenseReservationState';
import {formatStudentsString} from '../src/utils/formatters';
import {MANAGED_DEFENSE_LOCATIONS} from '../src/utils/reservationLocation';

const process=(id:string,local:string,localStatus='CONFIRMADO'):any=>({id,protocolo:`TCC - ${id}`,titulo:`Title ${id}`,aluno1:{nome:`Aluno ${id}`,email:'private@example.invalid'},aluno2:null,defesa:{startAt:'2026-11-06T14:00:00-03:00',local,localStatus}});
const event=(id:string,local:string):any=>({id,summary:`Evento ${id}`,description:`Local: ${local}\nOrientador: private@example.invalid`,start:'2026-11-06T16:00:00-03:00'});

function calendarDay(processes:any[],events:any[],selection:readonly string[]|null,ownsCalendarData=true){
  const source=readFileSync('src/pages/HomePage.tsx','utf8');
  const start=source.indexOf('  const getEventsForDate =');const end=source.indexOf('  const handleGoogleCalendarSync =',start);
  const code=ts.transpileModule(`(function(){${source.slice(start,end)};return getEventsForDate;})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  return vm.runInNewContext(code,{filteredProcesses:processes,processes,googleEvents:events,standaloneGoogleEvents:calendarStandaloneGoogleEvents(processes,events),calendarLocations:selection,ownsCalendarData,isDefenseOnCalendar,calendarEventMatchesProcess,matchesCalendarLocation,calendarGoogleEventLocation,formatStudentsString,year:2026,month:10,Date})(6);
}

test('todos preserva o conjunto anterior do calendário, sem ressuscitar eventos Google de processos excluídos do filtro',()=>{
  const processes=[process('1',MANAGED_DEFENSE_LOCATIONS[0]),process('2','Sala de teste'),process('3','Sala recusada','RECUSADO')];
  const events=[event('gcal-1','Endereço antigo'),event('gcal-2','Sala antiga'),event('gcal-3','Sala recusada'),event('external','Sala externa')];
  const all=calendarDay(processes,events,null);
  assert.deepEqual(Array.from(all.defenses,(p:any)=>p.id),['1','2']);assert.deepEqual(Array.from(all.gcal,(e:any)=>e.id),['external']);assert.equal(all.total,3);
  const selected=calendarDay(processes,events,[calendarLocationKey('Sala de teste')]);
  assert.deepEqual(Array.from(selected.defenses,(p:any)=>p.id),['2']);assert.equal(selected.gcal.length,0);
  const old=calendarDay(processes,events,[calendarLocationKey('Sala antiga')]);
  assert.equal(old.total,0,'o Google vinculado a outro local do processo não reaparece');
});

test('opções incluem locais padrão e personalizados públicos; não incluem recusas, rascunhos ou descrição privada',()=>{
  const records=[process('1','Sala de teste'),process('2','SALA DE TESTE'),process('3','Local recusado','RECUSADO'),{...process('4','Rascunho'),defesa:{local:'Rascunho'}}];
  const events=[event('gcal-1','Local antigo'),event('external','Sala externa')];
  const snapshot=JSON.stringify([records,events]);
  const options=calendarDefenseLocationOptions(records,events);
  for(const label of [...MANAGED_DEFENSE_LOCATIONS,'Sala de teste','Sala externa'])assert.ok(options.some(option=>option.label===label),label);
  assert.equal(options.filter(option=>option.key===calendarLocationKey('Sala de teste')).length,1);
  assert.doesNotMatch(JSON.stringify(options),/Local recusado|Rascunho|Local antigo|private@|Title|TCC -/);
  assert.equal(JSON.stringify([records,events]),snapshot,'nenhuma alteração de dados/estado de reserva');
});

test('Google usa a mesma localização que a apresentação e oferece opção explícita quando não informada',()=>{
  assert.equal(calendarGoogleEventLocation({location:'Campo Google',description:'Local: Sala da descrição\nPessoa: nome'}),'Sala da descrição');
  assert.equal(calendarGoogleEventLocation({location:'Campo Google'}),'Campo Google');
  const options=calendarDefenseLocationOptions([process('1','')],[]);
  assert.ok(options.some(option=>option.label==='Sem local informado'));
  assert.equal(matchesCalendarLocation('',[calendarLocationKey('')]),true);
});

test('multisseleção, limpar e todos não fazem consultas e todos abrange locais de uma atualização futura',()=>{
  const options=calendarDefenseLocationOptions([],[],['Sala A','Sala B']);
  const a=calendarLocationKey('Sala A'),b=calendarLocationKey('Sala B');
  assert.deepEqual(toggleCalendarLocation(null,a,options),[b]);
  assert.deepEqual(toggleCalendarLocation([],a,options),[a]);
  assert.equal(toggleCalendarLocation([a],b,options),null);
  assert.equal(matchesCalendarLocation('Novo local',null),true);
  assert.equal(matchesCalendarLocation('Sala A',[]),false);
  assert.equal(matchesCalendarLocation(' sála a ',[a]),true);
  assert.equal(calendarDay([process('1','Sala A')],[event('external','Sala B')],[]).total,0);
});

test('troca de identidade não permite que o calendário reaproveite dados antigos',async()=>{
  assert.equal(calendarDay([process('1','Sala privada')],[event('external','Sala privada')],null,false).total,0);
  const source=readFileSync('src/pages/HomePage.tsx','utf8');
  const start=source.indexOf('  const refreshData = async () =>');const end=source.indexOf('\n  useEffect(',start);
  let resolve!:(value:unknown)=>void;let calls=0,applied=0;
  const response=new Promise(yes=>{resolve=yes;});
  const context={calendarRefreshRequest:{current:null as AbortController|null},calendarIdentity:'account:a',calendarIdentityRef:{current:'account:a'},AbortController,Promise,console,
    apiClient:{getPublicCalendarData:()=>{calls++;return response;}},
    setProcesses:()=>{applied++;},setGoogleEvents:()=>{applied++;},setCalendarDataOwner:()=>{applied++;},setLoadError:()=>{},setIsLoading:()=>{},
  };
  const code=ts.transpileModule(`(function(){${source.slice(start,end)};return refreshData;})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const refresh=vm.runInNewContext(code,context);const pending=refresh();
  context.calendarIdentityRef.current='account:b';resolve({processes:[process('1','Sala privada')],googleEvents:[]});await pending;
  assert.equal(applied,0);assert.equal(calls,1,'uma leitura pública agregada, sem consulta privada ou extra para locais');
});

test('filtro não é aplicado ao repositório e o popover tem portal, controles de teclado e cleanup',()=>{
  const source=readFileSync('src/pages/HomePage.tsx','utf8');
  const repositoryStart=source.indexOf("{publicTab === 'biblioteca'");assert.ok(repositoryStart>0);
  const repository=source.slice(repositoryStart);
  assert.doesNotMatch(repository,/matchesCalendarLocation|calendarLocations/);
  assert.match(source,/<CalendarLocationFilter key=\{calendarIdentity\}/);
  assert.match(source,/ownsCalendarData\?processes:\[\]/);
  assert.match(source,/identity===calendarIdentity/);
  assert.match(source,/aria-label="Filtrar locais do calendário" aria-expanded=\{open\}/);
  assert.match(source,/createPortal\(<div ref=\{popup\} role="dialog"/);
  assert.match(source,/max-h-60 overflow-y-auto/);
  assert.match(source,/Todos os locais/);assert.match(source,/Concluir/);
  assert.match(source,/document\.removeEventListener\('pointerdown',outside,true\)/);
  assert.match(source,/window\.removeEventListener\('scroll',scroll,true\)/);
});


test('rajada live coalesce uma leitura agregada e somente uma revalidação, sem cancelar a identidade atual',async()=>{
  const source=readFileSync('src/pages/HomePage.tsx','utf8');
  const start=source.indexOf('  const refreshData = async () =>');const end=source.indexOf('\n  useEffect(',start);
  const responses:Array<{resolve:(value:unknown)=>void;reject:(reason:unknown)=>void}>=[];const applied:string[]=[];let loading=true,errors=0;
  const context={calendarRefreshRequest:{current:null as any},calendarIdentity:'account:a',calendarIdentityRef:{current:'account:a'},AbortController,Promise,
    apiClient:{getPublicCalendarData:()=>new Promise((resolve,reject)=>responses.push({resolve,reject}))},
    setProcesses:(records:any[])=>applied.push(records[0].id),setGoogleEvents:()=>{},setCalendarDataOwner:()=>{},setLoadError:(message:string)=>{if(message)errors++;},setIsLoading:(value:boolean)=>{loading=value;},
  };
  const code=ts.transpileModule(`(function(){${source.slice(start,end)};return refreshData;})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const refresh=vm.runInNewContext(code,context);
  const initial=refresh();const firstController=context.calendarRefreshRequest.current.controller;
  const live=refresh();const anotherLive=refresh();
  assert.equal(firstController.signal.aborted,false);assert.equal(responses.length,1);
  responses[0].resolve({processes:[process('first-current','Sala A')],googleEvents:[]});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(applied,['first-current']);assert.equal(loading,false);assert.equal(responses.length,2);
  responses[1].resolve({processes:[process('revalidated','Sala B')],googleEvents:[]});await Promise.all([initial,live,anotherLive]);
  assert.deepEqual(applied,['first-current','revalidated']);assert.equal(errors,0);assert.equal(context.calendarRefreshRequest.current,null);
  const failedRefresh=refresh();responses[2].reject(new Error('network failure'));await failedRefresh;
  assert.deepEqual(applied,['first-current','revalidated'],'falha mantém dados confirmados da mesma identidade');assert.equal(errors,1);assert.equal(loading,false);
});

test('cancelamento e troca de identidade descartam erro/resposta antigos, sem interferir na nova leitura',async()=>{
 const source=readFileSync('src/pages/HomePage.tsx','utf8');const start=source.indexOf('  const refreshData = async () =>'),end=source.indexOf('\n  useEffect(',start);
 const requests:Array<{resolve:(v:unknown)=>void;reject:(e:unknown)=>void}>=[],applied:string[]=[];let errors=0;
 const context={calendarRefreshRequest:{current:null as any},calendarIdentity:'account:a',calendarIdentityRef:{current:'account:a'},AbortController,Promise,
  apiClient:{getPublicCalendarData:()=>new Promise((resolve,reject)=>requests.push({resolve,reject}))},setProcesses:(v:any[])=>applied.push(v[0].id),setGoogleEvents:()=>{},setCalendarDataOwner:()=>{},setIsLoading:()=>{},setLoadError:(v:string)=>{if(v)errors++;}};
 const code=ts.transpileModule(`(function(){${source.slice(start,end)};return refreshData;})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const refresh=vm.runInNewContext(code,context);const old=refresh(),oldController=context.calendarRefreshRequest.current.controller;
 context.calendarIdentity='account:b';context.calendarIdentityRef.current='account:b';const current=refresh();assert.equal(oldController.signal.aborted,true);
 requests[0].resolve({processes:[process('private-old','A')],googleEvents:[]});await old;assert.equal(context.calendarRefreshRequest.current.identity,'account:b');
 requests[1].resolve({processes:[process('new-owner','B')],googleEvents:[]});await current;assert.deepEqual(applied,['new-owner']);assert.equal(errors,0);
 const canceled=refresh();context.calendarRefreshRequest.current.controller.abort();requests[2].reject(new Error('abort transport'));await canceled;assert.equal(errors,0);assert.deepEqual(applied,['new-owner']);
});

test('cópia Google legada sem identificador não ressuscita ao selecionar sua sala antiga',()=>{
  const current=process('1','Sala A');
  const old={...event('legacy-google-without-link','Sala B'),summary:`Defesa de TCC - ${formatStudentsString(current.aluno1,current.aluno2)}`,description:`Trabalho: ${current.titulo}\nLocal: Sala B`};
  assert.equal(calendarGoogleEventDuplicatesDefense(old,[current]),true);
  assert.equal(calendarGoogleEventDuplicatesDefense({...old,summary:'Defesa sem nome'},[current]),true,'título da descrição preserva a heurística legada');
  assert.equal(calendarGoogleEventDuplicatesDefense({...old,description:'Local: Sala B'},[current]),true,'nome dos alunos no resumo preserva a heurística legada');
  for(const selected of [null,[calendarLocationKey('Sala B')]] as const){
    const day=calendarDay([current],[old],selected);
    assert.equal(day.gcal.length,0);assert.equal(day.total,selected===null?1:0);
  }
  assert.equal(calendarDefenseLocationOptions([current],[old]).some(option=>option.key===calendarLocationKey('Sala B')),false);
  const source=readFileSync('src/pages/HomePage.tsx','utf8');
  const start=source.indexOf('  const selectedDayGcalEvents = useMemo('),end=source.indexOf('\n\n  useEffect(',start);
  assert.ok(start>0&&end>start);
  const code=ts.transpileModule(`(function(){${source.slice(start,end)};return selectedDayGcalEvents;})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const selected=vm.runInNewContext(code,{ownsCalendarData:true,selectedDayGoogleSelection:[old],standaloneGoogleEvents:calendarStandaloneGoogleEvents([current],[old]),calendarLocations:[calendarLocationKey('Sala B')],useMemo:(callback:Function)=>callback(),calendarGoogleEventLocation,matchesCalendarLocation,Date});
  assert.equal(selected,null,'pop-up já aberto também acompanha a mesma deduplicação');
});

test('heurística textual respeita dia e elegibilidade e mantém evento legítimo de outro dia',()=>{
  const current=process('1','Sala A');
  const sameTitle={...event('legacy-other-day','Sala B'),summary:`Defesa de TCC - ${current.titulo}`,start:'2026-11-05T14:00:00-03:00'};
  assert.equal(calendarGoogleEventDuplicatesDefense(sameTitle,[current]),false);
  assert.ok(calendarDefenseLocationOptions([current],[sameTitle]).some(option=>option.key===calendarLocationKey('Sala B')));
  const declined={...current,defesa:{...current.defesa,localStatus:'RECUSADO'}};
  assert.equal(calendarGoogleEventDuplicatesDefense({...sameTitle,start:current.defesa.startAt},[declined]),false,'texto semelhante sozinho não vincula uma defesa inelegível');
  assert.equal(calendarGoogleEventDuplicatesDefense({...sameTitle,id:'gcal-1'},[current]),true,'identificador estável continua suprimindo cópia mesmo em outro dia');
});
