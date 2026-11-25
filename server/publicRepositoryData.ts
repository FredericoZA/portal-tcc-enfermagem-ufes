import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import type { ProcessData, SignatureJob } from '../src/types';
import type { LegacyAcademicRecord } from '../src/types/legacyArchive';
import { buildPublicRepository } from './publicViews';
import { canonicalLegacyRecord } from './legacyArchive';

type Snapshot = {
  processes: ProcessData[];
  legacyAcademicRecords: LegacyAcademicRecord[];
  repositorySignatures?: SignatureJob[];
  revision?: number;
};

const repositoryCdnTtlSeconds = 120;
export function createPublicRepositoryReader(ports: {
  durable: () => boolean;
  readRevision: () => Promise<number | null>;
  readDurable: () => Promise<Snapshot>;
  readLocal: () => Snapshot;
}) {
  type Catalog = ReturnType<typeof buildPublicRepository>;
  let cached: { revision: number; data: Catalog } | undefined;
  let pending: Promise<Catalog> | undefined;
  const project = (snapshot: Snapshot) => buildPublicRepository(
    snapshot.processes,
    snapshot.legacyAcademicRecords.map(canonicalLegacyRecord),
    snapshot.repositorySignatures,
  );

  return async () => {
    if (!pending) {
      const task = Promise.resolve().then(async () => {
        if (!ports.durable()) {
          cached = undefined;
          return project(ports.readLocal());
        }
        const revision = await ports.readRevision();
        if (!Number.isSafeInteger(revision) || !revision) throw Error('Revisão não confirmada.');
        if (cached?.revision === revision) return cached.data;
        cached = undefined;
        const snapshot = await ports.readDurable();
        if (!Number.isSafeInteger(snapshot.revision) || !snapshot.revision) throw Error('Catálogo não confirmado.');
        const data = project(snapshot);
        cached = { revision: snapshot.revision, data };
        return data;
      });
      pending = task;
      void task.finally(() => { if (pending === task) pending = undefined; }).catch(() => undefined);
    }
    return structuredClone(await pending);
  };
}

/** The shared response contains the same public fields for every session. */
export function createPublicRepositoryHandler(
  read: () => Promise<ReturnType<typeof buildPublicRepository>>,
  sharedCache = false,
) {
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    if (sharedCache && String(req.originalUrl || req.url || '').includes('?')) {
      res.setHeader('Location', '/api/public/repository');
      return res.status(308).end();
    }
    try {
      const body = JSON.stringify(await read());
      const hash = '"' + createHash('sha256').update(body).digest('hex') + '"';
      if (sharedCache) {
        res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
        res.setHeader('Vercel-CDN-Cache-Control', `public, s-maxage=${repositoryCdnTtlSeconds}, must-revalidate`);
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('ETag', `W/${hash}`);
      // If-None-Match permits a weak comparison for GET and HEAD.
      if (String(req.headers['if-none-match'] || '').split(',')
        .some(tag => tag.trim().replace(/^W\//, '') === hash || tag.trim() === '*')) {
        return res.status(304).end();
      }
      return req.method === 'HEAD' ? res.end() : res.end(body);
    } catch {
      res.setHeader('Retry-After', '5');
      return res.status(503).json({ error: 'Não foi possível carregar o repositório.', code: 'PUBLIC_REPOSITORY_UNAVAILABLE' });
    }
  };
}
