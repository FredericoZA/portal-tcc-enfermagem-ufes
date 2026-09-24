import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, HelpCircle, UserCheck } from 'lucide-react';
import { PortalSectionDivider } from '../components/PortalSectionDivider';

interface PortalTutorialPageProps {
  onNavigate: (tab: string) => void;
}

type Role = 'aluno' | 'orientador' | 'presidente' | 'visitante';

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
      'Tenha o título do trabalho, os dados do orientador e do coorientador quando houver, a composição prevista da banca e uma proposta de data e horário.',
      'Confirme os nomes completos antes de cadastrar: esses dados serão reutilizados nos documentos gerados pelo Portal.',
    ],
    steps: [
      { title: '1. Entrar no processo correto', text: 'Acesse com seu e-mail e confira se o Portal reconheceu o trabalho ao qual você está vinculado. Não crie um segundo processo para corrigir um cadastro já existente.' },
      { title: '2. Fazer o cadastro inicial', text: 'Informe autoria, título, orientador, coorientador quando houver, banca e data/horário pretendidos. Revise grafia, acentuação e ordem dos nomes antes de concluir.' },
      { title: '3. Solicitar e confirmar o local', text: 'A reserva da sala ou auditório ocorre conforme a rotina do Departamento. Depois de receber a confirmação, volte ao processo e registre somente o local efetivamente reservado.' },
      { title: '4. Conferir a divulgação da defesa', text: 'Depois da confirmação de data, horário e local, confira como a apresentação aparece no calendário público. Havendo divergência, solicite a correção antes da defesa.' },
      { title: '5. Acompanhar a situação da banca', text: 'Verifique se orientador, coorientador e membros avaliadores estão corretamente identificados. Alterações de banca devem ser resolvidas antes da geração final dos documentos.' },
      { title: '6. Aguardar o registro da defesa', text: 'Após a apresentação, o orientador registra o resultado e o parecer. O aluno não deve avançar para a entrega final usando informações provisórias ou antes da liberação da etapa seguinte.' },
      { title: '7. Enviar a versão final', text: 'Anexe o arquivo final exigido e preencha os metadados do trabalho, incluindo palavras-chave, resumo sintético e resumo expandido quando aplicável.' },
      { title: '8. Definir as autorizações de publicação', text: 'Escolha separadamente o que poderá ser disponibilizado. Quando houver Termo de autorização, confira o documento antes de encaminhá-lo para assinatura.' },
      { title: '9. Conferir o encerramento', text: 'Antes de considerar sua participação concluída, verifique se a entrega final foi registrada, se não há pendências de assinatura e se as opções de publicação aparecem corretamente no processo.' },
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
      'Registrar sala ou auditório antes da confirmação do Departamento.',
      'Enviar versão preliminar como trabalho final.',
      'Concluir a autorização de publicação sem conferir o documento gerado.',
    ],
    finish: 'A participação principal do aluno termina quando a entrega final, os metadados e as autorizações exigidas estão registrados e não há pendência atribuída ao estudante.',
  },
  orientador: {
    title: 'Orientador',
    description: 'Use esta visão para conferir os dados acadêmicos da defesa, registrar o resultado e validar os documentos que dependem da orientação.',
    before: [
      'Entre com o mesmo e-mail informado no cadastro do TCC.',
      'Confirme que o processo exibido corresponde ao trabalho e aos estudantes corretos.',
      'Antes da avaliação, confira título, autoria, banca, data, horário e local da apresentação.',
    ],
    steps: [
      { title: '1. Localizar o TCC', text: 'Abra o processo pelo vínculo associado ao seu e-mail. Caso o trabalho não apareça, verifique se o endereço cadastrado pelo aluno é exatamente o utilizado no acesso.' },
      { title: '2. Conferir os dados acadêmicos', text: 'Revise título, nomes dos estudantes, composição da banca e demais informações que serão reutilizadas na Ata e nas declarações.' },
      { title: '3. Corrigir divergências antes da avaliação', text: 'Se houver informação incorreta e a etapa ainda permitir ajuste, corrija antes de concluir a avaliação. Isso evita documentos inconsistentes e retrabalho posterior.' },
      { title: '4. Registrar o resultado da banca', text: 'Após a defesa, selecione o resultado previsto no fluxo e registre o parecer final. O Portal não utiliza nota numérica quando essa informação não faz parte da regra do curso.' },
      { title: '5. Revisar a prévia da Ata', text: 'Confira nomes, funções dos membros, data, horário, local e resultado antes de iniciar qualquer processo de assinatura.' },
      { title: '6. Encaminhar a assinatura', text: 'Use a modalidade de assinatura disponível no Portal. Quando houver mais de um provedor habilitado, eles funcionam como alternativas independentes.' },
      { title: '7. Acompanhar pendências', text: 'Se uma assinatura falhar ou ficar incompleta, retome o processo somente depois de identificar a pendência. Não gere versões duplicadas sem necessidade.' },
      { title: '8. Conferir a etapa de entrega final', text: 'Depois da avaliação, acompanhe se o aluno conseguiu avançar para a entrega final e se o fluxo permanece coerente com o resultado registrado.' },
      { title: '9. Encerrar sua participação', text: 'Considere sua etapa concluída apenas quando avaliação, parecer e documentação sob sua responsabilidade estiverem corretamente registrados.' },
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
    finish: 'A participação principal do orientador termina quando o resultado foi registrado, a documentação correspondente foi conferida e as assinaturas sob sua responsabilidade foram encaminhadas ou concluídas.',
  },
  presidente: {
    title: 'Presidente da Comissão',
    description: 'Use esta visão para acompanhar pendências administrativas, conferir documentos finais e garantir que cada TCC percorra o fluxo previsto antes do encerramento.',
    before: [
      'Acesse com o e-mail vinculado à função de Presidente da Comissão.',
      'Use a área administrativa para identificar processos parados e a etapa em que cada pendência se encontra.',
      'Antes de intervir, verifique se a pendência pertence ao aluno, orientador, banca, assinatura, integração ou administração.',
    ],
    steps: [
      { title: '1. Acompanhar o painel de processos', text: 'Priorize processos com pendências reais e verifique qual requisito ainda impede a progressão. Evite refazer etapas que já foram concluídas corretamente.' },
      { title: '2. Conferir o histórico do processo', text: 'Use os registros existentes para entender o que já foi enviado, confirmado, assinado ou corrigido antes de executar nova ação administrativa.' },
      { title: '3. Validar documentos finais', text: 'Antes de encaminhar documentos da Comissão, confira título, autoria, banca, data, local e resultado da defesa.' },
      { title: '4. Tratar pendências de assinatura', text: 'Identifique se a falha está na geração, no envio, no provedor de assinatura ou na ausência de um signatário. Corrija a causa antes de reenviar.' },
      { title: '5. Conferir a declaração da banca', text: 'Quando disponível, revise a declaração de participação e confirme se os membros e suas funções correspondem ao processo.' },
      { title: '6. Verificar entrega e publicação', text: 'Confirme se a versão final e os metadados foram enviados e se as autorizações de publicação foram registradas quando necessárias.' },
      { title: '7. Acompanhar integrações', text: 'Quando houver sincronização com Drive, Docs, Gmail, Calendar ou outro serviço, diferencie falha de integração de pendência acadêmica para evitar ações incorretas.' },
      { title: '8. Liberar o encerramento', text: 'O processo só deve ser considerado apto à conclusão quando as entregas, documentos e assinaturas exigidas para aquele TCC estiverem resolvidas.' },
      { title: '9. Preservar rastreabilidade', text: 'Use o histórico e os registros do Portal como referência administrativa. Evite correções fora do fluxo quando houver uma ação própria do sistema para a mesma finalidade.' },
    ],
    checklist: [
      'Etapa e responsável pela pendência identificados.',
      'Documentos finais conferidos.',
      'Assinaturas necessárias resolvidas.',
      'Entrega final e publicação verificadas.',
      'Processo apto ao encerramento sem pendências remanescentes.',
    ],
    mistakes: [
      'Refazer uma etapa já concluída sem investigar a causa do problema.',
      'Tratar falha de integração como se fosse pendência acadêmica.',
      'Encerrar processo com assinatura ou documento obrigatório pendente.',
      'Alterar dados históricos sem necessidade administrativa comprovada.',
    ],
    finish: 'A atuação administrativa sobre um TCC termina quando o processo está íntegro, sem pendências obrigatórias e apto à conclusão conforme as regras configuradas no Portal.',
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
      { title: '5. Abrir os detalhes do TCC', text: 'Quando a visualização pública estiver habilitada, use o número do processo para consultar os dados disponibilizados daquele trabalho.' },
      { title: '6. Acessar arquivos autorizados', text: 'Somente documentos liberados para publicação devem aparecer no repositório. A ausência de arquivo não significa necessariamente ausência do documento no processo interno.' },
      { title: '7. Usar a página Como chegar', text: 'Consulte as opções de mapa e rota para chegar ao Departamento ou aos locais indicados para as apresentações.' },
      { title: '8. Diferenciar área pública e área restrita', text: 'Recursos administrativos, documentos internos e ações de participantes exigem acesso autenticado e não fazem parte da navegação do visitante.' },
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
    <div id="portal-tutorial-page" className="portal-public-shell mx-auto max-w-none overflow-hidden rounded-2xl border border-slate-300 bg-[#e1e6e9] shadow-sm">
      <section className="portal-public-header bg-[#005830] text-white">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white shadow-2xs" aria-hidden="true">
            <HelpCircle className="h-4 w-4 text-slate-700" />
          </span>
          <h1 className="text-base font-black uppercase tracking-tight text-white sm:text-lg">Como usar o Portal de TCC</h1>
        </div>

        <div className="portal-tutorial-filter-row border-t-2 border-white px-3 py-2 sm:px-4 flex flex-wrap items-center gap-2 text-xs min-w-0 w-full">
          <span className="text-[10px] opacity-80 font-black uppercase tracking-wider shrink-0">Filtrar visão:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(Object.keys(roleContent) as Role[]).map((key) => {
              const selected = role === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRole(key)}
                  data-selected={selected ? 'true' : 'false'}
                  className={`portal-table-filter-chip inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide cursor-pointer border select-none ${selected ? 'shadow-xs scale-[1.02]' : 'opacity-85'}`}
                >
                  <span>{roleContent[key].title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
      <PortalSectionDivider />

      <section className="portal-layer-panel bg-[#e1e6e9] p-3 sm:p-4">
        <div className="portal-layer-card flex items-start gap-3 rounded-2xl border border-slate-300 bg-[#d5dce0] p-3.5 shadow-2xs sm:p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#337959] text-white shadow-sm"><UserCheck className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#337959]">Visão selecionada</div>
            <h2 className="mt-0.5 text-lg font-black text-slate-950">{active.title}</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-700">{active.description}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[0.9fr_2.1fr]">
          <aside className="space-y-3">
            <section className="portal-layer-card rounded-xl border border-slate-300 bg-[#d5dce0] p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-900">
                <ClipboardCheck className="h-4 w-4 text-[#337959]" />Antes de começar
              </div>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-700">
                {active.before.map((item) => <li key={item} className="flex gap-2"><span className="font-black text-[#337959]">•</span><span>{item}</span></li>)}
              </ul>
            </section>

            <section className="portal-layer-card rounded-xl border border-slate-300 bg-[#d5dce0] p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-[#337959]" />Conferência antes de encerrar
              </div>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-700">
                {active.checklist.map((item) => <li key={item} className="flex gap-2"><span className="font-black text-[#337959]">✓</span><span>{item}</span></li>)}
              </ul>
            </section>

            <section className="portal-layer-card rounded-xl border border-slate-300 bg-[#d5dce0] p-3.5 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-900">
                <AlertTriangle className="h-4 w-4 text-[#337959]" />Erros a evitar
              </div>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-700">
                {active.mistakes.map((item) => <li key={item} className="flex gap-2"><span className="font-black text-slate-500">—</span><span>{item}</span></li>)}
              </ul>
            </section>
          </aside>

          <div>
            <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-900">Passo a passo</h3>
            <ol className="grid gap-2.5 lg:grid-cols-2">
              {active.steps.map((step, index) => (
                <li key={step.title} className="portal-layer-card flex h-full gap-3 rounded-xl border border-slate-300 bg-[#d5dce0] px-3.5 py-3 text-sm leading-5 text-slate-700 shadow-2xs">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#337959] text-[10px] font-black text-white">{index + 1}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-950">{step.title.replace(/^\d+\.\s*/, '')}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-700">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div id="portal-tutorial-finish-card" className="portal-layer-card mt-3 rounded-xl border border-[#9fb8a8] bg-white/80 px-4 py-3 shadow-2xs">
              <div className="text-xs font-black uppercase tracking-wide text-slate-900">Quando esta participação termina</div>
              <p className="mt-1.5 text-xs leading-5 text-slate-700">{active.finish}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
