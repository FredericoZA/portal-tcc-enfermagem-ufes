import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSupabaseAdminHeaders } from './supabase';

type EventVersion = { id: string; createdAt: string };

function key(event: EventVersion): string {
  const hash = createHash('sha256').update(JSON.stringify([event.id, event.createdAt])).digest('hex');
  return `notification-read-${hash.slice(0, 32)}`;
}

export function notificationReadStore(directory: string, durable: boolean) {
  const localDirectory = join(directory, 'notification-reads');
  const localFile = (owner: string) => join(localDirectory, createHash('sha256').update(owner).digest('hex') + '.json');
  const endpoint = () => new URL('/rest/v1/portal_table_preferences', process.env.SUPABASE_URL);
  const readLocal = (owner: string): string[] => {
    try {
      return JSON.parse(readFileSync(localFile(owner), 'utf8')) as string[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  };

  return {
    async read(owner: string, events: EventVersion[]): Promise<Set<string>> {
      if (events.length === 0) return new Set();
      const eventByKey = new Map(events.map(event => [key(event), event.id]));
      let keys: string[];
      if (durable) {
        const url = endpoint();
        // PostgREST string literals use double quotes for values with reserved characters.
        url.searchParams.set('owner_email', `eq."${owner.replace(/["\\]/g, '\\$&')}"`);
        url.searchParams.set('preference_scope', 'eq.USER');
        url.searchParams.set('table_key', `in.(${[...eventByKey.keys()].join(',')})`);
        url.searchParams.set('select', 'table_key');
        const result = await fetch(url, { headers: buildSupabaseAdminHeaders(), signal: AbortSignal.timeout(5_000) });
        if (!result.ok) throw new Error('Não foi possível consultar a leitura das notificações.');
        keys = (await result.json() as Array<{ table_key: string }>).map(row => row.table_key);
      } else {
        keys = readLocal(owner);
      }
      return new Set(keys.flatMap(readKey => {
        const id = eventByKey.get(readKey);
        return id ? [id] : [];
      }));
    },

    async mark(owner: string, event: EventVersion): Promise<void> {
      const tableKey = key(event);
      if (durable) {
        // A row per account and event version makes repeat and concurrent marks idempotent.
        // The namespace is outside the academic snapshot and the UI table keys.
        const result = await fetch(endpoint(), {
          method: 'POST',
          headers: { ...buildSupabaseAdminHeaders(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify({ table_key: tableKey, preference_scope: 'USER', owner_email: owner, config: {}, updated_by: owner }),
          signal: AbortSignal.timeout(5_000),
        });
        if (!result.ok) throw new Error('Não foi possível marcar a notificação como lida.');
      } else {
        const keys = readLocal(owner);
        if (keys.includes(tableKey)) return;
        mkdirSync(localDirectory, { recursive: true, mode: 0o700 });
        const file = localFile(owner);
        writeFileSync(file + '.tmp', JSON.stringify([...keys.slice(-399), tableKey]), { mode: 0o600 });
        renameSync(file + '.tmp', file);
      }
    },
  };
}
