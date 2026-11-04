/**
 * Declaração pública institucional aprovada: modelo A4 para preenchimento à mão.
 * A Comissão de Trabalho de Conclusão de Curso integra o Departamento de Enfermagem; a declaração é
 * assinada individualmente pelo(a) professor(a) orientador(a).
 *
 * Usa o brasão institucional local; não consulta dados pessoais nem serviços externos.
 */
export async function createBlankAttendanceDeclarationPdf(crestBytes?:Uint8Array): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const imageBytes=crestBytes||new Uint8Array(await (async()=>{const response=await fetch('/ufes-crest.png');if(!response.ok)throw new Error('Não foi possível carregar o brasão da UFES.');return response.arrayBuffer();})());
  const crest=await pdf.embedPng(imageBytes);
  pdf.setTitle('Declaração de comparecimento - Comissão de Trabalho de Conclusão de Curso');
  pdf.setAuthor('Departamento de Enfermagem - Comissão de Trabalho de Conclusão de Curso - CCS/UFES');
  pdf.setSubject('Modelo para preenchimento manual e assinatura do professor orientador');

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const page = pdf.addPage([pageWidth, pageHeight]);
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0, 88 / 255, 48 / 255);
  const ink = rgb(0, 0, 0);
  const muted = rgb(90 / 255, 103 / 255, 96 / 255);
  const stroke = rgb(106 / 255, 117 / 255, 111 / 255);
  const paleGreen = rgb(238 / 255, 245 / 255, 241 / 255);
  const paleBorder = rgb(185 / 255, 209 / 255, 196 / 255);
  const center = pageWidth / 2;
  const left = 58;
  const right = pageWidth - left;

  const draw = (
    value: string, x: number, y: number, size = 12,
    font = regular, color = ink
  ) => page.drawText(value, { x, y, size, font, color });

  const centered = (
    value: string, y: number, size = 10,
    font = sansBold, color = green
  ) => draw(value, center - font.widthOfTextAtSize(value, size) / 2, y, size, font, color);

  const line = (
    y: number, x1 = left, x2 = right, thickness = 0.7, color = stroke
  ) => page.drawLine({
    start: { x: x1, y }, end: { x: x2, y }, thickness, color,
  });

  const framed = (x: number, y: number, width: number, height: number, fill = false) =>
    page.drawRectangle({
      x, y, width, height, borderColor: fill ? paleBorder : green,
      borderWidth: 1, ...(fill ? { color: paleGreen } : {}),
    });

  const wrapped = (value: string, size: number, maxWidth: number) => {
    const rows: string[] = [];
    let row = '';
    for (const word of value.split(/\s+/)) {
      const next = row ? `${row} ${word}` : word;
      if (row && sans.widthOfTextAtSize(next, size) > maxWidth) {
        rows.push(row);
        row = word;
      } else row = next;
    }
    if (row) rows.push(row);
    return rows;
  };

  // Cabeçalho institucional com o brasão original, sem alterar a arte.
  framed(22, 22, pageWidth - 44, pageHeight - 44);
  page.drawRectangle({x:23,y:716,width:pageWidth-46,height:103,color:green});
  page.drawCircle({x:74,y:767,size:31,color:rgb(1,1,1)});
  page.drawImage(crest,{x:45,y:738,width:58,height:58});
  const header=(value:string,y:number,size:number,font=sans)=>draw(value,119,y,size,font,rgb(1,1,1));
  header('UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO',790,10,sansBold);
  header('CENTRO DE CIÊNCIAS DA SAÚDE',773,9);
  header('DEPARTAMENTO DE ENFERMAGEM',757,9);
  header('Curso de Graduação em Enfermagem e Obstetrícia',741,8.7);
  header('COMISSÃO DE TRABALHO DE CONCLUSÃO DE CURSO',726,8.7,sansBold);

  // Título e campos livres para preenchimento manuscrito.
  framed(70, 640, pageWidth - 140, 56);
  centered('DECLARAÇÃO DE COMPARECIMENTO', 673, 16);
  centered('Modelo em branco para preenchimento manual', 654, 9.2, sans, muted);
  draw('Declaro, para os devidos fins, que', left, 586, 12.5);
  line(553);
  draw('esteve presente na defesa do Trabalho de Conclusão de Curso (TCC)', left, 525);
  draw('intitulado:', left, 501);
  line(472);
  line(444);
  line(416);
  draw('realizada no dia ______/______/________, com início às ______h______', left, 372, 11.8);
  draw('e término às ______h______, no local:', left, 344, 11.8);
  line(312);
  line(284);

  // Nota explicativa do modelo, sem dados pessoais preenchidos.
  framed(left, 182, right - left, 44, true);
  const note = 'Observação: a declaração é emitida para preenchimento manual e deve ser assinada pelo(a) professor(a) orientador(a), podendo ser utilizada para membros da banca e demais participantes da defesa.';
  const lines = wrapped(note, 8.8, right - left - 16);
  if (lines.length > 3) throw new Error('Texto de orientação excedeu a área reservada.');
  lines.forEach((value, index) => draw(value, left + 8, 210 - index * 11, 8.8, sans, muted));

  draw('Local e data:', left, 150, 11.8);
  line(147, 133, right);
  line(103, 152, pageWidth - 152, 0.9);
  centered('Assinatura do(a) professor(a) orientador(a)', 85, 9.5, sans, muted);

  // Rodapé simples, sem faixa escura ou referência ao Colegiado.
  line(64, 48, pageWidth - 48, 1, green);
  centered('Departamento de Enfermagem · Comissão de Trabalho de Conclusão de Curso · CCS/UFES', 48, 7.6);
  centered('Campus de Maruípe · Vitória/ES', 34, 8.3, sans, muted);

  return pdf.save();
}

/** Um clique na barra lateral inicia o download, sem abrir pop-up ou formulário. */
export async function downloadBlankAttendanceDeclaration(): Promise<void> {
  const bytes = await createBlankAttendanceDeclarationPdf();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'declaracao-de-comparecimento-comissao-tcc.pdf';
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
