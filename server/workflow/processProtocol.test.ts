import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_INSTALLATION_PROFILE} from '../../src/constants/installation';
import {nextAvailableProcessProtocol} from './processProtocol';
test('pending deletions reserve codes even when no active TCC remains',()=>{
 assert.equal(nextAvailableProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,[],['TCC-2026-0001','TCC-2026-0002']),'TCC-2026-0003');
 assert.equal(nextAvailableProcessProtocol(DEFAULT_INSTALLATION_PROFILE,2026,['TCC-2026-0005'],['TCC-2026-0008','TCC-2025-0999']),'TCC-2026-0009');
 assert.equal(nextAvailableProcessProtocol({...DEFAULT_INSTALLATION_PROFILE,protocolPrefix:'ENF'},2026,[],['TCC-2026-0999','ENF-2026-0012']),'ENF-2026-0013');
});
