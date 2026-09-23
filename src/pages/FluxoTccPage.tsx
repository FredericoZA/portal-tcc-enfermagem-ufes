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
    summary: 'O aluno cria o processo e registra os dados acadêmicos que serão reutilizados nas etapas seguintes.',
    details: [
      'Informa título, autoria e os vínculos do orientador e do coorientador quando houver.',
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
    actor: 'Aluno + Departamento',
    icon: CalendarCheck,
    summary: 'A defesa só recebe local definitivo depois da confirmação do espaço reservado pelo Departamento.',
    details: [
      'O aluno solicita ou acompanha a reserva conforme a rotina administrativa do Departamento.',
      'A sala ou o auditório só deve ser registrado no Portal depois da confirmação real da reserva.',
      'Data e horário são conferidos juntamente com o local para evitar conflito entre agenda e espaço físico.',
      'Se houver mudança posterior, o processo deve ser atualizado antes da divulgação final da defesa.',
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
      'O convite utiliza título, participantes, banca, data, horário e local já registrados.',
      'Qualquer divergência deve ser corrigida no processo de origem para evitar documentos e comunicações diferentes entre si.',
    ],
    gate: 'Informações da defesa conferidas e aptas para divulgação.',
    result: 'Defesa publicada no calendário e comunicação preparada com dados consistentes.',
  },
  {
    n: 4,
    title: 'Defesa e Ata',
    actor: 'Orientador',
    icon: SearchCheck,
    summary: 'Depois da apresentação, o orientador registra o resultado e valida os dados que irão compor a Ata.',
    details: [
      'O orientador confere novamente autoria, título, banca, data, horário e local antes da avaliação.',
      'Registra o resultado previsto no fluxo e o parecer correspondente, sem inserir nota numérica quando ela não fizer parte da regra do curso.',
      'A prévia da Ata deve ser revisada antes do encaminhamento para assinatura.',
      'Falhas de assinatura ou divergências documentais devem ser corrigidas pela causa, sem criar versões duplicadas desnecessárias.',
    ],
    gate: 'Resultado, parecer e dados da Ata conferidos pelo orientador.',
    result: 'Ata pronta para a modalidade de assinatura aplicável ao processo.',
  },
  {
    n: 5,
    title: 'Entrega final',
    actor: 'Aluno',
    icon: BookOpenCheck,
    summary: 'Após a defesa, o aluno entrega a versão final e os metadados necessários para o encerramento acadêmico e para o acervo.',
    details: [
      'Envia o arquivo final do trabalho conforme o formato aceito pelo Portal.',
      'Preenche as palavras-chave e o resumo sintético exigidos para identificação do trabalho.',
      'Inclui o resumo expandido quando essa informação for aplicável ao curso ou ao processo.',
      'Confere se o arquivo enviado corresponde à versão final, e não a uma versão preliminar anterior à defesa.',
    ],
    gate: 'Arquivo final e metadados obrigatórios registrados sem pendências.',
    result: 'Material final entregue e pronto para as decisões de publicação.',
  },
  {
    n: 6,
    title: 'Autorização de publicação',
    actor: 'Aluno(s) + Orientador',
    icon: FileSignature,
    summary: 'Quando a publicação exigir autorização, o Portal prepara o Termo a partir dos dados já validados no processo.',
    details: [
      'O aluno define separadamente quais conteúdos poderão ser disponibilizados publicamente.',
      'O Termo só é exigido quando a escolha de publicação tornar o documento aplicável.',
      'Autores e orientador conferem os dados antes de iniciar a assinatura.',
      'A conclusão da assinatura é acompanhada no próprio processo para que a etapa seguinte use o estado correto.',
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
      'O documento é conferido antes do encaminhamento para a modalidade de assinatura disponível.',
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
      'Documentos finais permanecem vinculados ao TCC para consulta administrativa conforme as permissões existentes.',
      'O conteúdo autorizado pode ser disponibilizado no repositório público sem expor documentos internos não liberados.',
      'O encerramento preserva os dados necessários para rastreabilidade e consulta futura do trabalho.',
    ],
    gate: 'Nenhuma pendência obrigatória remanescente para o TCC.',
    result: 'TCC concluído e processo encerrado no Portal.',
  },
] as const;

export const FluxoTccPage: React.FC = () => (
  <div id="fluxo-tcc-page" className="mx-auto max-w-none space-y-0 py-2">
    <section className="portal-public-header rounded-t-2xl border border-emerald-900/80 bg-[#005830] px-3.5 py-3 text-white shadow-sm sm:px-4">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white shadow-2xs" aria-hidden="true">
          <GitBranch className="h-4 w-4 text-slate-700" />
        </span>
        <h1 className="text-sm font-black uppercase tracking-tight text-white sm:text-base">Fluxo do TCC</h1>
      </div>
    </section>

    <section className="rounded-b-2xl border border-t-0 border-slate-300 bg-[#f0f0f0] p-3 shadow-sm sm:p-5">
      <div className="portal-flow-snake" aria-label="Fluxo sequencial do TCC">
        {phases.map(({ n, title, actor, icon: Icon, summary, details, gate, result }) => (
          <article key={n} className="portal-flow-step flex h-full flex-col rounded-2xl border border-slate-300 bg-[#d5dce0] p-4 shadow-sm">
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

            <div className="mt-3 flex-1 space-y-1.5">
              {details.map((detail) => (
                <div key={detail} className="flex gap-2 text-[11px] leading-4.5 text-slate-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#337959]" aria-hidden="true" />
                  <span>{detail}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-[#b9cabe] bg-[#edf1ef] px-3 py-2 text-[10.5px] leading-4 text-slate-700">
              <strong className="text-slate-900">Para avançar:</strong> {gate}
            </div>

            <div className="mt-2 flex min-h-[58px] items-start gap-2 rounded-xl border border-[#b9cabe] bg-white px-3 py-2 text-[10.5px] font-semibold leading-4 text-slate-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#337959]" />
              <span><strong className="text-slate-900">Resultado:</strong> {result}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  </div>
);
