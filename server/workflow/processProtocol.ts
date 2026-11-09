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

export function reserveNextProcessProtocol(profile: InstallationProfile, counters: unknown, occupiedProtocols: readonly string[] = []): { protocol: string; counters: ProcessProtocolCounters } {
  const nextCounters = seedProcessProtocolCounters(counters, occupiedProtocols);
  const prefix = processProtocolPrefix(profile);
  const key = serialCounterKey(prefix);
  const occupied = new Set<number>();
  for (const protocol of occupiedProtocols) {
    const match = typeof protocol === 'string' ? protocol.trim().match(SERIAL_PROCESS_PROTOCOL) : null;
    if (match?.[1] === prefix) occupied.add(Number(match[2]));
  }
  let sequence = 1;
  while (occupied.has(sequence)) sequence++;
  if (sequence > maxSequence) throw new ProcessProtocolExhausted();
  // Keep the highest issued number for backups and older releases. Allocation
  // uses the current occupants so completed deletions can leave reusable gaps.
  nextCounters[key] = Math.max(nextCounters[key] || 0, sequence);
  return { protocol: buildProtocol(profile, sequence), counters: nextCounters };
}
