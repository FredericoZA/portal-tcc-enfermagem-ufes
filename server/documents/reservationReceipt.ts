import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import type { GlobalSettings, ProcessData } from '../../src/types';
import { resolveInstallationProfile } from '../../src/utils/installationProfile';
import { officialParticipantLines } from '../../src/utils/officialParticipants';
import { formatDatePt, formatTccTitle } from '../../src/utils/formatters';

type ReservationResponse = {
  decision?: 'CONFIRMED'|'DENIED'|'REJECTED'|string;
  respondedAt?: string;
  respondedBy?: string;
};

const W=595.28, H=841.89, M=47, contentWidth=W-M*2;
const green=rgb(0,.34,.21), ink=rgb(.10,.20,.17), gray=rgb(.32,.39,.36), border=rgb(.80,.85,.82);
const pale=rgb(.955,.974,.963), greenTint=rgb(.89,.96,.92), redTint=rgb(.996,.93,.93), red=rgb(.60,.14,.16);
const toSafeText = (value: unknown): string => String(value ?? '').replace(/[\u0000-\u001f]/g,' ').replace(/[—–]/g,'-').trim();

function breakLines(text: string, font: PDFFont, size: number, width: number): string[] {
  const words=toSafeText(text).split(/\s+/).filter(Boolean);
  const rows:string[]=[];let current='';
  for(const word of words){
    const candidate=current?current+' '+word:word;
    if(font.widthOfTextAtSize(candidate,size)<=width){current=candidate;continue;}
    if(current){rows.push(current);current='';}
    if(font.widthOfTextAtSize(word,size)<=width){current=word;continue;}
    let partial='';
    for(const letter of word){
      if(font.widthOfTextAtSize(partial+letter,size)>width && partial){rows.push(partial);partial=letter;}
      else partial+=letter;
    }
    current=partial;
  }
  if(current)rows.push(current);
  return rows.length?rows:['-'];
}

function drawLineGroup(page: PDFPage, label: string, value: string, x:number, y:number, width:number, regular:PDFFont, bold:PDFFont, fontSize=9.7):number {
  const labelText=label+':';
  const labelWidth=bold.widthOfTextAtSize(labelText,fontSize);
  page.drawText(labelText,{x,y,size:fontSize,font:bold,color:ink});
  const firstX=x+labelWidth+8;
  const firstWidth=width-labelWidth-8;
  const rows=breakLines(value,regular,fontSize,Math.max(70,firstWidth));
  page.drawText(rows[0],{x:firstX,y,size:fontSize,font:regular,color:ink});
  let cursor=y;
  for(const continuation of rows.slice(1)){
    cursor-=14;
    page.drawText(continuation,{x:firstX,y:cursor,size:fontSize,font:regular,color:ink});
  }
  return cursor-17;
}

