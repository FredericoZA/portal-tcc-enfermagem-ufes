import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_INSTALLATION_PROFILE} from '../../src/constants/installation';
import {mergeProcessProtocolCounters,reserveNextProcessProtocol,seedProcessProtocolCounters} from './processProtocol';

const next = (active:string[],pending:string[]=[]) =>
 reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,undefined,[...active,...pending]).protocol;

test('primeiro TCC recebe 0001 quando não há processos ou exclusões pendentes',()=>{
 assert.equal(next([]),'TCC-2026-0001');
});

test('números já emitidos não são preenchidos novamente quando há lacunas',()=>{
 assert.equal(next(['TCC-2026-0006'],['TCC-2026-0003','TCC-2026-0004','TCC-2026-0005']),'TCC-2026-0007');
 assert.equal(next(['TCC-2026-0001','TCC-2026-0002','TCC-2026-0004']),'TCC-2026-0005');
});

test('exclusões pendentes reservam o número para evitar colidir com Drive e Asten',()=>{
 assert.equal(next([],['TCC-2026-0001','TCC-2026-0002']),'TCC-2026-0003');
 assert.equal(next(['TCC-2026-0001'],['TCC-2026-0002']),'TCC-2026-0003');
});

test('contador persistido impede reutilização mesmo após excluir todos os processos',()=>{
 let counters={};
 for(let expected=1;expected<=3;expected++){
  const reservation=reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,counters);
  assert.equal(reservation.protocol,`TCC-2026-${String(expected).padStart(4,'0')}`);
  counters=JSON.parse(JSON.stringify(reservation.counters));
 }
 assert.equal(reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,counters,[]).protocol,'TCC-2026-0004');
});

test('migração recupera o maior número existente e não reduz contador mais recente',()=>{
 assert.deepEqual(seedProcessProtocolCounters(undefined,['TCC-2026-0001','TCC-2026-0017','TCC-2025-0099']),{'TCC-2026':17,'TCC-2025':99});
 assert.equal(reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,{'TCC-2026':20},['TCC-2026-0017']).protocol,'TCC-2026-0021');
 assert.equal(reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,{'TCC-2026':3}).protocol,'TCC-2026-0004');
});

test('legados e protocolos de outros anos ou prefixos mantêm sequências independentes',()=>{
 const issued=['001 - Legado','999 - Legado','legado-0108','TCC-2025-0999','ENF-2026-0099'];
 assert.equal(reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,undefined,issued).protocol,'TCC-2026-0001');
 assert.equal(reserveNextProcessProtocol({...DEFAULT_INSTALLATION_PROFILE,protocolPrefix:'ENF'},2026,undefined,issued).protocol,'ENF-2026-0100');
 assert.equal(reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2027,{'TCC-2026':30}).protocol,'TCC-2027-0001');
});

test('restauração antiga não apaga ou reduz contadores já persistidos',()=>{
 const current={'TCC-2026':3,'TCC-2025':99};
 assert.deepEqual(mergeProcessProtocolCounters(current,{'TCC-2026':1,'ENF-2026':12}),{'TCC-2026':3,'TCC-2025':99,'ENF-2026':12});
 assert.deepEqual(mergeProcessProtocolCounters(undefined,current),current);
 assert.deepEqual(current,{'TCC-2026':3,'TCC-2025':99});
});

test('reserva usa o mesmo prefixo normalizado e truncado do protocolo emitido',()=>{
 const profile={...DEFAULT_INSTALLATION_PROFILE,protocolPrefix:'  enfermagem-ufes-extra!  '};
 const first=reserveNextProcessProtocol(profile,2026,{});
 const second=reserveNextProcessProtocol(profile,2026,first.counters,[first.protocol]);
 assert.equal(first.protocol,'ENFERMAGEM-UFES--2026-0001');
 assert.equal(second.protocol,'ENFERMAGEM-UFES--2026-0002');
 assert.deepEqual(second.counters,{'ENFERMAGEM-UFES--2026':2});
});

test('reserva não altera o objeto do snapshot usado por outra tentativa',()=>{
 const original={'TCC-2026':1};
 const first=reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,original);
 const competing=reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,original);
 assert.deepEqual(original,{'TCC-2026':1});
 assert.equal(first.protocol,competing.protocol);
 assert.notEqual(first.counters,competing.counters);
});

test('contador inválido ou esgotado falha sem reiniciar a numeração',()=>{
 for(const counters of [null,[],true,{'TCC-2026':-1},{'TCC-2026':1.5},{'TCC-2026':'3'},JSON.parse('{"__proto__":3}'),{'TCC-2026':Number.MAX_SAFE_INTEGER+1}]){
  assert.throws(()=>reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,counters),/Contador/);
 }
 assert.throws(()=>reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,{'TCC-2026':Number.MAX_SAFE_INTEGER}),/limite/);
 assert.throws(()=>reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,{},['TCC-2026-99999999999999999']),/sequência/);
 for(const year of [NaN,Infinity,2026.5,999,10000])assert.throws(()=>reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,year,{}),/Ano/);
});
