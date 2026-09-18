import type { Request, Response } from 'express';

const supabaseUrl = () => String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const supabaseSecret = () => String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

function adminHeaders(): Record<string,string> {
  const secret=supabaseSecret();
  const headers:Record<string,string>={apikey:secret,Accept:'application/json'};
  if(!secret.startsWith('sb_secret_'))headers.Authorization=`Bearer ${secret}`;
  return headers;
}

function assetKey(value:unknown):string|null{
  const key=String(value||'').trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(key)?key:null;
}

export default async function handler(req:Request,res:Response){
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({error:'Método não permitido.'});
  }
  const key=assetKey(req.query?.key);
  if(!key)return res.status(404).json({error:'Ativo não localizado.'});
  if(!supabaseUrl()||!supabaseSecret())return res.status(503).json({error:'Ativo temporariamente indisponível.'});
  try{
    const response=await fetch(`${supabaseUrl()}/rest/v1/portal_runtime_assets?asset_key=eq.${encodeURIComponent(key)}&select=data_url,mime_type&limit=1`,{
      headers:adminHeaders(),signal:AbortSignal.timeout(15_000)
    });
    if(!response.ok){
      console.error('[RuntimeAsset] Supabase recusou a leitura:',response.status);
      return res.status(502).json({error:'Ativo temporariamente indisponível.'});
    }
    const rows=await response.json() as Array<{data_url?:string;mime_type?:string}>;
    const dataUrl=String(rows?.[0]?.data_url||'');
    const match=/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(dataUrl);
    if(!match)return res.status(404).json({error:'Ativo não localizado.'});
    const content=Buffer.from(match[2],'base64');
    if(!content.length||content.length>4*1024*1024)return res.status(502).json({error:'Ativo inválido.'});
    const mime=String(rows?.[0]?.mime_type||match[1]);
    res.setHeader('Content-Type',mime.startsWith('image/')?mime:match[1]);
    res.setHeader('Content-Length',String(content.length));
    res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    res.setHeader('ETag',`"${key}"`);
    return res.status(200).send(content);
  }catch(error){
    console.error('[RuntimeAsset] Falha ao carregar ativo:',error);
    return res.status(502).json({error:'Ativo temporariamente indisponível.'});
  }
}
