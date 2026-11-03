import {PortalIllustratedGuide} from '../components/PortalIllustratedGuide';
import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, UserCheck } from 'lucide-react';
import { PortalSectionDivider } from '../components/PortalSectionDivider';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';

interface PortalTutorialPageProps {
  onNavigate: (tab: string) => void;
}

type Role = 'aluno' | 'orientador' | 'visitante';

type GuideStep = {
  title: string;
  text: string;
};

type RoleGuide = {
  title: string;
  description: string;
  before: string[];
  steps: GuideStep[];
  checklist: string[];
  mistakes: string[];
  finish: string;
};

const roleContent: Record<Role, RoleGuide> = {
  aluno: {
    title: 'Aluno',
    description: 'Use esta visão para acompanhar tudo o que depende do estudante, desde o cadastro do trabalho até a entrega final e as autorizações de publicação.',
    before: [
      'Acesse o Portal com o mesmo e-mail previamente autorizado para o curso.',
      'Planeje a data e o local com o orientador: consulte o mapa de salas e considere aulas, eventos, reservas e horários de uso do prédio. Se necessário, consultem o Departamento de Enfermagem. Tenha também os dados do trabalho e dos participantes.',
      'Confirme os nomes completos antes de cadastrar: esses dados serão reutilizados nos documentos gerados pelo Portal.',
    ],
    steps: [
      { title: '1. Entrar no Portal', text: 'Entre com o e-mail cadastrado e autorizado no Portal. Se já houver um TCC vinculado ao seu acesso, abra esse processo em Meus TCCs. Não crie um segundo processo para corrigir um cadastro já existente.' },
      { title: '2. Fazer o cadastro inicial', text: 'Informe autoria, título, orientador, coorientador quando houver, banca e data/horário pretendidos. A ordem dos autores no cadastro será mantida nos documentos. Selecione como os autores serão chamados e o tratamento e a titulação de cada docente. Confira os nomes, inclusive o nome social quando utilizado.' },
      { title: '3. Acompanhar a reserva do local', text: 'Considere o mapa de salas, as aulas, os eventos, as reservas e o funcionamento do prédio; a consulta prévia ao departamento pode evitar retrabalho. Escolha auditório, sala de reuniões ou informe outro local. O departamento homologa os dois espaços que gerencia; outro local é confirmado pelo orientador. O responsável aceita ou recusa a data, o horário e o local solicitados. A resposta e o comprovante são registrados automaticamente; os autores e o orientador recebem o resultado por e-mail. Cada defesa ocupa 1 hora e 30 minutos. Para mudar o agendamento, use Alterar reserva em Dados do processo. Após uma recusa, use Solicitar nova data. O novo pedido exige outro aceite; alterações ficam bloqueadas após o registro da avaliação.' },
      { title: '4. Conferir a divulgação da defesa', text: 'Depois da confirmação de data, horário e local, confira como a apresentação aparece no calendário público. Havendo divergência, solicite a correção antes da defesa.' },
      { title: '5. Acompanhar a situação da banca', text: 'Verifique se orientador, coorientador e membros avaliadores estão corretamente identificados. Alterações de banca devem ser resolvidas antes da geração final dos documentos.' },
      { title: '6. Aguardar o registro da defesa', text: 'Após a defesa, o orientador registra o conceito e o parecer em Avaliação e ata. A assinatura é solicitada em Documentos administrativos. A entrega final só é liberada depois de a ata assinada ser arquivada.' },
      { title: '7. Enviar a versão final', text: 'Em Repositório acadêmico, preencha o resumo, as cinco palavras-chave e anexe o PDF final do TCC, que é obrigatório. O resumo expandido é opcional. Qualquer autor pode confirmar a entrega pelo botão Confirmar entrega e ir para documentos.' },
      { title: '8. Definir as autorizações de publicação', text: 'Escolha separadamente a publicação do trabalho completo e do resumo expandido. Se nenhuma publicação for autorizada, não haverá termo para assinar. Caso contrário, o termo fica em Documentos administrativos, onde se escolhe Asten ou Gov.br. Todos os autores e o orientador assinam o mesmo documento. Pelo Gov.br, somente o orientador devolve o PDF com todas as assinaturas.' },
      { title: '9. Conferir o encerramento', text: 'Após a entrega, os campos ficam bloqueados. Editar entrega permite corrigir enquanto a etapa estiver aberta e pode exigir novas assinaturas. A opção desaparece após a assinatura da declaração ou a conclusão. Acompanhe os documentos até o aviso final.' },
    ],
    checklist: [
      'Título e autoria conferidos.',
      'Orientador, coorientador e banca corretos.',
      'Data, horário e local confirmados.',
      'Arquivo final e metadados enviados.',
      'Autorizações de publicação registradas quando aplicáveis.',
    ],
    mistakes: [
      'Criar outro processo para corrigir um dado do processo existente.',
      'Tratar o local solicitado como confirmado antes do aceite do departamento ou do orientador, conforme o espaço escolhido.',
      'Enviar versão preliminar como trabalho final.',
      'Concluir a autorização de publicação sem conferir o documento gerado.',
    ],
    finish: 'A participação principal do aluno termina quando a entrega final, os metadados e as autorizações exigidas estão registrados e não há pendência atribuída ao estudante.',
  },
  orientador: {
    title: 'Orientador',
    description: 'Use esta visão para conferir os dados acadêmicos da defesa, registrar o resultado e validar os documentos que dependem do orientador.',
    before: [
      'Planeje com os alunos a data e o local considerando o mapa de salas, aulas, eventos, reservas e horários de uso do prédio. Se necessário, consultem o departamento antes do pedido.',
      'Entre com o mesmo e-mail informado no cadastro do TCC.',
      'Confirme que o processo exibido corresponde ao trabalho e aos estudantes corretos.',
      'Antes da avaliação, confira título, autoria, banca, data, horário e local da apresentação.',
    ],
    steps: [
      { title: '1. Localizar o TCC', text: 'Abra o processo pelo vínculo associado ao seu e-mail. Caso o trabalho não apareça, verifique se o endereço cadastrado pelo aluno é exatamente o utilizado no acesso.' },
      { title: '2. Conferir os dados acadêmicos', text: 'Revise título, nomes dos estudantes, composição da banca e demais informações que serão reutilizadas na Ata e nas declarações.' },
      { title: '3. Corrigir divergências antes da avaliação', text: 'Se houver informação incorreta e a etapa ainda permitir ajuste, corrija antes de concluir a avaliação. Isso evita documentos inconsistentes e retrabalho posterior.' },
      { title: '4. Registrar o resultado da banca', text: 'A partir do horário da defesa, com local confirmado e convite enviado, registre Aprovado, Aprovado com ressalva ou Reprovado e o parecer. O Portal TCC registra o conceito e a documentação; faça a avaliação e lance a nota no Portal do Professor (professor.ufes.br).' },
      { title: '5. Revisar a prévia da Ata', text: 'Confira nomes, funções dos membros, data, horário, local e resultado antes de iniciar qualquer processo de assinatura.' },
      { title: '6. Encaminhar a assinatura', text: 'Na prévia, confirme a conferência e clique em Registrar avaliação e ir para documentos. Em Documentos administrativos, na caixa da ata, escolha Asten ou Gov.br. Somente o orientador assina. Pelo Gov.br, baixe e devolva o PDF na janela do documento; o envio ainda depende da conferência administrativa para arquivamento.' },
      { title: '7. Acompanhar pendências', text: 'Se uma assinatura falhar ou ficar incompleta, retome o processo somente depois de identificar a pendência. Não gere versões duplicadas sem necessidade.' },
      { title: '8. Conferir a etapa de entrega final', text: 'A entrega final é liberada após o arquivamento da ata assinada. Acompanhe a entrega pelos autores e assine o termo somente se houver autorização de publicação. Pelo Asten, todos assinam no mesmo nível. Pelo Gov.br, reúna a sua assinatura e a de cada autor no mesmo PDF e devolva o arquivo completo pelo Portal.' },
      { title: '9. Encerrar sua participação', text: 'Reabrir avaliação fica disponível ao orientador e ao Master somente antes da entrega final. Depois da entrega, a avaliação não pode ser reaberta. Acompanhe as assinaturas em Documentos administrativos.' },
    ],
    checklist: [
      'Processo e estudantes corretos.',
      'Banca, data e local conferidos.',
      'Resultado e parecer registrados.',
      'Ata revisada antes da assinatura.',
      'Pendências de assinatura acompanhadas.',
    ],
    mistakes: [
      'Finalizar a avaliação antes de corrigir divergências conhecidas.',
      'Assinar documento sem conferir a prévia.',
      'Criar documento duplicado para contornar falha de assinatura.',
      'Usar outro e-mail e perder o vínculo com o processo correto.',
    ],
    finish: 'A participação principal do orientador termina quando o resultado foi registrado, a documentação correspondente foi conferida e as assinaturas sob sua responsabilidade foram concluídas e os documentos foram arquivados.',
  },
  visitante: {
    title: 'Visitante',
    description: 'Use esta visão para consultar informações públicas sem entrar na área restrita do Portal.',
    before: [
      'Nenhum login é necessário para consultar as páginas públicas.',
      'As informações exibidas respeitam o que foi preparado para divulgação externa.',
      'Dados e documentos internos do processo não ficam disponíveis apenas por existirem no sistema.',
    ],
    steps: [
      { title: '1. Consultar o calendário', text: 'Use o calendário para localizar as defesas divulgadas pelo curso por mês e por data.' },
      { title: '2. Abrir as defesas do dia', text: 'Clique em um dia que contenha apresentações para visualizar, no próprio Portal, todas as defesas públicas registradas naquela data.' },
      { title: '3. Conferir horário e local', text: 'Antes de se deslocar, confira o horário e o local apresentados no calendário. Alterações administrativas podem atualizar essas informações.' },
      { title: '4. Consultar o repositório', text: 'Pesquise trabalhos concluídos usando os campos e filtros disponíveis no acervo público.' },
      { title: '5. Abrir os detalhes do TCC', text: 'Clique no número do TCC para abrir a ficha pública. Se aparecer o login, você pode fechá-lo e continuar a consulta. Participantes vinculados podem entrar para acessar a área restrita.' },
      { title: '6. Acessar arquivos autorizados', text: 'Em Documentos administrativos, consulte o comprovante de reserva, o convite emitido e os documentos assinados liberados para consulta pública. O termo aparece quando aplicável. Trabalho completo e resumo expandido exigem autorização de publicação própria; e-mails, matrículas e registros permanecem restritos.' },
      { title: '7. Usar a página Como chegar', text: 'Consulte as opções de mapa e rota para chegar ao Departamento ou aos locais indicados para as apresentações.' },
      { title: '8. Diferenciar área pública e área restrita', text: 'Recursos administrativos, documentos internos e ações de participantes exigem acesso autenticado e não fazem parte da navegação do visitante.' },
      { title: '9. Consultar trabalhos legados', text: 'Os códigos como 001 - Legado identificam trabalhos antigos no mesmo Repositório. Eles não passam novamente pelo fluxo de cadastro, defesa ou assinatura. Os arquivos acadêmicos só aparecem com autorização confirmada; a documentação administrativa antiga permanece privada para consulta do Master.' },
    ],
    checklist: [
      'Data da defesa conferida.',
      'Horário e local conferidos.',
      'Trabalho localizado no repositório quando publicado.',
      'Arquivo acessado somente quando autorizado para divulgação.',
    ],
    mistakes: [
      'Usar informação antiga de convite sem conferir o calendário atualizado.',
      'Interpretar ausência de arquivo público como ausência de documento interno.',
      'Tentar usar a área restrita sem possuir vínculo com o processo.',
    ],
    finish: 'Para o visitante, a consulta termina quando as informações públicas necessárias foram localizadas no calendário, no repositório ou na página Como chegar.',
  },
};

