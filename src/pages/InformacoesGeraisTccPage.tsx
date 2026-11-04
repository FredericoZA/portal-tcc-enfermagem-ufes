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
          <div className="grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
            <RuleCard title="Obrigatoriedade e número de autores" icon={GraduationCap}>
              <p>O TCC é <strong>obrigatório</strong> para concluir o bacharelado em Enfermagem.</p>
              <p>A norma disponível prevê elaboração <strong>individual</strong> e, excepcionalmente, em <strong>dupla (até 2 estudantes)</strong>. A formação de dupla deve ser tratada com o orientador e a coordenação.</p>
            </RuleCard>
            <RuleCard title="Quando realizar o TCC" icon={CalendarDays}>
              <p>O TCC deve ser concluído e defendido entre o <strong>7º e o 8º períodos</strong> do curso.</p>
              <p>O <strong>9º e o 10º períodos</strong> são destinados <strong>exclusivamente ao estágio</strong>.</p>
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
              <p>O Portal permite cadastrar coorientador <strong>quando houver</strong>. A indicação deve observar os critérios do curso, confirmados com a coordenação da disciplina ou Comissão de TCC.</p>
              <p>A coorientação não substitui o orientador nem os dois examinadores.</p>
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
              <p>O Portal reserva <strong>1 hora e 30 minutos por agendamento</strong>, incluindo apresentação, avaliação e organização do espaço. Esse intervalo não define o tempo de fala.</p>
              <p>Aqui, o orientador registra <strong>conceito e parecer</strong> para a documentação. A avaliação acadêmica e o lançamento da nota são feitos no <SourceLink href="https://professor.ufes.br/">Portal do Professor</SourceLink>.</p>
            </RuleCard>
            <RuleCard title="Depois da defesa" icon={CheckCircle2}>
              <p>Realize as correções solicitadas pela banca, sob acompanhamento do orientador, e entregue a versão final conforme a orientação institucional.</p>
              <p>No <strong>Repositório acadêmico</strong>, qualquer um dos autores preenche o resumo e as palavras-chave e anexa o PDF do trabalho completo. O PDF do resumo expandido é opcional.</p>
            </RuleCard>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <section className="portal-layer-card rounded-xl border border-slate-300 p-3 shadow-2xs sm:p-4">
              <h2 className="flex items-center gap-2 text-xs font-black text-slate-900 sm:text-sm"><CheckCircle2 className="h-4 w-4 text-[var(--portal-brand-action)]" aria-hidden="true" />A entrega do TCC é obrigatória?</h2>
              <p className="mt-2 text-xs leading-5 text-slate-700"><strong>Sim.</strong> O PDF do trabalho completo, o resumo e as palavras-chave são obrigatórios na entrega dos processos novos. A entrega não autoriza a publicação do arquivo. Os registros legados preservam o que foi recebido na época, inclusive quando não há trabalho completo anexado.</p>
            </section>
            <section className="portal-layer-card rounded-xl border border-slate-300 p-3 shadow-2xs sm:p-4">
              <h2 className="flex items-center gap-2 text-xs font-black text-slate-900 sm:text-sm"><ShieldCheck className="h-4 w-4 text-[var(--portal-brand-action)]" aria-hidden="true" />É obrigatório publicar o TCC na internet?</h2>
              <p className="mt-2 text-xs leading-5 text-slate-700"><strong>A publicação do TCC na internet não é obrigatória.</strong> Entrega acadêmica e publicação são ações diferentes. No Portal, a divulgação do trabalho e do resumo expandido depende de autorização para cada PDF e não ocorre automaticamente com a entrega. Havendo publicação autorizada, os autores e o orientador assinam o Termo em <strong>Documentos administrativos</strong>. Sem autorização de nenhum arquivo, não há Termo.</p>
            </section>
          </div>

          <section className="portal-layer-card space-y-2 rounded-xl border border-slate-300 p-3 shadow-2xs sm:p-4">
            <h2 className="text-xs font-black text-slate-900 sm:text-sm">Documentos e próximos passos</h2>
            <p className="text-xs leading-5 text-slate-700"><strong>Documentos administrativos</strong> reúne comprovante de reserva, carta-convite, ata, Termo de Autorização quando aplicável e declaração de participação na banca. A ata é assinada pelo orientador; a declaração, pela presidência da Comissão. Comprovante e convite não exigem assinatura.</p>
            <p className="text-xs leading-5 text-slate-700">A prévia da ata utiliza um modelo institucional e um texto-base de parecer definido em programação para cada resultado da banca. O título do TCC pode ser inserido no rascunho; a fundamentação e as ressalvas devem ser preenchidas pelo orientador. O sistema não atribui avaliação acadêmica por inteligência artificial.</p>
            <p className="text-xs leading-5 text-slate-700">A <strong>Portaria Normativa GR/Ufes nº 310/2026</strong> regula o uso institucional de sistemas de inteligência artificial. O Portal usa regras programadas para seu fluxo administrativo e indicadores agregados com medidas de minimização. Isso não constitui certificação institucional nem dispensa os controles da LGPD; consulte a legislação detalhada logo abaixo.</p>
            <p className="text-xs leading-5 text-slate-700">Nos legados, essa mesma aba também reúne o instrumento de avaliação antigo, quando localizado. Ele não faz parte dos processos novos.</p>
            <p className="text-xs leading-5 text-slate-700">Consulte as fontes para prazos e regras da sua matriz. A norma disponível descreve procedimentos físicos históricos; a tramitação digital deste Portal segue as etapas de cadastro, reserva, conceito, assinaturas e entrega.</p>
            <ul className="space-y-1.5 text-xs leading-5 text-slate-700">
              <li><SourceLink href={NORMAS_TCC_URL}>Normas para elaboração do TCC (documento disponível no site do curso)</SourceLink></li>
              <li><SourceLink href={ORIENTACOES_CURSO_URL}>Orientações institucionais de agendamento, defesa e entrega</SourceLink></li>
              <li><SourceLink href={MATRIZ_CURRICULAR_URL}>Organização curricular do curso</SourceLink></li>
            </ul>
          </section>

          <section className="portal-layer-card space-y-2 rounded-xl border border-slate-300 p-3 shadow-2xs sm:p-4" aria-labelledby="tcc-legislacao">
            <h2 id="tcc-legislacao" className="flex items-center gap-2 text-xs font-black text-slate-900 sm:text-sm"><ShieldCheck className="h-4 w-4 text-[var(--portal-brand-action)]" aria-hidden="true" />Legislação e proteção de dados</h2>
            <p className="text-xs leading-5 text-slate-700"><strong>Portaria Normativa GR/Ufes nº 310, de 23 de outubro de 2026</strong>, publicada em 27/10/2026: estabelece regras para o uso institucional de sistemas de inteligência artificial na Universidade.</p>
            <p className="text-xs leading-5 text-slate-700">O Portal TCC utiliza formulários, fluxos definidos, modelos de documentos e indicadores estatísticos calculados por regras programadas, sem gerar pareceres ou decisões acadêmicas por IA generativa. O texto-base do parecer deve ser complementado e validado pelo orientador, de acordo com a deliberação da banca.</p>
            <p className="text-xs leading-5 text-slate-700">Essas medidas técnicas buscam adequação à Portaria; não substituem as exigências institucionais de segurança, proteção de dados pessoais e eventual análise da unidade competente.</p>
            <ul className="space-y-1.5 text-xs leading-5 text-slate-700">
              <li><SourceLink href="/legislacao/PORTARIA_NORMATIVA_GR_UFES_310_2026.md">Consultar a Portaria nº 310/2026 (transcrição para leitura)</SourceLink></li>
              <li><SourceLink href="https://atosnormativos.ufes.br/handle/10/21075">Repositório oficial de atos normativos da Ufes</SourceLink></li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
};
