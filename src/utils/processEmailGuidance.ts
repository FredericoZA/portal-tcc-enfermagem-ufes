import {reservationEmailInstructions} from './reservationRequestEmail';
import type {ProcessData} from '../types';
import {type ProcessSection} from './processLink';

export const PROCESS_EMAIL_GUIDANCE_TITLE='ORIENTAÇÕES DO PROCESSO';
export function emailProcessSection(eventCode:string,templateId:string,advisor=false):ProcessSection{
 const event=eventCode.toUpperCase();
 if(templateId==='email-entrega-repositorio')return 'acervo';
 if(templateId==='email-reserva'||templateId==='email-instrucoes-cadastro'||templateId==='email-confirmacao'||event==='TCC_CREATED')return 'cadastral';
 if(['LOCATION_CONFIRMED','INVITATION_SENT','PROCESS_COMPLETED','PUBLICATION_CLEARED','EVALUATION_SUBMITTED','SIGNATURE_REQUESTED','SIGNATURE_COMPLETED','REPOSITORY_SUBMITTED'].includes(event)||['email-convite','email-conclusao','email-encerramento'].includes(templateId))return 'docs';
 return advisor?'avaliacao':'docs';
}

/** Every participant receives the next actions and authenticated links for this TCC. */
export function processEmailGuidance(process:Pick<ProcessData,'id'|'protocolo'|'etapaAtual'> & Partial<Pick<ProcessData,'defesa'>>,baseUrl:string,eventCode='',templateId='',recipient=''):string {
 const event=eventCode.toUpperCase();
 const reservationNotice=templateId!=='email-entrega-repositorio'&&(templateId==='email-reserva'||templateId==='email-instrucoes-cadastro'||(event==='TCC_CREATED'&&!['email-convite','email-confirmacao'].includes(templateId)));
 const concise=templateId==='email-confirmacao'?['Autores: confiram a data, o horário e o local em Dados do processo.','Orientador: no dia da defesa, registre o conceito e o parecer em Avaliação e ata no Portal TCC; confira a ata e prossiga para a assinatura. A avaliação e o lançamento da nota devem ser feitos no Portal do Professor: professor.ufes.br.']:
templateId==='email-reserva'?reservationEmailInstructions():
templateId==='email-entrega-repositorio'?['Autores:\n• Na aba Repositório acadêmico, preencham o resumo e as palavras-chave, enviem os PDFs finais e escolham quais arquivos autorizam publicar.\n• Confirmem a entrega. Havendo publicação autorizada, o Termo ficará disponível para assinatura em Documentos administrativos.','Observação: a entrega pode ser feita por qualquer um dos autores.','Orientador: acompanhe a entrega e aguarde o Termo de Autorização para assinatura, quando houver publicação autorizada.']:
 reservationNotice?['Autores e orientador: aguardem a resposta do departamento, que será encaminhada automaticamente por e-mail.']:
 event==='EVALUATION_SUBMITTED'?['Orientador e examinadores: a ata exige as três assinaturas. Em Documentos administrativos, solicitem pelo botão Asten ou Gov.br.','• Asten: uma solicitação inclui os três docentes, cada um com seu link por e-mail.\n• Gov.br: os três assinam o mesmo PDF; o orientador reúne e devolve o arquivo completo.','Autores: aguardem as três assinaturas e o arquivamento da ata para entregar a versão final.']:
 event==='REPOSITORY_SUBMITTED'?['Autores e orientador: confiram e assinem o Termo em Documentos administrativos, se houver publicação autorizada.','• Asten (preferencial): solicitem a assinatura pelo botão Asten em Documentos administrativos. Cada autor e o orientador receberão o link por e-mail. Todos assinam no mesmo nível.\n• Gov.br: baixem o Termo e assinem o mesmo PDF. Somente o orientador pode anexar o termo no Portal: ele reúne a sua assinatura e a de cada autor e devolve esse único arquivo completo. Não enviem PDFs separados por pessoa.']:
 event==='PUBLICATION_CLEARED'||templateId==='email-assinatura-declaracao'?['Presidência: confira a declaração de participação na banca em Documentos administrativos e conclua a assinatura.','Asten: abra a solicitação recebida por e-mail e siga as etapas para assinar.','Gov.br: baixe o PDF no Portal, assine pelo serviço Gov.br e envie o arquivo assinado no campo da declaração.']:
 event==='SIGNATURE_REQUESTED'?['Responsável pela assinatura: confira o documento pendente em seu nome na aba Documentos administrativos.','Asten: abra a solicitação recebida por e-mail e siga as etapas para assinar.','Gov.br: baixe o PDF no Portal, assine pelo serviço Gov.br e envie o arquivo completo no campo indicado. A ata e o termo são devolvidos pelo orientador; a declaração, pela presidência.']:
 event==='INVITATION_SENT'||templateId==='email-convite'?['Avaliadores e coorientador: usem o botão acima para abrir a aba Documentos administrativos e consultar a carta-convite. Se o acesso for solicitado, entrem com o e-mail cadastrado; após o login, essa aba será aberta automaticamente.','O e-mail informado pelo autor no cadastro vincula cada participante a este TCC. Para a área do usuário, solicitem o código enviado a esse mesmo endereço, inclusive quando for de outra instituição. Não é necessário criar senha ou fazer um novo cadastro; o acesso corresponde ao papel no processo.']:
 event==='LOCATION_CONFIRMED'?['Autores: confiram o agendamento e a carta-convite em Documentos administrativos.','Orientador: no Portal TCC, registre o conceito e o parecer em Avaliação e ata. Faça a avaliação e lance a nota no Portal do Professor: professor.ufes.br.']:
 event==='SIGNATURE_COMPLETED'&&process.etapaAtual==='REPOSITORIO'?['Autores: a ata assinada foi arquivada. Acessem a aba Repositório acadêmico para enviar os arquivos finais e informar as opções de publicação.','Orientador: acompanhe os ajustes e a entrega final.']:
 event==='SIGNATURE_COMPLETED'?['A assinatura foi registrada. Consulte os documentos no processo do TCC, pelo Portal.']:
 ['Autores: confiram os dados e as pendências em Dados do processo.','Orientador: acompanhe o trabalho e registre o resultado em Avaliação e ata quando a etapa estiver liberada.'];
 return `${PROCESS_EMAIL_GUIDANCE_TITLE}\n\n${concise.join('\n\n')}`;
}

export function withProcessEmailGuidance(message:{text:string;html?:string},guidance:string):{text:string;html?:string}{
 const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
 const html=guidance.split('\n\n').map(part=>escape(part).replace(/https?:\/\/[^\s<)]+/g,url=>`<a href="${url}">${url}</a>`).replaceAll('\n','<br>')).join('<br><br>');
 return {text:message.text.includes(PROCESS_EMAIL_GUIDANCE_TITLE)?message.text:`${message.text}\n\n${guidance}`, ...(message.html?{html:message.html.includes(PROCESS_EMAIL_GUIDANCE_TITLE)?message.html.replace(escape(guidance),html):`${message.html}<section aria-label="Orientações">${html}</section>`}:{})};
}
