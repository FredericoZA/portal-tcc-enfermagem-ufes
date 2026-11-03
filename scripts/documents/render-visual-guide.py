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
for name, weight in [('Portal', 'Regular'), ('PortalBold', 'Bold')]:
    pdfmetrics.registerFont(TTFont(name, str(ROOT / f'server/documents/fonts/NotoSans-{weight}.ttf')))
GREEN, SAGE, TEXT = '#005830', '#8CB1A3', '#0F172A'
logo = ImageReader(str(ROOT / 'public/colenf-logo.png'))
body = ParagraphStyle('body', fontName='Portal', fontSize=9.5, leading=13.5, textColor=HexColor(TEXT), spaceAfter=11)
intro = ParagraphStyle('intro', parent=body, fontSize=9, leading=13, textColor=HexColor('#526273'))
heading = ParagraphStyle('heading', fontName='PortalBold', fontSize=18, leading=23, textColor=HexColor(GREEN), spaceAfter=15)
small = ParagraphStyle('small', parent=body, fontSize=8, leading=11, spaceAfter=0)

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
            self.setStrokeColor(HexColor('#C4CED4'))
            self.line(40, 43, 555, 43)
            self.setFont('Portal', 7)
            self.setFillColor(HexColor('#526273'))
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
        story.append(Paragraph(escape(revision) + ' · Referência da implementação local', intro))
        colors = [('Página', '#F6F7F8'), ('Painel', '#E9EDEF'), ('Grupo', '#D8DFE3'), ('Campo', '#FFFFFF')]
        cells = [[Paragraph(f'<b>{label}</b><br/>{code}', small) for label, code in colors]]
        swatches = Table(cells, colWidths=[128.75]*4)
        rules = [('BOX', (0,0), (-1,-1), .5, HexColor('#C4CED4')), ('LEFTPADDING', (0,0),(-1,-1),9), ('TOPPADDING',(0,0),(-1,-1),9), ('BOTTOMPADDING',(0,0),(-1,-1),9)]
        for col, (_, code) in enumerate(colors): rules.append(('BACKGROUND',(col,0),(col,0),HexColor(code)))
        swatches.setStyle(TableStyle(rules)); story.extend([swatches, Spacer(1,15)])
    for paragraph in content.strip().split('\n\n'):
        story.append(Paragraph(escape(' '.join(paragraph.splitlines())), body))
SimpleDocTemplate(str(OUT), pagesize=(595.28,841.89), leftMargin=40, rightMargin=40, topMargin=141, bottomMargin=61, title='Padrão visual e formatação - Portal TCC', author='Curso de Enfermagem e Obstetrícia - UFES').build(story,onFirstPage=header,onLaterPages=header,canvasmaker=NumberedCanvas)
print(OUT)
