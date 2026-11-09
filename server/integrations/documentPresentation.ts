import {academicName,orderedAuthors,facultyRole} from '../../src/utils/personPresentation';
import type {ProcessData} from '../../src/types';
import {adaptDocumentLanguage} from '../../src/utils/documentLanguage';
import {documentMainBody,bodyEditRequests} from './googleDocsBody';
/** Keep separate text runs between edits (names, title and institutional formatting). */
function paragraphRequests(node:any,before:string,after:string):any[]{
 const tokens=(text:string)=>text.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]/gu)||[];
 const a=tokens(before.trimEnd()),b=tokens(after.trimEnd());
 if(a.length*b.length>4_000_000)return bodyEditRequests({body:{content:[node]}},after);
 const scores=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
 for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)scores[i][j]=a[i]===b[j]?scores[i+1][j+1]+1:Math.max(scores[i+1][j],scores[i][j+1]);
 const patches:Array<{start:number;end:number;text:string}>=[];let i=0,j=0,offset=node.startIndex||1;
 while(i<a.length||j<b.length){
  if(i<a.length&&j<b.length&&a[i]===b[j]){offset+=a[i++].length;j++;continue;}
  const start=offset;let text='';
  while(i<a.length||j<b.length){
   if(i<a.length&&j<b.length&&a[i]===b[j])break;
   if(i<a.length&&(j===b.length||scores[i+1][j]>=scores[i][j+1]))offset+=a[i++].length;
   else text+=b[j++];
  }
  patches.push({start,end:offset,text});
 }
 return patches.reverse().flatMap(patch=>[...(patch.end>patch.start?[{deleteContentRange:{range:{startIndex:patch.start,endIndex:patch.end}}}]:[]),...(patch.text?[{insertText:{location:{index:patch.start},text:patch.text}}]:[])]);
}

/** Edit paragraph text in place, including table cells and signatures; keep the layout. */
export function presentationEditRequests(document:any,process:ProcessData,type:string):any[]{
 const groups:Array<{index:number;requests:any[]}>=[];
 const walk=(node:any,scope:Record<string,string>={})=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(n=>walk(n,scope));return;}
  const current=node.tabProperties?.tabId?{...scope,tabId:node.tabProperties.tabId}:scope;
  if(node.paragraph?.elements){
   const before=node.paragraph.elements.map((e:any)=>e.textRun?.content||'').join('');
   const after=adaptDocumentLanguage(before,process,type);
   if(before.trimEnd()!==after.trimEnd()){
    const requests=paragraphRequests(node,before,after).map(request=>request.deleteContentRange?{deleteContentRange:{range:{...request.deleteContentRange.range,...current}}}:{insertText:{...request.insertText,location:{...request.insertText.location,...current}}});
    groups.push({index:node.startIndex||0,requests});
   }
  }
  for(const [key,value] of Object.entries(node)){
   if(['headers','footers'].includes(key))for(const [segmentId,content] of Object.entries(value||{}))walk(content,{...current,segmentId});
   else if(!['paragraph','textRun'].includes(key))walk(value,current);
  }
 };
 walk(document);return groups.sort((a,b)=>b.index-a.index).flatMap(group=>group.requests);
}

/** Remove the unused second-author signature paragraph, including its own spacing.
 * Run before merging markers, only in the temporary copy. Never remove a table's
 * terminating paragraph or a paragraph that also contains another person's name.
 */
