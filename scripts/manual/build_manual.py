#!/usr/bin/env python3
"""Build the public illustrated guide. Run with Python + reportlab + pypdf.
UI illustrations are captured by scripts/capture-guide-images.ts using synthetic data.
No provider credentials, real participants or official document originals are embedded.
"""
from pathlib import Path
import json, hashlib, shutil
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/pdf/Manual_Portal_TCC_UFES.pdf'
PUBLIC=ROOT/'public/manual/manual-portal-tcc.pdf'
FONT_DIR=Path('/System/Library/Fonts/Supplemental')
# On other systems pass a directory containing Arial-compatible TTF fonts.
import os
FONT_DIR=Path(os.environ.get('PORTAL_MANUAL_FONT_DIR',str(FONT_DIR)))
for name,file in [('Portal','Arial.ttf'),('PortalBold','Arial Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(FONT_DIR/file)))
pdfmetrics.registerFontFamily('Portal',normal='Portal',bold='PortalBold',italic='Portal',boldItalic='PortalBold')
W,H=595.276,841.89
M=43; CW=W-2*M
GREEN=colors.HexColor('#005830'); SAGE=colors.HexColor('#8cb1a3')
INK=colors.HexColor('#17232d'); MUTED=colors.HexColor('#4a5d66')
PANEL=colors.HexColor('#e9edef'); LINE=colors.HexColor('#c4ced4')
URL='https://portal-tcc-enfermagem-ufes.vercel.app/'
ASTEN='https://ajuda.astenassinatura.com.br/article/86-como-assinar-um-documento'
# Each page has a single task. Step titles use the controls shown by the portal.
pages=[
 dict(tag='COMECE AQUI',title='Guia prático do\nPortal de TCC',kind='cover'),
 dict(tag='ACESSO • PARA TODOS',title='1. Solicitar o código de acesso',intro='A área do usuário exige autorização da secretaria ou vínculo com um TCC. Solicitar código não cria cadastro. Deixe o Portal e seu e-mail abertos em abas diferentes.',image='acesso',image_h=212,steps=[
 ('Abra o endereço do Portal.',URL),
 ('Clique em “Entrar no Portal”.','O botão fica na parte de baixo do menu lateral. No celular, abra o menu primeiro.'),
 ('Informe seu e-mail e clique em “Enviar código”.','Use o endereço cadastrado no TCC e autorizado no Portal. Ele pode ser institucional ou pessoal. Confira a grafia antes de enviar.')],note='O código chega por e-mail. Não feche o Portal: você voltará a esta janela para digitá-lo.'),
 dict(tag='ACESSO • PARA TODOS',title='2. Entrar com o código recebido',image='codigo-acesso',image_h=205,steps=[
 ('Abra a mensagem na sua caixa de e-mail.','Procure o código de seis números. Se não encontrar, consulte Spam ou Lixo eletrônico.'),
 ('Volte à aba do Portal.','Digite o código no campo “Código de confirmação” e clique em “Entrar”. O código expira em 10 minutos; use o mais recente.'),
 ('Abra “Meus TCCs” e clique no código do trabalho.','Se veio de um link por e-mail, o Portal pode manter a ficha do TCC aberta. Confira se a conta exibida é a sua.')],note='O código serve para acessar o Portal. O link de assinatura do Asten é outra mensagem, enviada em uma etapa posterior. Ambos são pessoais.'),
 dict(tag='ALUNO • CADASTRO',title='3. Cadastrar o trabalho',image='cadastro',image_h=167,steps=[
 ('Entre em “Meus TCCs” e clique em “Cadastrar TCC”.','Somente um autor inicia o cadastro. Se o TCC já existe, abra seu código; não cadastre o mesmo trabalho novamente.'),
 ('Preencha os participantes e os dados do trabalho.','Informe autor(es), orientador, dois examinadores e coorientador, quando houver. Confira nomes completos, e-mails, registros, titulações e instituições.'),
 ('Use “Continuar” para avançar nas sete etapas.','O e-mail do primeiro autor é o da conta de acesso e fica bloqueado. Use “Voltar” para corrigir ou “Salvar e sair” para retomar depois.'),
 ('Confira o título e as siglas.','No título e na instituição, escreva *UFES* para preservar uma sigla e/ou acrônimo em maiúsculas. Os asteriscos não aparecerão nos documentos.')]),
 dict(tag='ALUNO • AGENDAMENTO',title='4. Solicitar e acompanhar a reserva',steps=[
 ('Na última etapa, escolha data, horário e local.','Antes de enviar, considere o mapa de salas, as aulas, os eventos e o funcionamento do prédio. Conversar previamente pode evitar retrabalho.'),
 ('Confira as tabelas e clique em “Cadastrar e solicitar reserva”.','Auditório e sala de reuniões dependem do aceite do Departamento. Para outro local, escreva o nome completo como deverá aparecer nos documentos; o orientador receberá o pedido e deverá viabilizar a reserva externa.'),
 ('Aguarde a resposta ao pedido.','O intervalo da defesa é de 1h30. O local escolhido fica bloqueado no Portal enquanto a solicitação aguarda resposta. Isso não controla reservas realizadas fora do sistema.'),
 ('Acompanhe em “Dados do processo”.','Enquanto aguarda resposta, o pedido aparece no Calendário com “Aguardando confirmação” em vermelho. O aceite retira o aviso; a recusa retira só o agendamento, preservando o código do TCC. O resultado também chega por e-mail.'),
 ('Se necessário, solicite outra reserva.','Use “Refazer reserva” após uma recusa ou “Alterar reserva” quando disponível. Na janela, preencha a proposta e clique em “Enviar nova solicitação”. Aguarde o novo aceite.')],note='O protocolo é gerado pelo sistema e não pode ser alterado. Corrigir a data não exige criar outro TCC.'),
 dict(tag='ALUNO • REGRA ESSENCIAL',title='5. Entregar não é tornar público',kind='publication'),
 dict(tag='ALUNO • ENTREGA FINAL',title='6. Anexar e confirmar a entrega',image='repositorio',image_h=186,steps=[
 ('Abra “Repositório acadêmico”.','A entrega é liberada depois de a ata ter as três assinaturas e estar arquivada. Qualquer um dos autores pode concluir esta etapa.'),
 ('Preencha o resumo síntese e as palavras-chave.','Escreva até três parágrafos e 2.000 caracteres. Preencha exatamente cinco palavras-chave, uma em cada campo.'),
 ('Clique em “Escolher arquivo” no trabalho completo.','Selecione o PDF final do TCC. Este arquivo é obrigatório. Anexe o PDF do resumo expandido se houver; ele é opcional.'),
 ('Escolha a divulgação e confirme a entrega.','Marque somente os arquivos que os autores autorizam tornar públicos. Clique em “Confirmar entrega e ir para documentos”. Aguarde a confirmação do Portal.')],note='Apenas escolher um arquivo não conclui a entrega. É necessário clicar no botão de confirmação e aguardar o registro.'),
 dict(tag='ALUNO • DEPOIS DA ENTREGA',title='7. Publicação e termo de autorização',steps=[
 ('Confira a aba “Documentos administrativos”.','Depois da confirmação, os dados da entrega ficam bloqueados. Se “Editar entrega” ainda estiver disponível, use-o somente para uma correção necessária; ela pode exigir novos documentos e assinaturas.'),
 ('Se nenhum PDF foi autorizado para publicação, não há termo.','O TCC entregue continua guardado para consulta institucional restrita. Não é necessário marcar publicação para concluir a entrega.'),
 ('Se algum PDF foi autorizado, assinem o termo.','Na caixa “Termo de Autorização e Publicação”, um responsável solicita pelo botão “Asten”. Cada autor e o orientador recebem seu próprio link. Combine a solicitação para evitar repetições.'),
 ('Abra seu e-mail do Asten e conclua sua assinatura.','Siga as instruções da página 13. Cada pessoa assina pelo próprio link. O arquivamento depende de todas as assinaturas exigidas.')],note='A autorização do TCC e a do resumo expandido são independentes. Autorizar um arquivo não autoriza automaticamente o outro.'),
 dict(tag='ORIENTADOR • ANTES DA DEFESA',title='8. Conferir o processo e a banca',image='ficha',image_h=175,steps=[
 ('Entre com o e-mail cadastrado como orientador.','Use o acesso por código das páginas 2 e 3. Abra “Meus TCCs” e selecione o código do trabalho.'),
 ('Confira “Dados do processo”.','Revise título, autores, examinadores, coorientador, nomes, e-mails, titulações, instituições e dados da defesa. Corrija antes de emitir documentos, enquanto a etapa permitir.'),
 ('Verifique o local e acompanhe o convite.','Nos espaços do Departamento, aguarde a homologação. Para outro local, confira o pedido recebido e clique em “Aceitar reserva” ou “Recusar reserva”. O aceite no Portal não efetua uma reserva fora dele.'),
 ('Abra a carta-convite em “Documentos administrativos”.','Use “Ver” ou “Baixar PDF” quando liberados. Se houver dado incorreto e a edição estiver bloqueada, informe a comissão com o protocolo do TCC.')]),
 dict(tag='ORIENTADOR • APÓS A DEFESA',title='9. Registrar conceito e parecer',image='avaliacao',image_h=181,steps=[
 ('Abra o TCC e clique em “Conceito e Ata”.','O registro exige acesso como orientador, local confirmado, convite enviado e o início do horário da defesa.'),
 ('Selecione o resultado da defesa.','Escolha “Aprovado”, “Aprovado com ressalva” ou “Reprovado”, conforme a decisão da banca.'),
 ('Preencha o “Parecer da banca”.','Escreva a fundamentação deliberada. “Gerar rascunho de parecer” fornece um texto-base fixo; revise-o e substitua as instruções entre colchetes.'),
 ('Clique em “Visualizar ata”.','Leia a prévia antes de confirmar. O preenchimento do conceito ainda não solicita a assinatura do documento.')],note='A avaliação acadêmica e o lançamento da nota são feitos em professor.ufes.br. O Portal de TCC registra o conceito, o parecer e a documentação.'),
 dict(tag='ORIENTADOR • CONFERÊNCIA',title='10. Conferir e registrar a ata',image='ata-previa',image_h=117,steps=[
 ('Leia a ata inteira na prévia.','Confira título, nomes completos, data, local, participantes, resultado e parecer. O coorientador aparece quando cadastrado; isso não o torna signatário da ata.'),
 ('Se houver erro, clique em “Voltar e corrigir”.','Ajuste os dados antes de registrar. Não confirme uma ata com informação incorreta.'),
 ('Marque a confirmação de conferência.','Assinale “Visualizei a ata. Confirmo que o resultado, o parecer e os dados correspondem à defesa e autorizo o registro e a preparação para assinatura”.'),
 ('Clique em “Registrar avaliação e ir para documentos”.','O Portal abre “Documentos administrativos”. A ata registrada ainda precisa da assinatura do orientador e dos dois examinadores.')],note='Registrar o conceito não envia uma solicitação Asten automaticamente. A solicitação é feita na caixa da ata, na próxima etapa.'),
 dict(tag='ORIENTADOR • TRÊS ASSINATURAS',title='11. Solicitar as assinaturas da ata',image='documentos',image_h=199,steps=[
 ('Em “Documentos administrativos”, localize “Ata”.','O conceito e o parecer precisam estar registrados. Confira os responsáveis indicados: orientador e dois examinadores.'),
 ('Clique em “Asten” uma única vez.','A solicitação prepara o mesmo documento para os três integrantes. Aguarde o resultado; não repita o pedido enquanto estiver pendente.'),
 ('Abra o seu e-mail de assinatura.','Cada examinador também recebe um link pessoal. Cada um deve abrir sua mensagem e assinar, conforme a página 13.'),
 ('Volte ao Portal e acompanhe a caixa da ata.','Somente depois das três assinaturas e do arquivamento a entrega final do aluno é liberada. “Solicitado” ou “Aguardando assinatura” ainda não é conclusão.')]),
 dict(tag='ASTEN • PARA QUEM VAI ASSINAR',title='12. Assinar pelo link do e-mail',steps=[
 ('Abra a mensagem do Asten Assinatura.','Use a caixa de e-mail cadastrada para você no TCC. Confira o assunto, o código do trabalho e se o pedido é da ata ou do termo.'),
 ('Clique em “Assinar Documento” no e-mail.','O link abre o ambiente do Asten. Ele é pessoal: não encaminhe a mensagem para que outra pessoa assine em seu lugar.'),
 ('Leia o documento completo.','Confira os nomes, o título, a data e o conteúdo. Se houver erro, avise o orientador antes de assinar.'),
 ('No Asten, clique em “Assinar”.','Preencha os campos solicitados e aceite os termos apresentados. Siga até a confirmação de conclusão; apenas abrir o documento não o assina.'),
 ('Aguarde os demais signatários e o arquivamento.','Sua assinatura pode estar concluída enquanto as de outras pessoas ainda estão pendentes. Volte a “Documentos administrativos” para acompanhar o estado final.')],note='No fluxo por e-mail, não é necessário baixar, imprimir e reenviar o PDF ao Portal. Este manual ensina somente a assinatura pelo Asten.',source=ASTEN),
 dict(tag='EXAMINADOR • SEU PERCURSO',title='13. Receber o convite e assinar a ata',steps=[
 ('Leia o convite recebido por e-mail.','Confira autoria, título, data, horário e local. Se houver divergência, avise o orientador antes da apresentação.'),
 ('Abra a carta-convite quando precisar.','Pelo link do TCC, selecione “Documentos administrativos” e use “Ver” ou “Baixar PDF”. Os dados públicos dispensam login; para conteúdo restrito, entre com seu e-mail da banca e o código.'),
 ('Participe da defesa e da decisão da banca.','O orientador registra o conceito e o parecer no Portal. Você não precisa cadastrar outro TCC nem preencher a entrega do aluno.'),
 ('Depois, assine a ata pelo seu e-mail do Asten.','Quando o orientador solicitar, cada examinador recebe seu próprio link. Clique em “Assinar Documento”, confira o arquivo e conclua em “Assinar”, como na página 13.'),
 ('Acompanhe a declaração da banca.','Ela depende da entrega final confirmada e dos documentos aplicáveis concluídos. Quando liberada, consulte-a em “Documentos administrativos”.')],note='A ata tem três signatários: orientador e dois examinadores. O coorientador não é signatário da ata. O termo de publicação é assinado pelos autores e pelo orientador.'),
 dict(tag='ENCERRAMENTO • DOCUMENTOS',title='14. Consultar os documentos finais',image='documentos-concluidos',image_h=206,steps=[
 ('Abra “Documentos administrativos”.','Use “Ver” para consultar na tela e “Baixar PDF” para salvar. A disponibilidade depende do estado de cada documento e da sua permissão de acesso.'),
 ('Aguarde a declaração de participação na banca.','A Presidência da Comissão assina após a entrega final confirmada, a ata arquivada e o termo assinado e arquivado, quando houver publicação autorizada.'),
 ('Diferencie os dois tipos de declaração.','A declaração de participação na banca integra o processo. Já “Declaração de comparecimento”, no menu lateral, baixa um modelo em branco para preenchimento manual e assinatura do orientador.')],note='A defesa ou a assinatura da ata, isoladamente, não encerram o processo. O aluno ainda precisa confirmar a entrega do PDF final.'),
 dict(tag='AJUDA • SITUAÇÕES FREQUENTES',title='15. Quando não consigo avançar',steps=[
 ('O código de acesso não chegou.','Confira o e-mail, Spam e Lixo eletrônico. Aguarde o prazo exibido antes de pedir outro código. Se o endereço estiver errado, use “Trocar e-mail”.'),
 ('Entrei, mas não aparece o meu trabalho.','Confirme se usou o mesmo e-mail informado no cadastro do TCC. Informe à comissão o protocolo e o papel que você exerce no trabalho.'),
 ('O botão de assinatura não aparece.','Confira a etapa do processo e os responsáveis na caixa do documento. Para a ata, o conceito precisa estar registrado; para o termo, a entrega e a autorização de publicação precisam estar confirmadas.'),
 ('Assinei, mas a próxima etapa continua bloqueada.','Na ata, aguarde orientador e dois examinadores assinarem e o PDF ser arquivado. No termo, aguarde todos os autores e o orientador. Não solicite outro envio para tentar acelerar.'),
 ('O PDF foi anexado, mas a entrega não terminou.','Confira resumo, cinco palavras-chave e PDF final. Clique em “Confirmar entrega e ir para documentos” e aguarde a confirmação. Se persistir, relate em “Sugestões”, com o protocolo e sem códigos ou credenciais.')]),
 dict(tag='CONSULTA RÁPIDA',title='16. Quem faz cada etapa',kind='reference'),
 dict(tag='ACESSO E PROTEÇÃO DE DADOS',title='17. Quem pode entrar e o que é público',steps=[
 ('Aluno: autorização pela secretaria.','A secretaria autoriza previamente os alunos, normalmente com e-mail institucional da UFES. A administração pode autorizar outros endereços. Quem não tem autorização nem vínculo com um TCC não entra na área do usuário.'),
 ('Docentes e demais participantes: vínculo pelo TCC.','Ao concluir o cadastro, o autor vincula os demais autores, orientador, coorientador e examinadores pelos e-mails informados. Um examinador externo também pode entrar com esse mesmo endereço e o código enviado por e-mail. O vínculo libera apenas as funções do seu papel, sem acesso administrativo.'),
 ('Consulta pública e dados restritos.','Visitantes consultam título, autoria, docentes, resumo textual e dados públicos da defesa. E-mails e matrículas não aparecem na ficha pública. Nome, matrícula e e-mail são dados pessoais; também são tratados documentos, informações acadêmicas e registros técnicos necessários ao processo.'),
 ('Arquivos e comunicações.','Os originais ficam no Drive privado. A entrega obrigatória não autoriza a publicação do PDF. E-mails são usados para acesso, avisos e assinaturas; destinatários de mensagens do mesmo TCC podem conhecer os endereços dos demais destinatários.'),
 ('Regras programadas e decisões humanas.','A operação do Portal não usa modelos de inteligência artificial, agentes autônomos ou treinamento com dados dos participantes. Conceitos, pareceres, reservas e autorizações dependem dos responsáveis. Consulte o Aviso de privacidade e a legislação em Informações gerais do TCC.')]),
]
styles={
 'body':ParagraphStyle('body',fontName='Portal',fontSize=13,leading=18.5,textColor=INK,spaceAfter=0),
 'small':ParagraphStyle('small',fontName='Portal',fontSize=10.3,leading=14.2,textColor=MUTED),
 'step':ParagraphStyle('step',fontName='Portal',fontSize=13,leading=18.5,textColor=INK),
 'title':ParagraphStyle('title',fontName='PortalBold',fontSize=23,leading=28,textColor=INK),
}
OUT.parent.mkdir(parents=True,exist_ok=True)
c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
c.setTitle('Manual do Portal de TCC - Enfermagem/UFES')
c.setAuthor('Portal de TCC - Enfermagem/UFES')
c.setSubject('Aluno, orientador e examinador; entrega obrigatória, publicação opcional e assinatura pelo Asten')
y=0; page_number=0; bounds=[]
def para(text,x=None,width=None,style='body',gap=10):
 global y
 x=M if x is None else x; width=CW if width is None else width
 p=Paragraph(text,styles[style]); _,height=p.wrap(width,1000)
 if y-height<61: raise RuntimeError(f'Content overflows page {page_number}: {text[:80]} at {y-height}')
 p.drawOn(c,x,y-height);y-=height+gap
 return height

def box(text,fill=PANEL):
 global y
 p=Paragraph(text,styles['body']);_,h=p.wrap(CW-28,1000)
 if y-h-28<61:raise RuntimeError(f'Box overflows page {page_number}')
 c.setFillColor(fill);c.roundRect(M,y-h-28,CW,h+28,9,fill=1,stroke=0)
 p.drawOn(c,M+14,y-h-14);y-=h+40

def image(name,max_h):
 global y
 file=ROOT/'public/manual'/f'{name}.jpg'
 img=ImageReader(str(file));iw,ih=img.getSize();scale=min(CW/iw,max_h/ih);w,h=iw*scale,ih*scale
 if y-h<80:raise RuntimeError(f'Image overflows page {page_number}: {name}')
 c.drawImage(img,M+(CW-w)/2,y-h,w,h,mask='auto');y-=h+7
 para('Tela ilustrativa do Portal, com dados fictícios. Amplie o PDF para ver os detalhes.',style='small',gap=12)

def step(number,title,text):
 global y
 top=y
 c.setFillColor(GREEN);c.circle(M+12,top-11,12,fill=1,stroke=0)
 c.setFillColor(colors.white);c.setFont('PortalBold',11);c.drawCentredString(M+12,top-15,str(number))
 para('<b>'+escape(title)+'</b><br/>'+escape(text),M+35,CW-35,style='step',gap=15)

def header(tag,title):
 global y
 c.setFillColor(GREEN);c.rect(0,H-58,W,58,fill=1,stroke=0)
 c.setFillColor(colors.white);c.setFont('PortalBold',11);c.drawImage(str(ROOT/'public/national-arms.png'),M,H-47,29,31,mask='auto')
 c.drawString(M+40,H-19,'UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO')
 c.setFont('Portal',8);c.drawString(M+40,H-33,'CENTRO DE CIÊNCIAS DA SAÚDE')
 c.drawString(M+40,H-46,'Curso de Graduação em Enfermagem e Obstetrícia')
 y=H-84
 c.setFillColor(GREEN);c.setFont('PortalBold',10);c.drawString(M,y,tag);y-=15
 para(escape(title).replace('\n','<br/>'),style='title',gap=17)

def footer():
 c.setStrokeColor(LINE);c.line(M,58,W-M,58)
 c.setFillColor(MUTED);c.setFont('Portal',7)
 for i,line in enumerate(['Comissão de Trabalho de Conclusão de Curso','Departamento de Enfermagem','Curso de Enfermagem e Obstetrícia — CCS/UFES']):
  c.drawRightString(W-M,46-i*10,line)
 c.drawRightString(W-M,14,'Atualizado em quarta-feira, 04/11/2026 • Assinatura pelo Asten')
 c.drawString(M,14,f'{page_number} / {len(pages)}')
 bounds.append({'page':page_number,'lastContentY':round(y,2)})

for page_number,page in enumerate(pages,1):
 c.bookmarkPage(f'page-{page_number}')
 c.addOutlineEntry(page['title'].replace('\n',' '),f'page-{page_number}',level=0)
 if page.get('kind')=='cover':
  c.setFillColor(GREEN);c.rect(0,H-262,W,262,fill=1,stroke=0)
  c.setFillColor(colors.white);c.circle(M+32.5,H-69.5,34,fill=1,stroke=0)
  c.drawImage(str(ROOT/'public/national-arms.png'),M,H-102,65,65,mask='auto')
  c.setFillColor(colors.white);c.setFont('PortalBold',11);c.drawString(M+82,H-59,'UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO')
  c.setFont('Portal',10.5);c.drawString(M+82,H-77,'Centro de Ciências da Saúde')
  c.setFont('Portal',8.5);c.drawString(M+82,H-91,'Curso de Graduação em Enfermagem e Obstetrícia')
  c.setFont('PortalBold',31);c.drawString(M,H-155,'Guia prático do');c.drawString(M,H-193,'Portal de TCC')
  c.setFont('Portal',13);c.drawString(M,H-229,'O que fazer, onde clicar e como concluir cada etapa')
  y=H-290
  para('Para alunos, orientadores e examinadores',style='title',gap=13)
  para('Mantenha este PDF aberto enquanto usa o Portal. Comece pelo acesso e, depois, consulte a seção do seu papel. Os títulos dos botões aparecem em <b>negrito</b>.',gap=16)
  for label,num in [('Acesso por código de e-mail',2),('Aluno: cadastro, reserva e entrega',4),('Entregar não é tornar público',6),('Orientador: conceito, ata e assinatura',9),('Assinar pelo Asten',13),('Examinador: convite, defesa e ata',14),('Acesso e proteção de dados',18)]:
   ptop=y;para(f'<b>{label}</b> <font color="#4a5d66"> — página {num}</font>',gap=10)
   c.linkRect('',f'page-{num}',(M,y+7,W-M,ptop+1),relative=0,thickness=0)
  y-=8
  para('<b>Acesse o Portal</b><br/><link href="'+URL+'" color="#005830">portal-tcc-enfermagem-ufes.vercel.app</link>',gap=18)
  box('<b>Entrega obrigatória. Publicação opcional.</b><br/>Todo TCC novo exige o PDF final. Autorizar que outras pessoas vejam ou baixem esse arquivo é uma escolha separada dos autores.')
 elif page.get('kind')=='publication':
  header(page['tag'],page['title'])
  box('<b>ENTREGAR O TCC É OBRIGATÓRIO.</b><br/>O aluno envia o PDF final do trabalho completo ao Portal e confirma a entrega. O arquivo é preservado no acervo institucional, inclusive quando não há autorização para torná-lo público.')
  box('<b>TORNAR O PDF PÚBLICO É OPCIONAL.</b><br/>Essa escolha permite que outras pessoas consultem e baixem o arquivo autorizado. Anexar o PDF não autoriza sua publicação. A entrega acadêmica e a divulgação pública são decisões diferentes.')
  para('<b>Se os autores não autorizarem a publicação</b><br/>Anexe o TCC, deixe as opções de tornar público desmarcadas e confirme a entrega. O arquivo permanece com acesso restrito. Não haverá termo de publicação para assinar.',gap=19)
  para('<b>Se os autores autorizarem a publicação</b><br/>Marque o TCC, o resumo expandido ou ambos, conforme a autorização. Depois da entrega, autores e orientador assinam o Termo de Autorização e Publicação pelo Asten.',gap=19)
  para('<b>As escolhas são independentes.</b><br/>É possível entregar os dois PDFs e autorizar a divulgação de apenas um, dos dois ou de nenhum. O resumo expandido é opcional; o PDF do TCC completo é obrigatório nos trabalhos novos.',gap=16)
  para('Exemplo: entregar o TCC e não marcar “Tornar este Trabalho de TCC Público” cumpre a entrega sem divulgar o PDF ao público.',style='body')
 elif page.get('kind')=='reference':
  header(page['tag'],page['title'])
  for title,text in [
   ('ALUNO','Cadastra o trabalho, acompanha a reserva, entrega o PDF final obrigatório e escolhe quais arquivos autoriza tornar públicos. Assina o termo quando houver publicação autorizada.'),
   ('ORIENTADOR','Confere o cadastro, acompanha a defesa, registra conceito e parecer, confere a ata, solicita a assinatura e assina. Também assina o termo, quando aplicável.'),
   ('EXAMINADORES','Recebem o convite, participam da defesa e assinam a ata, cada um pelo seu link do Asten. Não fazem o cadastro nem a entrega do aluno.'),
   ('QUEM ASSINA CADA DOCUMENTO','Ata: orientador e dois examinadores. Termo: todos os autores e orientador, somente quando houver publicação autorizada. Declaração da banca: Presidência da Comissão. Comprovante e carta-convite não exigem assinatura.')]:
   box('<b>'+title+'</b><br/>'+text)
  para('<b>Acessos de apoio</b><br/>No menu lateral, Sugestões e Declaração de comparecimento ficam em Informações. Replicar Portal fica abaixo, na seção Replicação. O manual completo em PDF está fixado no topo de Como usar.',gap=14)
  para('<b>Referências e edição</b><br/>Nomes de telas e botões conferidos no código e em capturas locais da versão consolidada em quarta-feira, 04/11/2026. Asten: <link href="'+ASTEN+'" color="#005830">Como assinar um documento?</link>. As figuras usam dados fictícios. Este guia não substitui a conferência do documento antes de assiná-lo.',style='small')
 else:
  header(page['tag'],page['title'])
  if page.get('intro'):para(escape(page['intro']),gap=17)
  for n,(title,text) in enumerate(page['steps'],1):step(n,title,text)
  if page.get('image'):image(page['image'],page['image_h'])
  if page.get('note'):box(escape(page['note']))
  if page.get('source'):para('Orientação de assinatura conferida na <link href="'+page['source']+'" color="#005830">Central de Ajuda do Asten</link>.',style='small',gap=0)
 footer();c.showPage()
c.save()
r=PdfReader(OUT)
assert len(r.pages)==len(pages)
for i,p in enumerate(r.pages):
 assert len(p.extract_text() or '')>300,(i,'Missing text')
assert '/Annots' in r.pages[0], 'Cover navigation must be clickable'
PUBLIC.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(OUT,PUBLIC)
manifest={'edition':'2026-11-04','pages':len(pages),'bodyFontPoints':13,'lineHeightPoints':18.5,'pdf':str(PUBLIC.relative_to(ROOT)),'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'signaturePolicy':'ATA: advisor and two examiners; TERMO: authors and advisor; DECLARACAO: commission president','sources':['server/workflow/signaturePolicy.ts','src/components/PortalIllustratedGuide.tsx','src/components/AdvisorEvaluationPanel.tsx','src/pages/HomePage.tsx','src/pages/ProcessoDetailPage.tsx','src/utils/blankAttendanceDeclaration.ts',ASTEN],'screenshots':'Synthetic captures; no provider dispatch or real personal data','layoutChecks':bounds}
(ROOT/'output/pdf/manual-verification.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'pdf':str(OUT),'public':str(PUBLIC),'pages':len(r.pages),'bytes':OUT.stat().st_size,'sha256':manifest['sha256']},ensure_ascii=False))
