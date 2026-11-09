import {DOCUMENT_ISSUER_LINES} from '../../src/utils/institutionalIdentity';
import {formatDateWithWeekday} from '../../src/utils/formatters';
import {officialParticipantLines} from '../../src/utils/officialParticipants';
import type {ProcessData} from '../../src/types';

type Paragraph = {startIndex:number;endIndex:number;text:string;tabId?:string};
type Edit = {start:number;end:number;text:string;tabId?:string};

/** Main-body paragraphs only: never rewrite source models, headers or signatures. */
function paragraphsOf(document:any):Paragraph[]{
  const bodies:Array<{body:any;tabId?:string}>=[];
  const tabs=(items:any[])=>{for(const tab of items||[]){
    if(tab.documentTab?.body||tab.body)bodies.push({body:tab.documentTab?.body||tab.body,tabId:tab.tabProperties?.tabId});
    tabs(tab.childTabs);
  }};
  tabs(document.tabs);
  const target=bodies[0]||(document.body?{body:document.body,tabId:undefined}:undefined);
  return (target?.body.content||[]).filter((item:any)=>item.paragraph&&Number.isInteger(item.startIndex)&&Number.isInteger(item.endIndex)).map((item:any)=>({
    startIndex:item.startIndex,endIndex:item.endIndex,tabId:target?.tabId,
    text:item.paragraph.elements.map((run:any)=>run.textRun?.content||'').join('').trim(),
  }));
}

const isIssuer=(text:string)=>/^(?:Comissão (?:de |dos? )?Trabalhos? de Conclusão de Curso(?: do)?|Departamento de Enfermagem|Curso (?:de Graduação em|de) Enfermagem e Obstetrícia(?:\s*[·—–-]?\s*CCS\s*\/\s*UFES)?|Curso de Enfermagem e Obstetrícia(?:\s*[·—–-]?\s*CCS\s*\/\s*UFES)?)$/iu.test(text);
const isCommission=(text:string)=>/^Comissão (?:de |dos? )?Trabalhos? de Conclusão de Curso(?: do)?$/iu.test(text);
const isDate=(text:string)=>/^Vitória\s*(?:[-–—,]\s*)?(?:ES|Espírito Santo)\s*,\s*.+\d/iu.test(text);

/** One closing block, at the end of the letter. Editing actual indices preserves
 * unrelated runs, images, participant signature blocks and the final Docs newline. */
