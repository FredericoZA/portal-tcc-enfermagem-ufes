import React, {useState} from 'react';
import {ChevronLeft, ChevronRight, ExternalLink} from 'lucide-react';

export type GuideRole = 'aluno' | 'orientador' | 'examinador' | 'visitante';
export type GuideActivity = {
  id: string;
  title: string;
  roles: GuideRole[];
  imageId: string;
  imageCaption: string;
  relatedImages?: {id: string; caption: string}[];
  steps: string[];
  done: string;
  help: string[];
};

// Labels intentionally follow the controls displayed in the current portal.
// Screenshots are captured from the same components with fictitious examples.
export const guideActivities: GuideActivity[] = [
  {
    id: 'acesso', title: 'Entrar com o e-mail do processo', roles: ['aluno', 'orientador', 'examinador'], imageId: 'acesso',
    imageCaption: 'Janela de acesso por e-mail. O código é pessoal e não deve ser compartilhado.',
    steps: [
      'No menu lateral, selecione Entrar no Portal.',
      'Informe o e-mail autorizado ou vinculado ao seu TCC. A secretaria libera o acesso inicial dos alunos. Os demais participantes acessam os trabalhos conforme seu vínculo.',
      'Clique em Enviar código e digite os seis números recebidos por e-mail. Guarde o código para uso pessoal.',
      'Após entrar, abra Meus TCCs para localizar o trabalho ou continue na ficha aberta pelo link que recebeu.',
      'Sem login, consulte as informações públicas. As ações disponíveis após o acesso dependem do seu papel no processo.',
    ],
    done: 'Sua conta aparece no Portal e o processo exibe as ações correspondentes ao seu papel.',
    help: [
      'Código não recebido: confira o endereço digitado e a pasta de spam. Aguarde o prazo exibido antes de solicitar outro código.',
      'Código vencido: solicite um novo e use o mais recente. Não envie códigos ou credenciais em sugestões de melhoria.',
      'Acesso ou TCC indisponível: confira se o e-mail está autorizado e se é o mesmo do cadastro do processo. Alunos sem cadastro inicial podem consultar a secretaria.',
    ],
  },
  {
    id: 'cadastro', title: 'Cadastrar o TCC e os participantes', roles: ['aluno'], imageId: 'cadastro',
    imageCaption: 'Cadastro inicial: sete etapas, com o e-mail do primeiro autor vinculado à conta.',
    relatedImages: [{id: 'reserva', caption: 'Última etapa: leia as orientações da reserva e confira todos os dados antes de enviar.'}],
    steps: [
      'Em Meus TCCs, clique em Cadastrar TCC. Se o trabalho já existe, abra seu código em vez de criar outro processo.',
      'Preencha o autor e, se houver, o segundo autor. A ordem dos autores será mantida nos documentos. O e-mail do primeiro autor é o da conta e fica bloqueado.',
      'Informe orientador, examinadores e coorientador, quando houver, com nome, e-mail, tratamento, titulação e instituição nos campos solicitados. Confira as sugestões antes de aceitá-las.',
      'Em títulos e instituições, escreva *UFES* para preservar uma sigla e/ou acrônimo em maiúsculas. Os asteriscos não aparecem nos documentos. Nomes de pessoas seguem a capitalização do Portal.',
      'Use Continuar para salvar e avançar. Salvar e sair guarda o rascunho para retomar depois. A reserva é preenchida na última etapa; confira todas as tabelas antes de Cadastrar e solicitar reserva.',
    ],
    done: 'Um protocolo foi criado e o pedido de reserva foi registrado. O agendamento ainda aguarda a decisão do responsável.',
    help: [
      'Campo incorreto na conferência: use Voltar para corrigir a etapa correspondente.',
      'Dados repetidos entre pessoas: confira quem ocupa cada função, os nomes e os e-mails antes de enviar.',
      'Rascunho alterado em outra aba: mantenha uma única aba de preenchimento e siga a orientação exibida antes de salvar.',
    ],
  },
  {
    id: 'ficha', title: 'Abrir e conferir a ficha', roles: ['aluno', 'orientador', 'examinador'], imageId: 'ficha',
    imageCaption: 'Dados do processo e tabela compacta de participantes, no modelo usado por todos os TCCs.',
    steps: [
      'Em Meus TCCs, clique no código do trabalho. A mesma ficha também abre pelos códigos do Calendário, do Repositório e pelos links dos e-mails.',
      'Em Dados do processo, confira título, participantes, data, horário e local. Protocolo e data de registro são definidos pelo sistema e não podem ser alterados.',
      'As outras abas são Conceito e Ata, Repositório acadêmico e Documentos administrativos. A faixa superior indica a etapa atual; abrir uma aba não conclui essa etapa.',
      'Os campos editáveis exibem o controle de edição. Após a emissão ou o envio do convite, os dados cadastrais ficam bloqueados para autores e orientador. A reserva tem um controle próprio de alteração.',
    ],
    done: 'A ficha corresponde ao trabalho e os dados conferidos estão corretos.',
    help: [
      'Sem controles de edição: confira seu acesso, seu papel e a etapa do trabalho. Campos de consulta não ficam editáveis apenas por clicar neles.',
      'Informação incorreta em etapa bloqueada: informe o protocolo e a correção à comissão. Não crie outro processo para contornar o bloqueio.',
    ],
  },
  {
    id: 'agenda', title: 'Escolher ou alterar a reserva', roles: ['aluno'], imageId: 'confirmacao',
    imageCaption: 'Alteração de reserva em Dados do processo, disponível aos autores enquanto a etapa permitir.',
    steps: [
      'Na última etapa do cadastro, escolha um único local e informe data e horário. Para auditório e sala de reuniões, a homologação cabe ao departamento. Para outro local, informe o nome exato: ele aparecerá nos documentos e o orientador receberá o pedido.',
      'Considere mapa de salas, aulas, eventos, reservas e horários de uso do prédio. A consulta prévia pode evitar retrabalho; o Portal não controla os agendamentos externos.',
      'Ao enviar, o espaço selecionado fica bloqueado no intervalo da defesa, de 1h30. O aceite confirma a reserva; a recusa libera o intervalo. Outro espaço pode ter uma defesa no mesmo horário, desde que não haja participantes em comum.',
      'Para mudar um processo existente, abra Dados do processo e clique em Alterar reserva ou, após uma recusa, Refazer reserva. Preencha os novos dados e clique em Enviar nova solicitação.',
      'O novo pedido invalida a confirmação anterior. Aguarde outro aceite do departamento ou do orientador. A alteração deixa de estar disponível após o registro do conceito ou da entrega final.',
    ],
    done: 'O pedido está registrado com a data, o horário e o local pretendidos; a confirmação só vale depois do aceite.',
    help: [
      'Horário ocupado: escolha outro intervalo ou outro espaço e envie o pedido corrigido.',
      'Reserva recusada: use Refazer reserva no mesmo TCC. Não é necessário refazer o cadastro dos participantes.',
      'Local externo: o orientador também precisa garantir a reserva junto ao espaço escolhido; o bloqueio do Portal não faz essa reserva externa.',
    ],
  },
  {
    id: 'confirmacao', title: 'Acompanhar a confirmação da reserva', roles: ['aluno'], imageId: 'documentos',
    imageCaption: 'O comprovante fica na primeira caixa de Documentos administrativos, junto dos outros documentos.',
    steps: [
      'O responsável pelo local recebe os botões de aceitar ou recusar. Os autores e o orientador recebem uma comunicação informativa, sem os botões reservados ao responsável. Se o responsável for o próprio orientador, ele recebe a mensagem de decisão.',
      'Enquanto aguarda resposta, o pedido aparece no Calendário com o texto em vermelho e (aguardando confirmação) logo após o horário. O aceite retira o aviso; a recusa retira somente o agendamento da agenda e mantém o código do TCC. Em Documentos administrativos, consulte o comprovante.',
      'Depois do aceite, confira a data, o horário e o local no Calendário e os dados da carta-convite em Documentos administrativos.',
      'Os examinadores e o coorientador, quando houver, recebem o convite em uma mensagem de grupo. Os documentos são consultados no Portal.',
    ],
    done: 'A reserva está confirmada, o comprovante está disponível e os dados da defesa foram conferidos.',
    help: [
      'Ainda aguardando resposta: o envio do cadastro não equivale ao aceite da reserva.',
      'Ao aceitar ou recusar pelo e-mail, o responsável acompanha o registro automático e o download do comprovante. Se houver erro, confira o resultado antes de repetir; após alterar a reserva, use o e-mail mais recente.',
      'Pedido recusado: volte a Dados do processo e use Refazer reserva.',
    ],
  },
  {
    id: 'reserva-orientador', title: 'Conferir a reserva e o convite', roles: ['orientador'], imageId: 'documentos',
    imageCaption: 'Confira o comprovante e a carta-convite em Documentos administrativos.',
    steps: [
      'Abra Dados do processo e confira data, horário e local com os autores.',
      'Para auditório ou sala de reuniões, acompanhe a homologação do departamento. Se o pedido for para outro local, confira a disponibilidade com o espaço escolhido e use o botão de aceite ou recusa no e-mail de solicitação.',
      'Confira o comprovante e a carta-convite em Documentos administrativos. Se a proposta precisar mudar, combine os novos dados com os autores para que solicitem outra reserva.',
    ],
    done: 'A reserva atual foi confirmada e as informações da defesa no convite estão corretas.',
    help: ['Divergência após o bloqueio de edição: informe o protocolo e os dados corretos à comissão.'],
  },
  {
    id: 'avaliacao', title: 'Registrar o conceito e conferir a ata', roles: ['orientador'], imageId: 'avaliacao',
    imageCaption: 'Conceito e Ata: preenchimento pelo orientador. A escolha da assinatura acontece em outra aba.',
    relatedImages: [{id: 'ata-previa', caption: 'Conferência da prévia: confirme os dados antes de registrar o conceito e continuar nos documentos.'}],
    steps: [
      'Entre com o e-mail do orientador, abra o TCC e a aba Conceito e Ata. O registro é liberado com local confirmado, convite enviado e a partir do horário da defesa.',
      'Selecione Aprovado, Aprovado com ressalva ou Reprovado e preencha o Parecer da banca. Gerar rascunho de parecer fornece um texto-base fixo: revise-o conforme o que a banca decidiu.',
      'Registre o conceito e o parecer deliberados pela banca. Se houve ressalvas, descreva-as no parecer. Lance notas e frequência no Portal do Professor, em professor.ufes.br.',
      'Clique em Visualizar ata. Confira os dados e o texto da prévia, marque a confirmação de conferência e clique em Registrar conceito e ata e ir para documentos.',
      'O Portal abre Documentos administrativos. O registro não envia uma assinatura automaticamente: escolha Asten ou Gov.br na caixa da ata.',
    ],
    done: 'O conceito e o parecer foram registrados; a ata está pronta para o orientador solicitar a assinatura em Documentos administrativos.',
    help: [
      'Registro indisponível: confira o horário da defesa, a confirmação do local, o envio do convite e se está na conta do orientador.',
      'Prévia incorreta: corrija o preenchimento antes de confirmar. A prévia por si só não registra o conceito.',
      'Reabrir conceito e ata só aparece enquanto o registro puder ser corrigido. A primeira entrega final bloqueia a reabertura, mesmo se a entrega for reaberta depois.',
    ],
  },
  {
    id: 'assinatura-examinador', title: 'Assinar a ata como examinador', roles: ['examinador'], imageId: 'documentos',
    imageCaption: 'Documentos administrativos: a caixa da ata apresenta os responsáveis e os métodos de assinatura.',
    steps: [
      'Use seu próprio e-mail cadastrado como examinador para entrar no Portal e abra o TCC em Meus TCCs ou pelo link do convite.',
      'Depois que o orientador registrar o conceito e o parecer, abra Documentos administrativos e confira a ata. O examinador não registra o conceito nem altera o parecer.',
      'Quando o orientador solicitar a assinatura pelo Asten, abra o link pessoal recebido no seu e-mail e assine. A ata só será arquivada quando orientador e os dois examinadores assinarem.',
      'Se usarem Gov.br, baixe o PDF preparado, assine o mesmo arquivo e encaminhe a versão assinada ao orientador para reunir as três assinaturas e devolver o PDF completo no Portal.',
    ],
    done: 'Sua assinatura foi registrada no documento; a etapa só termina depois das três assinaturas e do arquivamento da ata.',
    help: [
      'Sem acesso à ata: confira se entrou com o e-mail registrado na banca. Se o link do Asten ainda não chegou, confirme com o orientador se a assinatura foi solicitada.',
      'Gov.br: não devolva uma versão com uma única assinatura como arquivo final. O orientador reúne todas as assinaturas.',
    ],
  },
  {
    id: 'documentos', title: 'Conferir, assinar e baixar documentos', roles: ['aluno', 'orientador', 'examinador'], imageId: 'documentos',
    imageCaption: 'Documentos administrativos: comprovante, convite, ata, termo e declaração. Nos legados, o instrumento de avaliação aparece como sexto item.',
    steps: [
      'Abra Documentos administrativos. Cada caixa informa a disponibilidade, os responsáveis e as ações do documento. Comprovante e carta-convite não exigem assinatura.',
      'O orientador e os dois examinadores assinam a ata. Todos os autores e o orientador assinam o termo, se houver publicação autorizada. A declaração é assinada pela presidência da comissão.',
      'O responsável escolhe o método na caixa do documento. Prefira o Asten: solicite uma vez e siga o link recebido por e-mail. O Portal acompanha o retorno e o arquivamento; o envio do convite não significa que o documento foi assinado.',
      'Pelo Gov.br, cada participante assina o mesmo PDF. Na ata, o orientador reúne a própria assinatura e as dos dois examinadores; no termo, reúne as dos autores e a sua. O orientador devolve um PDF completo para cada documento.',
      'Use Ver e Baixar PDF quando disponíveis. A ata assinada e arquivada libera a entrega final. A conclusão do processo depende também da entrega e dos demais documentos obrigatórios.',
    ],
    done: 'O documento aparece assinado e arquivado, com as ações de consulta e download disponíveis.',
    help: [
      'Sem botão de assinatura: confira quem assina, seu vínculo e a condição exibida na caixa. Alunos não solicitam assinatura da ata.',
      'Solicitação Asten pendente: acompanhe o estado e o e-mail cadastrado; não crie outra solicitação para o mesmo documento.',
      'PDF devolvido pelo Gov.br: aguarde a conferência do Master. O envio isolado ainda não libera a próxima etapa.',
    ],
  },
  {
    id: 'assinatura-gov', title: 'Assinar e devolver pelo Gov.br', roles: ['aluno', 'orientador', 'examinador'], imageId: 'gov',
    imageCaption: 'Janela Gov.br com download e devolução. A conferência administrativa é uma etapa posterior.',
    steps: [
      'Em Documentos administrativos, abra Gov.br na caixa do documento. O orientador prepara a ata. Os examinadores podem baixar o PDF depois que ele for preparado. O orientador também pode preparar o termo, quando aplicável.',
      'Em 1. Baixar o documento, clique em Gerar e baixar PDF ou Baixar PDF para assinar. Use Abrir assinador Gov.br para assinar esse arquivo. Não o imprima nem gere outro PDF por cima dele.',
      'Na ata, orientador e dois examinadores devem assinar o mesmo PDF, que é devolvido pelo orientador. No termo, todos os autores e o orientador precisam assinar o mesmo PDF. O aluno encaminha sua assinatura ao orientador, que reúne o arquivo completo.',
      'O orientador usa 2. Devolver o documento assinado → Devolver PDF assinado e seleciona o PDF completo. O Portal aceita PDF de até 50 MB.',
      'O Master confere o arquivo no VALIDAR/ITI e registra a aprovação e o arquivamento. Até essa conferência, o documento permanece pendente.',
    ],
    done: 'Após a conferência e o arquivamento, a caixa do documento deixa de mostrar assinatura pendente.',
    help: [
      'Devolução indisponível: confirme se o PDF foi preparado e se está na conta responsável. Na ata e no termo, somente o orientador devolve o arquivo; o Master também pode intervir.',
      'Arquivo recusado: confira a versão do documento e as assinaturas exigidas. Preserve o original preparado pelo Portal.',
      'Para reduzir as etapas de download e devolução, prefira o Asten quando disponível.',
    ],
  },
  {
    id: 'repositorio', title: 'Entregar os arquivos e escolher o que será público', roles: ['aluno'], imageId: 'repositorio',
    imageCaption: 'Repositório acadêmico: PDF do TCC obrigatório, resumo expandido opcional e escolhas independentes de publicação.',
    relatedImages: [{id: 'entrega-confirmada', caption: 'Depois da entrega: campos bloqueados e Editar entrega disponível enquanto a etapa permitir.'}],
    steps: [
      'Depois de a ata assinada ser arquivada, abra Repositório acadêmico. Qualquer um dos autores pode realizar a entrega.',
      'Preencha o resumo síntese em até três parágrafos e 2.000 caracteres. Informe exatamente cinco palavras-chave, uma em cada campo.',
      'Clique em Escolher arquivo para anexar o PDF final do trabalho completo, obrigatório nos TCCs novos. O PDF do resumo expandido é opcional.',
      'Escolha separadamente se deseja tornar público o TCC e o resumo expandido. Anexar um arquivo não autoriza sua publicação. Sem nenhuma autorização, não haverá termo para assinar.',
      'Confira tudo e clique em Confirmar entrega e ir para documentos. Os campos ficam bloqueados. Havendo publicação autorizada, assinem o termo em Documentos administrativos.',
      'Se ainda permitido, Editar entrega reabre os dados e pode exigir novas assinaturas. Depois da assinatura da declaração ou da conclusão, essa opção deixa de estar disponível.',
    ],
    done: 'A entrega foi registrada. A continuidade está em Documentos administrativos; o encerramento depende dos documentos obrigatórios arquivados.',
    help: [
      'Entrega bloqueada: confira se a ata foi realmente assinada e arquivada. Escolher o método ou apenas devolver um PDF não conclui a assinatura.',
      'Publicação do resumo indisponível: anexe o resumo expandido antes de marcar sua publicação.',
      'Termo ausente: ele só é necessário quando algum arquivo foi escolhido para publicação.',
    ],
  },
  {
    id: 'consulta-publica', title: 'Consultar calendário e trabalhos publicados', roles: ['visitante'], imageId: 'calendario',
    imageCaption: 'Calendário público: confira o período e abra o código da defesa desejada.',
    steps: [
      'No menu lateral, clique em Calendário. Selecione o mês e o dia para conferir as defesas, horários e locais.',
      'Clique no código do TCC para abrir os detalhes públicos. Não é necessário entrar no Portal para consultar esses dados.',
      'Na ficha, confira Dados do processo, Conceito e Ata, Repositório acadêmico e Documentos administrativos. Somente as informações e os arquivos liberados ficam disponíveis.',
      'Para editar, registrar conceito ou assinar, entre com um e-mail vinculado ao processo. A consulta pública não libera essas ações.',
    ],
    done: 'Você localizou a defesa e consultou os dados públicos sem precisar entrar no Portal.',
    help: [
      'Defesa não aparece: confira os filtros e o período selecionado.',
      'Apareceu uma solicitação de login: feche a janela se quiser continuar apenas a consulta pública.',
    ],
  },
  {
    id: 'local-publico', title: 'Conferir data e local da defesa', roles: ['visitante'], imageId: 'calendario',
    imageCaption: 'Confira novamente o calendário antes de se deslocar: o agendamento pode ter sido alterado.',
    steps: [
      'No Calendário, selecione o período da defesa e abra o código do TCC.',
      'Confira a data, o horário e o local em Dados do processo. Use o comprovante disponível em Documentos administrativos para consultar o resultado da reserva.',
      'No menu Como chegar, consulte os mapas e as opções de rota. Para outro local, considere o endereço informado no processo.',
    ],
    done: 'Você sabe quando e onde a defesa ocorrerá.',
    help: ['Convite antigo com outra data: use as informações atualizadas no processo e no Calendário.'],
  },
  {
    id: 'repositorio-publico', title: 'Pesquisar o Repositório público', roles: ['visitante'], imageId: 'consulta-publica',
    imageCaption: 'Busca e filtros do Repositório. O ícone de resumo evita linhas extensas na tabela.',
    steps: [
      'No menu lateral, clique em Repositório. Abra a busca e digite título, autor ou outro dado do trabalho. A lista é filtrada enquanto você escreve, sem botão OK.',
      'Use os filtros e a paginação da tabela. Na coluna Resumo, passe o mouse sobre o ícone, use o foco do teclado ou toque no ícone no celular para ler o texto completo.',
      'Clique no código para abrir a mesma ficha do TCC em modo de consulta. E-mails, matrículas e registros não aparecem na ficha pública.',
      'Em Repositório acadêmico, abra os PDFs autorizados. A presença do trabalho na lista não torna todos os seus arquivos públicos.',
    ],
    done: 'Você localizou o trabalho, leu o resumo e acessou os arquivos liberados para publicação.',
    help: [
      'Poucos resultados: limpe a busca e confira os filtros.',
      'Sem link para PDF: o arquivo pode ser privado ou não ter sido entregue. A ausência do link não é um erro de acesso.',
    ],
  },
  {
    id: 'legados', title: 'Consultar trabalhos legados', roles: ['visitante'], imageId: 'legados',
    imageCaption: 'Exemplo histórico com dados fictícios, na mesma ficha e nas mesmas abas do restante do Portal.',
    steps: [
      'No mesmo Repositório, procure códigos como 001 - Legado. A numeração identifica os trabalhos antigos importados.',
      'Abra o código e consulte as mesmas abas dos demais TCCs. Dados ou arquivos ausentes na origem podem permanecer sem preenchimento. Um trabalho antigo pode ter apenas resumo expandido.',
      'O resumo síntese pode ser lido na tabela e na ficha. Os PDFs acadêmicos só ficam públicos com autorização confirmada. A documentação administrativa antiga permanece privada para consulta do Master; o instrumento de avaliação fica no sexto cartão de Documentos administrativos.',
      'O registro histórico não inicia outro cadastro, defesa ou assinatura. Não crie um novo processo para completar um trabalho antigo.',
    ],
    done: 'Você consultou os dados e os arquivos disponíveis do registro histórico.',
    help: ['Documento antigo restrito: a importação não autoriza a divulgação de dados pessoais ou de protocolos de assinatura presentes nos arquivos.'],
  },
  {
    id: 'sugestoes', title: 'Informar um problema ou sugerir melhoria', roles: ['aluno', 'orientador', 'examinador', 'visitante'], imageId: 'sugestoes',
    imageCaption: 'Sugestões fica na parte inferior do menu lateral e recebe relatos sobre o Portal.',
    steps: [
      'Na parte inferior do menu lateral, clique em Sugestões. O envio também está disponível sem login.',
      'Descreva em qual tela estava, o que tentou fazer e o que ocorreu. Informe o protocolo do TCC quando necessário; não inclua códigos de acesso ou credenciais.',
      'Se ajudar, anexe uma imagem PNG, JPEG ou WebP de até 1,5 MB. Remova dados pessoais que não sejam necessários para explicar o problema.',
      'Clique em Enviar sugestão e aguarde a confirmação. O Master acompanha os registros em Configurações → Sugestões.',
    ],
    done: 'O Portal confirmou o recebimento da sugestão. Marcar uma sugestão como revisada não significa que a alteração já foi implementada.',
    help: ['Erro ao enviar: mantenha o texto, confira o tamanho da imagem e tente novamente após a mensagem de erro. Sem confirmação, o envio não está concluído.'],
  },
];

