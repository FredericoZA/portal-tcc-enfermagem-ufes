"""Build the visual standard from its maintained Markdown source."""
from pathlib import Path
import re
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf/padrao-visual-portal-tcc.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / 'docs/PADRAO_VISUAL_PORTAL.md'
source = SOURCE.read_text()
revision = re.search(r'^Revisão .+$', source, re.M).group(0)
tokens = dict(re.findall(r'(--portal-[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;', (ROOT / 'src/styles/portal-tokens.css').read_text()))
def token(name):
    return tokens[f'--portal-{name}']
for name, weight in [('Portal', 'Regular'), ('PortalBold', 'Bold')]:
    pdfmetrics.registerFont(TTFont(name, str(ROOT / f'server/documents/fonts/NotoSans-{weight}.ttf')))
GREEN, SAGE, TEXT = token('brand-header'), token('brand-sage'), token('text-dark')
logo = ImageReader(str(ROOT / 'public/colenf-logo.png'))
body = ParagraphStyle('body', fontName='Portal', fontSize=9.1, leading=12.9, textColor=HexColor(TEXT), spaceAfter=8)
intro = ParagraphStyle('intro', parent=body, fontSize=8.4, leading=11.7, textColor=HexColor(token('text-muted')))
heading = ParagraphStyle('heading', fontName='PortalBold', fontSize=17, leading=22, textColor=HexColor(GREEN), spaceAfter=10)
small = ParagraphStyle('small', parent=body, fontSize=8.3, leading=11, spaceAfter=0)
table_head = ParagraphStyle('table_head', parent=small, fontName='PortalBold')
bullet = ParagraphStyle('bullet', parent=body, leftIndent=12, firstLineIndent=0, bulletIndent=1)
WIDTH = 515.28

def inline(text):
    text = escape(text.translate(str.maketrans({'\u2011': '-', '\u2013': '-', '\u2014': '-'})))
    return re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)

def markdown_table(block):
    rows = [[part.strip() for part in line.strip().strip('|').split('|')] for line in block.splitlines() if line.strip()]
    rows = [row for row in rows if not all(re.fullmatch(r':?-{3,}:?', cell) for cell in row)]
    if not rows or any(len(row) != len(rows[0]) for row in rows):
        raise ValueError('Tabela Markdown inconsistente no guia visual')
    cells = [[Paragraph(inline(cell), table_head if row_index == 0 else small) for cell in row] for row_index, row in enumerate(rows)]
    widths = [170, 90, WIDTH - 260] if len(rows[0]) == 3 else [WIDTH / len(rows[0])] * len(rows[0])
    table = Table(cells, colWidths=widths, repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor(token('surface-header'))),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor(token('border'))),
        ('LINEBELOW', (0, 0), (-1, -1), .4, HexColor(token('surface-page'))),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return table

class NumberedCanvas(__import__('reportlab.pdfgen.canvas', fromlist=['Canvas']).Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.states = []
    def showPage(self):
        self.states.append(dict(self.__dict__))
        self._startPage()
    def save(self):
        total = len(self.states)
        for state in self.states:
            self.__dict__.update(state)
            self.setStrokeColor(HexColor(token('border')))
            self.line(40, 43, 555, 43)
            self.setFont('Portal', 7)
            self.setFillColor(HexColor(token('text-muted')))
            self.drawString(40, 28, f'Padrão visual e formatação · {revision}')
            self.drawRightString(555, 28, f'{self._pageNumber} / {total}')
            super().showPage()
        super().save()

def header(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(HexColor(GREEN)); canvas.rect(0, 722, 596, 120, fill=1, stroke=0)
    canvas.drawImage(logo, 275, 785, width=45, height=45, mask='auto', preserveAspectRatio=True)
    canvas.setFillColor(HexColor('#FFFFFF')); canvas.setFont('PortalBold', 10)
    canvas.drawCentredString(297.5, 767, 'Universidade Federal do Espírito Santo')
    canvas.setFont('Portal', 9)
    canvas.drawCentredString(297.5, 750, 'Curso de Graduação em Enfermagem e Obstetrícia')
    canvas.setFont('PortalBold', 8)
    canvas.drawCentredString(297.5, 733, 'Portal TCC · Identidade visual e formatação')
    canvas.restoreState()

story = []
chapters = re.split(r'^## ', source, flags=re.M)
for index, chapter in enumerate(chapters[1:]):
    if index: story.append(PageBreak())
    title, content = chapter.split('\n', 1)
    story.append(Paragraph(escape(title), heading))
    if index == 0:
        story.append(Paragraph(inline(revision) + ' · Referência da implementação local', intro))
        colors = [
            [('Página', token('surface-page')), ('Painel', token('surface-panel')), ('Grupo', token('surface-card')), ('Campo', token('surface-inner'))],
            [('Institucional', GREEN), ('Ação / foco', token('brand-action')), ('Sálvia', SAGE), ('Cabeçalho', token('surface-header'))],
        ]
        cells = [[Paragraph(f'<font color="{"#FFFFFF" if row_index == 1 and col < 2 else TEXT}"><b>{label}</b><br/>{code.upper()}</font>', small) for col, (label, code) in enumerate(row)] for row_index, row in enumerate(colors)]
        swatches = Table(cells, colWidths=[WIDTH/4]*4)
        rules = [('GRID', (0,0), (-1,-1), .5, HexColor(token('border'))), ('LEFTPADDING', (0,0),(-1,-1),9), ('TOPPADDING',(0,0),(-1,-1),8), ('BOTTOMPADDING',(0,0),(-1,-1),8)]
        for row_index, row in enumerate(colors):
            for col, (_, code) in enumerate(row): rules.append(('BACKGROUND',(col,row_index),(col,row_index),HexColor(code)))
        swatches.setStyle(TableStyle(rules)); story.extend([swatches, Spacer(1,12)])
    for paragraph in content.strip().split('\n\n'):
        if paragraph.startswith('|'):
            story.extend([markdown_table(paragraph), Spacer(1,10)])
        elif paragraph.startswith('- '):
            for line in paragraph.splitlines():
                story.append(Paragraph(inline(line.removeprefix('- ')), bullet, bulletText='•'))
        else:
            story.append(Paragraph(inline(' '.join(paragraph.splitlines())), body))
SimpleDocTemplate(str(OUT), pagesize=(595.28,841.89), leftMargin=40, rightMargin=40, topMargin=141, bottomMargin=61, title='Padrão visual e formatação - Portal TCC', author='Curso de Enfermagem e Obstetrícia - UFES').build(story,onFirstPage=header,onLaterPages=header,canvasmaker=NumberedCanvas)
print(OUT)
