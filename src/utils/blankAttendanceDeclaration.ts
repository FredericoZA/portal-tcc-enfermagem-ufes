/**
 * Modelo público em branco para preenchimento manual após a defesa.
 * Não consulta processos, participantes nem serviços externos.
 */
export async function createBlankAttendanceDeclarationPdf(): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const document = await PDFDocument.create();
  document.setTitle('Declaração de comparecimento - modelo em branco');
  document.setSubject('Modelo para preenchimento à mão e assinatura do professor orientador');
  const page = document.addPage([595.28, 841.89]); // A4, em pontos
  const regular = await document.embedFont(StandardFonts.TimesRoman);
  const bold = await document.embedFont(StandardFonts.TimesRomanBold);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.25, 0.25, 0.25);
  const left = 63;
  const right = 532;

  const text = (value: string, y: number, x = left, size = 12, font = regular) => {
    page.drawText(value, { x, y, size, font, color: black });
  };
  const rule = (y: number, start = left, end = right) => {
    page.drawLine({ start: { x: start, y }, end: { x: end, y }, thickness: 0.65, color: gray });
  };

  const title = 'DECLARAÇÃO DE COMPARECIMENTO';
  text(title, 744, (595.28 - bold.widthOfTextAtSize(title, 16)) / 2, 16, bold);

  text('Declaro, para os devidos fins, que', 667);
  rule(633); // Nome de quem compareceu à defesa
  text('esteve presente na defesa do Trabalho de Conclusão de Curso (TCC)', 603);
  text('intitulado:', 574);
  rule(540);
  rule(509);
  rule(478);

  text('realizada no dia ______/______/________, com início às ______h______', 440);
  text('e término às ______h______, no local:', 412);
  rule(380);
  rule(349);

  text('Local e data: _______________________________________________________', 282);
  rule(190, 127, 468);
  const signature = 'Assinatura do(a) professor(a) orientador(a)';
  text(signature, 170, (595.28 - regular.widthOfTextAtSize(signature, 11)) / 2, 11);

  return document.save();
}

/** Aciona o download direto do PDF, sem formulário ou janela de pré-visualização. */
export async function downloadBlankAttendanceDeclaration(): Promise<void> {
  const bytes = await createBlankAttendanceDeclarationPdf();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'declaracao-de-comparecimento-modelo-em-branco.pdf';
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
