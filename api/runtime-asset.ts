import { createRequire } from 'node:module';
import type { Request, Response } from 'express';

const loadBundle = createRequire(import.meta.url);

// Vercel emits this wrapper as native Node ESM. Local TypeScript dependencies
// are compiled into the explicit CJS artifact, never resolved by the runtime.
export default async function handler(req: Request, res: Response) {
  const runtime = loadBundle('../dist/server/vercel/runtime-asset.cjs') as {
    default: (req: Request, res: Response) => unknown;
  };
  return runtime.default(req, res);
}
