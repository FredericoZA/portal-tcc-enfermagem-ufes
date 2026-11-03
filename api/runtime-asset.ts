import sharp from 'sharp';
import type { Request, Response } from 'express';
import { loadRuntimeImage } from '../server/integrations/supabase';

const supabaseUrl = () => String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const supabaseSecret = () => String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

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
    const stored=await loadRuntimeImage(key);
    if(!stored)return res.status(404).json({error:'Ativo não localizado.'});
    let content:Buffer=stored.bytes;
    let mime=stored.mimeType;
    const png=req.query?.format==='png';
    if(png&&mime!=='image/png'){
      content=await sharp(content,{limitInputPixels:16_000_000}).png().toBuffer();
      mime='image/png';
    }
    res.setHeader('Content-Type',mime);
    res.setHeader('Content-Length',String(content.length));
    res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    res.setHeader('ETag',`"${key}${png?'-png':''}"`);
    return res.status(200).send(content);
  }catch(error){
    console.error('[RuntimeAsset] Falha ao carregar ativo:',error);
    return res.status(502).json({error:'Ativo temporariamente indisponível.'});
  }
}
