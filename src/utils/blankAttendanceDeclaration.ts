/**
 * Modelo público institucional, em branco e preparado para preenchimento manual.
 * Usa a mesma logomarca COLENF disponibilizada em public/colenf-logo.png.
 * Não consulta TCCs, contas, participantes ou serviços de IA.
 */
export async function createBlankAttendanceDeclarationPdf(logoBytes: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle('Declaração de comparecimento - modelo em branco');
  pdf.setAuthor('Colegiado do Curso de Enfermagem e Obstetrícia - CCS/UFES');
  pdf.setSubject('Modelo de declaração para preenchimento manual e assinatura do professor orientador');

  const page = pdf.addPage([595.28, 841.89]); // A4 em pontos
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const institutional = await pdf.embedFont(StandardFonts.Helvetica);
  const institutionalBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(logoBytes);

  const green = rgb(0, 88 / 255, 48 / 255);
  const ink = rgb(0.13, 0.18, 0.16);
  const muted = rgb(0.38, 0.43, 0.41);
  const ruleColor = rgb(0.42, 0.48, 0.45);
  const left = 57;
  const right = 538;
  const center = 595.28 / 2;

  const text = (
    value: string, x: number, y: number, size = 12,
    font = regular, color = ink
  ) => page.drawText(value, { x, y, size, font, color });
  const centered = (
    value: string, y: number, size: number, font = institutionalBold, color = green
  ) => text(value, center - font.widthOfTextAtSize(value, size) / 2, y, size, font, color);
  const line = (y: number, x1 = left, x2 = right, thickness = 0.7, color = ruleColor) =>
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });

  // Cabeçalho limpo: logo oficial à esquerda e identificação acadêmica à direita.
  page.drawImage(logo, { x: left, y: 734, width: 69, height: 69 });
  text('UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO', 140, 783, 10.6, institutionalBold, green);
  text('CENTRO DE CIÊNCIAS DA SAÚDE', 140, 765, 9.7, institutional, ink);
  text('COLEGIADO DO CURSO DE ENFERMAGEM E OBSTETRÍCIA', 140, 748, 9.0, institutional, ink);
  line(716, left, right, 1.3, green);

  centered('DECLARAÇÃO DE COMPARECIMENTO', 656, 16, institutionalBold, green);

  text('Declaro, para os devidos fins, que', left, 592, 12.5);
  line(558);
  text('esteve presente na defesa do Trabalho de Conclusão de Curso (TCC)', left, 531, 12.0);
  text('intitulado:', left, 507, 12.0);
  line(477);
  line(449);
  line(421);

  text('realizada no dia ______/______/________, com início às ______h______', left, 376, 11.8);
  text('e término às ______h______, no local:', left, 348, 11.8);
  line(315);
  line(285);

  text('Local e data:', left, 236, 11.8);
  line(233, 131, right);

  line(157, 141, 454, 0.8);
  centered('Assinatura do(a) professor(a) orientador(a)', 137, 9.5, institutional, muted);

  // Rodapé institucional simples, sem faixas ou caixas.
  line(95, left, right, 0.9, green);
  centered('COLEGIADO DO CURSO DE ENFERMAGEM E OBSTETRÍCIA · CCS/UFES', 77, 8.8, institutionalBold, green);
  centered('Campus de Maruípe · Vitória/ES', 60, 8.5, institutional, muted);

  return pdf.save();
}

async function loadOfficialCourseLogo(): Promise<Uint8Array> {
  // Imagem pública e estática do próprio portal, sem depender de sessão ou backend.
  const response = await fetch('/colenf-logo.png', { cache: 'force-cache' });
  if (!response.ok) throw new Error('Logomarca do curso indisponível.');
  return new Uint8Array(await response.arrayBuffer());
}

/** Baixa o PDF imediatamente após o clique, sem abrir formulários ou pop-ups. */
export async function downloadBlankAttendanceDeclaration(): Promise<void> {
  const logoBytes = await loadOfficialCourseLogo();
  const bytes = await createBlankAttendanceDeclarationPdf(logoBytes);
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