export async function createReservationReceiptPdf(
  process: ProcessData,
  settings: GlobalSettings,
  _options: { publicView?: boolean } = {},
): Promise<Buffer> {
  const data=process.defesa as ProcessData['defesa'] & {departmentResponse?:ReservationResponse};
  const response=data.departmentResponse || (data.localStatus==='CONFIRMADO'
    ? {decision:'CONFIRMED',respondedAt:data.localConfirmedAt,respondedBy:data.localConfirmedBy}
    : {decision:'DENIED'});
  const approved=response.decision==='CONFIRMED';
  const pdf=await PDFDocument.create(),page=pdf.addPage([W,H]);
  const normal=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const installation=resolveInstallationProfile(settings);

  page.drawRectangle({x:0,y:H-72,width:W,height:72,color:green});
  page.drawText('PORTAL TCC  |  ENFERMAGEM E OBSTETRICIA',{x:M,y:H-39,font:bold,size:11.5,color:rgb(1,1,1)});
  page.drawText('Universidade Federal do Espirito Santo',{x:M,y:H-56,font:normal,size:9,color:rgb(.87,.96,.90)});

  let y=H-111;
  const mainTitle=approved?'Comprovante de reserva':'Comprovante de indisponibilidade';
  page.drawText(mainTitle,{x:M,y,size:20,font:bold,color:ink});
  y-=27;
  page.drawText('Protocolo: '+toSafeText(process.protocolo),{x:M,y,size:9.5,font:bold,color:gray});
  y-=18;

  page.drawRectangle({x:M,y:y-68,width:contentWidth,height:76,color:approved?greenTint:redTint,borderColor:approved?rgb(.65,.82,.70):rgb(.88,.65,.65),borderWidth:1});
  page.drawText(approved?'RESERVA CONFIRMADA':'LOCAL INDISPONIVEL',{x:M+14,y:y-17,font:bold,size:12,color:approved?green:red});
  const message=approved
    ? 'A reserva da defesa foi confirmada na data, no horario e no local especificados neste comprovante.'
    : 'O responsavel recusou o agendamento solicitado. Os autores poderao enviar novo pedido pelo Portal TCC.';
  for(const [index,line] of breakLines(message,normal,9.5,contentWidth-28).entries()){
    page.drawText(line,{x:M+14,y:y-37-index*13,font:normal,size:9.5,color:ink});
  }
  y-=105;

  const section=(heading:string)=>{
    page.drawText(heading,{x:M,y,size:11,font:bold,color:green});
    y-=9;
    page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:1,color:border});
    y-=19;
  };

  section('Identificacao do trabalho');
  y=drawLineGroup(page,'Titulo do TCC',formatTccTitle(process.titulo),M,y,contentWidth,normal,bold);
  for(const line of officialParticipantLines(process)){
    y=drawLineGroup(page,line.role,line.name,M,y,contentWidth,normal,bold);
  }
  y-=12;

  section('Dados da defesa');
  const defenseAt=process.defesa.startAt;
  const date=defenseAt?formatDatePt(defenseAt):'A definir';
  const start=defenseAt?new Date(defenseAt):null;
  const end=process.defesa.endAt?new Date(process.defesa.endAt):null;
  const fmt=(d:Date)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
  const time=start?fmt(start)+(end?' as '+fmt(end):''):'A definir';
  const duration=start&&end?Math.max(0,Math.round((end.getTime()-start.getTime())/60000)):0;

  page.drawRectangle({x:M,y:y-55,width:contentWidth,height:65,color:pale});
  page.drawText('DATA',{x:M+13,y:y-16,font:bold,size:8,color:gray});
  page.drawText('HORARIO',{x:M+contentWidth/2,y:y-16,font:bold,size:8,color:gray});
  page.drawText(toSafeText(date),{x:M+13,y:y-33,font:bold,size:10.5,color:ink});
  page.drawText(toSafeText(time),{x:M+contentWidth/2,y:y-33,font:bold,size:10.5,color:ink});
  if(duration){
    page.drawText('Duracao: '+Math.floor(duration/60)+'h '+String(duration%60).padStart(2,'0')+'min',{
      x:M+contentWidth/2,y:y-48,font:normal,size:8.5,color:gray
    });
  }
  y-=89;
  y=drawLineGroup(page,approved?'Local autorizado':'Local solicitado',process.defesa.local,M,y,contentWidth,normal,bold);
  y-=14;

  section('Registro da resposta');
  y=drawLineGroup(page,'Resposta registrada por',response.respondedBy||'Nao informado',M,y,contentWidth,normal,bold);
  const respondedAt=response.respondedAt?new Date(response.respondedAt):null;
  const recorded=respondedAt&&!Number.isNaN(respondedAt.getTime())
    ? new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(respondedAt)
    : 'Nao informado';
  y=drawLineGroup(page,'Data e hora',recorded,M,y,contentWidth,normal,bold);

  page.drawLine({start:{x:M,y:66},end:{x:W-M,y:66},thickness:.7,color:border});
  page.drawText('Documento gerado automaticamente pelo Portal TCC.',{x:M,y:49,font:normal,size:8,color:gray});
  page.drawText(toSafeText(installation.institutionAcronym),{x:W-M-32,y:49,font:bold,size:8,color:green});

  if(y<85)throw new Error('O comprovante ultrapassou o espaco seguro de uma pagina; revise o conteudo antes de gerar.');
  return Buffer.from(await pdf.save());
}
