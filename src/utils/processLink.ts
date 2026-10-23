import type {ProcessData} from '../types';
export type ProcessSection='cadastral'|'avaliacao'|'docs'|'acervo';
const sections:Record<string,ProcessSection>={geral:'cadastral',cadastral:'cadastral',avaliacao:'avaliacao',documentos:'docs',docs:'docs',acervo:'acervo'};
export function readProcessLink(search:string):{id:string;section:ProcessSection}|null {
 const params=new URLSearchParams(search),id=params.get('tcc')||'';
 if(!/^[a-zA-Z0-9_-]{1,200}$/.test(id))return null;
 return {id,section:sections[params.get('secao')||'geral']||'cadastral'};
}
export function processLink(base:string,id:string,section:ProcessSection='cadastral'):string {
 if(!/^[a-zA-Z0-9_-]{1,200}$/.test(id))throw new Error('Identificador do TCC inválido.');
 const url=new URL(base);if(!['http:','https:'].includes(url.protocol))throw new Error('Endereço do Portal inválido.');
 url.searchParams.set('tcc',id);url.searchParams.set('secao',section==='cadastral'?'geral':section);url.hash='';return url.toString();
}
export function setProcessLink(id:string|null,section:ProcessSection|null=null,push=false){
 const url=new URL(window.location.href);
 if(id){url.searchParams.set('tcc',id);if(section)url.searchParams.set('secao',section==='cadastral'?'geral':section);else url.searchParams.delete('secao');}else{url.searchParams.delete('tcc');url.searchParams.delete('secao');}
 if(url.href!==window.location.href)window.history[push?'pushState':'replaceState']({},'',url);
}

/** The workflow chooses the initial tab and each real stage transition; manual navigation stays possible. */
export function processWorkflowSection(process:Pick<ProcessData,'etapaAtual'|'defesa'|'avaliacao'|'status'>):ProcessSection {
 const stage=process.etapaAtual;
 if(process.status==='CONCLUIDO'||stage==='CONCLUIDO')return 'docs';
 if(stage==='REPOSITORIO')return 'acervo';
 if(stage==='DOCUMENTOS')return 'docs';
 if(['DEFESA','AVALIACAO','ASSINATURA'].includes(stage))return 'avaliacao';
 return 'cadastral';
}
