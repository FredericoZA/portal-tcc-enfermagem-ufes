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
GOVBR='https://www.gov.br/pt-br/servicos/assinatura-eletronica'
ITI='https://validar.iti.gov.br/'
# Each page has a single task. Step titles use the controls shown by the portal.
pages=[
 dict(tag='COMECE AQUI',title='Guia prático do\nPortal de TCC',kind='cover'),
 dict(tag='ACESSO • PARA TODOS',title='1. Solicitar o código de acesso',intro='A área do usuário exige autorização da secretaria ou vínculo com um TCC. Solicitar código não cria cadastro. Deixe o Portal e seu e-mail abertos em abas diferentes.',image='acesso',image_h=212,steps=[
 ('Abra o endereço do Portal.',URL),
 ('Clique em “Entrar no Portal”.','O botão fica na parte de baixo do menu lateral. No celular, abra o menu primeiro.'),
 ('Informe seu e-mail e clique em “Enviar código”.','Use o endereço cadastrado no TCC e autorizado no Portal. Ele pode ser institucional ou pessoal. Confira a grafia antes de enviar.')],note='O código chega por e-mail. Não feche o Portal: você voltará a esta janela para digitá-lo.'),
 dict(tag='ACESSO • PARA TODOS',title='2. Entrar com o código recebido',image='codigo-acesso',image_h=205,steps=[
 ('Abra a mensagem na sua caixa de e-mail.','Procure o código de seis números. Se não encontrar, consulte Spam ou Lixo eletrônico.'),
 ('Volte à aba do Portal.','Se a janela fechou, informe o mesmo e-mail e clique em “Já tenho um código”. Digite os seis números e clique em “Entrar”. Use o código mais recente, válido por 10 minutos.'),
 ('Abra “Meus TCCs” e clique no código do trabalho.','Se veio de um link por e-mail, o Portal pode manter a ficha do TCC aberta. Confira se a conta exibida é a sua.')],note='O código serve para acessar o Portal. O link de assinatura do Asten é outra mensagem, enviada em uma etapa posterior. Ambos são pessoais.'),
 dict(tag='ALUNO • CADASTRO',title='3. Cadastrar o trabalho',image='cadastro',image_h=155,steps=[
 ('Entre em “Meus TCCs” e clique em “Cadastrar TCC”.','Somente um autor inicia o cadastro. Se o TCC já existe, abra seu código; não cadastre o mesmo trabalho novamente.'),
 ('Preencha os participantes e os dados do trabalho.','Informe nomes completos, e-mails, tratamentos, titulações e instituições de autor(es), orientador, dois examinadores e coorientador, se houver. O orientador é sempre da Universidade Federal do Espírito Santo. Não são solicitados CPF, matrícula ou SIAPE.'),
 ('Informe o período acadêmico para estatística, se souber.','Na seção Trabalho, escolha o período ao qual a apresentação se refere, por exemplo, 2026.1. Use “Não informado” quando não souber. Essa resposta não muda a data da defesa nem o código do TCC.'),
 ('Use “Continuar” para avançar nas sete etapas.','O e-mail do primeiro autor é o da conta de acesso e fica bloqueado. Use “Voltar” para corrigir ou “Salvar e sair” para retomar depois.'),
 ('Confira o título e as siglas.','No título e nas instituições dos examinadores e do coorientador, digite o texto normalmente: o Portal reconhece siglas automaticamente e ajusta a capitalização.')]),
 dict(tag='ALUNO • AGENDAMENTO',title='4. Solicitar e acompanhar a reserva',steps=[
 ('Na última etapa, escolha data, horário e local.','Escolha hoje ou uma data futura, inclusive sábado ou domingo. Antes de enviar, confira a disponibilidade do espaço com o Departamento ou, para outro local, com o orientador.'),
 ('Confira as tabelas e clique em “Cadastrar e solicitar reserva”.','Auditório e sala de reuniões dependem do aceite do Departamento. Para outro local, escreva o nome completo como deverá aparecer nos documentos; o orientador receberá o pedido e deverá viabilizar a reserva externa.'),
 ('Aguarde a resposta ao pedido.','O intervalo da defesa é de 1h30. O local escolhido fica bloqueado no Portal enquanto a solicitação aguarda resposta. Isso não controla reservas realizadas fora do sistema.'),
 ('Acompanhe em “Dados do processo”.','Enquanto aguarda resposta, o pedido aparece no Calendário com o texto em vermelho e “(aguardando confirmação)” após o horário. O aceite retira o aviso; a recusa retira só o agendamento, preservando o código do TCC. O resultado responde ao pedido do responsável, com PDF e com responsável, autores e orientador como destinatários diretos.'),
 ('Se necessário, solicite outra reserva.','Use “Refazer reserva” após uma recusa ou “Alterar reserva” quando disponível. Na janela, preencha a proposta e clique em “Enviar nova solicitação”. Aguarde o novo aceite.')],note='O protocolo é gerado pelo sistema e não pode ser alterado. Corrigir a data não exige criar outro TCC.'),
 dict(tag='ALUNO • REGRA ESSENCIAL',title='5. Entregar não é tornar público',kind='publication'),
 dict(tag='ALUNO • ENTREGA FINAL',title='6. Anexar e confirmar a entrega',image='repositorio',image_h=186,steps=[
 ('Abra “Repositório acadêmico”.','A entrega é liberada depois de todas as assinaturas exigidas na ata e do seu arquivamento. Qualquer um dos autores pode concluir esta etapa.'),
 ('Preencha o resumo síntese e as palavras-chave.','Escreva até três parágrafos e 2.000 caracteres. Preencha exatamente cinco palavras-chave, uma em cada campo.'),
 ('Clique em “Escolher arquivo” no trabalho completo.','Selecione o PDF final do TCC. Este arquivo é obrigatório. Anexe o PDF do resumo expandido se houver; ele é opcional.'),
 ('Escolha a divulgação e confirme a entrega.','Assinale somente a caixa do arquivo que deseja tornar público. Sem caixas assinaladas, nenhum PDF será publicado. Clique em “Confirmar entrega e ir para documentos”. Aguarde a confirmação do Portal.')],note='Apenas escolher um arquivo não conclui a entrega. É necessário clicar no botão de confirmação e aguardar o registro.'),
 dict(tag='ALUNO • DEPOIS DA ENTREGA',title='7. Publicação e termo de autorização',steps=[
 ('Confira a aba “Documentos administrativos”.','Depois da confirmação, os dados da entrega ficam bloqueados. Se “Editar entrega” ainda estiver disponível, use-o somente para uma correção necessária; informe o motivo e confirme novamente arquivos e autorizações. Se houver publicação, o novo termo exigirá novas assinaturas.'),
 ('Se nenhum PDF foi autorizado para publicação, não há termo.','O TCC entregue continua guardado para consulta institucional restrita. Não é necessário marcar publicação para concluir a entrega.'),
 ('Se algum PDF foi autorizado, assinem o termo.','Na caixa “Termo de Autorização e Publicação”, acompanhe o envio automático pelo ASTEN. Todos os autores e o orientador recebem links individuais; Gov.br permanece como alternativa.'),
 ('Assine pelo método em uso no processo.','No Asten, cada pessoa usa seu link. Pelo Gov.br, o orientador reúne as assinaturas e devolve o PDF. Consulte as seções dos dois métodos.')],note='A autorização do TCC e a do resumo expandido são independentes. Autorizar um arquivo não autoriza automaticamente o outro.'),
 dict(tag='ORIENTADOR • ANTES DA DEFESA',title='8. Conferir o processo e a banca',image='ficha-orientador',image_h=175,steps=[
 ('Entre com o e-mail cadastrado como orientador.','Use o acesso por código das páginas 2 e 3. Abra “Meus TCCs” e selecione o código do trabalho.'),
 ('Confira “Dados do processo”.','Revise título, autores, examinadores, coorientador, nomes, e-mails, titulações, instituições e dados da defesa. Corrija título e participantes enquanto a edição estiver aberta. Combine mudanças de reserva e data com os autores, que enviam o novo pedido.'),
 ('Verifique o local e acompanhe o convite.','Nos espaços do Departamento, aguarde a homologação. Para outro local, confira o pedido recebido e clique em “Aceitar reserva” ou “Recusar reserva”. O aceite no Portal não efetua uma reserva fora dele.'),
 ('Abra a carta-convite em “Documentos administrativos”.','Use “Ver” ou “Baixar PDF” quando liberados. Se houver dado incorreto e a edição estiver bloqueada, informe a comissão com o protocolo do TCC.')]),
 dict(tag='ORIENTADOR • APÓS A DEFESA',title='9. Registrar conceito e parecer',image='avaliacao',image_h=181,steps=[
 ('Abra o TCC e clique em “Conceito e Ata”.','O registro exige acesso como orientador, local confirmado, convite enviado e o início do horário da defesa.'),
 ('Selecione o conceito da defesa.','Escolha “Aprovado”, “Aprovado com ressalva” ou “Reprovado”, conforme a decisão da banca.'),
 ('Preencha o “Parecer da banca”.','“Gerar rascunho de parecer” preenche um parágrafo com o conceito escolhido. Revise o texto e, se quiser, acrescente as considerações da banca ao final.'),
 ('Clique em “Visualizar ata”.','Leia a prévia antes de confirmar. O preenchimento do conceito ainda não solicita a assinatura do documento.')],note='Registre o conceito e o parecer deliberados pela banca, incluindo eventuais ressalvas. Notas e frequência são lançadas em professor.ufes.br.'),
 dict(tag='ORIENTADOR • CONFERÊNCIA',title='10. Conferir e registrar a ata',image='ata-previa',image_h=117,steps=[
 ('Leia a ata inteira na prévia.','Confira título, nomes completos, data, local, participantes, resultado e parecer. Confirme a presença do coorientador: ele assina a ata quando participou da sessão.'),
 ('Se houver erro, clique em “Corrigir ata”.','Edite o texto na própria ata formatada. Confira as alterações, marque a confirmação e clique em “Salvar e continuar”.'),
 ('Marque a confirmação de conferência.','Assinale “Visualizei a ata. Confirmo que o resultado, o parecer e os dados correspondem à defesa e autorizo o registro e a preparação para assinatura”.'),
 ('Clique em “Registrar conceito e ata e ir para documentos”.','O Portal abre “Documentos administrativos” e inicia o envio automático pelo ASTEN a todos os signatários da ata. Acompanhe o estado confirmado da solicitação.')],note='Depois do registro, acompanhe o estado da ata em Documentos administrativos.'),
 dict(tag='ORIENTADOR • ASSINATURAS DA ATA',title='11. Acompanhar as assinaturas da ata',image='documentos',image_h=245,steps=[
 ('Em “Documentos administrativos”, localize “Ata”.','O conceito e o parecer precisam estar registrados. Assinam orientador, dois examinadores, autores e coorientador presente na sessão, até seis pessoas.'),
 ('Confira o estado do ASTEN.','O pedido é encaminhado automaticamente. A caixa da ata mostra se o envio está pendente ou se o e-mail já foi enviado.'),
 ('Abra o seu e-mail de assinatura.','Cada signatário usa seu próprio link. Quando o Gov.br estiver disponível, consulte o procedimento na seção “Assinar e devolver pelo Gov.br”.'),
 ('Volte ao Portal e acompanhe a caixa da ata.','Somente depois de todas as assinaturas exigidas e do arquivamento a entrega final do aluno é liberada. “Solicitado” ou “Aguardando assinatura” ainda não é conclusão.')]),
 dict(tag='ASTEN • PARA QUEM VAI ASSINAR',title='12. Assinar pelo link do e-mail',steps=[
 ('Abra a mensagem do Asten Assinatura.','Use a caixa de e-mail cadastrada para você no TCC. Confira o assunto, o código do trabalho e se o pedido é da ata, do termo ou da declaração.'),
 ('Clique em “Assinar Documento” no e-mail.','O link abre o ambiente do Asten. Ele é pessoal: não encaminhe a mensagem para que outra pessoa assine em seu lugar.'),
 ('Leia o documento completo.','Confira os nomes, o título, a data e o conteúdo. Se houver erro, avise o orientador antes de assinar.'),
 ('No Asten, clique em “Assinar”.','Preencha os campos solicitados e aceite os termos apresentados. Siga até a confirmação de conclusão; apenas abrir o documento não o assina.'),
 ('Aguarde os demais signatários e o arquivamento.','Sua assinatura pode estar concluída enquanto as de outras pessoas ainda estão pendentes. Volte a “Documentos administrativos” para acompanhar o estado final.')],note='No Asten, cada signatário conclui pelo próprio link. A alternativa pelo Gov.br usa o PDF preparado no Portal.',source=ASTEN),
 dict(tag='EXAMINADOR • SEU PERCURSO',title='13. Receber o convite e assinar a ata',image='documentos-examinador',image_h=150,steps=[
 ('Leia o convite recebido por e-mail.','Confira autoria, título, data, horário e local. Se houver divergência, avise o orientador antes da apresentação.'),
 ('Abra a carta-convite quando precisar.','Abra “Documentos administrativos”. Para conteúdo restrito, entre com seu e-mail da banca e o código.'),
 ('Assine a ata quando solicitado.','No Asten, use seu link pessoal. Pelo Gov.br, assine o PDF preparado e encaminhe ao orientador para reunir todas as assinaturas exigidas.'),
 ('Acompanhe a declaração da banca.','Ela depende da entrega final confirmada e dos documentos aplicáveis concluídos. Quando liberada, consulte-a em “Documentos administrativos”.')],note='O examinador consulta os dados autorizados e assina a ata. O orientador registra conceito e parecer.'),
 dict(tag='ENCERRAMENTO • DOCUMENTOS',title='14. Consultar os documentos finais',image='documentos-concluidos',image_h=206,steps=[
 ('Abra “Documentos administrativos”.','Use “Ver” para consultar na tela e “Baixar PDF” para salvar. A disponibilidade depende do estado de cada documento e da sua permissão de acesso.'),
 ('Aguarde a declaração de participação na banca.','A Presidência da Comissão assina após a entrega final confirmada, a ata arquivada e o termo assinado e arquivado, quando houver publicação autorizada.'),
 ('Diferencie os dois tipos de declaração.','A declaração de participação na banca integra o processo. Já “Declaração de comparecimento”, no menu lateral, baixa um modelo em branco para preenchimento manual e assinatura do orientador.')],note='A defesa ou a assinatura da ata, isoladamente, não encerram o processo. O aluno ainda precisa confirmar a entrega do PDF final.'),
 dict(tag='AJUDA • SITUAÇÕES FREQUENTES',title='15. Quando não consigo avançar',steps=[
 ('O código de acesso não chegou.','Confira o e-mail, Spam e Lixo eletrônico. Aguarde o prazo exibido antes de pedir outro código. Se o endereço estiver errado, use “Trocar e-mail”.'),
 ('Entrei, mas não aparece o meu trabalho.','Confirme se usou o mesmo e-mail informado no cadastro do TCC. Informe à comissão o protocolo e o papel que você exerce no trabalho.'),
 ('Onde assinar o documento.','O ASTEN aparece como informação de envio automático; abra o link pessoal recebido por e-mail. Se o envio estiver pendente, aguarde ou informe a secretaria. A alternativa Gov.br tem procedimento próprio, sem reenviar o pedido ASTEN.'),
 ('Assinei, mas a próxima etapa continua bloqueada.','Na ata, aguarde todos os participantes indicados assinarem e o PDF ser arquivado. No termo, aguarde todos os autores e o orientador. Não solicite outro envio para tentar acelerar.'),
 ('O PDF foi anexado, mas a entrega não terminou.','Confira resumo, cinco palavras-chave e PDF final. Clique em “Confirmar entrega e ir para documentos” e aguarde a confirmação. Se persistir, relate em “Sugestões”, com o protocolo e sem códigos ou credenciais.')]),
 dict(tag='CONSULTA RÁPIDA',title='16. Quem faz cada etapa',kind='reference'),
 dict(tag='ACESSO E PROTEÇÃO DE DADOS',title='17. Quem pode entrar e o que é público',steps=[
 ('Aluno: autorização pela secretaria.','A secretaria autoriza previamente os alunos, normalmente com e-mail institucional da UFES. A administração pode autorizar outros endereços. Quem não tem autorização nem vínculo com um TCC não entra na área do usuário.'),
 ('Docentes e demais participantes: vínculo pelo TCC.','Ao concluir o cadastro, o autor vincula os demais autores, orientador, coorientador e examinadores pelos e-mails informados. Um examinador externo também pode entrar com esse mesmo endereço e o código enviado por e-mail. O vínculo libera apenas as funções do seu papel, sem acesso administrativo.'),
 ('Consulta pública e dados restritos.','Visitantes consultam título, autoria, docentes, resumo textual e dados públicos da defesa. O cadastro novo não solicita CPF, matrícula ou SIAPE. Os registros históricos são preservados. E-mails e identificadores pessoais antigos não aparecem na ficha pública.'),
 ('Arquivos e comunicações.','Os originais ficam no Drive privado. A entrega obrigatória não autoriza a publicação do PDF. E-mails são usados para acesso, avisos e assinaturas; destinatários de mensagens do mesmo TCC podem conhecer os endereços dos demais destinatários.'),
 ('Regras programadas e decisões dos responsáveis.','O Portal registra os conceitos, os pareceres, as reservas e as autorizações informados pelas pessoas responsáveis. Consulte o Aviso de Privacidade em Informações gerais do TCC.')]),
 dict(tag='GOV.BR • ALTERNATIVA DE ASSINATURA',title='18. Assinar e devolver pelo Gov.br',image='gov',image_h=170,steps=[
 ('Abra “Gov.br” na caixa do documento.','O responsável prepara o PDF. Quem participa como signatário baixa o documento quando ele estiver disponível.'),
 ('Use “Abrir assinador Gov.br”.','Assine o mesmo PDF que o Portal preparou. Baixe a versão assinada. Imprimir o documento perde a assinatura eletrônica.'),
 ('Reúna as assinaturas no mesmo PDF.','Na ata, orientador, dois examinadores, todos os autores e coorientador presente na sessão. No termo, todos os autores e orientador. O orientador devolve a ata e o termo. A Presidência devolve a declaração.'),
 ('Devolva o PDF completo para conferência.','Use “Devolver PDF assinado”. O Portal aceita arquivos de até 50 MB. O documento fica pendente até a conferência e o arquivamento.')],kind='govbr'),
 dict(tag='VISITANTE • SEM LOGIN',title='19. Consultar calendário e repositório',image='calendario',image_h=165,steps=[
 ('Abra “Calendário”.','Escolha o mês e o dia. Abra o código do TCC para consultar o horário e o local efetivo da defesa.'),
 ('Consulte “Repositório”.','Busque pelo título ou pela autoria. Abra a ficha e consulte apenas os arquivos liberados em “Repositório acadêmico”.'),
 ('Confira “Documentos administrativos”.','As ações “Ver” e “Baixar PDF” aparecem somente quando o arquivo está disponível para consulta.'),
 ('Envie um relato pelo menu “Sugestões”, se necessário.','Informe a tela e o que aconteceu. Evite compartilhar dados pessoais ou credenciais.')],note='A consulta pública não permite alterar dados, registrar conceito, reservar espaço nem assinar documentos.'),

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
c.setSubject('Aluno, orientador e examinador, visitante, entrega obrigatória, publicação opcional, Asten e Gov.br')
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
 c.setFillColor(GREEN);c.rect(0,H-100,W,100,fill=1,stroke=0)
 arms=ImageReader(str(ROOT/'public/national-arms.png'));iw,ih=arms.getSize();aw=38;ah=aw*ih/iw
 c.drawImage(arms,(W-aw)/2,H-49,aw,ah,mask='auto')
 c.setFillColor(colors.white);c.setFont('PortalBold',10)
 c.drawCentredString(W/2,H-63,'UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO')
 c.setFont('PortalBold',8.5);c.drawCentredString(W/2,H-76,'CENTRO DE CIÊNCIAS DA SAÚDE')
 c.drawCentredString(W/2,H-89,'CURSO DE GRADUAÇÃO EM ENFERMAGEM E OBSTETRÍCIA')
 y=H-126
 c.setFillColor(GREEN);c.setFont('PortalBold',10);c.drawString(M,y,tag);y-=15
 para(escape(title).replace('\n','<br/>'),style='title',gap=17)

def footer():
 c.setStrokeColor(LINE);c.line(M,58,W-M,58)
 c.setFillColor(MUTED);c.setFont('Portal',7)
 for i,line in enumerate(['Comissão de Trabalho de Conclusão de Curso','Departamento de Enfermagem','Curso de Graduação em Enfermagem e Obstetrícia — CCS/UFES']):
  c.drawRightString(W-M,46-i*10,line)
 c.drawRightString(W-M,14,'Atualizado em 08/11/2026')
 c.drawString(M,14,f'{page_number} / {len(pages)}')
 bounds.append({'page':page_number,'lastContentY':round(y,2)})

for page_number,page in enumerate(pages,1):
 c.bookmarkPage(f'page-{page_number}')
 c.addOutlineEntry(page['title'].replace('\n',' '),f'page-{page_number}',level=0)
 if page.get('kind')=='cover':
  c.setFillColor(GREEN);c.rect(0,H-262,W,262,fill=1,stroke=0)
  arms=ImageReader(str(ROOT/'public/national-arms.png'));iw,ih=arms.getSize();aw=58;ah=aw*ih/iw
  c.setFillColor(colors.white);c.circle(W/2,H-46,33,fill=1,stroke=0)
  c.drawImage(arms,(W-aw)/2,H-76,aw,ah,mask='auto')
  c.setFillColor(colors.white);c.setFont('PortalBold',11);c.drawCentredString(W/2,H-100,'UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO')
  c.setFont('PortalBold',10);c.drawCentredString(W/2,H-116,'CENTRO DE CIÊNCIAS DA SAÚDE')
  c.setFont('PortalBold',9.4);c.drawCentredString(W/2,H-132,'CURSO DE GRADUAÇÃO EM ENFERMAGEM E OBSTETRÍCIA')
  c.setFont('PortalBold',31);c.drawString(M,H-178,'Guia prático do');c.drawString(M,H-214,'Portal de TCC')
  c.setFont('Portal',13);c.drawString(M,H-245,'O que fazer, onde clicar e como concluir cada etapa')
  y=H-290
  para('Para participantes e visitantes',style='title',gap=13)
  para('Consulte a seção do seu papel. Os nomes dos botões aparecem em <b>negrito</b>.',gap=16)
  for label,num in [('Acesso por código de e-mail',2),('Aluno: cadastro, reserva e entrega',4),('Entregar não é tornar público',6),('Orientador: conceito, ata e assinatura',9),('Assinar pelo Asten',13),('Examinador: convite, defesa e ata',14),('Acesso e proteção de dados',18),('Assinar e devolver pelo Gov.br',19),('Visitante: consulta pública',20)]:
   ptop=y;para(f'<b>{label}</b> <font color="#4a5d66"> — página {num}</font>',gap=6)
   c.linkRect('',f'page-{num}',(M,y+7,W-M,ptop+1),relative=0,thickness=0)
  y-=8
  para('<b>Acesse o Portal</b><br/><link href="'+URL+'" color="#005830">portal-tcc-enfermagem-ufes.vercel.app</link>',gap=18)
  box('<b>Entrega obrigatória. Publicação opcional.</b><br/>Todo TCC novo exige o PDF final. Autorizar que outras pessoas vejam ou baixem esse arquivo é uma escolha separada dos autores.')
 elif page.get('kind')=='publication':
  header(page['tag'],page['title'])
  box('<b>ENTREGAR O TCC É OBRIGATÓRIO.</b><br/>O aluno envia o PDF final do trabalho completo ao Portal e confirma a entrega. O arquivo é preservado no acervo institucional, inclusive quando não há autorização para torná-lo público.')
  box('<b>TORNAR O PDF PÚBLICO É OPCIONAL.</b><br/>Essa escolha permite que outras pessoas consultem e baixem o arquivo autorizado. Anexar o PDF não autoriza sua publicação. A entrega acadêmica e a divulgação pública são decisões diferentes.')
  para('<b>Se os autores não autorizarem a publicação</b><br/>Anexe o TCC, deixe as opções de tornar público desmarcadas e confirme a entrega. O arquivo permanece com acesso restrito. Não haverá termo de publicação para assinar.',gap=19)
  para('<b>Se os autores autorizarem a publicação</b><br/>Marque o TCC, o resumo expandido ou ambos, conforme a autorização. Após a entrega, o termo é gerado e a ASTEN envia automaticamente os links de assinatura aos autores e ao orientador.',gap=19)
  para('<b>As escolhas são independentes.</b><br/>É possível entregar os dois PDFs e autorizar a divulgação de apenas um, dos dois ou de nenhum. O resumo expandido é opcional; o PDF do TCC completo é obrigatório nos trabalhos novos.',gap=16)
  para('Exemplo: entregar o TCC e não marcar “Tornar este Trabalho de TCC Público” cumpre a entrega sem divulgar o PDF ao público.',style='body')
 elif page.get('kind')=='reference':
  header(page['tag'],page['title'])
  for title,text in [
   ('ALUNO','Cadastra e acompanha o trabalho. Solicita, altera ou refaz a reserva enquanto a etapa permite. Assina a ata, entrega o PDF final e assina o termo quando houver publicação autorizada.'),
   ('ORIENTADOR','Pode corrigir título e participantes na etapa permitida. Registra conceito e ata. Assina a ata e o termo aplicável. O aluno envia pedidos de reserva e alteração de data.'),
   ('EXAMINADORES','Consultam os dados autorizados, participam da defesa e assinam a ata quando convocados.'),
   ('QUEM ASSINA CADA DOCUMENTO','Ata: orientador, dois examinadores, autores e coorientador presente na sessão. Termo: todos os autores e orientador, somente quando houver publicação autorizada. Declaração da banca: Presidência da Comissão. Comprovante e carta-convite não exigem assinatura.')]:
   box('<b>'+title+'</b><br/>'+text)
  para('<b>Acessos de apoio</b><br/>No menu lateral, Sugestões e Declaração de comparecimento ficam em Informações. Replicar Portal fica abaixo, na seção Replicação. O manual completo em PDF está fixado no topo de Como usar.',gap=14)
  para('<b>Referências e edição</b><br/>Nomes de telas e botões conferidos no código e em capturas locais. Revisão dos textos em domingo, 08/11/2026. Asten: <link href="'+ASTEN+'" color="#005830">Como assinar um documento?</link>. As figuras usam dados fictícios.',style='small')
 else:
  header(page['tag'],page['title'])
  if page.get('intro'):para(escape(page['intro']),gap=17)
  for n,(title,text) in enumerate(page['steps'],1):step(n,title,text)
  if page.get('image'):image(page['image'],page['image_h'])
  if page.get('note'):box(escape(page['note']))
  if page.get('kind')=='govbr':
   para('Orientações oficiais: <link href="'+GOVBR+'" color="#005830">Assinatura Gov.br</link> e <link href="'+ITI+'" color="#005830">VALIDAR/ITI</link>.',style='small',gap=0)
  if page.get('source'):para('Orientação de assinatura conferida na <link href="'+page['source']+'" color="#005830">Central de Ajuda do Asten</link>.',style='small',gap=0)
 footer();c.showPage()
c.save()
r=PdfReader(OUT)
assert len(r.pages)==len(pages)
for i,p in enumerate(r.pages):
 assert len(p.extract_text() or '')>300,(i,'Missing text')
assert '/Annots' in r.pages[0], 'Cover navigation must be clickable'
PUBLIC.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(OUT,PUBLIC)
manifest={'edition':'2026-11-08','pages':len(pages),'bodyFontPoints':13,'lineHeightPoints':18.5,'pdf':str(PUBLIC.relative_to(ROOT)),'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'signaturePolicy':'ATA: advisor, two examiners, authors and attending co-advisor; TERMO: authors and advisor; DECLARACAO: commission president','sources':['server/workflow/signaturePolicy.ts','src/components/PortalIllustratedGuide.tsx','src/components/AdvisorEvaluationPanel.tsx','src/pages/HomePage.tsx','src/pages/ProcessoDetailPage.tsx','src/utils/blankAttendanceDeclaration.ts',ASTEN,GOVBR,ITI],'screenshots':'Synthetic captures; no provider dispatch or real personal data','layoutChecks':bounds}
(ROOT/'output/pdf/manual-verification.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'pdf':str(OUT),'public':str(PUBLIC),'pages':len(r.pages),'bytes':OUT.stat().st_size,'sha256':manifest['sha256']},ensure_ascii=False))