export const guideActivityOrder: Record<GuideRole, string[]> = {
  aluno: ['acesso', 'cadastro', 'ficha', 'agenda', 'confirmacao', 'repositorio', 'documentos', 'assinatura-gov', 'sugestoes'],
  orientador: ['acesso', 'ficha', 'reserva-orientador', 'avaliacao', 'documentos', 'assinatura-gov', 'sugestoes'],
  examinador: ['acesso', 'ficha', 'assinatura-examinador', 'documentos', 'assinatura-gov', 'sugestoes'],
  visitante: ['consulta-publica', 'local-publico', 'repositorio-publico', 'legados', 'sugestoes'],
};

export function activitiesForRole(role: string): GuideActivity[] {
  if (!Object.hasOwn(guideActivityOrder, role)) return [];
  return guideActivityOrder[role as GuideRole].flatMap(id => guideActivities.filter(item => item.id === id && item.roles.includes(role as GuideRole)));
}

function GuideText({text}: {text: string}) {
  const parts = text.split('professor.ufes.br');
  return <>{parts.map((part, index) => <React.Fragment key={index}>{index > 0 && <a href="https://professor.ufes.br/" target="_blank" rel="noopener noreferrer" className="underline">professor.ufes.br</a>}{part}</React.Fragment>)}</>;
}