export function optionalAuthorBlockRequests(document:any,process:ProcessData):any[]{
 if(process.aluno2?.nome.trim())return [];
 const ranges:Array<{startIndex:number;endIndex:number;tabId?:string}>=[];
 const marker=/(?:<<|\{\{|\[\[|«|-)\s*(?:nome completo aluno \(2\)|ALUNO_?2_NOME(?:_COMPLETO)?|AUTORIA_SEGUNDO_NOME)\s*(?:>>|\}\}|\]\]|»|-)/giu;
 const walk=(node:any,tabId?:string)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(value=>walk(value,tabId));return;}
  const scope=node.tabProperties?.tabId||tabId;
  const content=node.body?.content;
  if(Array.isArray(content))for(let i=0;i<content.length;i++){
   const paragraph=content[i],text=paragraph.paragraph?.elements?.map((e:any)=>e.textRun?.content||'').join('')||'';
   marker.lastIndex=0;if(!marker.test(text))continue;
   marker.lastIndex=0;if(text.replace(marker,'').trim())continue;
   let start=paragraph.startIndex,end=paragraph.endIndex;
   const previous=content[i-1];
   if(previous?.paragraph&&previous.paragraph.elements.every((e:any)=>e.textRun&&!e.textRun.content.trim()))start=previous.startIndex;
   if(i===content.length-1)end--; // Docs requires the final body newline.
   if(Number.isInteger(start)&&Number.isInteger(end)&&end>start)ranges.push({startIndex:start,endIndex:end,...(scope?{tabId:scope}:{})});
  }
  // Signature blocks in body paragraphs only; table cells and headers remain intact.
  for(const [key,value] of Object.entries(node))if(!['body','table','headers','footers'].includes(key))walk(value,scope);
 };
 walk(document);
 return ranges.sort((a,b)=>b.startIndex-a.startIndex).map(range=>({deleteContentRange:{range}}));
}

/** Compact only the authorization signature area; preserve body, letterhead and date. */
export function authorizationSignatureLayoutRequests(document:any,process:ProcessData):any[]{
 const names=new Set([process.orientador,process.aluno1,process.aluno2].filter(Boolean).flatMap((person:any)=>[person.nome.trim(),academicName(person,'abbreviated'),academicName(person,'full')]).filter(Boolean));
 const groups:Array<{index:number;request:any}>=[];
 const walk=(node:any,tabId?:string)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(value=>walk(value,tabId));return;}
  const scope=node.tabProperties?.tabId||tabId,content=node.body?.content;
  if(Array.isArray(content)){
   const text=(entry:any)=>entry.paragraph?.elements?.map((e:any)=>e.textRun?.content||'').join('').trim()||'';
   const indices=content.map((entry:any,index:number)=>names.has(text(entry))?index:-1).filter((i:number)=>i>=0);
   if(indices.length){
    const first=indices[0],last=indices[indices.length-1];let boundary=first;
    while(boundary>0&&content[boundary-1].paragraph&&!text(content[boundary-1]))boundary--;
    for(let i=boundary;i<=Math.min(last+1,content.length-1);i++){
     const entry=content[i];if(!entry.paragraph)continue;
     const start=entry.startIndex,end=entry.endIndex;
     if(!Number.isInteger(start)||!Number.isInteger(end)||end<=start)continue;
     const range={startIndex:start,endIndex:end,...(scope?{tabId:scope}:{})};
     if(!text(entry)){
      // Leave one normal paragraph before the first signature; no spacer stacks.
      if(i===boundary){groups.push({index:start,request:{updateParagraphStyle:{range,paragraphStyle:{spaceAbove:{magnitude:0,unit:'PT'},spaceBelow:{magnitude:0,unit:'PT'},lineSpacing:100},fields:'spaceAbove,spaceBelow,lineSpacing'}}});continue;}
      if(i<content.length-1)groups.push({index:start,request:{deleteContentRange:{range}}});
     }else if(names.has(text(entry))||/^(?:Orienta(?:dor|dora|ção)(?: e Presidente)?|Alun[oa]s?|Autoria|Discentes?)$/i.test(text(entry))){
      const name=names.has(text(entry));
      groups.push({index:start,request:{updateParagraphStyle:{range,paragraphStyle:{spaceAbove:{magnitude:name?12:0,unit:'PT'},spaceBelow:{magnitude:0,unit:'PT'},lineSpacing:100},fields:'spaceAbove,spaceBelow,lineSpacing'}}});
     }
    }
   }
  }
  for(const[key,value]of Object.entries(node))if(!['body','table','headers','footers'].includes(key))walk(value,scope);
 };
 walk(document);return groups.sort((a,b)=>b.index-a.index).map(group=>group.request);
}

