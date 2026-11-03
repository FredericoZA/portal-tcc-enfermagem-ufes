import type { ProcessData } from '../../src/types';
import { officialParticipantLines, officialIdentificationLines } from '../../src/utils/officialParticipants';
import { formatDatePt } from '../../src/utils/formatters';

const clean = (s: string) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim();
const escapeHtml = (s: string) => clean(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c));

function defenseTime(date: string): string {
  if (!date || !Number.isFinite(Date.parse(date))) return 'A definir';
  return new Date(date).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour:'2-digit', minute:'2-digit', hour12:false,
  });
}

/** Template canônico apenas para os convites à banca. Não altera destinatários. */
export function officialInvitationEmail(process: ProcessData, portalUrl?: string): {
  subject: string; text: string; html: string;
} {
  const date = process.defesa?.startAt ? formatDatePt(process.defesa.startAt) : 'A definir';
  const time = defenseTime(process.defesa?.startAt);
  const location = process.defesa?.local || 'A confirmar';
  const subject = '[Portal TCC] Convite para a banca de TCC — '+process.protocolo;
  const intro = 'Convidamos Vossas Senhorias para participar da banca de defesa do Trabalho de Conclusão de Curso identificado abaixo.';
  const rows = [
    ...officialIdentificationLines(process),
    'Data: '+date,
    'Horário: '+time,
    'Local: '+location,
  ];
  const url = String(portalUrl || '').trim();
  const footer = [
    'Atenciosamente,',
    'Comissão de Trabalho de Conclusão de Curso',
    'Departamento de Enfermagem',
    'Curso de Enfermagem e Obstetrícia — CCS/UFES',
  ];
  const text = [
    'Prezados(as),','',intro,'',...rows,'',
    ...(url ? ['Acesse o Portal TCC: '+url,''] : []),
    ...footer,
  ].join('\n');

  const normalRow = (label: string, value: string) =>
    '<div style="margin:3px 0;line-height:1.45"><strong>'+escapeHtml(label)+':</strong> '+escapeHtml(value)+'</div>';

  const lines = [
    normalRow('Título',process.titulo),
    ...officialParticipantLines(process).map(({role,name})=>normalRow(role,name)),
    '<div style="height:12px"></div>',
    normalRow('Data',date),
    normalRow('Horário',time),
    normalRow('Local',location),
  ].join('');

  const html = [
    '<div style="background:#edf2ef;padding:20px 12px;font-family:Arial,sans-serif;color:#193a2e">',
    '<article style="max-width:650px;margin:auto;background:#ffffff;border:1px solid #cad7cf;border-radius:10px;overflow:hidden">',
    '<header style="background:#005830;padding:16px 20px;color:white;font-size:17px;font-weight:bold">Convite para a banca de TCC</header>',
    '<div style="padding:22px;font-size:14px;line-height:1.55">',
    '<p>Prezados(as),</p><p style="text-align:justify">'+escapeHtml(intro)+'</p>',
    lines,
    ...(url ? ['<p style="margin-top:22px"><a style="color:#005830;font-weight:bold" href="'+escapeHtml(url)+'">Acessar o Portal TCC</a></p>'] : []),
    '<p style="margin-top:22px">Atenciosamente,</p>',
    '<p>Comissão de Trabalho de Conclusão de Curso<br>Departamento de Enfermagem<br>Curso de Enfermagem e Obstetrícia — CCS/UFES</p>',
    '</div></article></div>',
  ].join('');
  return {subject,text,html};
}
