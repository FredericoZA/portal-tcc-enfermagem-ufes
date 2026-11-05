import React from 'react';
import { BookOpen, CalendarDays, CheckCircle2, ClipboardList, ExternalLink, FileText, GraduationCap, Info, ShieldCheck, Users } from 'lucide-react';
import { ColorfulHeaderIcon } from '../components/ColorfulHeaderIcon';
import { PortalSectionDivider } from '../components/PortalSectionDivider';
import { useAuth } from '../context/AuthContext';
import { resolveInstallationProfile } from '../utils/installationProfile';

const NORMAS_TCC_URL = 'https://enfermagem.vitoria.ufes.br/sites/enfermagem.vitoria.ufes.br/files/field/anexo/normas_do_tcc_-_de-ufes.pdf';
const PPC_URL = 'https://enfermagem.vitoria.ufes.br/pt-br/concepcao-da-organizacao-curricular';
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
                <p>O TCC integra as atividades obrigatórias da graduação em Enfermagem e Obstetrícia. O Portal aceita o cadastro individual ou em dupla, com até dois estudantes, conforme as orientações acadêmicas do curso.</p>
              </RuleCard>
              <RuleCard title="Quando realizar o TCC" icon={CalendarDays}>
                <p>Na matriz de 2020, o TCC I está no 7º período e o TCC II, no 8º. Planeje a conclusão e a defesa para o 8º período. Os Estágios Curriculares I e II estão no 9º e no 10º períodos, respectivamente.</p>
                <SourceLink href={MATRIZ_CURRICULAR_URL}>Consultar Matriz Curricular 2020</SourceLink>
              </RuleCard>
              <RuleCard title="Temas e ética em pesquisa" icon={BookOpen}>
                <p>Defina o tema com o orientador, considerando o interesse dos autores, a pertinência para a Enfermagem e a viabilidade da pesquisa. Estudos com participantes humanos ou animais devem observar as exigências éticas e as autorizações aplicáveis. Proteja a privacidade e a confidencialidade das informações pessoais, especialmente dos dados de saúde.</p>
              </RuleCard>
              <RuleCard title="Quem pode orientar" icon={Users}>
                <p>A orientação cabe a um professor do Curso de Enfermagem e Obstetrícia da UFES com afinidade com o tema. O orientador acompanha o trabalho, contribui para o rigor científico e metodológico e auxilia na preparação da defesa e na composição da banca.</p>
              </RuleCard>
              <RuleCard title="Pode haver coorientador?" icon={Info}>
                <p>Sim. A coorientação pode complementar o acompanhamento quando o tema ou o método justificar a participação de outro profissional com conhecimento na área. Combine a indicação com o orientador e observe os critérios do curso. A coorientação complementa a orientação titular e a composição da banca segue as regras do curso.</p>
              </RuleCard>
              <RuleCard title="Como é formada a banca" icon={Users}>
                <p>A banca tem três integrantes. O orientador preside a sessão e os outros dois membros são profissionais de nível superior com conhecimento na área do trabalho, preferencialmente enfermeiros. Orientador e autores escolhem os examinadores em comum acordo, conforme as orientações do curso.</p>
              </RuleCard>
              <RuleCard title="Formatos do trabalho" icon={FileText}>
                <p>O TCC pode ser apresentado como monografia ou artigo científico, em comum acordo com o orientador. Consulte as normas do curso para preparar a estrutura, as referências e a apresentação da versão final.</p>
              </RuleCard>
              <RuleCard title="Apresentação e defesa" icon={ClipboardList}>
                <p>A defesa é a apresentação oral do trabalho à banca em sessão pública agendada. Autores e orientador conferem a data, o horário e o local. Depois da defesa, o orientador registra em <strong>Conceito e Ata</strong> a decisão da banca e prepara a ata. O docente lança notas e frequência no <SourceLink href="https://professor.ufes.br/">Portal do Professor</SourceLink>.</p>
              </RuleCard>
              <RuleCard title="Entrega e publicação do TCC" icon={CheckCircle2}>
                <p><strong>A entrega do TCC final em PDF é obrigatória. A publicação é opcional.</strong> Envie o trabalho, o resumo sintético e as palavras-chave mesmo que o PDF fique restrito. A divulgação do trabalho completo depende da autorização expressa dos autores. O PDF do resumo expandido é opcional e tem autorização de publicação independente.</p>
              </RuleCard>
            </div>
          </section>

          <section aria-labelledby="tcc-sobre-o-portal" className="space-y-2 border-t border-slate-300 pt-3">
            <h2 id="tcc-sobre-o-portal" className="text-sm font-black text-slate-900">Informações sobre o Portal TCC</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <RuleCard title="Documentos e próximos passos" icon={FileText}>
                <p>O Portal organiza o cadastro, a reserva do local, a composição da banca, o registro do conceito e da ata, as assinaturas e a entrega final. Os registros e indicadores agregados apoiam a gestão acadêmica e a avaliação institucional do curso.</p>
                <ul className="space-y-1.5">
                  <li><SourceLink href={NORMAS_TCC_URL}>Normas para elaboração do TCC</SourceLink></li>
                  <li><SourceLink href={PPC_URL}>Projeto Pedagógico do Curso (PPC)</SourceLink></li>
                  <li><SourceLink href="/manual/manual-portal-tcc.pdf">Manual de uso do Portal</SourceLink></li>
                </ul>
              </RuleCard>
              <RuleCard title="Legislação e proteção de dados" icon={ShieldCheck}>
                <p>O Portal utiliza as informações necessárias à identificação dos participantes e à tramitação acadêmica. Os documentos têm regras de acesso distintas para consulta administrativa e divulgação pública. A entrega do TCC não autoriza a publicação. Consulte a LGPD e o Aviso de Privacidade para conhecer as regras de tratamento dos dados.</p>
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