/** Remove the extra gap immediately before the declaration's standalone date. */
export function declarationDateLayoutRequests(document:any):any[]{
 const groups:Array<{index:number;request:any}>=[];
 const walk=(node:any,tabId?:string)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(value=>walk(value,tabId));return;}
  const scope=node.tabProperties?.tabId||tabId,content=node.body?.content;
  if(Array.isArray(content))for(let i=0;i<content.length;i++){
   const entry=content[i],text=entry.paragraph?.elements?.map((e:any)=>e.textRun?.content||'').join('').trim()||'';
   if(!/^[\p{L} .’'-]+(?:[-–]\s*[A-Z]{2})?[, -]+(?:(?:(?:segunda|terça|quarta|quinta|sexta)-feira|sábado|domingo),\s*)?\d{1,2} de [\p{L}]+ de \d{4}\.?$/u.test(text))continue;
   const range=(value:any)=>({startIndex:value.startIndex,endIndex:value.endIndex,...(scope?{tabId:scope}:{})});
   groups.push({index:entry.startIndex,request:{updateParagraphStyle:{range:range(entry),paragraphStyle:{alignment:'END',spaceAbove:{magnitude:6,unit:'PT'},spaceBelow:{magnitude:6,unit:'PT'},lineSpacing:100},fields:'alignment,spaceAbove,spaceBelow,lineSpacing'}}});
   const previous=content[i-1],before=previous?.paragraph?.elements;
   if(before?.length&&before.every((element:any)=>element.textRun&&!element.textRun.content.trim()))groups.push({index:previous.startIndex,request:{deleteContentRange:{range:range(previous)}}});
  }
  for(const[key,value]of Object.entries(node))if(!['body','table','headers','footers'].includes(key))walk(value,scope);
 };
 walk(document);return groups.sort((a,b)=>b.index-a.index).map(group=>group.request);
}

/** Separate the first student signature from the examining board in the ata.
 * Paragraph spacing avoids inserting a phantom author or changing the template text.
 */
export function ataStudentSignatureLayoutRequests(document:any,process:ProcessData):any[]{
 const authors=new Set([process.aluno1,process.aluno2].filter(Boolean).map(person=>person!.nome.trim()));
 const requests:any[]=[];
 const walk=(node:any,tabId?:string)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(value=>walk(value,tabId));return;}
  const scope=node.tabProperties?.tabId||tabId,content=node.body?.content;
  if(Array.isArray(content)){
   const text=(entry:any)=>entry.paragraph?.elements?.map((e:any)=>e.textRun?.content||'').join('').trim()||'';
   for(let i=1;i<content.length;i++){
    const entry=content[i];if(!authors.has(text(entry)))continue;
    let previous=i-1;
    while(previous>=0&&content[previous].paragraph&&!text(content[previous]))previous--;
    if(previous<0||!/^Examinador(?:a|\(a\))?$/i.test(text(content[previous])))continue;
    if(!Number.isInteger(entry.startIndex)||!Number.isInteger(entry.endIndex))continue;
    requests.push({updateParagraphStyle:{range:{startIndex:entry.startIndex,endIndex:entry.endIndex,...(scope?{tabId:scope}:{})},paragraphStyle:{spaceAbove:{magnitude:12,unit:'PT'}},fields:'spaceAbove'}});
   }
  }
  for(const[key,value]of Object.entries(node))if(!['body','table','headers','footers'].includes(key))walk(value,scope);
 };
 walk(document);return requests;
}

/** A separate checkbox paragraph also needs breathing room below AUTORIZAMOS. */
export function authorizationOptionsLayoutRequests(document:any):any[]{
 const requests:any[]=[];
 const walk=(node:any,tabId?:string)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(value=>walk(value,tabId));return;}
  const scope=node.tabProperties?.tabId||tabId,content=node.body?.content;
  if(Array.isArray(content)){
   const text=(entry:any)=>entry?.paragraph?.elements?.map((e:any)=>e.textRun?.content||'').join('').trim()||'';
   for(let i=1;i<content.length;i++){
    const entry=content[i];
    if(!/^[☒☐]/u.test(text(entry))||! /AUTORIZAMOS:$/i.test(text(content[i-1])))continue;
    if(!Number.isInteger(entry.startIndex)||!Number.isInteger(entry.endIndex))continue;
    requests.push({updateParagraphStyle:{range:{startIndex:entry.startIndex,endIndex:entry.endIndex,...(scope?{tabId:scope}:{})},paragraphStyle:{spaceAbove:{magnitude:12,unit:'PT'}},fields:'spaceAbove'}});
   }
  }
  for(const[key,value]of Object.entries(node))if(!['body','table','headers','footers'].includes(key))walk(value,scope);
 };
 walk(document);return requests;
}


