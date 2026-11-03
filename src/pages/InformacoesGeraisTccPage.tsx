import React from 'react';
import { BookOpen, CalendarDays, CheckCircle2, ClipboardList, ExternalLink, FileText, GraduationCap, Info, ShieldCheck, Users } from 'lucide-react';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';
import { PortalSectionDivider } from '../components/PortalSectionDivider';
import { useAuth } from '../context/AuthContext';
import { resolveInstallationProfile } from '../utils/installationProfile';

const NORMAS_TCC_URL = 'https://enfermagem.vitoria.ufes.br/sites/enfermagem.vitoria.ufes.br/files/field/anexo/normas_do_tcc_-_de-ufes.pdf';
const ORIENTACOES_CURSO_URL = 'https://enfermagem.vitoria.ufes.br/pt-br/envio-do-trabalho-de-conclusao-de-curso';
const MATRIZ_CURRICULAR_URL = 'https://enfermagem.vitoria.ufes.br/pt-br/concepcao-da-organizacao-curricular';

interface InformacoesGeraisTccPageProps {
  onNavigate: (tab: string) => void;
}

const RuleCard: React.FC<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}> = ({ title, icon: Icon, children }) => (
  <section className="portal-layer-card rounded-xl border border-slate-300 p-3 shadow-2xs sm:p-4">
    <div className="mb-2 flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-[var(--portal-brand-action)]" aria-hidden="true" />
      <h2 className="text-xs font-black text-slate-900 sm:text-sm">{title}</h2>
    </div>
    <div className="space-y-2 text-xs leading-5 text-slate-700">{children}</div>
  </section>
);

const SourceLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 font-bold text-[var(--portal-brand-action)] underline-offset-2 hover:underline focus-visible:underline"
  >
    {children}
    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
  </a>
);

/**
 * Conteúdo acadêmico desta instalação: não presumir que as regras da Enfermagem/UFES
 * se aplicam a cursos que reutilizem o código-fonte do Portal.
 * Normas antigas e instruções digitais atuais podem divergir; não transformar
 * exigências históricas de entrega física em procedimentos operacionais.
 */