export const PortalTutorialPage: React.FC<PortalTutorialPageProps> = ({ onNavigate }) => {
  void onNavigate;
  const [role, setRole] = useState<Role>('aluno');
  const active = useMemo(() => roleContent[role], [role]);

  return (
    <div id="portal-tutorial-page" className="portal-public-shell portal-layer-panel mx-auto max-w-none overflow-hidden rounded-2xl border border-slate-300 shadow-sm">
      <section className="portal-public-header text-white">
        <div className="portal-public-title-row gap-2">
          <ColorfulHeaderIcon type="tutorial" />
          <h1 className="text-base font-black normal-case tracking-tight text-white sm:text-lg">Como usar o Portal de TCC</h1>
        </div>

        <div className="portal-public-filter-row portal-tutorial-filter-row flex-wrap gap-2 text-xs min-w-0">
          <span className="portal-filter-label opacity-80 shrink-0">Filtrar:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(Object.keys(roleContent) as Role[]).map((key) => {
              const selected = role === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRole(key)}
                  data-selected={selected ? 'true' : 'false'}
                  aria-pressed={selected}
                  className="portal-standard-filter-chip portal-table-filter-chip cursor-pointer select-none"
                >
                  <span>{roleContent[key].title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <PortalSectionDivider />

      <section className="portal-layer-panel p-3 sm:p-4">
        <div className="portal-layer-card flex items-start gap-3 rounded-2xl border border-slate-300 p-3.5 shadow-2xs sm:p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--portal-brand-action)] text-white shadow-sm"><UserCheck className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div className="text-[9px] font-black normal-case tracking-[0.16em] text-[var(--portal-brand-action)]">Visão selecionada</div>
            <h2 className="mt-0.5 text-lg font-black text-slate-950">{active.title}</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-700">{active.description}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[0.9fr_2.1fr]">
          <aside className="space-y-3">
            <section className="portal-layer-card rounded-xl border border-slate-300 p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-black normal-case tracking-wide text-slate-900">
                <ClipboardCheck className="h-4 w-4 text-[var(--portal-brand-action)]" />Antes de começar
              </div>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-700">
                {active.before.map((item) => <li key={item} className="flex gap-2"><span className="font-black text-[var(--portal-brand-action)]">•</span><span>{item}</span></li>)}
              </ul>
            </section>

            <section className="portal-layer-card rounded-xl border border-slate-300 p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-black normal-case tracking-wide text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-[var(--portal-brand-action)]" />Conferência antes de encerrar
              </div>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-700">
                {active.checklist.map((item) => <li key={item} className="flex gap-2"><span className="font-black text-[var(--portal-brand-action)]">✓</span><span>{item}</span></li>)}
              </ul>
            </section>

            <section className="portal-layer-card rounded-xl border border-slate-300 p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-black normal-case tracking-wide text-slate-900">
                <AlertTriangle className="h-4 w-4 text-[var(--portal-brand-action)]" />Erros a evitar
              </div>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-700">
                {active.mistakes.map((item) => <li key={item} className="flex gap-2"><span className="font-black text-slate-500">—</span><span>{item}</span></li>)}
              </ul>
            </section>
          </aside>

          <div>
            <h3 className="mb-2 text-xs font-black normal-case tracking-wide text-slate-900">Passo a passo</h3>
            <ol className="grid gap-2.5 lg:grid-cols-2">
              {active.steps.map((step, index) => (
                <li key={step.title} className="portal-layer-card flex h-full gap-3 rounded-xl border border-slate-300 px-3.5 py-3 text-sm leading-5 text-slate-700 shadow-2xs">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--portal-brand-action)] text-[10px] font-black text-white">{index + 1}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-950">{step.title.replace(/^\d+\.\s*/, '')}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-700">{step.text}</p>
                  </div>
                </li>
              ))}
              <li id="portal-tutorial-finish-card" className={`portal-layer-card rounded-xl border border-slate-300 px-3.5 py-3 shadow-2xs ${active.steps.length % 2 === 0 ? 'lg:col-span-2' : ''}`}>
              <div className="text-xs font-black normal-case tracking-wide text-slate-900">Quando esta participação termina</div>
              <p className="mt-1.5 text-xs leading-5 text-slate-700">{active.finish}</p>
              </li>
            </ol>
          </div>
        </div>
        <PortalIllustratedGuide role={role}/>
      </section>
    </div>
  );
};