const authorSignatureLabel = (person: ProcessData['aluno1']) => person.tratamento === 'Aluna' ? 'Aluna autora' : person.tratamento === 'Aluno' ? 'Aluno autor' : 'Autoria';
const studentSignatureRole = /^(?:Alun[oa]s?(?: autor(?:a|es|as)?)?|Autor(?:a|es|as)?|Autoria|Discentes?)$/iu;

/** Include the coadvisor signature block only after explicit presence confirmation. */
export function ataCoadvisorBlockRequests(document:any,process:ProcessData):any[]{
 const co=process.coorientador,last=orderedAuthors(process).filter(person=>person.nome.trim()).at(-1);
 if(process.avaliacao?.coadvisorPresent!==true||!co?.nome?.trim()||!last)return [];
 const requests:any[]=[];
 const walk=(node:any,tabId?:string)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(item=>walk(item,tabId));return;}
  const scope=node.tabProperties?.tabId||tabId,content=node.body?.content;
  if(Array.isArray(content)){
   const text=(entry:any)=>entry.paragraph?.elements?.map((element:any)=>element.textRun?.content||'').join('').trim()||'';
   for(let i=0;i<content.length-1;i++){
    if(text(content[i])!==last.nome.trim()||!studentSignatureRole.test(text(content[i+1])))continue;
    if(content.slice(i+2).some((entry:any)=>text(entry).includes(co.nome.trim())))break;
    const index=content[i+1].endIndex-1;
    if(Number.isInteger(index))requests.push({insertText:{location:{index,...(scope?{tabId:scope}:{})},text:`\n\n${academicName(co,'abbreviated')}\n${facultyRole(co,'coorientador').replace(/^\p{L}/u,c=>c.toLocaleUpperCase('pt-BR'))}`}});
    break;
   }
  }
  for(const [key,value] of Object.entries(node))if(!['body','table','headers','footers'].includes(key))walk(value,scope);
 };
 walk(document);return requests;
}

/** Replace only the standalone author signature group, never names in body prose. */
export function individualAuthorSignatureRequests(document:any,process:ProcessData):any[]{
 const authors=orderedAuthors(process).filter(person=>person.nome.trim());
 const names=new Set(authors.map(person=>person.nome.trim()));
 const requests:Array<{index:number;items:any[]}>=[];
 const walk=(node:any,tabId?:string)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(value=>walk(value,tabId));return;}
  const scope=node.tabProperties?.tabId||tabId;
  const content=node.body?.content;
  if(Array.isArray(content)){
   const text=(entry:any)=>entry.paragraph?.elements?.map((element:any)=>element.textRun?.content||'').join('').trim()||'';
   for(let i=0;i<content.length;i++){
    const lines=text(content[i]).split(/\r?\n/).map((line:string)=>line.trim()).filter(Boolean);
    if(!lines.length||!names.has(lines[0])||!lines.every((line:string)=>names.has(line)||studentSignatureRole.test(line)))continue;
    let last=i,hasRole=lines.some((line:string)=>studentSignatureRole.test(line));
    for(let j=i+1;j<content.length&&content[j].paragraph;j++){
     const next=text(content[j]).split(/\r?\n/).map((line:string)=>line.trim()).filter(Boolean);
     if(!next.every((line:string)=>names.has(line)||studentSignatureRole.test(line)))break;
     hasRole ||= next.some((line:string)=>studentSignatureRole.test(line));
     if(next.length)last=j;
    }
    if(!hasRole)continue;
    const before=content.slice(i,last+1).map((entry:any)=>entry.paragraph.elements.map((element:any)=>element.textRun?.content||'').join('')).join('').replace(/\n$/,'');
    const after=authors.map(person=>`${person.nome.trim()}\n${authorSignatureLabel(person)}`).join('\n');
    const startIndex=content[i].startIndex,endIndex=content[last].endIndex-1;
    if(before!==after&&Number.isInteger(startIndex)&&Number.isInteger(endIndex)&&endIndex>startIndex){
     const location={index:startIndex,...(scope?{tabId:scope}:{})};
     requests.push({index:startIndex,items:[{deleteContentRange:{range:{startIndex,endIndex,...(scope?{tabId:scope}:{})}}},{insertText:{location,text:after}}]});
    }
    i=last;
   }
  }
  for(const[key,value]of Object.entries(node))if(!['body','table','headers','footers'].includes(key))walk(value,scope);
 };
 walk(document);return requests.sort((a,b)=>b.index-a.index).flatMap(group=>group.items);
}

