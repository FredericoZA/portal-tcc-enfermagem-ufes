import React from 'react';
import {
  BookOpenCheck,
  CalendarCheck,
  CheckCircle2,
  FileSignature,
  GraduationCap,
  SearchCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';
import { PortalSectionDivider } from '../components/PortalSectionDivider';
import { SignatureFlowSummary } from '../components/SignatureFlowSummary';

const phases = [
  {
    n: 1,
    title: 'Cadastro inicial',
    actor: 'Aluno',
    icon: GraduationCap,
    summary: 'O aluno cria o processo e registra os dados acadêmicos que serão reutilizados nas etapas seguintes.',
    details: [
      'Antes do pedido, alunos e orientador podem consultar o mapa de salas e considerar aulas, eventos, reservas e horários de uso do prédio. Se necessário, podem consultar o departamento para evitar retrabalho. A reserva do auditório ou da sala de reuniões depende de homologação do departamento.',
      'Informa título, autoria e os vínculos do orientador e do coorientador quando houver.',
      'A ordem dos autores no cadastro será mantida nos documentos. Seleciona a forma de referência aos autores e o tratamento e a titulação de cada docente; confere os nomes, incluindo o nome social quando utilizado.',
      'Registra a composição prevista da banca e a proposta de data e horário da defesa.',
      'Confere grafia, acentuação e identificação das pessoas antes de concluir o cadastro.',
      'O Portal cria um único processo que passa a concentrar documentos, confirmações e histórico do TCC.',
    ],
    gate: 'Cadastro salvo com os dados mínimos exigidos e participantes corretamente vinculados.',
    result: 'Processo criado e disponível para a confirmação do local.',
  },
  {
    n: 2,
    title: 'Confirmação do local',
    actor: 'Departamento ou orientador',
    icon: CalendarCheck,
    summary: 'O departamento ou o orientador confirma o agendamento, conforme o local escolhido.',
    details: [
      'Auditório e sala de reuniões são usados também para aulas e eventos. Alunos e orientador podem consultar o mapa de salas, as reservas e o funcionamento do prédio; se necessário, podem consultar o departamento para evitar retrabalho.',
      'O aluno escolhe um único local. Para auditório ou sala de reuniões, o departamento aceita ou recusa o agendamento por e-mail. Para outro local, informado pelo aluno, a confirmação é feita pelo orientador. O Portal registra a resposta, gera o comprovante e avisa os autores e o orientador.',
      'O envio do pedido bloqueia apenas o local escolhido no intervalo da defesa (1h30). O aceite confirma a reserva; a recusa libera o intervalo. Defesas simultâneas são permitidas em espaços diferentes, sem sobreposição no mesmo espaço.',
      'Em Dados do processo, use Alterar reserva; após uma recusa, use Solicitar nova data. O novo pedido invalida a confirmação anterior e exige novo aceite. Esse controle não verifica reservas externas ao Portal.',
    ],
    gate: 'Data, horário e local precisam representar exatamente a reserva confirmada.',
    result: 'Defesa com data, horário e local consolidados no processo.',
  },
  {
    n: 3,
    title: 'Convite e calendário',
    actor: 'Portal',
    icon: Users,
    summary: 'Com as informações confirmadas, o Portal prepara a divulgação pública e os dados necessários para a comunicação da banca.',
    details: [
      'A defesa passa a aparecer no calendário público do curso dentro da data cadastrada.',
      'O calendário apresenta as informações públicas previstas, preservando dados internos do processo.',
      'O Portal envia o convite aos examinadores e ao coorientador, quando houver, com autores e orientador em cópia. O botão abre Documentos administrativos. O login permite acessar os recursos do participante; o visitante pode fechar essa janela e consultar os dados públicos; a carta-convite é consultada e baixada no Portal, sem anexos por e-mail.',
      'Qualquer divergência deve ser corrigida no processo de origem para evitar documentos e comunicações diferentes entre si.',
    ],
    gate: 'Informações da defesa conferidas e aptas para divulgação.',
    result: 'Defesa publicada no calendário e convite encaminhado aos examinadores e ao coorientador, quando houver.',
  },
  {
    n: 4,
    title: 'Defesa e Ata',
    actor: 'Orientador',
    icon: SearchCheck,
    summary: 'Depois da apresentação, o orientador registra o resultado e valida os dados que irão compor a Ata.',
    details: [
      'O orientador confere novamente autoria, título, banca, data, horário e local antes da avaliação.',
      'Com o local confirmado e o convite enviado, o registro é liberado a partir do horário da defesa: Aprovado, Aprovado com ressalva ou Reprovado, acompanhado do parecer.',
      'A avaliação e o lançamento da nota são realizados no Portal do Professor: https://professor.ufes.br/.',
      'Na prévia da ata, confirma a conferência e usa Registrar avaliação e ir para documentos. A escolha entre Asten e Gov.br fica em Documentos administrativos; o registro da avaliação não inicia a assinatura automaticamente. Somente o orientador assina a ata.',
      'Falhas de assinatura ou divergências documentais devem ser corrigidas pela causa, sem criar versões duplicadas desnecessárias.',
    ],
    gate: 'Ata assinada pelo orientador e arquivada no processo para liberar a entrega final.',
    result: 'Ata arquivada; alunos recebem instruções para a entrega final, com ciência ao orientador.',
  },
  {
    n: 5,
    title: 'Entrega final',
    actor: 'Aluno',
    icon: BookOpenCheck,
    summary: 'Após o arquivamento da ata assinada pelo orientador, qualquer um dos autores confirma a entrega no Repositório acadêmico.',
    details: [
      'Anexa o PDF final do TCC, obrigatório para trabalhos novos. A publicação é opcional e independente da entrega.',
      'Preenche o resumo e os cinco campos de palavras-chave para identificação do trabalho.',
      'Inclui o resumo expandido quando essa informação for aplicável ao curso ou ao processo.',
      'Confere os dados e clica em Confirmar entrega e ir para documentos. Os campos ficam bloqueados. Editar entrega permite corrigir enquanto a etapa estiver aberta; após a assinatura da declaração ou a conclusão, a edição deixa de estar disponível.',
    ],
    gate: 'Arquivo final e metadados obrigatórios registrados sem pendências.',
    result: 'Entrega e escolhas de publicação registradas; continuidade em Documentos administrativos.',
  },
  {
    n: 6,
    title: 'Autorização de publicação',
    actor: 'Aluno(s) + Orientador',
    icon: FileSignature,
    summary: 'Se algum arquivo for escolhido para publicação, o Portal prepara o termo a partir da entrega confirmada.',
    details: [
      'O aluno define separadamente quais conteúdos poderão ser disponibilizados publicamente.',
      'Sem autorização de publicação de nenhum arquivo, não há Termo nem e-mail de assinatura desse documento.',
      'Todos os autores e o orientador assinam o Termo. No Asten, todos assinam no mesmo nível. Pelo Gov.br, somente o orientador devolve o mesmo PDF com todas as assinaturas.',
      'A assinatura é solicitada somente na caixa do termo em Documentos administrativos. Confirmar a entrega não envia uma solicitação automática ao Asten. O PDF devolvido pelo Gov.br ainda precisa de conferência administrativa.',
    ],
    gate: 'Escolhas de publicação registradas e Termo resolvido quando necessário.',
    result: 'Autorização de publicação formalizada nos casos em que é exigida.',
  },
  {
    n: 7,
    title: 'Declaração da banca',
    actor: 'Presidente da Comissão',
    icon: UserCheck,
    summary: 'A Presidência confere as informações finais da banca e acompanha as pendências administrativas que ainda impedem o encerramento.',
    details: [
      'A declaração reutiliza os dados da defesa e a composição efetivamente registrada da banca.',
      'A Presidência verifica se os documentos anteriores e as entregas obrigatórias estão resolvidos.',
      'A presidência da comissão assina a declaração por Asten (preferencial) ou Gov.br na Área do Presidente. Essa função é diferente da presidência da sessão, exercida pelo orientador.',
      'Pendências de integração, assinatura ou arquivo são tratadas antes da conclusão para preservar a rastreabilidade do processo.',
    ],
    gate: 'Documentos e pendências administrativas obrigatórias resolvidos.',
    result: 'Declaração conferida e processo apto à checagem final de encerramento.',
  },
  {
    n: 8,
    title: 'Conclusão',
    actor: 'Portal + Administração',
    icon: CheckCircle2,
    summary: 'O TCC é concluído somente quando todas as entregas, conferências e assinaturas obrigatórias daquele processo estiverem resolvidas.',
    details: [
      'O Portal verifica o estado final das etapas e mantém o histórico das ações associadas ao processo.',
      'Autores, orientador, banca e presidência recebem o aviso final e podem consultar os documentos conforme suas permissões.',
      'Visitantes abrem o TCC sem login para consultar os dados públicos, o comprovante de reserva, o convite emitido e os documentos assinados liberados para consulta. O trabalho completo e o resumo expandido dependem de autorizações próprias; e-mails, matrículas e registros permanecem restritos.',
      'O encerramento preserva os dados necessários para rastreabilidade e consulta futura do trabalho.',
    ],
    gate: 'Nenhuma pendência obrigatória remanescente para o TCC.',
    result: 'TCC concluído e processo encerrado no Portal.',
  },
] as const;

export const FluxoTccPage: React.FC = () => (
  <div id="fluxo-tcc-page" className="mx-auto max-w-none space-y-0">
    <section className="portal-public-header">
      <div className="portal-public-title-row gap-2">
        <ColorfulHeaderIcon type="flow" />
        <h1 className="text-sm font-black normal-case tracking-tight text-white sm:text-base">Fluxo do TCC</h1>
      </div>
    </section>
    <PortalSectionDivider />

    <section className="portal-layer-panel p-3 sm:p-5">
      <div className="portal-flow-snake" aria-label="Fluxo sequencial do TCC">
        {phases.map(({ n, title, actor, icon: Icon, summary, details, gate, result }) => (
          <article key={n} className="portal-flow-step portal-layer-card flex h-full flex-col rounded-2xl border border-slate-300 p-4 shadow-sm">
            <div className="portal-flow-number flex h-11 w-11 items-center justify-center rounded-full border-4 border-[var(--portal-surface-panel)] bg-[var(--portal-brand-header)] text-sm font-black text-white shadow-md" aria-label={`Etapa ${n}`}>
              {n}
            </div>

            <div className="flex min-h-[48px] items-start gap-3 pl-7">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--portal-brand-action)] text-white shadow-sm" aria-hidden="true">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-black text-slate-950 sm:text-base">{title}</h2>
                  <span className="rounded-full border border-slate-300 bg-[#eef1f3] px-2 py-1 text-[8.5px] font-black normal-case tracking-wide text-slate-700">{actor}</span>
                </div>
                <span className="mt-1 inline-block text-[8.5px] font-black normal-case tracking-[0.16em] text-[var(--portal-brand-action)]">Etapa {n}</span>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-700">{summary}</p>

            <div className="mt-3 flex-1 space-y-1.5">
              {details.map((detail) => (
                <div key={detail} className="flex gap-2 text-[11px] leading-4.5 text-slate-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--portal-brand-action)]" aria-hidden="true" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-panel)] px-3 py-2 text-[10.5px] leading-4 text-slate-700">
              <strong className="text-slate-900">Para avançar:</strong> {gate}
            </div>

            <div className="mt-2 flex min-h-[58px] items-start gap-2 rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface-inner)] px-3 py-2 text-[10.5px] font-semibold leading-4 text-slate-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--portal-brand-action)]" />
              <span><strong className="text-slate-900">Resultado:</strong> {result}</span>
            </div>
          </article>
        ))}
      </div>
      <SignatureFlowSummary />
    </section>
    <div className="px-3 pb-3 sm:px-5 sm:pb-5 space-y-3"><SignatureFlowSummary /><section className="portal-instruction rounded-xl p-4 text-xs leading-5" aria-label="Consulta ao histórico legado"><h2 className="font-bold">Trabalhos legados</h2><ul className="mt-2 list-disc space-y-1 pl-5"><li>Registros como 001 - Legado ficam no mesmo Repositório, com os dados históricos disponíveis.</li><li>A importação não cria uma nova defesa nem solicita novas assinaturas. Campos ou arquivos ausentes na origem podem permanecer sem preenchimento.</li><li>Trabalho completo e resumo expandido só ficam públicos com autorização confirmada. Os documentos administrativos antigos permanecem privados para consulta do Master no respectivo processo.</li></ul></section></div>
  </div>
);
