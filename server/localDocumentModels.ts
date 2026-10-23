import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';

export function localDocumentModelsEnabled(env:NodeJS.ProcessEnv=process.env){
  return env.NODE_ENV!=='production'&&!env.VERCEL&&env.PORTAL_PERSISTENCE_PROVIDER==='local_file'&&env.PORTAL_TEST_DOCUMENT_RENDERER==='true';
}

export function storeLocalDocumentModel(directory:string,fileName:string,bytes:Buffer){
  if(!localDocumentModelsEnabled())throw new Error('O armazenamento documental local está desabilitado.');
  if(!fileName.toLowerCase().endsWith('.docx')||!bytes.length||bytes.length>12*1024*1024||bytes.subarray(0,2).toString('hex')!=='504b')throw new Error('Envie um DOCX válido de até 12 MB.');
  const contentSha256=createHash('sha256').update(bytes).digest('hex');
  const folder=path.join(directory,'modelos-locais');mkdirSync(folder,{recursive:true,mode:0o700});
  writeFileSync(path.join(folder,`${contentSha256}.docx`),bytes,{mode:0o600});
  return {id:`local_model_${contentSha256}`,name:path.basename(fileName),webViewLink:'',rootFolderId:undefined,contentSha256,driveRevisionId:`local-${contentSha256}`,driveModifiedTime:new Date().toISOString()};
}

export function readLocalDocumentModel(directory:string,fileId:string,expectedHash:string){
  if(!localDocumentModelsEnabled())throw new Error('O armazenamento documental local está desabilitado.');
  const hash=/^local_model_([a-f0-9]{64})$/.exec(fileId)?.[1];
  if(!hash||hash!==expectedHash)throw new Error('Referência local de modelo inválida.');
  const bytes=readFileSync(path.join(directory,'modelos-locais',`${hash}.docx`));
  if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error('A integridade do DOCX local não foi confirmada.');
  return bytes;
}
