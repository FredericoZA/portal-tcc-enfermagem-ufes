from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/pdf/padrao-visual-portal-tcc.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
fonts=Path('/System/Library/Fonts/Supplemental')
pdfmetrics.registerFont(TTFont('Portal',str(fonts/'Arial.ttf')))
pdfmetrics.registerFont(TTFont('PortalBold',str(fonts/'Arial Bold.ttf')))
C=canvas.Canvas(str(OUT),pagesize=(595.28,841.89)); C.setTitle('Padrão Visual e Formatação - Portal TCC'); C.setAuthor('Portal TCC - Enfermagem UFES')
PAGE='#F6F7F8'; PANEL='#E9EDEF'; CARD='#D8DFE3'; GREEN='#005830'; TEXT='#0F172A'; MUTED='#526273'; BORDER='#C4CED4'
W,H=595.28,841.89; y=0

def text(s,x,y,size=10,bold=False,color=TEXT):
 C.setFillColor(HexColor(color));C.setFont('PortalBold' if bold else 'Portal',size);C.drawString(x,y,s)
def rect(x,y,w,h,color,r=0):
 C.setFillColor(HexColor(color)); C.setStrokeColor(HexColor(BORDER));
 if r:C.roundRect(x,y,w,h,r,fill=1,stroke=1)
 else:C.rect(x,y,w,h,fill=1,stroke=0)
def page(num,title,subtitle):
 global y
 if num>1:C.showPage()
 rect(0,0,W,H,PAGE);rect(0,H-102,W,102,GREEN)
 text('PORTAL TCC  /  ENFERMAGEM UFES',40,H-31,10,True,'#FFFFFF')
 text(title,40,H-59,22,True,'#FFFFFF');text(subtitle,40,H-81,10,False,'#FFFFFF')
 text('PADRÃO VISUAL E FORMATAÇÃO  ·  Revisão 4.0  ·  21/10/2026',40,27,8,color=MUTED)
 text(f'{num} / 4',523,27,8,color=MUTED);y=H-128

def heading(s):
 global y
 y-=8;text(s,40,y,13,True,GREEN);y-=24

def para(s,bold=False):
 global y
 for line in simpleSplit(s,'PortalBold' if bold else 'Portal',10.5,515):text(line,40,y,10.5,bold);y-=15
 y-=8

def bullet(s):para('• '+s)

page(1,'Uma hierarquia para todo o Portal','Página, pop-ups, formulários e áreas administrativas seguem as mesmas superfícies.')
heading('1. Quatro fundos, em uma sequência fixa')
rows=[('01','Branco gelo',PAGE,'Fundo da página e do pop-up'),('02','Cinza claro',PANEL,'Painel principal e corpo de trabalho'),('03','Cinza médio',CARD,'Grupo interno e cabeçalho de seção'),('04','Branco','#FFFFFF','Campo, controle e conteúdo final')]
for n,name,hexval,desc in rows:
 rect(40,y-49,515,58,hexval,7);text(n,54,y-12,12,True,GREEN);text(name+'  '+hexval,87,y-10,12,True);text(desc,87,y-29,10,color=MUTED);y-=68
heading('2. Verde institucional, sem verde bebê')
rect(40,y-30,515,40,GREEN,6);text('Cabeçalhos, etapa atual e ação principal  ·  #005830',54,y-14,11,True,'#FFFFFF');y-=54
para('Botões comuns usam branco e borda neutra. O verde institucional identifica a ação principal, a aba selecionada e o andamento. Ícones decorativos não recebem fundos roxos, azuis ou verdes claros.')
heading('3. Governança')
para('Os tokens em src/styles/portal-tokens.css definem a paleta. A instrução mais recente do responsável substitui os valores estruturais e as regras conflitantes da revisão 2.0. Não reintroduzir um quinto fundo cinza.')
para('Status e alertas continuam acompanhados por texto. As cores semânticas existentes não devem virar fundos decorativos dos painéis. Sidebar e rodapé mantêm sua identidade escura.')

page(2,'Planilhas flutuantes','Acesso, Registros de Assinatura e Registro de Logs')
heading('4. A tabela é o corpo do pop-up')
para('Sem margem ou padding entre a janela e a planilha. O cabeçalho das colunas começa imediatamente abaixo da barra de título. A borda externa de 1 px pertence à janela, não é uma margem.')
rect(40,y-205,515,215,'#FFFFFF',8);rect(41,y-36,513,45,GREEN);text('REGISTRO DE LOGS',54,y-18,12,True,'#FFFFFF');rect(41,y-71,513,35,GREEN)
for x,label in [(54,'DATA / HORA'),(194,'USUÁRIO'),(352,'ATIVIDADE')]:text(label,x,y-57,9,True,'#FFFFFF')
for i in range(4):
 yy=y-101-i*30;rect(41,yy,513,30,PANEL);text('16/10/2026',54,yy+11,9);text('Usuário de demonstração',194,yy+11,9);text('Registro de atividade',352,yy+11,9)
