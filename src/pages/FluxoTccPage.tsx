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
  <div id="fluxo-tcc-page" className="mx-auto max-w-5xl space-y-3 py-2">
    <section className="rounded-2xl border border-emerald-900/80 bg-[#005830] px-3.5 py-3 text-white shadow-sm sm:px-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white shadow-2xs" aria-hidden="true">
          <GitBranch className="h-4 w-4 text-slate-700" />
        </span>
        <h1 className="text-sm font-black uppercase tracking-tight text-white sm:text-base">Fluxo completo do TCC</h1>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-300 bg-[#f0f0f0] p-3 shadow-sm sm:p-5">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold leading-6 text-slate-700">
          O Portal acompanha o TCC do primeiro cadastro ao encerramento. Cada etapa libera a seguinte somente quando as informações necessárias daquele momento já foram registradas e conferidas.
        </p>
      </div>

      <div className="relative mt-5">
        <div className="absolute bottom-3 left-[23px] top-3 w-px bg-slate-300 lg:left-1/2 lg:-translate-x-1/2" aria-hidden="true" />

        <div className="space-y-3 sm:space-y-4">
          {phases.map(({ n, title, actor, icon: Icon, summary, details, result }, index) => {
            const leftSide = index % 2 === 0;
            return (
              <article key={n} className="relative grid grid-cols-[48px_minmax(0,1fr)] items-start gap-3 lg:grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] lg:gap-4">
                <div className={`col-start-2 lg:row-start-1 ${leftSide ? 'lg:col-start-1' : 'lg:col-start-3'}`}>
                  <div className={`rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4 ${leftSide ? 'lg:text-right' : ''}`}>
                    <div className={`flex flex-wrap items-center gap-2 ${leftSide ? 'lg:justify-end' : ''}`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#337959] text-white shadow-sm">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className={leftSide ? 'lg:order-first' : ''}>
                        <div className={`flex flex-wrap items-center gap-2 ${leftSide ? 'lg:justify-end' : ''}`}>
                          <h2 className="text-base font-black text-slate-950">{title}</h2>
                          <span className="rounded-full border border-slate-300 bg-[#e5e9ed] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-700">{actor}</span>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-5 text-slate-700">{summary}</p>

                    <div className="mt-3 space-y-1.5">
                      {details.map((detail) => (
                        <div key={detail} className={`flex gap-2 text-xs leading-5 text-slate-600 ${leftSide ? 'lg:flex-row-reverse' : ''}`}>
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#337959]" aria-hidden="true" />
                          <span>{detail}</span>
                        </div>
                      ))}
                    </div>

                    <div className={`mt-3 inline-flex max-w-full items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-[11px] font-bold leading-4 text-slate-700 ${leftSide ? 'lg:flex-row-reverse' : ''}`}>
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#337959]" />
                      <span><strong className="text-slate-900">Resultado:</strong> {result}</span>
                    </div>
                  </div>
                </div>

                <div className="absolute left-0 top-3 flex h-12 w-12 items-center justify-center rounded-full border-4 border-[#f0f0f0] bg-[#005830] text-sm font-black text-white shadow-md lg:static lg:col-start-2 lg:row-start-1 lg:mx-auto lg:h-14 lg:w-14">
                  {n}
                </div>

                <div className={`hidden lg:block lg:row-start-1 ${leftSide ? 'lg:col-start-3' : 'lg:col-start-1'}`} aria-hidden="true">
                  <div className={`mt-6 flex items-center ${leftSide ? 'justify-start' : 'justify-end'}`}>
                    <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500 shadow-2xs">Etapa {n}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  </div>
);