/** Each role stays directly below its own name and uses regular weight. */
export function individualAuthorSignatureStyleRequests(document:any,process:ProcessData):any[]{
 const names=new Set(orderedAuthors(process).map(person=>person.nome.trim()));
 const requests:any[]=[];
 const walk=(node:any,tabId?:string)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(value=>walk(value,tabId));return;}
  const scope=node.tabProperties?.tabId||tabId,content=node.body?.content;
  if(Array.isArray(content))for(let i=0;i<content.length;i++){
   const entry=content[i],text=entry.paragraph?.elements?.map((element:any)=>element.textRun?.content||'').join('').trim()||'';
   if(!['Aluno autor','Aluna autora','Autoria'].includes(text)||!names.has(content[i-1]?.paragraph?.elements?.map((element:any)=>element.textRun?.content||'').join('').trim()||''))continue;
   for(const [paragraph,isName]of [[content[i-1],true],[entry,false]] as const){
    const range={startIndex:paragraph.startIndex,endIndex:paragraph.endIndex,...(scope?{tabId:scope}:{})};
    requests.push({updateParagraphStyle:{range,paragraphStyle:{alignment:'CENTER',spaceAbove:{magnitude:isName?12:0,unit:'PT'},spaceBelow:{magnitude:0,unit:'PT'},lineSpacing:100,keepWithNext:isName},fields:'alignment,spaceAbove,spaceBelow,lineSpacing,keepWithNext'}});
    requests.push({updateTextStyle:{range,textStyle:{bold:isName,underline:false},fields:'bold,underline'}});
   }
  }
  for(const[key,value]of Object.entries(node))if(!['body','table','headers','footers'].includes(key))walk(value,scope);
 };
 walk(document);return requests;
}

/** Missing optional identification in older invitation/declaration models is added after the board. */
export function coadvisorIdentificationRequests(document:any,process:ProcessData,type:string):any[]{
 const co=process.coorientador;
 if(!['CONVITE','DECLARACAO'].includes(type)||!co?.nome?.trim())return [];
 const paragraphs:Array<{node:any;tabId?:string}>=[];
 const walk=(node:any,tabId?:string)=>{
  if(!node||typeof node!=='object')return;
  if(Array.isArray(node)){node.forEach(item=>walk(item,tabId));return;}
  const scope=node.tabProperties?.tabId||tabId;
  if(node.paragraph?.elements)paragraphs.push({node,tabId:scope});
  for(const [key,value]of Object.entries(node))if(!['paragraph','textRun','headers','footers'].includes(key))walk(value,scope);
 };
 walk(document);
 const text=(node:any)=>node.paragraph.elements.map((element:any)=>element.textRun?.content||'').join('');
 if(paragraphs.some(({node})=>text(node).includes(co.nome.trim())))return [];
 const examiners=process.banca.filter(person=>person.email!==process.orientador.email&&person.email!==co.email);
 const last=paragraphs.filter(({node})=>examiners.some(person=>text(node).includes(person.nome.trim()))).at(-1);
 if(!last)return [];
 const index=last.node.endIndex-1,scope=last.tabId?{tabId:last.tabId}:{};
 const line=`\n${facultyRole(co,'coorientador').replace(/^\p{L}/u,letter=>letter.toLocaleUpperCase('pt-BR'))}: ${academicName(co,'abbreviated')}`;
 return [{insertText:{location:{index,...scope},text:line}},{updateTextStyle:{range:{startIndex:index+1,endIndex:index+line.length,...scope},textStyle:{bold:false},fields:'bold'}}];
}

/** Join only the closing formula to the opinion; leave all styled text in place. */
export function ataClosingContinuationRequests(document:any):any[]{
 const body=documentMainBody(document);
 if(!body)return [];
 const matches=[...body.text.matchAll(/(?<=[.!?])[ \t\r\n]+(?=Nada mais havendo a tratar,)/giu)];
 const scope=body.tabId?{tabId:body.tabId}:{};
 return matches.filter(match=>/[\r\n]/.test(match[0])).reverse().flatMap(match=>{
  const startIndex=body.startIndex+match.index!,endIndex=startIndex+match[0].length;
  return [{deleteContentRange:{range:{startIndex,endIndex,...scope}}},{insertText:{location:{index:startIndex,...scope},text:' '}}];
 });
}
