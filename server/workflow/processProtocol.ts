import type {InstallationProfile} from '../../src/types';
import {buildProtocol,processProtocolPrefix,SERIAL_PROCESS_PROTOCOL} from '../../src/utils/installationProfile';

export type ProcessProtocolCounters = Record<string, number>;

const historicalCounterKey = /^([A-Z0-9_-]{1,16})-[1-9]\d{3}$/;
const historicalProtocol = /^([A-Z0-9_-]{1,16}-[1-9]\d{3})-(\d+)$/;
const maxSequence = 99_999;

// Keep the persisted key compatible with earlier releases during a rollback.
const serialCounterKey = (prefix: string) => `${prefix}-9999`;

export class ProcessProtocolExhausted extends Error {
  constructor() { super('A sequência de protocolos atingiu o limite de 99.999.'); }
}

export function mergeProcessProtocolCounters(...sources: readonly unknown[]): ProcessProtocolCounters {
  const merged: ProcessProtocolCounters = {};
  for (const source of sources) {
    if (source === undefined) continue;
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Contador de protocolos inválido.');
    for (const [key, value] of Object.entries(source)) {
      if (!historicalCounterKey.test(key) || !Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Contador de protocolos inválido.');
      merged[key] = Math.max(merged[key] || 0, Number(value));
    }
  }
  return merged;
}

export function seedProcessProtocolCounters(counters: unknown, issuedProtocols: readonly string[]): ProcessProtocolCounters {
  const seeded = mergeProcessProtocolCounters(counters);
  for (const protocol of issuedProtocols) {
    if (typeof protocol !== 'string') continue;
    const serial = protocol.trim().match(SERIAL_PROCESS_PROTOCOL);
    const match = serial || protocol.trim().match(historicalProtocol);
    if (!match) continue;
    const sequence = Number(match[2]);
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('A sequência do protocolo existente é inválida.');
    const key = serial ? serialCounterKey(serial[1]) : match[1];
    seeded[key] = Math.max(seeded[key] || 0, sequence);
  }
  return seeded;
}

export function reserveNextProcessProtocol(profile: InstallationProfile, counters: unknown, issuedProtocols: readonly string[] = []): { protocol: string; counters: ProcessProtocolCounters } {
  const nextCounters = seedProcessProtocolCounters(counters, issuedProtocols);
  const prefix = processProtocolPrefix(profile);
  const key = serialCounterKey(prefix);
  let highest = 0;
  for (const [counter, sequence] of Object.entries(nextCounters)) {
    if (counter.match(historicalCounterKey)?.[1] === prefix) highest = Math.max(highest, sequence);
  }
  if (highest >= maxSequence) throw new ProcessProtocolExhausted();
  const sequence = highest + 1;
  nextCounters[key] = sequence;
  return { protocol: buildProtocol(profile, sequence), counters: nextCounters };
}
