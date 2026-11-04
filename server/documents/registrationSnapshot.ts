import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {PDFDocument,rgb,type PDFFont,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type {ProcessData,GlobalSettings} from '../../src/types';
import {resolveInstallationProfile} from '../../src/utils/installationProfile';
import {academicName} from '../../src/utils/personPresentation';
import {formatDateWithWeekday,formatTime24h} from '../../src/utils/formatters';
import {registrationQuestions} from '../../src/utils/operationalConfig';

const fontBytes=Promise.all(['Regular','Bold'].map(weight=>readFile(path.join(process.cwd(),'server/documents/fonts',`NotoSans-${weight}.ttf`))));
const logoBytes=readFile(path.join(process.cwd(),'server/documents/assets/colenf-logo.png'));
interface Field {label:string;value:string;wide?:boolean}
interface Section {title:string;fields:Field[]}

/** Canonical values are shown once; custom questions retain their published labels. */
export function registrationSnapshotSections(process:ProcessData,settings:GlobalSettings):Section[]{
 const sections:Section[]=[];
 const field=(label:string,value:unknown,wide=false):Field=>({label,value:String(value??'').trim()||'Não informado',wide});
 sections.push({title:'Trabalho',fields:[field('Título do TCC',process.titulo,true)]});
 for(const student of [process.aluno1,process.aluno2])if(student){
  sections.push({title:'Aluno autor',fields:[field('Nome',student.nome,true),field('E-mail',student.email),field('Matrícula ou outro registro',student.matricula),field('Forma de referência',student.tratamento)]});
 }
 for(const [title,person]of [['Orientador',process.orientador],...process.banca.filter(person=>person.funcao!=='ORIENTADOR').map(person=>['Examinador',person] as const),['Coorientador',process.coorientador]] as const){
  if(!person?.nome?.trim())continue;
  sections.push({title,fields:[field('Nome nos documentos',academicName(person,'abbreviated'),true),field('E-mail',person.email),field('Matrícula, SIAPE ou outro registro',person.siape),field('Instituição',person.instituicao,true)]});
 }
 sections.push({title:'Agendamento solicitado',fields:[field('Data',formatDateWithWeekday(process.defesa.startAt)),field('Horário',`${formatTime24h(process.defesa.startAt)} às ${formatTime24h(process.defesa.endAt)}`),field('Local',process.defesa.local,true),...(process.defesa.alternateLocation?[field('Local alternativo',process.defesa.alternateLocation,true)]:[])]});
 const answers=process.registrationAnswers||{};
 const consumed=new Set(['TITULO','DEFESA_DATA_HORA','DEFESA_LOCAL','DEFESA_LOCAL_PERSONALIZADO','DEFESA_LOCAL_ALTERNATIVO','LOCAL_ALTERNATIVO','TEM_ALUNO_2','TEM_COORIENTADOR','AUTORIA_ORDEM']);
 for(const prefix of ['ALUNO_1','ALUNO_2','ORIENTADOR','COORIENTADOR','EXAMINADOR_2','EXAMINADOR_3'])for(const suffix of ['NOME','EMAIL','MATRICULA','SIAPE','CIAP','TRATAMENTO','TITULACAO','INSTITUICAO'])consumed.add(`${prefix}_${suffix}`);
 const groups=new Map<string,Field[]>();
 for(const question of registrationQuestions(settings.integrationStudio,answers)){
  if(consumed.has(question.fieldKey))continue;
  const value=answers[question.fieldKey];if(value===undefined||value===null||String(value).trim()==='')continue;
  const title=question.section||'Informações complementares';
  const fields=groups.get(title)||[];fields.push(field(question.label,typeof value==='boolean'?(value?'Sim':'Não'):value,true));groups.set(title,fields);
 }
 for(const [title,fields]of groups)sections.push({title,fields});
 return sections;
}

export async function createRegistrationSnapshotPdf(process:ProcessData,settings:GlobalSettings):Promise<Buffer>{
 return renderBrandedRecordPdf({title:'Cadastro inicial de TCC',protocol:process.protocolo,revision:process.registrationRevision||1,sections:registrationSnapshotSections(process,settings),note:'Agendamento sujeito ao aceite do responsável pelo local.',footer:'Registro do cadastro inicial · Portal TCC'},settings);
}

export async function createBrandedTextPdf(input:{title:string;protocol:string;body:string;footer?:string},settings:GlobalSettings):Promise<Buffer>{
 const fields=input.body.split(/\r?\n/).filter(row=>row.trim()).map(row=>{
  const colon=row.indexOf(':');
  return {label:colon>0&&colon<100?row.slice(0,colon):'',value:colon>0&&colon<100?row.slice(colon+1).trim():row,wide:true};
 });
 return renderBrandedRecordPdf({...input,sections:[{title:'Informações registradas',fields}]},settings);
}

async function renderBrandedRecordPdf(input:{title:string;protocol:string;revision?:number;sections:Section[];note?:string;footer?:string},settings:GlobalSettings):Promise<Buffer>{
 const profile=resolveInstallationProfile(settings),brand=settings.integrationStudio?.brandKit;
 const institution=brand?.institutionName?.trim()||profile.institutionName,course=brand?.courseName?.trim()||profile.courseName;
 const hex=/^#[a-f\d]{6}$/i.test(brand?.primaryColor||'')?brand!.primaryColor:'#005830';
 const green=rgb(parseInt(hex.slice(1,3),16)/255,parseInt(hex.slice(3,5),16)/255,parseInt(hex.slice(5,7),16)/255);
 const ink=rgb(.09,.15,.13),muted=rgb(.36,.42,.40),line=rgb(.81,.85,.83),panel=rgb(.94,.96,.95);
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const [normalBytes,boldBytes]=await fontBytes;
 const normal=await doc.embedFont(normalBytes,{subset:true}),bold=await doc.embedFont(boldBytes,{subset:true});
 const logo=await doc.embedPng(await logoBytes);
 doc.setTitle(`${input.protocol} - ${input.title}`);doc.setAuthor(institution);doc.setSubject(input.title);
 const margin=42,width=511,gap=16,half=(width-gap)/2;
 let page:PDFPage,y=0;
 const wrap=(value:string,font:PDFFont,size:number,max:number)=>{
  const rows:string[]=[];let row='';
  for(const word of value.replace(/\s+/gu,' ').trim().split(' ')){
   if(font.widthOfTextAtSize((row?row+' ':'')+word,size)<=max){row+=(row?' ':'')+word;continue;}
   if(row){rows.push(row);row='';}
   for(const char of word){if(row&&font.widthOfTextAtSize(row+char,size)>max){rows.push(row);row='';}row+=char;}
  }
  if(row)rows.push(row);return rows;
 };
 const text=(value:string,x:number,top:number,size=9,font=normal,color=ink)=>page.drawText(value,{x,y:top,size,font,color});
 const header=()=>{
  page=doc.addPage([595,842]);page.drawRectangle({x:0,y:730,width:595,height:112,color:green});
  page.drawImage(logo,{x:277,y:791,width:40,height:40});
  let top=775;
  for(const [value,size,font]of [[institution,11,bold],[course,9,normal]] as const)for(const row of wrap(value,font,size,width)){
   text(row,(595-font.widthOfTextAtSize(row,size))/2,top,size,font,rgb(1,1,1));top-=15;
  }
  y=704;for(const titleRow of wrap(input.title,bold,18,width)){text(titleRow,margin,y,18,bold,green);y-=23;}
  text(input.protocol,margin,y,10,bold);const revision=input.revision?`Revisão ${input.revision}`:'';text(revision,553-normal.widthOfTextAtSize(revision,8),y,8,normal,muted);y-=20;
 };
 const ensure=(height:number)=>{if(y-height<62)header();};
 const sectionTitle=(title:string)=>{page.drawRectangle({x:margin,y:y-6,width,height:24,color:panel});text(title,margin+10,y+2,10,bold,green);y-=24;};
 const row=(fields:Field[],title:string)=>{
  const sizes=fields.map(value=>value.wide?width:half);
  const rows=fields.map((value,index)=>wrap(value.value,normal,9,sizes[index]));
  let offset=0;
  const total=Math.max(...rows.map(value=>value.length));
  while(offset<total){
   if(y-37<62){header();sectionTitle(`${title} (continuação)`);}
   const capacity=Math.max(1,Math.floor((y-62-24)/13));
   const count=Math.min(total-offset,capacity);
   for(let index=0;index<fields.length;index++){
    const x=margin+index*(half+gap);text(fields[index].label+(offset?' (continuação)':''),x,y,8,bold,muted);
    rows[index].slice(offset,offset+count).forEach((value,lineIndex)=>text(value,x,y-14-lineIndex*13,9));
   }
   y-=18+count*13;offset+=count;
   if(offset<total){header();sectionTitle(`${title} (continuação)`);}
  }
 };
 header();
 for(const section of input.sections){
  let sectionHeight=29;
  for(let index=0;index<section.fields.length;index++){
   const current=section.fields[index],next=section.fields[index+1];
   const paired=!current.wide&&next&&!next.wide;
   sectionHeight+=18+13*Math.max(wrap(current.value,normal,9,current.wide?width:half).length,paired?wrap(next.value,normal,9,half).length:0);
   if(paired)index++;
  }
  ensure(Math.min(sectionHeight,600));sectionTitle(section.title);
  for(let index=0;index<section.fields.length;index++){
   const current=section.fields[index],next=section.fields[index+1];
   if(!current.wide&&next&&!next.wide){row([current,next],section.title);index++;}
   else row([current],section.title);
  }
  y-=5;
 }
 if(input.note){ensure(35);page.drawRectangle({x:margin,y:y-27,width,height:35,color:rgb(1,.98,.91)});text(input.note,margin+10,y-8,9,normal,ink);}
 const pages=doc.getPages();for(let index=0;index<pages.length;index++){
  page=pages[index];page.drawLine({start:{x:margin,y:44},end:{x:553,y:44},thickness:.6,color:line});
  text(input.footer||'Registro eletrônico · Portal TCC',margin,30,7,normal,muted);
  const count=`${index+1} / ${pages.length}`;text(count,553-normal.widthOfTextAtSize(count,8),30,8,normal,muted);
 }
 return Buffer.from(await doc.save());
}