text('Anterior     1     Próxima',428,y-196,8,color=MUTED);y-=235
bullet('Título: referência de 45 px. Cabeçalho de colunas: 35 px. Linha de dados: mínimo de 30 px. Paginação integrada: 24 px.')
bullet('Tabela com rolagem própria; cabeçalho fixo, filtros e ordenação permanecem utilizáveis. Não esconder colunas para simular ausência de margem.')
bullet('Sem registros: manter as colunas e apresentar a mensagem como uma linha da própria tabela. Não usar cartão com borda tracejada.')
heading('5. Planilhas de página e filtros')
para('Nas páginas com filtros, preservar as barras compactas e os separadores configurados. Essa geometria não cria uma faixa vazia dentro dos três pop-ups de planilha. Campos e botões ordinários permanecem brancos.')
heading('6. Texto e legibilidade')
para('Fonte de interface: Inter ou fontes de sistema equivalentes. Texto escuro #0F172A; secundário #526273. Manter contraste, foco visível e nomes acessíveis. Cor sozinha não informa estado ou permissão.')

page(3,'Detalhes do TCC e editores','A aparência reforça o processo sem alterar o conteúdo acadêmico.')
heading('7. Detalhes do TCC')
bullet('Fundo branco gelo. O fluxo fica em uma faixa branca, com etapas e indicador atual em verde institucional.')
bullet('Duas caixas cinza médio: Dados do processo (protocolo, título e registro; defesa, horário e local) e Dados dos membros, com linhas centralizadas. Sem etapa regimental repetida.')
bullet('Abas fixas: Dados do processo; Avaliação e ata; Documentos do processo; Repositório. Ao abrir, selecionar a aba da etapa atual, preservando a navegação manual.')
bullet('Botões principais de edição e assinatura usam o mesmo verde. Sem verde bebê, roxo decorativo ou variações locais para a mesma ação.')
heading('8. Documentos, e-mails, formulários e fluxos')
bullet('Documentos: painel cinza claro, grupo de variáveis cinza médio e linhas de variável brancas. Preservar DOCX, versões, nomes e vínculos existentes.')
bullet('E-mails: configuração organizada sobre superfícies neutras; campos e corpo de edição brancos. A identidade do e-mail gerado é separada da moldura do editor.')
bullet('Formulários: painel principal cinza claro, perguntas cinza médio e configuração de campos branca. Ícones ficam dentro de seus controles.')
bullet('Fluxos: faixa principal cinza claro, grupo de configuração cinza médio e linhas de ações brancas. Verde apenas em estados ativos e cabeçalhos operacionais.')
bullet('Prévia da ata: revisão integral do corpo, nova visualização e confirmação explícita. Cabeçalho e rodapé institucionais são preservados. Janelas fecham ao clicar fora; títulos têm ícone, sem botão Fechar.')
heading('9. Implementação e conferência')
para('Fontes atuais: src/styles/portal-tokens.css, portal-components.css, portal-layout.css, portal-sheet.css e portal-responsive.css; componentes de cada área e DESIGN.md. Não apontar para folhas CSS antigas que não participam do runtime.')
para('Conferir as cores calculadas no navegador, espaçamentos, rolagem e troca de abas. TypeScript e build complementam a conferência visual. Teste local não comprova publicação na Vercel nem validação de uma integração real.')
para('A revisão registra as decisões de aparência adotadas em 21/10/2026. O número 1.0.79 do rodapé, isoladamente, não identifica o conjunto de alterações publicado.')

page(4,'Organização dos arquivos','Sistema, modelos, trabalhos e publicação possuem papéis diferentes.')
heading('10. Estrutura do Google Drive')
for title,body in [
('00_SISTEMA','Brasão PNG, logo PNG, este PDF e configuração técnica da homologação. A homologação é uma instalação de testes completa, não uma pasta exclusiva da Asten.'),
('01_DOCUMENTOS','Modelos e documentos por categoria: carta-convite, ata, termo e declaração. Gerados e assinados ficam diretamente no ciclo correspondente, sem subpasta por TCC. Carta-convite não tem assinatura nem pasta Assinados.'),
('02_PROCESSOS / protocolo','Pastas de TCC diretamente em 02_PROCESSOS, sem pasta de ano. Cada processo reúne trabalho, resumo, formulários e comprovantes. IDs e vínculos permanecem preservados.'),
('Repositório no Portal','Consulta os arquivos autorizados do próprio processo. Não exige outra pasta ou cópia no Drive. Documentos privados continuam protegidos.')]:
 text(title,40,y,11,True,GREEN);y-=19;para(body)
heading('11. Originais, assinaturas e privacidade')
para('Não criar pasta Lixo no Portal. Descartar apenas alvos conferidos, pelo fluxo normal do Drive. Repositório usa os arquivos autorizados do processo. Não tornar a pasta de processos pública.')
para('Campos editáveis têm demarcação discreta e canetinha ao passar o mouse ou focar. A edição ocorre no próprio campo. Botões de link e histórico são circulares, brancos e identificados por ícones.')
heading('12. Checklist de revisão')
para('Quatro fundos na ordem correta; verde institucional sem verde bebê; planilhas sem margens; conteúdo dos modelos preservado; dados privados protegidos; arquivos identificados por protocolo; resultado conferido no ambiente efetivamente utilizado.')
C.save();print(OUT)
