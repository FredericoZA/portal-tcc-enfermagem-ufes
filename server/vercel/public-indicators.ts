import type {Request, Response} from 'express';
import {admitPortalRequest} from '../security/requestAdmission';

/** Retired public aggregator, including direct Vercel URLs. No database reads. */
export default function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!admitPortalRequest(req, res, 'indicators')) return;
  return res.status(410).json({error:'A consulta pública de indicadores foi encerrada. Utilize o acesso administrativo.',code:'PUBLIC_INDICATORS_RETIRED'});
}
