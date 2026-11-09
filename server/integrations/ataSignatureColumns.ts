import {PDFDocument,StandardFonts} from 'pdf-lib';
import type {ProcessData} from '../../src/types';
import {academicName,facultyRole} from '../../src/utils/personPresentation';
import {documentMainBody,bodyEditRequests} from './googleDocsBody';
import type {SignatureSignerSnapshot} from '../../src/types/signatures';
import {signaturePresentation} from './documentSignatureBlocks';

export type AtaColumnRequests=any[]&{signatureRows?:string[]};
function matchingStops(stops:Array<{offset:number;alignment?:string}>,column:number){
 return [column/2,column*1.5].every(offset=>stops.some(stop=>stop.alignment==='CENTER'&&Math.abs(stop.offset-offset)<1));
}
/** Native tab stops are read-only in Docs API: inherit them from the DOCX/native model. */
export async function ataSignatureColumnRequests(document:any,process:ProcessData,signers?:SignatureSignerSnapshot[]):Promise<AtaColumnRequests>{
 if(signers&&(signers.length<4||signers.length>6))throw new Error('A ata exige entre quatro e seis signatários.');
 const body=documentMainBody(document);
 if(!body){if(signers)throw new Error('Não foi possível conferir as assinaturas configuradas da ata.');return [];}
 const examiners=(process.banca||[]).filter(person=>person.funcao!=='ORIENTADOR'&&(!process.orientador.email||person.email!==process.orientador.email)).sort((a,b)=>Number(a.funcao.match(/\d+/)?.[0]||99)-Number(b.funcao.match(/\d+/)?.[0]||99));
 if(examiners.length!==2||!process.orientador.nome?.trim()||!process.aluno1.nome?.trim()){if(signers)throw new Error('Confira os participantes da ata antes de gerar as assinaturas configuradas.');return [];}
 const co=process.avaliacao?.coadvisorPresent===true?process.coorientador:null;
 const people=[process.orientador,...examiners,process.aluno1,process.aluno2,process.coorientador].filter(Boolean);
 const names=new Set([...people.flatMap(person=>[person!.nome.trim(),academicName(person,'abbreviated'),academicName(person,'full')]),...(signers||[]).map(signer=>signer.name.trim())]);
 const roles=/^(?:Orienta(?:dor|dora)(?: e [Pp]residente)?|Examinador(?:a|\(a\))?|Integrante da banca|Coorientador(?:a)?|Alun[oa](?: autor(?:a)?)?|Autoria|Presidência da Comissão de TCC|Presidente da Comissão(?: de TCC)?)$/u;
 const lines=body.text.split('\n');
 const first=lines.findIndex((line,i)=>[process.orientador.nome.trim(),academicName(process.orientador,'abbreviated'),academicName(process.orientador,'full')].includes(line.trim())&&roles.test(lines[i+1]?.trim()||''));
 if(first<0){if(signers)throw new Error('O modelo não contém um bloco identificável para as assinaturas configuradas da ata.');return [];}
 let last=first;
 while(last+1<lines.length){
  if(!lines[last+1].trim()||names.has(lines[last+1].trim())||roles.test(lines[last+1].trim()))last++;
  else if(signers&&roles.test(lines[last+2]?.trim()||''))last+=2;
  else break;
 }
 while(last>first&&!lines[last].trim())last--;
 const signatureNames=lines.slice(first,last+1).filter(line=>names.has(line.trim()));
 if(![process.orientador,...examiners,process.aluno1,...(process.aluno2?[process.aluno2]:[])].every(person=>signatureNames.some(name=>[person.nome.trim(),academicName(person,'abbreviated'),academicName(person,'full')].includes(name.trim()))))throw new Error('Confira os blocos de assinatura da ata antes de organizar as duas colunas.');
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.TimesRomanBold);
 const width=Number(document.documentStyle?.documentSize?.width?.magnitude)||595.28;
 const available=width-85.04,column=available/2,maxWidth=column-18;
 if(!body.layout.slice(first,last+1).every(paragraph=>matchingStops(paragraph.tabStops,column)))throw new Error('O modelo da ata precisa conter duas tabulações centrais nas assinaturas. Use o DOCX aprovado ou ajuste as tabulações do modelo Google Docs.');
 const measure=(text:string)=>{try{return font.widthOfTextAtSize(text,11);}catch{return [...text].length*11;}};
 const wrap=(name:string)=>{
  const result:string[]=[];let current='';
  for(const word of name.trim().split(/\s+/)){
   if(current&&measure(current+' '+word)>maxWidth){result.push(current);current='';}
   for(const letter of word){if(current&&measure(current+letter)>maxWidth){result.push(current);current='';}current+=letter;}
   current+=' ';
  }
  if(current.trim())result.push(current.trim());
  return result.map(line=>line.trim());
 };
 const cap=(text:string)=>text.replace(/^\p{L}/u,c=>c.toLocaleUpperCase('pt-BR'));
 const student=(person:ProcessData['aluno1']|null|undefined)=>person?{name:person.nome.trim(),role:person.tratamento==='Aluna'?'Aluna autora':person.tratamento==='Aluno'?'Aluno autor':'Autoria'}:null;
 const faculty=(person:ProcessData['orientador'],role:'orientador'|'examinador'|'coorientador')=>({name:academicName(person,'abbreviated'),role:cap(facultyRole(person,role))+(role==='orientador'?' e Presidente':'')});
 let pairs:Array<Array<{name:string;role:string}|null>>=[
  [faculty(process.orientador,'orientador'),student(process.aluno1)],
  [faculty(examiners[0],'examinador'),student(process.aluno2)],
  [faculty(examiners[1],'examinador'),co?faculty(co,'coorientador'):null],
 ];
 if(signers){
  const left=signers.filter(signer=>signer.role==='ADVISOR'||signer.role==='EXAMINER');
  const right=signers.filter(signer=>signer.role!=='ADVISOR'&&signer.role!=='EXAMINER');
  if(left.length!==3||right.length>3)throw new Error('Confira os três integrantes titulares da banca e os demais signatários da ata.');
  pairs=left.map((signer,index)=>[signaturePresentation(process,signer,'ATA'),right[index]?signaturePresentation(process,right[index],'ATA'):null]);
 }
 const output:Array<{text:string;name:boolean;first:boolean}>=[];
 for(const [left,right] of pairs){
  const a=wrap(left!.name),b=right?wrap(right.name):[];
  for(let i=0;i<Math.max(a.length,b.length);i++)output.push({text:`\t${a[i]||''}\t${b[i]||''}`,name:true,first:i===0});
  output.push({text:`\t${left!.role}\t${right?.role||''}`,name:false,first:false});
 }
 const prefix=lines.slice(0,first).join('\n')+(first?'\n':'');
 const after=prefix+output.map(line=>line.text).join('\n')+(last+1<lines.length?'\n'+lines.slice(last+1).join('\n'):'');
 const scope=body.tabId?{tabId:body.tabId}:{};
 const requests:AtaColumnRequests=bodyEditRequests(document,after);
 let start=body.startIndex+prefix.length;
 for(const [i,line] of output.entries()){
  const range={startIndex:start,endIndex:start+line.text.length,...scope};
  const paragraphStyle={alignment:'START',indentStart:{magnitude:0,unit:'PT'},indentEnd:{magnitude:0,unit:'PT'},indentFirstLine:{magnitude:0,unit:'PT'},spaceAbove:{magnitude:line.first?10:0,unit:'PT'},spaceBelow:{magnitude:0,unit:'PT'},lineSpacing:100,keepWithNext:i<output.length-1};
  requests.push({updateParagraphStyle:{range,paragraphStyle,fields:Object.keys(paragraphStyle).join(',')}});
  requests.push({updateTextStyle:{range,textStyle:{bold:line.name,underline:false,fontSize:{magnitude:11,unit:'PT'},weightedFontFamily:{fontFamily:'Times New Roman'}},fields:'bold,underline,fontSize,weightedFontFamily'}});
  start+=line.text.length+1;
 }
 requests.signatureRows=output.map(line=>line.text);
 return requests;
}

/** Every newly inserted paragraph must retain the imported stops before export. */
export function assertAtaSignatureColumnReadback(document:any,expectedRows:string[]){
 const body=documentMainBody(document);
 if(!body||expectedRows.length<6)throw new Error('O Google Docs não confirmou os blocos de assinatura da ata.');
 const column=((Number(document.documentStyle?.documentSize?.width?.magnitude)||595.28)-85.04)/2;
 let cursor=0;
 for(const expected of expectedRows){
  const index=body.layout.findIndex((paragraph,i)=>i>=cursor&&paragraph.runs.map(run=>run.text).join('').replace(/\n$/,'')===expected);
  if(index<0||!matchingStops(body.layout[index].tabStops,column))throw new Error('O Google Docs não preservou as duas colunas em todos os blocos de assinatura da ata.');
  cursor=index+1;
 }
}
export function assertAtaSignatureTabs(document:any){
 const rows=documentMainBody(document)?.layout.map(paragraph=>paragraph.runs.map(run=>run.text).join('').replace(/\n$/,'')).filter(text=>/^\t[^\t]*\t/.test(text))||[];
 if(rows.length)assertAtaSignatureColumnReadback(document,rows);
}
