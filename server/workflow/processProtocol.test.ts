import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_INSTALLATION_PROFILE} from '../../src/constants/installation';
import {mergeProcessProtocolCounters,reserveNextProcessProtocol,seedProcessProtocolCounters} from './processProtocol';

const next = (active:string[],pending:string[]=[]) =>
 reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,undefined,[...active,...pending]).protocol;

test('primeiro TCC recebe 00001 quando não há processos ou exclusões pendentes',()=>{
 assert.equal(next([]),'TCC - 00001');
});

test('alocação preenche a primeira lacuna entre os códigos ocupados',()=>{
 assert.equal(next(['TCC - 00006'],['TCC - 00003','TCC - 00004','TCC - 00005']),'TCC - 00001');
 assert.equal(next(['TCC - 00001','TCC - 00002','TCC - 00004']),'TCC - 00003');
});

test('exclusões pendentes reservam o número para evitar colidir com Drive e Asten',()=>{
 assert.equal(next([],['TCC - 00001','TCC - 00002']),'TCC - 00003');
 assert.equal(next(['TCC - 00001'],['TCC - 00002']),'TCC - 00003');
});

test('contador histórico permanece após a reutilização de uma vaga',()=>{
 const counters={'TCC-9999':3};
 const reused=reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,counters,['TCC - 00001','TCC - 00003']);
 assert.equal(reused.protocol,'TCC - 00002');
 assert.deepEqual(reused.counters,counters);
 assert.equal(reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,counters,[]).protocol,'TCC - 00001');
});

test('contadores anuais ficam preservados e ficam fora da escolha da primeira vaga',()=>{
 assert.deepEqual(seedProcessProtocolCounters(undefined,['TCC-2026-0001','TCC-2026-0017','TCC-2025-0099']),{'TCC-2026':17,'TCC-2025':99});
 assert.equal(reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,{'TCC-2026':20,'TCC-9999':5},['TCC-2026-0017','TCC - 00006']).protocol,'TCC - 00001');
 assert.equal(reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,{'TCC-2026':3}).protocol,'TCC - 00001');
 assert.equal(reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,{'TCC-2026':5},['TCC - 00001']).protocol,'TCC - 00002');
});

test('sequência serial ignora códigos anuais, legados e códigos seriais de outro prefixo',()=>{
 const issued=['001 - Legado','999 - Legado','legado-0108','TCC-2025-0999','ENF-2026-0099','ENF - 00003'];
 assert.equal(reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,undefined,issued).protocol,'TCC - 00001');
 assert.equal(reserveNextProcessProtocol({...DEFAULT_INSTALLATION_PROFILE,protocolPrefix:'ENF'},undefined,issued).protocol,'ENF - 00001');
 assert.equal(reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,{'TCC-2026':30}).protocol,'TCC - 00001');
});

test('restauração antiga não apaga ou reduz contadores já persistidos',()=>{
 const current={'TCC-2026':3,'TCC-2025':99};
 assert.deepEqual(mergeProcessProtocolCounters(current,{'TCC-2026':1,'ENF-2026':12}),{'TCC-2026':3,'TCC-2025':99,'ENF-2026':12});
 assert.deepEqual(mergeProcessProtocolCounters(undefined,current),current);
 assert.deepEqual(current,{'TCC-2026':3,'TCC-2025':99});
});

test('reserva usa o mesmo prefixo normalizado e truncado do protocolo emitido',()=>{
 const profile={...DEFAULT_INSTALLATION_PROFILE,protocolPrefix:'  enfermagem-ufes-extra!  '};
 const first=reserveNextProcessProtocol(profile,{});
 const second=reserveNextProcessProtocol(profile,first.counters,[first.protocol]);
 assert.equal(first.protocol,'ENFERMAGEM-UFES- - 00001');
 assert.equal(second.protocol,'ENFERMAGEM-UFES- - 00002');
 assert.deepEqual(second.counters,{'ENFERMAGEM-UFES--9999':2});
});

test('reserva não altera o objeto do snapshot usado por outra tentativa',()=>{
 const original={'TCC-2026':1};
 const first=reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,original);
 const competing=reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,original);
 assert.deepEqual(original,{'TCC-2026':1});
 assert.equal(first.protocol,competing.protocol);
 assert.notEqual(first.counters,competing.counters);
});

test('contador inválido ou esgotado falha sem reiniciar a numeração',()=>{
 for(const counters of [null,[],true,{'TCC-2026':-1},{'TCC-2026':1.5},{'TCC-2026':'3'},JSON.parse('{"__proto__":3}'),{'TCC-2026':Number.MAX_SAFE_INTEGER+1}]){
  assert.throws(()=>reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,counters),/Contador/);
 }
 assert.equal(reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,{'TCC-9999':Number.MAX_SAFE_INTEGER}).protocol,'TCC - 00001');
 assert.throws(()=>reserveNextProcessProtocol(DEFAULT_INSTALLATION_PROFILE,{},['TCC-2026-99999999999999999']),/sequência/);
 const occupied=Array.from({length:99_998},(_,index)=>`TCC - ${String(index+1).padStart(5,'0')}`);
 assert.equal(next(occupied),'TCC - 99999');
 assert.throws(()=>next([...occupied,'TCC - 99999']),/limite/);
});
