import type {ProcessData} from '../types';
import {processLink, type ProcessSection} from './processLink';

export const PROCESS_EMAIL_GUIDANCE_TITLE='ORIENTAÇÕES DO PROCESSO';
export function emailProcessSection(eventCode:string,templateId:string,advisor=false):ProcessSection{
 const event=eventCode.toUpperCase();
 if(templateId==='email-entrega-repositorio')return 'acervo';
 if(templateId==='email-reserva'||templateId==='email-instrucoes-cadastro'||event==='TCC_CREATED')return 'cadastral';
 if(['LOCATION_CONFIRMED','INVITATION_SENT','PROCESS_COMPLETED','PUBLICATION_CLEARED','EVALUATION_SUBMITTED','SIGNATURE_REQUESTED','SIGNATURE_COMPLETED','REPOSITORY_SUBMITTED'].includes(event)||['email-convite','email-conclusao','email-encerramento'].includes(templateId))return 'docs';
 return advisor?'avaliacao':'docs';
}

/** Every participant receives the next actions and authenticated links for this TCC. */
export function processEmailGuidance(process:Pick<ProcessData,'id'|'protocolo'|'etapaAtual'>,baseUrl:string,eventCode='',templateId='',recipient=''):string {
 const link=(section:ProcessSection)=>baseUrl?processLink(baseUrl,process.id,section):`Portal → Meus TCCs → ${process.protocolo}`;
 const general=link('cadastral'),evaluation=link('avaliacao'),documents=link('docs'),repository=link('acervo');
 const event=eventCode.toUpperCase();
 let steps:string[];
 if(templateId==='email-entrega-repositorio'){
  steps=[
   `Autores: concluam os ajustes eventualmente solicitados pela orientação e pela banca. Se não houver ajustes, utilizem a versão final apresentada. A entrega é feita no Repositório deste TCC (${repository}).`,
   'Entrem com o e-mail indicado nesta mensagem e o código recebido. Na aba Repositório, preencham Resumo síntese do TCC com objetivo, método, resultados e conclusão, em até três parágrafos e 2.000 caracteres.',
   'Preencham os cinco campos de palavras-chave. Em Arquivo do trabalho completo, cliquem em Escolher arquivo e selecionem o PDF final revisado.',
   'Se desejarem, enviem o PDF em Arquivo do resumo expandido. Este arquivo é opcional.',
   'Escolham separadamente se desejam tornar público o trabalho completo e se desejam tornar público o resumo expandido. É possível divulgar somente o resumo expandido. Havendo publicação, selecionem a forma de assinatura do Termo e confirmem a autorização.',
   'Confiram os campos e cliquem em Salvar no acervo e finalizar o processo. Um dos autores realiza a entrega pelo trabalho; a dupla não precisa enviar novamente. A conclusão depende das assinaturas e documentos finais aplicáveis.',
   'Orientação: esta mensagem também é enviada para sua ciência. Acompanhe a entrega da versão final e assine o Termo quando houver solicitação de publicação.'
  ];
 }else if(templateId==='email-reserva'||templateId==='email-instrucoes-cadastro'||(!templateId&&event==='TCC_CREATED')){
  steps=[
   'Departamento: responda ao pedido de reserva confirmando a disponibilidade do local, da data e do horário. Esta é a única providência solicitada ao departamento; não é necessário preencher o Portal.',
   `Autores: aguardem a resposta do departamento. Depois, um dos autores deve acessar Dados do processo (${general}), selecionar o local autorizado, anexar a resposta em PDF de até 1 MB, marcar o recebimento da confirmação e clicar em Confirmar local e enviar convite. Uma pessoa realiza esta etapa pela dupla.`
  ];
 }else if(templateId==='email-confirmacao'){
  steps=[`Autores: confiram a confirmação do local, a data e o horário em Dados do processo (${general}). Aguardem o convite formal enviado aos participantes da banca.`];
 }else if(['LOCATION_CONFIRMED','INVITATION_SENT'].includes(event)||templateId==='email-convite'){
  steps=[
   `Autores: confiram data, horário, local e composição da banca em Dados do processo (${general}) e compareçam à defesa conforme o agendamento.`,
   `Orientação: confira os dados do trabalho e dos participantes em Dados do processo (${general}). Os campos permitidos podem ser corrigidos diretamente ao clicar no texto. Confira o agendamento e conduza a defesa. Após a apresentação, acesse Avaliação e ata (${evaluation}), informe o resultado e o parecer, escolha a forma de assinatura, clique em Visualizar ata, confira o documento, marque a confirmação da leitura e confirme a ata para prosseguir.`,
   `Banca: acesse Documentos do processo (${documents}), clique em Ver na Carta-Convite da Banca e em Baixar PDF para guardar o convite. Confira data, horário e local em Dados do processo (${general}) e participe da defesa.`
  ];
 }else if(event==='PROCESS_COMPLETED'||templateId==='email-conclusao'){
  steps=[
   `Autores e orientação: consultem e baixem os documentos disponíveis em Documentos do processo (${documents}).`,
   `Autores: confiram a entrega e as opções de publicação em Repositório (${repository}). Somente os arquivos expressamente autorizados podem ser públicos.`,
   `Banca e presidência: consultem os documentos finais em Documentos do processo (${documents}). Não é necessário repetir etapas concluídas; se houver divergência, solicitem a correção à comissão.`
  ];
 }else if(event==='PUBLICATION_CLEARED'){
  steps=[
   `Presidência: consulte as declarações em Documentos do processo (${documents}) e conclua as assinaturas pendentes pelo método escolhido.`,
   `Autores, orientação e banca: acompanhem os documentos em Documentos do processo (${documents}). Se houver assinatura pendente em seu nome, usem a solicitação recebida do provedor ou a opção Gov.br disponível no Portal.`,
   `Autores: acompanhem o estado da entrega e da publicação em Repositório (${repository}).`
  ];
 }else if(['EVALUATION_SUBMITTED','SIGNATURE_REQUESTED','SIGNATURE_COMPLETED','REPOSITORY_SUBMITTED'].includes(event)||process.etapaAtual==='ASSINATURA'){
  steps=[
   `Orientação e demais signatários indicados: acessem Documentos do processo (${documents}) e confiram quais documentos aguardam sua assinatura. Na Asten, sigam o link da solicitação de assinatura enviada pelo provedor. No Gov.br, baixem o PDF e devolvam o arquivo com as assinaturas exigidas pela opção correspondente do Portal.`,
   `Autores: após o arquivamento da ata assinada, acessem Repositório (${repository}), preencham o resumo e as cinco palavras-chave, anexem o trabalho completo em PDF e, se desejarem, o resumo expandido. Escolham separadamente os arquivos que autorizam publicar e cliquem em Salvar no acervo e finalizar o processo. Se a entrega já foi registrada, acompanhem as pendências sem reenviá-la.`,
   `Autores e orientação: se solicitaram publicação, acompanhem e assinem o Termo de Autorização pelo método escolhido. A carta-convite não exige assinatura.`,
   `Presidência: confira o retorno e o arquivamento das assinaturas em Documentos do processo (${documents}) e trate as pendências exibidas antes de concluir o processo.`
  ];
 }else if(['DEFESA','AVALIACAO'].includes(process.etapaAtual)){
  steps=[
   `Autores e banca: confiram o agendamento em Dados do processo (${general}) e participem da defesa.`,
   `Orientação: após a defesa, acesse Avaliação e ata (${evaluation}), informe o resultado e o parecer, escolha a forma de assinatura e clique em Visualizar ata. Confira os dados, confirme a leitura e confirme a ata para prosseguir.`,
   `Demais participantes: acompanhem os documentos e futuras solicitações de assinatura em Documentos do processo (${documents}).`
  ];
 }else if(process.etapaAtual==='REPOSITORIO'||process.etapaAtual==='CONCLUIDO'||process.etapaAtual==='DOCUMENTOS'){
  steps=[`Autores: confiram os campos e arquivos da entrega em Repositório (${repository}). Preencham as pendências e salvem no acervo quando a etapa estiver liberada.`,`Orientação, banca e presidência: consultem os documentos e as assinaturas pendentes em Documentos do processo (${documents}).`];
 }else{
  steps=[`Autores e orientação: confiram os dados e as pendências em Dados do processo (${general}). Aguardem a resposta do departamento antes de registrar a confirmação do local.`,`Banca e presidência: consultem o agendamento em Dados do processo (${general}) e os arquivos em Documentos do processo (${documents}).`];
 }
 return `${PROCESS_EMAIL_GUIDANCE_TITLE}\n\nAcesso ao TCC ${process.protocolo}: ${link(emailProcessSection(eventCode,templateId))}\n${recipient?`E-mail de acesso: ${recipient}. Use exatamente esse endereço para entrar. `:''}Entre com o e-mail cadastrado no processo e o código recebido por e-mail. O link abre este trabalho após a autenticação. Clique em Entrar, informe o endereço cadastrado, solicite o código e digite o código recebido. Os documentos são baixados no Portal, na aba Documentos do processo; esta mensagem não leva PDFs anexados.\n\n${steps.map((step,index)=>`${index+1}. ${step}`).join('\n\n')}`;
}

export function withProcessEmailGuidance(message:{text:string;html?:string},guidance:string):{text:string;html?:string}{
 const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
 const html=guidance.split('\n\n').map(part=>escape(part).replace(/https?:\/\/[^\s<)]+/g,url=>`<a href="${url}">${url}</a>`).replaceAll('\n','<br>')).join('<br><br>');
 return {text:message.text.includes(PROCESS_EMAIL_GUIDANCE_TITLE)?message.text:`${message.text}\n\n${guidance}`, ...(message.html?{html:message.html.includes(PROCESS_EMAIL_GUIDANCE_TITLE)?message.html.replace(escape(guidance),html):`${message.html}<section aria-label="Orientações">${html}</section>`}:{})};
}
