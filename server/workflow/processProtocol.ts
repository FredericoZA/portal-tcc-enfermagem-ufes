import type {InstallationProfile} from '../../src/types';
import {buildProtocol} from '../../src/utils/installationProfile';

export type ProcessProtocolCounters = Record<string, number>;

const counterKeyPattern = /^[A-Z0-9_-]{1,16}-[1-9]\d{3}$/;
const protocolPattern = /^([A-Z0-9_-]{1,16}-[1-9]\d{3})-(\d+)$/;

export function mergeProcessProtocolCounters(...sources: readonly unknown[]): ProcessProtocolCounters {
  const merged: ProcessProtocolCounters = {};
  for (const source of sources) {
    if (source === undefined) continue;
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Contador de protocolos inválido.');
    for (const [key, value] of Object.entries(source)) {
      if (!counterKeyPattern.test(key) || !Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Contador de protocolos inválido.');
      merged[key] = Math.max(merged[key] || 0, Number(value));
    }
  }
  return merged;
}

export function seedProcessProtocolCounters(counters: unknown, issuedProtocols: readonly string[]): ProcessProtocolCounters {
  const seeded = mergeProcessProtocolCounters(counters);
  for (const protocol of issuedProtocols) {
    const match = typeof protocol === 'string' ? protocol.trim().match(protocolPattern) : null;
    if (!match) continue;
    const sequence = Number(match[2]);
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('A sequência do protocolo existente é inválida.');
    seeded[match[1]] = Math.max(seeded[match[1]] || 0, sequence);
  }
  return seeded;
}

export function reserveNextProcessProtocol(profile: InstallationProfile, year: number, counters: unknown, issuedProtocols: readonly string[] = []): { protocol: string; counters: ProcessProtocolCounters } {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new Error('Ano do protocolo inválido.');
  const nextCounters = seedProcessProtocolCounters(counters, issuedProtocols);
  const key = buildProtocol(profile, year, 1).replace(/-\d+$/, '');
  const sequence = (nextCounters[key] || 0) + 1;
  if (!Number.isSafeInteger(sequence)) throw new Error('A sequência de protocolos atingiu o limite permitido.');
  nextCounters[key] = sequence;
  return { protocol: buildProtocol(profile, year, sequence), counters: nextCounters };
}
