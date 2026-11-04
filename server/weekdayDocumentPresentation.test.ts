import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMO_PROCESSES } from '../src/services/demoSeed';
import { reservationRequestEmail } from '../src/utils/reservationRequestEmail';
import { officialInvitationEmail } from './workflow/officialInvitation';
import { formatVariable } from '../src/utils/operationalConfig';
import { formatDateNumeric, formatDateNumericWithWeekday, formatDateExtensoTotal } from '../src/utils/formatters';

const fixture = () => {
  const p = structuredClone(DEMO_PROCESSES[0]);
  p.defesa.startAt='2026-12-07T15:30:00-03:00';
  p.defesa.endAt='2026-12-07T17:00:00-03:00';
  return p;
};

test('e-mail de reserva informa o dia da semana sem alterar o horário',()=>{
  const p=fixture();
  const mail=reservationRequestEmail({process:p,baseUrl:'https://portal.example',courseName:'Enfermagem'});
  assert.match(mail.text,/Data: 07\/12\/2026 \(segunda-feira\)/);
  assert.match(mail.html,/07\/12\/2026 \(segunda-feira\)/);
  assert.match(mail.text,/Horário: 15:30 às 17:00/);
});

test('convite para banca exibe dia da semana e mantém os demais campos',()=>{
  const p=fixture();
  const mail=officialInvitationEmail(p,'https://portal.example');
  assert.match(mail.text,/Data: 7 de dezembro de 2026 \(segunda-feira\)/);
  assert.match(mail.html,/7 de dezembro de 2026 \(segunda-feira\)/);
  assert.match(mail.text,/Horário: 15:30/);
});

test('as variáveis de documentos incluem dia da semana nos formatos numérico e extenso',()=>{
  const date='2026-12-07T15:30:00-03:00';
  const short = formatVariable(date,{source:'DEFESA_DATA_HORA',format:'datetime',letterCase:'original',marker:'DATA',bold:false} as Parameters<typeof formatVariable>[1]);
  const long = formatVariable(date,{source:'DEFESA_DATA_HORA',format:'datetime_long',letterCase:'original',marker:'DATA',bold:false} as Parameters<typeof formatVariable>[1]);
  assert.match(short,/07\/12\/2026 \(segunda-feira\) às 15:30/);
  assert.match(long,/sete de dezembro de dois mil e vinte e seis \(segunda-feira\)/);
  assert.match(formatDateExtensoTotal(date),/segunda-feira/);
});

test('o fuso do documento define o dia da semana mesmo quando cruza a meia-noite',()=>{
  const iso='2026-12-07T03:30:00.000Z';
  const requested={source:'DEFESA_DATA_HORA',format:'datetime',letterCase:'original',marker:'DATA',bold:false} as Parameters<typeof formatVariable>[1];
  assert.match(formatVariable(iso,requested,'America/Manaus'),/06\/12\/2026 \(domingo\) às 23:30/);
  assert.match(formatVariable(iso,requested,'America/Sao_Paulo'),/07\/12\/2026 \(segunda-feira\) às 00:30/);
});

test('datas técnicas permanecem em DD/MM/AAAA, sem a semana na exportação',()=>{
  assert.equal(formatDateNumeric('2026-12-07'),'07/12/2026');
  assert.equal(formatDateNumericWithWeekday('2026-12-07'),'07/12/2026 (segunda-feira)');
});

test('campos do formulário e comprovantes exibem a semana sem substituir inputs nativos',()=>{
  const file=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
  for(const path of [
    'src/components/ProcessSummaryCard.tsx',
    'src/components/ReservationChangeForm.tsx',
  ]){
    assert.match(file(path),/type="date"/);
    assert.match(file(path),/formatDatePt\(.*date\)/i);
  }
  for(const path of ['server/documents/reservationReceipt.ts','src/pages/CoordenadorPage.tsx','src/pages/HomePage.tsx']){
    assert.match(file(path),/formatDatePt|formatDateNumericWithWeekday/);
  }
});
