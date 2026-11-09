import React from 'react';
import { BookOpen, CalendarDays, CheckCircle2, ClipboardList, ExternalLink, FileText, GraduationCap, Info, ShieldCheck, Users } from 'lucide-react';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';
import { PortalSectionDivider } from '../components/PortalSectionDivider';
import { useAuth } from '../context/AuthContext';
import { resolveInstallationProfile } from '../utils/installationProfile';

const NORMAS_TCC_URL = 'https://enfermagem.vitoria.ufes.br/sites/enfermagem.vitoria.ufes.br/files/field/anexo/normas_do_tcc_-_de-ufes.pdf';
const PPC_URL = 'https://prograd.ufes.br/sites/prograd.ufes.br/files/field/anexo/ppc_enfermagem_e_obstetricia_ccs.pdf';
const MATRIZ_CURRICULAR_URL = 'https://enfermagem.vitoria.ufes.br/pt-br/matriz-curricular-2020';
const LGPD_URL = 'https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html';

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
      <h3 className="text-xs font-black text-slate-900 sm:text-sm">{title}</h3>
    </div>
    <div className="space-y-2 text-xs leading-5 text-slate-700">{children}</div>
  </section>
);

const SourceLink: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 font-bold text-[var(--portal-brand-header)] underline-offset-2 hover:underline focus-visible:underline"
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
export const InformacoesGeraisTccPage: React.FC<InformacoesGeraisTccPageProps> = () => {
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
          <h1 className="text-sm font-black normal-case tracking-tight text-white sm:text-base">Informações gerais do TCC</h1>
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
          <section aria-labelledby="tcc-sobre-o-trabalho" className="space-y-2">
            <h2 id="tcc-sobre-o-trabalho" className="text-sm font-black text-slate-900">Sobre o Trabalho de Conclusão de Curso</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <RuleCard title="Obrigatoriedade e número de autores" icon={GraduationCap}>
                <p>O Trabalho de Conclusão de Curso (TCC) integra as atividades obrigatórias da graduação em Enfermagem e Obstetrícia. O trabalho pode ser desenvolvido individualmente ou em dupla, conforme as orientações acadêmicas do curso.</p>
              </RuleCard>
              <RuleCard title="Quando realizar o TCC" icon={CalendarDays}>
                <p>A Matriz Curricular 2020 prevê o Trabalho de Conclusão de Curso I (TCC I) no 7º período e o Trabalho de Conclusão de Curso II (TCC II) no 8º. Planeje a elaboração e a defesa até o 8º período. Na organização regular da matriz, o 9º e o 10º períodos são destinados, respectivamente, ao Estágio Curricular I – Atenção Primária em Saúde e ao Estágio Curricular II, com concentração nas atividades de estágio. Essa distribuição da matriz não estabelece, por si só, uma proibição de toda matrícula concomitante; confira sua situação acadêmica com o curso.</p>
                <SourceLink href={MATRIZ_CURRICULAR_URL}>Consultar Matriz Curricular 2020</SourceLink>
              </RuleCard>
              <RuleCard title="Temas e ética em pesquisa" icon={BookOpen}>
                <p>O tema do TCC deve ser definido em diálogo com o orientador, conciliando o interesse acadêmico dos autores, a pertinência para a Enfermagem e a viabilidade da pesquisa. Estudos com participantes humanos ou animais devem observar as exigências éticas e as autorizações aplicáveis antes de sua realização. Na utilização de informações pessoais, especialmente dados de saúde, é indispensável proteger a privacidade e a confidencialidade dos participantes, conforme a legislação vigente.</p>
              </RuleCard>
              <RuleCard title="Quem pode orientar" icon={Users}>
                <p>A orientação do TCC é realizada por professor vinculado ao Curso de Enfermagem e Obstetrícia da Universidade Federal do Espírito Santo, cuja atuação acadêmica apresente afinidade com o tema escolhido. Cabe ao orientador acompanhar o desenvolvimento do trabalho, contribuir para o rigor científico e metodológico da pesquisa e apoiar o estudante na preparação da defesa e na composição da banca examinadora.</p>
              </RuleCard>
              <RuleCard title="Pode haver coorientador?" icon={Info}>
                <p>Sim. A coorientação pode complementar o acompanhamento do TCC quando a natureza do tema ou da metodologia justificar a participação de outro profissional com conhecimento na área. Sua indicação deve observar os critérios acadêmicos do curso e ser articulada com o professor orientador. O coorientador contribui para o desenvolvimento do trabalho, mas não substitui o orientador titular nem altera, por si só, a composição da banca examinadora.</p>
              </RuleCard>
              <RuleCard title="Como é formada a banca" icon={Users}>
                <p>A banca examinadora é formada por três integrantes: o professor orientador, que preside a sessão, e dois profissionais de nível superior com conhecimento na área do trabalho, preferencialmente enfermeiros. A escolha dos examinadores é realizada em comum acordo entre o orientador e os autores, observadas as orientações do curso.</p>
              </RuleCard>
              <RuleCard title="Formatos do trabalho" icon={FileText}>
                <p>O TCC pode ser apresentado como monografia ou artigo científico, em comum acordo com o professor orientador. Independentemente do formato, o trabalho deve atender às normas acadêmicas de estrutura, referências e apresentação adotadas pelo curso. Antes de preparar a versão final, consulte as orientações de elaboração do TCC em vigor.</p>
              </RuleCard>
              <RuleCard title="Apresentação e defesa" icon={ClipboardList}>
                <p>A defesa do TCC é a apresentação oral do trabalho perante a banca examinadora, em sessão pública previamente agendada. Os autores e o orientador devem conferir data, horário e local. Após a defesa, o orientador registra no Portal TCC um dos três conceitos previstos e prepara a ata. A avaliação e o lançamento de notas e frequência são feitos no <SourceLink href="https://professor.ufes.br/">Portal do Professor</SourceLink>.</p>
              </RuleCard>
              <RuleCard title="Entrega e publicação do TCC" icon={CheckCircle2}>
                <p>A entrega do TCC final em PDF é obrigatória para concluir o processo acadêmico. Sua disponibilização pública para consulta ou download, porém, depende de autorização expressa dos autores. Também é possível anexar um resumo expandido e decidir separadamente sobre sua divulgação, quando essa opção estiver disponível. Entrega e publicação são decisões distintas: não autorizar a divulgação não dispensa o envio do trabalho.</p>
              </RuleCard>
            </div>
          </section>

          <section aria-labelledby="tcc-sobre-o-portal" className="space-y-2 border-t border-slate-300 pt-3">
            <h2 id="tcc-sobre-o-portal" className="text-sm font-black text-slate-900">Informações sobre o Portal TCC</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <RuleCard title="Documentos e próximos passos" icon={FileText}>
                <p>O Portal TCC organiza o cadastro do trabalho, a reserva do local, a composição da banca, o registro de conceito e ata, a coleta de assinaturas e a entrega final. Para conhecer as normas do curso e acompanhar cada etapa, consulte os documentos institucionais e o manual de uso.</p>
                <ul className="space-y-1.5">
                  <li><SourceLink href={NORMAS_TCC_URL}>Normas para elaboração do TCC</SourceLink></li>
                  <li><SourceLink href={PPC_URL}>Projeto Pedagógico do Curso (PPC)</SourceLink></li>
                  <li><SourceLink href="/manual/manual-portal-tcc.pdf">Manual de uso do Portal</SourceLink></li>
                </ul>
              </RuleCard>
              <RuleCard title="Legislação e proteção de dados" icon={ShieldCheck}>
                <p>O Portal TCC utiliza apenas as informações necessárias à identificação dos participantes e à tramitação acadêmica dos trabalhos. Os documentos são mantidos sob controle de acesso, com regras distintas para consulta administrativa e divulgação pública. A entrega do TCC não implica autorização para publicação. O tratamento de dados pessoais deve observar a Lei Geral de Proteção de Dados (LGPD) e o Aviso de Privacidade do Portal.</p>
                <ul className="space-y-1.5">
                  <li><SourceLink href={LGPD_URL}>Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018)</SourceLink></li>
                  <li><SourceLink href="/privacidade.html">Aviso de privacidade do Portal</SourceLink></li>
                </ul>
              </RuleCard>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
