import {isManagedDefenseLocation} from '../../src/utils/reservationLocation';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {PDFDocument,rgb,type PDFFont,type PDFPage} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type {ProcessData,GlobalSettings} from '../../src/types';
import {resolveInstallationProfile} from '../../src/utils/installationProfile';
import {officialParticipantLines} from '../../src/utils/officialParticipants';
import {authorNames} from '../../src/utils/personPresentation';
import {formatTccTitle,formatDateWithWeekday,formatDateNumericWithWeekday,formatTime24h} from '../../src/utils/formatters';

const fontBytes=Promise.all(['Regular','Bold'].map(weight=>readFile(path.join(process.cwd(),'server/documents/fonts',`NotoSans-${weight}.ttf`))));
const logoBytes=readFile(path.join(process.cwd(),'server/documents/assets/colenf-logo.png'));
const ink=rgb(.13,.23,.19),muted=rgb(.35,.42,.39),line=rgb(.82,.87,.84),paper=rgb(.96,.98,.97);
export async function createReservationReceiptPdf(process:ProcessData,settings:GlobalSettings,options:{publicView?:boolean}={}):Promise<Buffer>{
 // Older confirmations predate the department micro-form; retain their recorded facts.
 const response=process.defesa.departmentResponse||(process.defesa.localStatus==='CONFIRMADO'&&process.defesa.localConfirmedAt?{
  decision:'CONFIRMED' as const,respondedAt:process.defesa.localConfirmedAt,
  respondedBy:process.defesa.localConfirmedBy||'Não informado no registro original',
  startAt:process.defesa.startAt,endAt:process.defesa.endAt,local:process.defesa.local,receiptBody:''
 }:null);
 if(!response)throw new Error('Resposta ao agendamento não registrada.');
 const profile=resolveInstallationProfile(settings),brand=settings.integrationStudio?.brandKit;
 const institution=brand?.institutionName?.trim()||profile.institutionName;
 const course=brand?.courseName?.trim()||profile.courseName;
 const color=/^#[a-f\d]{6}$/i.test(brand?.primaryColor||'')?brand!.primaryColor!:'#005830';
 const green=rgb(...[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255) as [number,number,number]);
 const snapshot=new Map((response.receiptBody||'').split('\n').map(row=>{const i=row.indexOf(':');return [row.slice(0,i),row.slice(i+1).trim()];}));
 let authors=snapshot.get('Autoria')||authorNames(process);
 for(const person of [process.aluno1,process.aluno2].filter(Boolean)){if(person!.matricula){authors=authors.replaceAll(`${person!.matricula} - `,'').replaceAll(` (${person!.matricula})`,'');}}
 const title=formatTccTitle(snapshot.get('Título')||process.titulo);
 const confirmed=response.decision==='CONFIRMED';
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const [regularBytes,boldBytes]=await fontBytes;
 const logo=await doc.embedPng(await logoBytes);
 const regular=await doc.embedFont(regularBytes,{subset:true}),bold=await doc.embedFont(boldBytes,{subset:true});
 doc.setTitle(`${process.protocolo} - ${confirmed?'Comprovante de reserva':'Comprovante de indisponibilidade'}`);doc.setAuthor(institution);doc.setSubject('Resposta ao pedido de agendamento da defesa');
 let page:PDFPage,y=0;const margin=46,width=503;
 const wrap=(text:string,font:PDFFont,size:number,max:number)=>{
  const rows:string[]=[];let row='';
  for(const word of text.replace(/\s+/gu,' ').trim().split(' ')){
   if(font.widthOfTextAtSize((row?row+' ':'')+word,size)<=max){row+=(row?' ':'')+word;continue;}
   if(row){rows.push(row);row='';}
   for(const ch of word){if(row&&font.widthOfTextAtSize(row+ch,size)>max){rows.push(row);row='';}row+=ch;}
  }
  if(row)rows.push(row);return rows;
 };
 const draw=(text:string,x:number,top:number,size=10,font=regular,color=ink)=>page.drawText(text,{x,y:top,size,font,color});
 const newPage=()=>{
  page=doc.addPage([595,842]);page.drawRectangle({x:0,y:705,width:595,height:137,color:green});
  const logoSize=48;page.drawImage(logo,{x:(595-logoSize)/2,y:781,width:logoSize,height:logoSize});
  let top=764;
  for(const [text,size,font] of [[institution,12,bold],[course,10,regular],[profile.departmentName,9,regular]] as const){for(const row of wrap(text,font,size,width)){draw(row,(595-font.widthOfTextAtSize(row,size))/2,top,size,font,rgb(1,1,1));top-=17;}}
  y=675;
 };
 const ensure=(height:number)=>{if(y-height<88)newPage();};
 const paragraph=(text:string,size=10,font=regular,color=ink)=>{const rows=wrap(text,font,size,width);for(const row of rows){ensure(size+6);draw(row,margin,y,size,font,color);y-=size+6;}};
 const section=(label:string)=>{ensure(62);y-=16;draw(label,margin,y,9,bold,green);y-=10;page.drawLine({start:{x:margin,y},end:{x:549,y},thickness:.7,color:line});y-=21;};
 const field=(label:string,value:string)=>{ensure(32);draw(label,margin,y,9,bold,muted);y-=12;paragraph(value,9);y-=2;};
 newPage();paragraph(confirmed?'Comprovante de reserva':'Comprovante de indisponibilidade',20,bold,green);y-=1;paragraph(process.protocolo,10,bold,muted);y-=12;
 page.drawRectangle({x:margin,y:y-68,width,height:80,color:confirmed?rgb(.90,.96,.92):rgb(1,.97,.88),borderColor:confirmed?rgb(.68,.82,.72):rgb(.90,.79,.45),borderWidth:.7});
 const iconX=margin+23,iconY=y-11;
 page.drawCircle({x:iconX,y:iconY,size:13,color:confirmed?green:rgb(.63,.43,.08)});
 if(confirmed){page.drawLine({start:{x:iconX-6,y:iconY},end:{x:iconX-1,y:iconY-5},thickness:2,color:rgb(1,1,1)});page.drawLine({start:{x:iconX-1,y:iconY-5},end:{x:iconX+7,y:iconY+5},thickness:2,color:rgb(1,1,1)});}
 else{page.drawLine({start:{x:iconX,y:iconY+6},end:{x:iconX,y:iconY-1},thickness:2,color:rgb(1,1,1)});page.drawCircle({x:iconX,y:iconY-6,size:1.2,color:rgb(1,1,1)});}
 draw(confirmed?'RESERVA CONFIRMADA':'LOCAIS INDISPONÍVEIS',margin+47,y-8,12,bold,green);
 const responsible=isManagedDefenseLocation(process.defesa.local)?'O Departamento de Enfermagem':'O orientador';
 const statement=confirmed?`${responsible} confirmou o agendamento da defesa de TCC no local, na data e no horário registrados neste comprovante.`:`${responsible} recusou o agendamento solicitado. Os autores poderão solicitar um novo agendamento pelo Portal.`;
 wrap(statement,regular,9,width-68).forEach((row,i)=>draw(row,margin+47,y-29-i*14,9,regular,ink));y-=80;
 section('Identificação do trabalho');field('Título do TCC',title);field('Autores',authors);
 for(const participant of officialParticipantLines(process).filter(person=>!person.key.startsWith('ALUNO_')))paragraph(`${participant.role}: ${participant.name}`,9);
 section('Dados da defesa');
 const date=formatDateWithWeekday(response.startAt),time=`${formatTime24h(response.startAt)} às ${formatTime24h(response.endAt)}`;
 const dateRows=wrap(date,bold,11,240);const height=Math.max(60,dateRows.length*16+36);ensure(height+8);
 page.drawRectangle({x:margin,y:y-height+16,width,height,color:paper});draw('DATA',margin+12,y,8,bold,muted);draw('HORÁRIO',310,y,8,bold,muted);
 dateRows.forEach((row,i)=>draw(row,margin+12,y-20-i*16,11,bold));draw(time,310,y-20,11,bold);draw('Duração: 1 hora e 30 minutos',310,y-37,8,regular,muted);y-=height;
 field(confirmed?'Local autorizado':'Local solicitado',confirmed?(response.local||snapshot.get('Local')||process.defesa.local):process.defesa.local);
 section('Registro da resposta');
 if(!options.publicView)field('Resposta registrada por',response.respondedBy);
 const registered=`${formatDateNumericWithWeekday(response.respondedAt)}, ${new Intl.DateTimeFormat('pt-BR',{timeZone:settings.timezone||'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(response.respondedAt))}`;
 field('Data e hora do registro',registered);
 const pages=doc.getPages();for(let i=0;i<pages.length;i++){page=pages[i];page.drawLine({start:{x:margin,y:60},end:{x:549,y:60},thickness:.7,color:line});draw('Registro eletrônico do Portal TCC',margin,44,8,regular,muted);const number=`${i+1} / ${pages.length}`;draw(number,549-regular.widthOfTextAtSize(number,8),44,8,regular,muted);}
 return Buffer.from(await doc.save());
}
