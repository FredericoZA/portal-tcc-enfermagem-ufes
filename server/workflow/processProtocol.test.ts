import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {DEFAULT_INSTALLATION_PROFILE} from '../../src/constants/installation';
import {nextAvailableProcessProtocol} from './processProtocol';

const next = (active:string[],pending:string[]=[]) =>
 nextAvailableProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,active,pending);

test('primeiro TCC recebe 0001 quando não há processos ou exclusões pendentes',()=>{
 assert.equal(next([]),'TCC-2026-0001');
});

test('exclusões concluídas deixam lacunas reutilizáveis sem renumerar um TCC ativo',()=>{
 assert.equal(next(['TCC-2026-0006'],['TCC-2026-0003','TCC-2026-0004','TCC-2026-0005']),'TCC-2026-0001');
 assert.equal(next(['TCC-2026-0001','TCC-2026-0006'],['TCC-2026-0003','TCC-2026-0004','TCC-2026-0005']),'TCC-2026-0002');
});

test('exclusões pendentes reservam o número para evitar colidir com Drive e Asten',()=>{
 assert.equal(next([],['TCC-2026-0001','TCC-2026-0002']),'TCC-2026-0003');
 assert.equal(next(['TCC-2026-0001'],['TCC-2026-0002']),'TCC-2026-0003');
});

test('quando números iniciais estão ocupados, encontra a primeira lacuna ou adiciona no final',()=>{
 assert.equal(next(['TCC-2026-0001','TCC-2026-0002','TCC-2026-0004']),'TCC-2026-0003');
 assert.equal(next(['TCC-2026-0001','TCC-2026-0002','TCC-2026-0003']),'TCC-2026-0004');
});

test('outros anos e prefixos não ocupam a sequência do ano atual',()=>{
 assert.equal(next(['TCC-2025-0999','ENF-2026-0099']),'TCC-2026-0001');
 assert.equal(nextAvailableProcessProtocol({...DEFAULT_INSTALLATION_PROFILE,protocolPrefix:'ENF'},2026,['TCC-2026-0999','ENF-2026-0012'],[]),'ENF-2026-0001');
});

test('fonte operacional considera apenas exclusões ainda pendentes',()=>{
 const server=readFileSync(new URL('../../server.ts',import.meta.url),'utf8');
 assert.match(server,/processDeletionTasksStore\.filter\(task=>task\.status==='PENDING'\)\.map\(task=>task\.protocol\)/);
 assert.doesNotMatch(server,/protocolCounter\+\+/);
});
