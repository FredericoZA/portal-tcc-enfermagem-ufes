import React from 'react';
import {
  BookOpenCheck,
  CalendarCheck,
  CheckCircle2,
  FileSignature,
  GitBranch,
  GraduationCap,
  SearchCheck,
  UserCheck,
  Users,
} from 'lucide-react';

const phases = [
  {
    n: 1,
    title: 'Cadastro inicial',
    actor: 'Aluno',
    icon: GraduationCap,
    summary: 'O processo começa quando o aluno registra o TCC no Portal e informa os dados acadêmicos necessários para organizar a defesa.',
    details: [
      'Informa autoria, título, orientador, coorientador quando houver, banca e data/horário pretendidos.',
      'O cadastro cria o processo que será acompanhado pelas pessoas vinculadas ao TCC ao longo das próximas etapas.',
    ],
    result: 'Processo criado e pronto para a confirmação do local.',
  },
  {
    n: 2,
    title: 'Confirmação do local',
    actor: 'Aluno + Departamento',
    icon: CalendarCheck,
    summary: 'A reserva do espaço é conferida antes de a apresentação entrar definitivamente no calendário institucional.',
    details: [
      'O aluno verifica com o Departamento qual sala ou auditório ficou efetivamente reservado.',
      'Depois da confirmação, o local definitivo é registrado no processo junto da data e do horário da defesa.',
    ],
    result: 'Defesa com data, horário e local confirmados.',
  },
  {
    n: 3,
    title: 'Convite e calendário',
    actor: 'Portal',
    icon: Users,
    summary: 'Com o local confirmado, o Portal prepara a comunicação da defesa e consolida as informações que serão divulgadas.',
    details: [
      'A apresentação passa a constar no calendário público do curso com as informações acadêmicas previstas.',
      'O convite institucional é preparado com título, participantes, banca, data, horário e local da apresentação.',
    ],
    result: 'Defesa divulgada e convite institucional preparado.',
  },
  {
    n: 4,
    title: 'Defesa e Ata',
    actor: 'Orientador',
    icon: SearchCheck,
    summary: 'Depois da apresentação, o orientador registra o resultado e confere os dados que irão compor a Ata da defesa.',
    details: [
      'O resultado e o parecer da banca são registrados no Portal sem utilização de nota numérica no fluxo atual.',
      'Antes da assinatura, os dados acadêmicos e a composição da banca são conferidos na prévia do documento.',
    ],
    result: 'Ata conferida e encaminhada para a etapa de assinatura aplicável.',
  },
  {
    n: 5,
    title: 'Entrega final',
    actor: 'Aluno',
    icon: BookOpenCheck,
    summary: 'Após a defesa, o aluno conclui a parte acadêmica do processo enviando a versão final e os dados destinados ao repositório.',
    details: [
      'São enviados o trabalho final, cinco palavras-chave e o resumo sintético, além do resumo expandido quando houver.',
      'O aluno também informa separadamente o que poderá ser publicado no repositório institucional do Portal.',
    ],
    result: 'Material final entregue e opções de publicação registradas.',
  },
  {
    n: 6,
    title: 'Termo de autorização',
    actor: 'Aluno(s) + Orientador',
    icon: FileSignature,
    summary: 'Quando a publicação exigir autorização, o Portal prepara o Termo com os dados já conferidos no processo.',
    details: [
      'Aluno ou alunos e orientador conferem o documento antes de encaminhá-lo para assinatura.',
      'A etapa só é exigida quando a escolha de publicação do processo torna o Termo aplicável.',
    ],
    result: 'Autorização de publicação formalizada quando necessária.',
  },
  {
    n: 7,
    title: 'Declaração da banca',
    actor: 'Presidente da Comissão',
    icon: UserCheck,
    summary: 'Com as etapas anteriores atendidas, a Presidência confere a declaração de participação dos membros da banca.',
    details: [
      'O documento reúne os dados da defesa, a composição da banca e as informações necessárias para a declaração institucional.',
      'A Presidência acompanha as pendências finais e encaminha a declaração para a assinatura disponível no Portal.',
    ],
    result: 'Declaração conferida e processada para encerramento.',
  },
  {
    n: 8,
    title: 'Conclusão',
    actor: 'Portal',
    icon: CheckCircle2,
    summary: 'O processo é encerrado somente depois de cumpridas as entregas, conferências e assinaturas exigidas para aquele TCC.',
    details: [
      'Os documentos finais permanecem associados ao processo e o material autorizado pode ser sincronizado com o repositório.',
      'O histórico do TCC fica consolidado para consulta administrativa e para as informações públicas efetivamente liberadas.',
    ],
    result: 'TCC concluído e processo institucional encerrado.',
  },
] as const;

export const FluxoTccPage: React.FC = () => (
  <div id="fluxo-tcc-page" className="mx-auto max-w-none space-y-0 py-2">
    <section className="rounded-t-2xl border border-emerald-900/80 bg-[#005830] px-3.5 py-3 text-white shadow-sm sm:px-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white shadow-2xs" aria-hidden="true">
          <GitBranch className="h-4 w-4 text-slate-700" />
        </span>
        <h1 className="text-sm font-black uppercase tracking-tight text-white sm:text-base">Fluxo do TCC</h1>
      </div>
    </section>

    <section className="rounded-b-2xl border border-t-0 border-slate-300 bg-[#f0f0f0] p-3 shadow-sm sm:p-5">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-sm font-semibold leading-6 text-slate-700">
          O Portal acompanha o TCC do primeiro cadastro ao encerramento. Siga o caminho numerado: cada etapa libera a seguinte somente quando as informações necessárias já foram registradas e conferidas.
        </p>
      </div>

      <div className="portal-flow-snake mt-6" aria-label="Fluxo sequencial do TCC">
        {phases.map(({ n, title, actor, icon: Icon, summary, details, result }) => (
          <article key={n} className="portal-flow-step rounded-2xl border border-slate-300 bg-[#d5dce0] p-4 shadow-sm">
            <div className="portal-flow-number flex h-11 w-11 items-center justify-center rounded-full border-4 border-[#f0f0f0] bg-[#005830] text-sm font-black text-white shadow-md" aria-label={`Etapa ${n}`}>
              {n}
            </div>

            <div className="flex min-h-[48px] items-start gap-3 pl-7">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#337959] text-white shadow-sm" aria-hidden="true">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-black text-slate-950 sm:text-base">{title}</h2>
                  <span className="rounded-full border border-slate-300 bg-[#eef1f3] px-2 py-1 text-[8.5px] font-black uppercase tracking-wide text-slate-700">{actor}</span>
                </div>
                <span className="mt-1 inline-block text-[8.5px] font-black uppercase tracking-[0.16em] text-[#337959]">Etapa {n}</span>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-700">{summary}</p>
            <div className="mt-3 space-y-1.5">
              {details.map((detail) => (
                <div key={detail} className="flex gap-2 text-[11px] leading-4.5 text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#337959]" aria-hidden="true" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#b9cabe] bg-white/80 px-3 py-2 text-[10.5px] font-semibold leading-4 text-slate-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#337959]" />
              <span><strong className="text-slate-900">Resultado:</strong> {result}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  </div>
);