import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { ProcessData } from '../types';
import { defenseEndAt } from './defenseSchedule';
import { effectiveDefenseReservationStatus, isDefenseOnCalendar } from './defenseReservationState';

type Reservation = Pick<ProcessData, 'protocolo' | 'titulo' | 'defesa' | 'status'>;

export function confirmedReservations(processes: readonly Reservation[], year: number, month: number, timeZone = 'America/Sao_Paulo') {
  const localDate = new Intl.DateTimeFormat('en-CA', {timeZone,year:'numeric',month:'2-digit',day:'2-digit'});
  const day = new Intl.DateTimeFormat('pt-BR', {timeZone,weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'});
  const time = new Intl.DateTimeFormat('pt-BR', {timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const period = `${year}-${String(month+1).padStart(2,'0')}`;
  return processes
    .filter(p=>p.status!=='EM_RASCUNHO' && isDefenseOnCalendar(p) && effectiveDefenseReservationStatus(p)==='CONFIRMADO')
    .map(p=>({p,start:Date.parse(p.defesa.startAt)}))
    .filter(({start})=>localDate.format(start).slice(0,7)===period)
    .sort((a,b)=>a.start-b.start || a.p.protocolo.localeCompare(b.p.protocolo,'pt-BR'))
    .map(({p,start})=>{
      const recordedEnd = Date.parse(p.defesa.endAt);
      const end = recordedEnd>start ? recordedEnd : Date.parse(defenseEndAt(p.defesa.startAt));
      return [day.format(start), `${time.format(start)} – ${time.format(end)}`, p.defesa.local || '—', p.protocolo, p.titulo];
    });
}

const headings = ['Dia', 'Horário', 'Local', 'Processo', 'Título'];
const widths = [110, 106, 181, 97, 279.89];
const side = 34;
const lineHeight = 13;
const fontSize = 9;
const brand = rgb(0.10,0.27,0.20);
const text = rgb(0.12,0.17,0.15);
const line = rgb(0.83,0.87,0.84);

function wrap(value: string, font: PDFFont, width: number, characterSet: Set<number>) {
  const sanitized = Array.from(value.normalize('NFC').replace(/\s+/gu,' ').trim(), char=>
    characterSet.has(char.codePointAt(0)!) ? char : '?').join('');
  const lines: string[] = [];
  let current = '';
  for (const word of sanitized.split(' ')) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next,fontSize)<=width) {
      current=next;
      continue;
    }
    if(current) lines.push(current);
    current='';
    for (const char of word) {
      if(font.widthOfTextAtSize(current+char,fontSize)>width) {
        lines.push(current);
        current='';
      }
      current+=char;
    }
  }
  return [...lines,current];
}

export async function buildConfirmedReservationsPdf(input: {
  rows: string[][];
  period: string;
  courseName: string;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const characterSet = new Set(font.getCharacterSet());
  const tableWidth = widths.reduce((sum,width)=>sum+width,0);
  pdf.setTitle(`Reservas confirmadas · ${input.period}`);
  const newPage = () => {
    const page = pdf.addPage([841.89,595.28]);
    page.drawText('Reservas confirmadas',{x:side,y:549,size:23,font:bold,color:brand});
    const course=wrap(input.courseName,font,tableWidth,characterSet)[0];
    page.drawText(course,{x:side,y:529,size:fontSize,font,color:text});
    page.drawText(input.period,{x:side,y:508,size:12,font:bold,color:brand});
    page.drawRectangle({x:side,y:465,width:tableWidth,height:25,color:brand});
    let x=side;
    for(const [index,heading] of headings.entries()) {
      page.drawText(heading,{x:x+8,y:474,size:10,font:bold,color:rgb(1,1,1)});
      x+=widths[index];
    }
    return page;
  };
  let page = newPage();
  let y = 465;
  if(!input.rows.length) page.drawText('Nenhuma reserva confirmada no período selecionado.',{x:side+8,y:442,size:11,font,color:text});
  for (const [index,row] of input.rows.entries()) {
    let remaining = row.map((value,i)=>wrap(value,font,widths[i]-16,characterSet));
    while (remaining.some(cell=>cell.length)) {
      let room = Math.floor((y-45-12)/lineHeight);
      if (room<1) {page=newPage();y=465;room=Math.floor((y-45-12)/lineHeight);}
      const height = Math.min(room,Math.max(...remaining.map(cell=>cell.length)))*lineHeight+12;
      page.drawRectangle({x:side,y:y-height,width:tableWidth,height,borderWidth:0.5,borderColor:line,color:index%2===0?rgb(0.95,0.97,0.95):rgb(1,1,1)});
      let x = side;
      for(const [i,cell] of remaining.entries()) {
        if(i) page.drawLine({start:{x,y},end:{x,y:y-height},thickness:0.5,color:line});
        cell.slice(0,room).forEach((value,n)=>page.drawText(value,{x:x+8,y:y-16-n*lineHeight,size:fontSize,font,color:text}));
        x+=widths[i];
      }
      remaining=remaining.map(cell=>cell.slice(room));
      y-=height;
    }
  }
  const pages=pdf.getPages();
  pages.forEach((page,index)=>page.drawText(`${index+1} / ${pages.length}`,{x:side,y:24,size:fontSize,font,color:text}));
  return pdf.save();
}
