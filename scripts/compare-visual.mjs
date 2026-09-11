#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import png from 'pngjs';
const {PNG}=png;

const value=(name,fallback)=>{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:fallback;};
export async function comparePngFiles(baselinePath,candidatePath,diffPath,threshold=.1){
  const baseline=PNG.sync.read(await readFile(baselinePath)),candidate=PNG.sync.read(await readFile(candidatePath));
  if(baseline.width!==candidate.width||baseline.height!==candidate.height)return {width:Math.max(baseline.width,candidate.width),height:Math.max(baseline.height,candidate.height),differentPixels:null,ratio:1,sizeMismatch:true};
  const diff=new PNG({width:baseline.width,height:baseline.height});
  const differentPixels=pixelmatch(baseline.data,candidate.data,diff.data,baseline.width,baseline.height,{threshold,includeAA:false});
  await mkdir(path.dirname(diffPath),{recursive:true});await writeFile(diffPath,PNG.sync.write(diff));
  return {width:baseline.width,height:baseline.height,differentPixels,ratio:differentPixels/(baseline.width*baseline.height),sizeMismatch:false};
}
export async function compareVisualFolders({baseline,candidate,diff,maximumRatio=.001,approve=false,reviewedBy=''}){
  if(!existsSync(candidate))throw new Error('A pasta de capturas candidatas não existe.');
  const files=(await readdir(candidate)).filter(file=>file.endsWith('.png')).sort();if(!files.length)throw new Error('Nenhuma captura PNG candidata foi encontrada.');
  if(approve){
    if(reviewedBy.trim().length<3)throw new Error('Informe PORTAL_VISUAL_REVIEWER após conferir todas as capturas.');
    await mkdir(baseline,{recursive:true});for(const file of files)await copyFile(path.join(candidate,file),path.join(baseline,file));
    const manifest={approvedAt:new Date().toISOString(),approvedBy:reviewedBy.trim(),files,scope:'Dados fictícios locais; a aprovação visual não homologa provedores externos.'};await writeFile(path.join(baseline,'baseline.json'),JSON.stringify(manifest,null,2));return {status:'BASELINE_APROVADA',...manifest};
  }
  if(!existsSync(path.join(baseline,'baseline.json')))return {status:'SEM_BASELINE_APROVADA',files,results:[],errors:['Aprovação humana inicial ainda não foi registrada.']};
  await mkdir(diff,{recursive:true});const results=[],errors=[];
  for(const file of files){const before=path.join(baseline,file);if(!existsSync(before)){errors.push(`${file}: ausente na referência.`);continue;}const result=await comparePngFiles(before,path.join(candidate,file),path.join(diff,file),.1);results.push({file,...result});if(result.ratio>maximumRatio)errors.push(`${file}: ${(result.ratio*100).toFixed(3)}% dos pixels mudaram.`);}
  const baselineFiles=(await readdir(baseline)).filter(file=>file.endsWith('.png'));for(const file of baselineFiles)if(!files.includes(file))errors.push(`${file}: captura candidata ausente.`);
  const report={status:errors.length?'REGRESSAO_DETECTADA':'APROVADO',maximumRatio,results,errors,comparedAt:new Date().toISOString()};
  await writeFile(path.join(diff,'resultado.json'),JSON.stringify(report,null,2));await writeFile(path.join(diff,'index.html'),`<!doctype html><meta charset="utf-8"><title>Comparação visual</title><style>body{font:16px system-ui;margin:24px}img{max-width:100%;border:1px solid}figure{margin:28px 0}</style><h1>${report.status}</h1><ul>${errors.map(error=>`<li>${error.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</li>`).join('')}</ul>${results.map(row=>`<figure><figcaption>${row.file} · ${(row.ratio*100).toFixed(3)}%</figcaption><img src="${row.file}" alt="Diferença visual de ${row.file}"></figure>`).join('')}`);return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=fileURLToPath(new URL('..',import.meta.url));
  const report=await compareVisualFolders({baseline:path.resolve(value('--baseline',path.join(root,'visual-baseline'))),candidate:path.resolve(value('--candidate',path.join(root,'..','portal-visual-rc8'))),diff:path.resolve(value('--diff',path.join(root,'..','portal-visual-diff-rc8'))),maximumRatio:Number(value('--max-ratio','0.001')),approve:process.argv.includes('--approve'),reviewedBy:process.env.PORTAL_VISUAL_REVIEWER||''});console.log(JSON.stringify(report,null,2));if(report.status==='REGRESSAO_DETECTADA'||report.status==='SEM_BASELINE_APROVADA')process.exitCode=1;
}