export const InformacoesGeraisTccPage: React.FC<InformacoesGeraisTccPageProps> = ({ onNavigate }) => {
  const { settings } = useAuth();
  const profile = resolveInstallationProfile(settings);
  const course = profile.courseName || '';
  const institution = profile.institutionName || '';
  const isEnfermagemUfes = /enfermagem/i.test(course) && (/ufes/i.test(institution) || /universidade federal do esp[ií]rito santo/i.test(institution));

  return (
    <div id="informacoes-gerais-tcc-page" className="portal-public-shell portal-layer-panel mx-auto max-w-none overflow-hidden rounded-2xl border border-slate-300 shadow-sm">
      <section className="portal-public-header">
        <div className="portal-public-title-row gap-2">
          <ColorfulHeaderIcon type="guidance" />
          <h1 className="text-sm font-black uppercase tracking-tight text-white sm:text-base">Informações gerais do TCC</h1>
        </div>
      </section>
      <PortalSectionDivider />

      {!isEnfermagemUfes ? (
        <section className="portal-layer-panel space-y-3 p-4 sm:p-5">
          <p className="text-sm font-bold text-slate-900">Orientações específicas do curso ainda não configuradas</p>
          <p className="text-xs leading-5 text-slate-700">
            As regras acadêmicas variam entre cursos. Esta instalação não utiliza automaticamente as normas de Enfermagem da UFES.
            Consulte o regulamento e a coordenação do curso antes de definir autoria, orientação, banca, defesa ou entrega.
          </p>
        </section>
      ) : (
        <div className="portal-layer-panel space-y-4 p-3 sm:p-4">
          <div className="portal-layer-card rounded-xl border border-slate-300 p-3 sm:p-4">
            <p className="text-sm font-bold leading-5 text-slate-900">O que você precisa saber antes de iniciar seu Trabalho de Conclusão de Curso</p>
            <p className="mt-1 text-xs leading-5 text-slate-700">
              Estas são orientações gerais do curso de Enfermagem da UFES. O regulamento acadêmico e as instruções institucionais prevalecem.
              Em caso de divergência entre documentos de épocas diferentes, confirme a regra aplicável à sua matriz curricular com a coordenação.
            </p>
          </div>

          <div className="grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
            <RuleCard title="Obrigatoriedade e número de autores" icon={GraduationCap}>
              <p>O TCC é <strong>obrigatório</strong> para concluir o bacharelado em Enfermagem.</p>
              <p>A norma disponível prevê elaboração <strong>individual</strong> e, excepcionalmente, em <strong>dupla (até 2 estudantes)</strong>. A formação de dupla deve ser tratada com o orientador e a coordenação.</p>
            </RuleCard>
            <RuleCard title="Quando realizar o TCC" icon={CalendarDays}>
              <p>O percurso inclui elaboração do projeto e, depois, desenvolvimento e apresentação do trabalho nas disciplinas correspondentes de TCC I e TCC II.</p>
              <p>A norma anterior cita Orientação à Monografia I no 7º período e II no 8º. Como há matriz curricular posterior, <strong>esses períodos não devem ser aplicados automaticamente a todos os estudantes</strong>. Confira sua matriz e os pré-requisitos.</p>
            </RuleCard>
            <RuleCard title="Temas e ética em pesquisa" icon={BookOpen}>
              <p>Escolha um tema relevante para a Enfermagem, como atenção hospitalar, cuidado domiciliar, saúde coletiva ou ensino em saúde.</p>
              <p>O projeto deve ser aprovado pelo orientador. Pesquisas com participantes humanos ou animais devem observar as exigências éticas pertinentes antes de sua execução.</p>
            </RuleCard>
            <RuleCard title="Quem pode orientar" icon={Users}>
              <p>O documento normativo identifica como orientador um <strong>professor do curso de Enfermagem e Obstetrícia da UFES</strong>, cuja área de conhecimento tenha afinidade com o tema.</p>
              <p>A orientação deve ser formalizada conforme os procedimentos da disciplina. O orientador também preside a banca de defesa.</p>
            </RuleCard>
            <RuleCard title="Pode haver coorientador?" icon={Info}>
              <p>O Portal possui campo para coorientador <strong>quando houver</strong>, mas a norma de elaboração consultada não estabelece de modo expresso os critérios de elegibilidade e aprovação da coorientação.</p>
              <p><strong>Confirme previamente</strong> com a coordenação da disciplina ou Comissão de TCC antes de formalizar a indicação. O cadastro no Portal, por si só, não substitui essa autorização.</p>
            </RuleCard>
            <RuleCard title="Como é formada a banca" icon={Users}>
              <p>A norma disponível prevê <strong>3 integrantes</strong>: o orientador, na presidência, e mais <strong>2 profissionais de nível superior</strong> com conhecimento do tema, preferencialmente enfermeiros.</p>
              <p>Os dois membros convidados são definidos de comum acordo entre orientador e estudante(s). A presença de coorientador não altera automaticamente essa composição.</p>
            </RuleCard>
            <RuleCard title="Formatos do trabalho" icon={FileText}>
              <p>O TCC pode ser apresentado como <strong>monografia ou artigo</strong>, em decisão conjunta com o orientador.</p>
              <p>A monografia deve seguir a normalização acadêmica aplicável. Para artigo, observe as exigências da norma do curso e do periódico escolhido, quando pertinente. Confira sempre a versão atualizada das orientações de formatação.</p>
            </RuleCard>
            <RuleCard title="Apresentação e avaliação" icon={ClipboardList}>
              <p>A defesa é uma apresentação oral, de caráter público, avaliada por banca examinadora. O estudante deve combinar data e horário com orientador e avaliadores e observar o procedimento de reserva de local.</p>
              <p>A página institucional prevê <strong>1 hora e 30 minutos por agendamento</strong>, incluindo apresentação, avaliação e organização do espaço. Essa duração da reserva não deve ser confundida com o tempo de fala.</p>
            </RuleCard>
            <RuleCard title="Depois da defesa" icon={CheckCircle2}>
              <p>Realize as correções solicitadas pela banca, sob acompanhamento do orientador, e entregue a versão final conforme a orientação institucional.</p>
              <p>Na rotina digital divulgada pelo curso, a entrega reúne <strong>trabalho final, resumo, ata de apresentação e termo de autorização para publicação</strong>, conforme aplicabilidade, em PDF.</p>
            </RuleCard>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="portal-layer-card rounded-xl border border-slate-300 p-3 shadow-2xs sm:p-4">
              <h2 className="flex items-center gap-2 text-xs font-black text-slate-900 sm:text-sm"><CheckCircle2 className="h-4 w-4 text-[var(--portal-brand-action)]" aria-hidden="true" />A entrega do TCC é obrigatória?</h2>
              <p className="mt-2 text-xs leading-5 text-slate-700"><strong>Sim.</strong> A versão final e os documentos acadêmicos exigidos precisam ser entregues para a conclusão do processo. Na rotina digital divulgada, os arquivos são enviados em PDF.</p>
            </section>
            <section className="portal-layer-card rounded-xl border border-slate-300 p-3 shadow-2xs sm:p-4">
              <h2 className="flex items-center gap-2 text-xs font-black text-slate-900 sm:text-sm"><ShieldCheck className="h-4 w-4 text-[var(--portal-brand-action)]" aria-hidden="true" />É obrigatório publicar o TCC na internet?</h2>
              <p className="mt-2 text-xs leading-5 text-slate-700"><strong>Não foi identificada obrigação geral de disponibilização pública</strong> nas referências consultadas. Entrega acadêmica e publicação são ações diferentes. No Portal, a divulgação de arquivos depende da autorização expressa aplicável, e não decorre automaticamente da entrega.</p>
            </section>
          </div>

          <section className="portal-layer-card space-y-2 rounded-xl border border-slate-300 p-3 shadow-2xs sm:p-4">
            <h2 className="text-xs font-black text-slate-900 sm:text-sm">Documentos oficiais e próximos passos</h2>
            <p className="text-xs leading-5 text-slate-700">Consulte as fontes antes de decidir sobre prazos, documentação e situações não previstas. A norma de elaboração disponível descreve também procedimentos físicos históricos, como CD e cópias impressas, que <strong>não devem ser confundidos com a rotina digital atual</strong>.</p>
            <ul className="space-y-1.5 text-xs leading-5 text-slate-700">
              <li><SourceLink href={NORMAS_TCC_URL}>Normas para elaboração do TCC (documento disponível no site do curso)</SourceLink></li>
              <li><SourceLink href={ORIENTACOES_CURSO_URL}>Orientações institucionais de agendamento, defesa e entrega</SourceLink></li>
              <li><SourceLink href={MATRIZ_CURRICULAR_URL}>Organização curricular do curso</SourceLink></li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={() => onNavigate('tutorial')} className="portal-action-green rounded-lg border px-3 py-2 text-xs font-bold text-white">Como usar o Portal</button>
              <button type="button" onClick={() => onNavigate('fluxo-tcc')} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100">Ver fluxo do TCC</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
