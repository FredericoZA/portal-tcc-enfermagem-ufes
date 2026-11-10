import type {ProcessData} from '../../src/types';
import type {SignatureSignerSnapshot} from '../../src/types/signatures';
import {academicName,facultyRole} from '../../src/utils/personPresentation';
import {documentMainBody,bodyEditRequests} from './googleDocsBody';

export function signaturePresentation(process:ProcessData,signer:SignatureSignerSnapshot,type:string):{name:string;role:string}{
 const people=[process.aluno1,process.aluno2,process.orientador,process.coorientador,...(process.banca||[])].filter(Boolean);
 const person=people.find(person=>person!.email.trim().toLowerCase()===signer.email.trim().toLowerCase());
 const cap=(value:string)=>value.replace(/^\p{L}/u,c=>c.toLocaleUpperCase('pt-BR'));
 let role:string;
 switch(signer.role){
  case 'ADVISOR':role=person?cap(facultyRole(person,'orientador')):'Orientador';if(type==='ATA')role+=' e Presidente';break;
  case 'EXAMINER':role=person?cap(facultyRole(person,'examinador')):'Examinador';break;
  case 'CO_ADVISOR':role=person?cap(facultyRole(person,'coorientador')):'Coorientador';break;
  case 'STUDENT':role=person?.tratamento==='Aluna'?'Aluna autora':person?.tratamento==='Aluno'?'Aluno autor':'Autoria';break;
  case 'PRESIDENT':role='Presidência da Comissão de TCC';break;
  default:throw new Error('Papel de assinatura documental não reconhecido.');
 }
 const name=String(signer.name||'').trim();
 if(!name||/[\r\n\u0000-\u001f\u007f]/.test(name))throw new Error('Confira o nome do signatário antes de gerar o documento.');
 return{name,role};
}

const signatureRole=/^(?:Orienta(?:dor|dora|ção)(?: e [Pp]residente)?|Examinador(?:a|\(a\))?|Integrante da banca|Coorientador(?:a)?|Alun[oa]s?(?: autor(?:a)?)?|Autoria|Discentes?|Presidente(?: da Comissão(?: de TCC| de Trabalho de Conclusão de Curso)?)?|Presidência da Comissão(?: de TCC)?)$/iu;

/** A configured recipient snapshot changes only the existing signature area.
 * Main-body prose, institutional issuer, headers and footers are never rebuilt. */
export function configuredSignatureBlockRequests(document:any,process:ProcessData,type:string,signers:SignatureSignerSnapshot[]):any[]{
 if(!['TERMO','DECLARACAO'].includes(type))return [];
 if(!signers.length)throw new Error('O documento precisa de signatários antes da geração.');
 const body=documentMainBody(document);if(!body)throw new Error('Não foi possível conferir o bloco de assinaturas do modelo.');
 const blocks=signers.map(signer=>signaturePresentation(process,signer,type));
 const names=new Set([...blocks.map(block=>block.name),...[process.aluno1,process.aluno2,process.orientador,process.coorientador,...(process.banca||[])].filter(Boolean).flatMap(person=>[person!.nome.trim(),academicName(person,'abbreviated'),academicName(person,'full')])]);
 const lines=body.text.split('\n');
 const first=lines.findIndex((line,i)=>names.has(line.trim())&&signatureRole.test(lines[i+1]?.trim()||''));
 if(first<0)throw new Error('O modelo não contém um bloco de assinaturas identificável. Confira o modelo antes de gerar o documento.');
 let last=first+1;
 while(last+1<lines.length){
  if(!lines[last+1].trim()||names.has(lines[last+1].trim())||signatureRole.test(lines[last+1].trim()))last++;
  else if(signatureRole.test(lines[last+2]?.trim()||''))last+=2;
  else break;
 }
 while(last>first&&!lines[last].trim())last--;
 const rows=blocks.flatMap(block=>[block.name,block.role]);
 const prefix=lines.slice(0,first).join('\n')+(first?'\n':'');
 const after=prefix+rows.join('\n')+(last+1<lines.length?'\n'+lines.slice(last+1).join('\n'):'');
 const requests=bodyEditRequests(document,after),scope=body.tabId?{tabId:body.tabId}:{};
 let start=body.startIndex+prefix.length;
 for(const [index,text]of rows.entries()){
  const range={startIndex:start,endIndex:start+text.length,...scope};
  requests.push({updateParagraphStyle:{range,paragraphStyle:{alignment:'CENTER',spaceAbove:{magnitude:index%2===0?10:0,unit:'PT'},spaceBelow:{magnitude:0,unit:'PT'},lineSpacing:100,keepWithNext:index<rows.length-1},fields:'alignment,spaceAbove,spaceBelow,lineSpacing,keepWithNext'}});
  requests.push({updateTextStyle:{range,textStyle:{bold:index%2===0,underline:false},fields:'bold,underline'}});
  start+=text.length+1;
 }
 return requests;
}

export function assertConfiguredSignatureBlocks(document:any,process:ProcessData,type:string,signers:SignatureSignerSnapshot[]):void{
 const body=documentMainBody(document);if(!body)throw new Error('O Google Docs não confirmou as assinaturas configuradas.');
 const lines=body.text.split('\n').map(line=>line.trim());
 for(const signer of signers){
  const block=signaturePresentation(process,signer,type);
  if(!lines.some((line,index)=>line===block.name&&lines[index+1]===block.role))throw new Error('O Google Docs não preservou todos os signatários configurados no documento.');
 }
}