export function institutionalClosingRequests(document:unknown,type:string,issuedAt=new Date()):Array<Record<string,unknown>>{
  const paragraphs=paragraphsOf(document);
  if(!paragraphs.length)return [];
  const last=paragraphs.at(-1)!;
  const issuerStart=paragraphs.findIndex(row=>isCommission(row.text));
  let issuerEnd=issuerStart;
  if(issuerStart>=0)while(issuerEnd+1<paragraphs.length&&(isIssuer(paragraphs[issuerEnd+1].text)||!paragraphs[issuerEnd+1].text))issuerEnd++;
  const edits:Edit[]=[];
  const issuer=DOCUMENT_ISSUER_LINES.join('\n');
  const greeting=type==='CONVITE'?paragraphs.find(row=>/^Atenciosamente,?$/iu.test(row.text)):undefined;
  if(type==='ATA'){
    const sessionClosing=paragraphs.findIndex(row=>/Nada mais havendo a tratar,/iu.test(row.text));
    if(sessionClosing>=0){
      for(const row of paragraphs.slice(sessionClosing+1)){
        if(isDate(row.text)||row.text&&row.text.split(/\r?\n/).every(line=>isIssuer(line.trim()))){
          edits.push({start:row.startIndex,end:row===last?row.endIndex-1:row.endIndex,text:'',tabId:row.tabId});
        }
      }
    }
  }else if(type==='CONVITE'){
    const dates=paragraphs.filter(row=>isDate(row.text));
    const date=dates.at(-1)?.text||`Vitória - ES, ${formatDateWithWeekday(issuedAt.toISOString())}.`;
    const closing=`Atenciosamente,\n\n${date}\n\n${issuer}`;
    if(greeting){
      // Avoid accumulating spacer paragraphs after repeated render/readback passes.
      const start=paragraphs.indexOf(greeting);
      const end=issuerStart>start?issuerEnd:start;
      const closingRows=paragraphs.slice(start,end+1);
      if(closingRows.every(row=>row===greeting||isDate(row.text)||isIssuer(row.text)||!row.text)){
        const before=closingRows.map(row=>row.text).join('\n');
        if(before!==closing)edits.push({start:greeting.startIndex,end:paragraphs[end].endIndex-1,text:closing,tabId:greeting.tabId});
        for(const row of dates.filter(row=>row.startIndex<greeting.startIndex||row.startIndex>paragraphs[end].endIndex))edits.push({start:row.startIndex,end:row===last?row.endIndex-1:row.endIndex,text:'',tabId:row.tabId});
      }
    }else if(issuerStart<0){
      edits.push({start:last.endIndex-1,end:last.endIndex-1,text:`\n\n${closing}`,tabId:last.tabId});
      for(const row of dates)edits.push({start:row.startIndex,end:row===last?row.endIndex-1:row.endIndex,text:'',tabId:row.tabId});
    }
  }else if(issuerStart>=0){
    if(paragraphs.slice(issuerStart,issuerEnd+1).map(row=>row.text).join('\n').trim()!==issuer)edits.push({start:paragraphs[issuerStart].startIndex,end:paragraphs[issuerEnd].endIndex-1,text:issuer,tabId:paragraphs[issuerStart].tabId});
  }else{
    edits.push({start:last.endIndex-1,end:last.endIndex-1,text:`\n\n${issuer}`,tabId:last.tabId});
  }
  return edits.sort((a,b)=>b.start-a.start).flatMap(edit=>{
    const scope=edit.tabId?{tabId:edit.tabId}:{};
    return [...(edit.end>edit.start?[{deleteContentRange:{range:{startIndex:edit.start,endIndex:edit.end,...scope}}}]:[]),...(edit.text?[{insertText:{location:{index:edit.start,...scope},text:edit.text}}]:[])];
  });
}

/** True right alignment, without the old fixed 260pt indent. */
export function institutionalClosingStyleRequests(document:unknown):Array<Record<string,unknown>>{
  const paragraphs=paragraphsOf(document);
  const issuerStart=paragraphs.findIndex(row=>isCommission(row.text));
  return paragraphs.filter((row,index)=>isDate(row.text)||/^Atenciosamente,?$/iu.test(row.text)||(index>=issuerStart&&issuerStart>=0&&isIssuer(row.text))).map(row=>({updateParagraphStyle:{
    range:{startIndex:row.startIndex,endIndex:row.endIndex,...(row.tabId?{tabId:row.tabId}:{})},
    paragraphStyle:{alignment:'END',indentStart:{magnitude:0,unit:'PT'},indentEnd:{magnitude:0,unit:'PT'},spaceAbove:{magnitude:0,unit:'PT'},spaceBelow:{magnitude:0,unit:'PT'}},
    fields:'alignment,indentStart,indentEnd,spaceAbove,spaceBelow',
  }}));
}

/** Fail closed if a changed model drops a person or joins the board again.
 * Validate the merged identification, rather than counting matches of old phrases. */
export function assertInvitationIdentification(document:unknown,process:ProcessData):void{
  const rows=paragraphsOf(document).flatMap(row=>row.text.split('\n')).map(row=>row.trim());
  for(const person of officialParticipantLines(process)){
    // Academic prefixes may be normalized by the presentation pass; the person's
    // actual name and role must still be a single independent field.
    const name=person.name.replace(/^(?:(?:Prof(?:essor(?:a)?)?\.?ª?\.?|Dr\.?ª?\.?|Dra\.?|Me\.?|Ma\.?)\s+)*/iu,'');
    const count=rows.filter(row=>{
      const colon=row.indexOf(':');if(colon<0)return false;
      const label=row.slice(0,colon).replace(/ e Presidente$/iu,'');
      return label===person.role&&row.slice(colon+1).trim().endsWith(name);
    }).length;
    if(count!==1)throw new Error('A carta-convite deve identificar cada autor, orientador, examinador e coorientador uma única vez, em linhas separadas. Confira os dados e o modelo antes de gerar.');
  }
}
