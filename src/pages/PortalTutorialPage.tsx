import React, {useState} from 'react';
import {AlertTriangle, CheckCircle2, ClipboardCheck, GitBranch} from 'lucide-react';
import {PortalIllustratedGuide} from '../components/PortalIllustratedGuide';
import {PortalSectionDivider} from '../components/PortalSectionDivider';
import {ColorfulHeaderIcon} from '../components/ColorfulHeaderIcon';

interface PortalTutorialPageProps {
  onNavigate: (tab: string) => void;
}

type Role = 'aluno' | 'orientador' | 'visitante';

const roleContent: Record<Role, {
  title: string;
  description: string;
  before: string[];
  checklist: string[];
  mistakes: string[];
}> = {
  aluno: {
    title: 'Aluno',
    description: 'Cadastre o trabalho, acompanhe a reserva e entregue os arquivos finais. A publicação é opcional; a entrega do PDF do TCC é obrigatória para trabalhos novos.',
    before: [
      'Entre com o e-mail autorizado para criar o TCC. O e-mail do primeiro autor corresponde à conta que está usando o Portal.',
      'Separe título, nomes, e-mails e registros dos autores e docentes. Confira o tratamento, a titulação e a instituição de cada docente.',
      'Combine data e local com o orientador. Considere o mapa de salas, aulas, eventos e horários de funcionamento do prédio.',
    ],
    checklist: [
      'Reserva confirmada e participantes conferidos no mesmo processo.',
      'Resumo, cinco palavras-chave e PDF final do TCC entregues.',
      'Autorizações de publicação escolhidas separadamente para cada arquivo, conforme a vontade dos autores.',
      'Termo assinado por todos os autores e pelo orientador, somente quando houver publicação autorizada.',
      'Documentos obrigatórios arquivados e processo concluído.',
    ],
    mistakes: [
      'Não crie outro TCC para corrigir um cadastro. Use o processo existente e os controles de alteração disponíveis.',
      'Anexar o TCC não o torna público. Marque apenas os arquivos cuja publicação deseja autorizar.',
      'O aluno não assina a ata. Pelo Gov.br, encaminhe o termo assinado ao orientador; ele devolve um único PDF com todas as assinaturas.',
    ],
  },
  orientador: {
    title: 'Orientador',
    description: 'Confira o processo, registre o conceito e o parecer, assine a ata e, havendo publicação autorizada, o termo. A avaliação e a nota são lançadas no Portal do Professor.',
    before: [
      'Entre com o mesmo e-mail informado como orientador no TCC. Consultar a ficha sem login não libera ações do orientador.',
      'Confira autoria, título, banca, data e local antes de registrar o conceito. As etapas concluídas passam a limitar as correções.',
      'Planeje a defesa com os alunos considerando o uso das salas e o funcionamento do prédio. Outro local informado pelos autores depende do seu aceite e da reserva junto ao espaço escolhido.',
    ],
    checklist: [
      'Conceito e parecer registrados e prévia da ata conferida.',
      'Avaliação e nota lançadas no Portal do Professor, em professor.ufes.br.',
      'Ata assinada pelo orientador e arquivada para liberar a entrega final.',
      'Termo com todas as assinaturas, se houver publicação autorizada.',
      'Pendências acompanhadas em Documentos administrativos até o encerramento.',
    ],
    mistakes: [
      'O conceito do Portal TCC não substitui a avaliação e o lançamento da nota no Portal do Professor.',
      'Registrar o conceito ou a entrega não envia uma solicitação ao Asten. Escolha o método na caixa do documento, em Documentos administrativos.',
      'Devolver o PDF pelo Gov.br ainda exige conferência administrativa. O envio isolado não conclui a assinatura.',
    ],
  },
  visitante: {
    title: 'Visitante',
    description: 'Consulte o calendário, os dados públicos e os arquivos autorizados dos trabalhos atuais e legados. A consulta pública dispensa login.',
    before: [
      'Calendário e Repositório ficam no menu lateral. Clique no código do TCC para abrir sua ficha.',
      'A ficha usa as mesmas abas do processo, com ações e dados restritos conforme o acesso. E-mails, matrículas e registros não são públicos.',
      'Um registro pode aparecer sem PDF público. A consulta depende da autorização de publicação de cada arquivo.',
    ],
    checklist: [
      'Título e autoria correspondem ao trabalho procurado.',
      'Data, horário e local conferidos antes de se deslocar para uma defesa.',
      'Arquivo consultado corresponde ao que foi autorizado para publicação.',
    ],
    mistakes: [
      'Um PDF indisponível não significa que o trabalho não existe. Ele pode ser privado ou não ter sido entregue na origem.',
      'Legados são registros históricos no mesmo Repositório. Não precisam de novo cadastro, defesa ou assinatura.',
      'Login só é necessário para informações restritas e ações de participantes vinculados.',
    ],
  },
};

export const PortalTutorialPage: React.FC<PortalTutorialPageProps> = ({onNavigate}) => {
  const [role, setRole] = useState<Role>('aluno');
  const active = roleContent[role];

  return (
    <div id="portal-tutorial-page" className="portal-public-shell portal-layer-panel mx-auto max-w-none overflow-hidden rounded-2xl border border-slate-300 shadow-sm">
      <section className="portal-public-header text-white">
        <div className="portal-public-title-row gap-2">
          <ColorfulHeaderIcon type="tutorial" />
          <h1 className="text-base font-black normal-case tracking-tight text-white sm:text-lg">Como usar o Portal de TCC</h1>
        </div>
        <div className="portal-public-filter-row portal-tutorial-filter-row flex-wrap gap-2 text-xs min-w-0">
          <span className="portal-filter-label opacity-80 shrink-0">Meu perfil:</span>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Perfil do manual">
            {(Object.keys(roleContent) as Role[]).map(key => (
              <button key={key} type="button" onClick={() => setRole(key)} data-selected={role === key ? 'true' : 'false'} aria-pressed={role === key} className="portal-standard-filter-chip portal-table-filter-chip cursor-pointer select-none">
                <span>{roleContent[key].title}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
      <PortalSectionDivider />
      <div className="p-3 sm:p-4">
        <p className="text-sm leading-6 text-slate-700">{active.description}</p>
        <aside className="portal-instruction mt-3 p-3" aria-label={`Antes de começar — ${active.title}`}>
          <h2 className="flex items-center gap-2 text-sm font-bold"><ClipboardCheck className="h-4 w-4 shrink-0" aria-hidden="true" />Antes de começar</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">{active.before.map(item => <li key={item}>{item}</li>)}</ul>
        </aside>
        <h2 className="mt-5 text-base font-bold text-slate-950">Passo a passo</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">Escolha uma atividade. Cada exemplo mostra onde clicar, o resultado esperado e como resolver as pendências mais comuns.</p>
        <PortalIllustratedGuide role={role}/>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <section className="portal-layer-card rounded-xl border border-slate-300 p-3.5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-950"><CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--portal-brand-action)]" aria-hidden="true" />Conferência antes de encerrar</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-700">{active.checklist.map(item => <li key={item}>{item}</li>)}</ul>
          </section>
          <aside className="portal-instruction p-3.5">
            <h2 className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />Erros a evitar</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">{active.mistakes.map(item => <li key={item}>{item}</li>)}</ul>
          </aside>
        </div>
        <div className="mt-4 flex justify-center"><button type="button" className="portal-action" onClick={() => onNavigate('fluxo-tcc')}><GitBranch className="h-4 w-4" aria-hidden="true" />Ver o Fluxo do TCC</button></div>
      </div>
    </div>
  );
};
