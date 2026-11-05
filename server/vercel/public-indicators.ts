import type {Request, Response} from 'express';
import {admitPortalRequest} from '../security/requestAdmission';
import {buildPublicIndicatorsFromState} from '../publicIndicators';
import type {ProcessData} from '../../src/types';
import type {LegacyAcademicRecord} from '../../src/types/legacyArchive';

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!admitPortalRequest(req, res, 'indicators')) return;
  if(!['GET','HEAD'].includes(req.method)){
    res.setHeader('Allow','GET, HEAD');
    return res.status(405).json({error:'Método não permitido.'});
  }
  const secret=String(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
  let origin:URL;
  try{
    origin=new URL(String(process.env.SUPABASE_URL||'').trim());
    if(origin.username||origin.password||origin.search||origin.hash||origin.protocol!=='https:'||process.env.PORTAL_PERSISTENCE_PROVIDER!=='supabase'||!secret)throw new Error('Unavailable');
  }catch{
    return res.status(503).json({error:'Os indicadores estão temporariamente indisponíveis.'});
  }
  try{
    const query=new URLSearchParams({id:'eq.global',select:'processes:payload->processes,legacyAcademicRecords:payload->legacyAcademicRecords',limit:'1'});
    const headers:Record<string,string>={apikey:secret,Accept:'application/json'};
    if(!secret.startsWith('sb_secret_'))headers.Authorization=`Bearer ${secret}`;
    const response=await fetch(`${origin.href.replace(/\/$/,'')}/rest/v1/portal_runtime_state?${query}`,{headers,signal:AbortSignal.timeout(12_000),redirect:'error',cache:'no-store'});
    if(!response.ok)throw new Error('Unavailable');
    const rows=await response.json() as Array<{processes?:ProcessData[];legacyAcademicRecords?:LegacyAcademicRecord[]}>;
    if(!Array.isArray(rows)||!rows[0]||!Array.isArray(rows[0].processes)||rows[0].legacyAcademicRecords!=null&&!Array.isArray(rows[0].legacyAcademicRecords))throw new Error('Unavailable');
    return res.status(200).json(buildPublicIndicatorsFromState(rows[0]));
  }catch{
    return res.status(503).json({error:'Os indicadores estão temporariamente indisponíveis.'});
  }
}