export function PortalIllustratedGuide({role = 'aluno'}: {role?: string}) {
  const available = activitiesForRole(role);
  const [selected, setSelected] = useState({role, id: ''});
  const selectedId = selected.role === role ? selected.id : '';
  const current = available.find(item => item.id === selectedId) || available[0];
  if (!current) return null;
  const imageUrl = `/manual/${current.imageId}.jpg?v=2026-11-05-revisao`;
  const index = available.indexOf(current);
  const selectScreen = (next: number) => {
    if (available[next]) setSelected({role, id: available[next].id});
  };

  return (
    <section className="portal-illustrated-guide" aria-label="Manual ilustrado">
      <div id={`guide-panel-${role}`} role="region" aria-labelledby={`guide-activity-title-${role}`} className="portal-guide-sheet" data-guide-activity={current.id}>
        <div className="portal-guide-screen-nav flex items-center justify-between gap-3" role="group" aria-label="Navegação das telas" onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? available.length - 1 : -1;
          if (next < 0 || next >= available.length) return;
          event.preventDefault();
          selectScreen(next);
        }}>
          <button type="button" className="portal-action portal-guide-screen-arrow" aria-label="Tela anterior" aria-controls={`guide-panel-${role}`} title="Tela anterior" disabled={index === 0} onClick={() => selectScreen(index - 1)}><ChevronLeft className="h-5 w-5" aria-hidden="true"/></button>
          <h2 id={`guide-activity-title-${role}`} className="portal-guide-screen-title text-center text-base font-bold" aria-live="polite" aria-atomic="true">{current.title} — {index + 1}/{available.length}</h2>
          <button type="button" className="portal-action portal-guide-screen-arrow" aria-label="Próxima tela" aria-controls={`guide-panel-${role}`} title="Próxima tela" disabled={index === available.length - 1} onClick={() => selectScreen(index + 1)}><ChevronRight className="h-5 w-5" aria-hidden="true"/></button>
        </div>
        <div className="portal-guide-content mt-3">
          <div className="portal-guide-instructions min-w-0">
            <ol className="my-0 list-decimal space-y-2 pl-5 text-sm leading-6 sm:text-base">{current.steps.map(step => <li key={step}><GuideText text={step} /></li>)}</ol>
            <p className="portal-guide-result mt-3 text-xs leading-5"><strong>Como saber que terminou:</strong> {current.done}</p>
            <details key={`${role}-${current.id}`} className="portal-guide-help mt-3 text-xs leading-5">
              <summary className="cursor-pointer font-semibold">Dúvidas desta atividade</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">{current.help.map(item => <li key={item}>{item}</li>)}</ul>
            </details>
          </div>
          <figure className="portal-guide-figure m-0 min-w-0 w-full">
            <a href={imageUrl} target="_blank" rel="noreferrer" aria-label={`Ampliar imagem: ${current.title}`} className="portal-guide-image-link">
              <img src={imageUrl} alt={current.imageCaption} loading="lazy" className="portal-guide-image" />
            </a>
            <figcaption className="mt-2 text-xs leading-5 text-slate-600">{current.imageCaption} <a className="inline-flex items-center gap-1 underline" href={imageUrl} target="_blank" rel="noreferrer">Abrir imagem em tamanho maior<ExternalLink className="h-3 w-3" aria-hidden="true" /></a></figcaption>
          </figure>
        </div>
        {current.relatedImages?.map(related => {
          const url = `/manual/${related.id}.jpg?v=2026-11-05-revisao`;
          return <details key={related.id} className="portal-guide-related mt-3">
            <summary className="cursor-pointer text-xs font-semibold">Ver exemplo: {related.caption}</summary>
            <a href={url} target="_blank" rel="noreferrer" className="portal-guide-image-link mt-3" aria-label={`Ampliar imagem: ${related.caption}`}><img src={url} alt={related.caption} loading="lazy" className="portal-guide-image" /></a>
          </details>;
        })}
      </div>
    </section>
  );
}
