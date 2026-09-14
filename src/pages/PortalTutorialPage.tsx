import React, { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CalendarCheck,
  CheckCircle2,
  FileSignature,
  GraduationCap,
  LockKeyhole,
  SearchCheck,
  ShieldCheck,
  UserCheck,
  Users
} from 'lucide-react';

interface PortalTutorialPageProps {
  onNavigate: (tab: string) => void;
}

type Role = 'aluno' | 'orientador' | 'presidente' | 'visitante';

const roleContent: Record<Role, { title: string; description: string; steps: string[] }> = {
  aluno: {
    title: 'Aluno',
    description: 'Inicia o TCC, confirma o local, acompanha a defesa e conclui a entrega final.',
    steps: [
      'Entre com o e-mail previamente autorizado e o código enviado pelo Portal.',
      'Cadastre título, autoria, orientador, coorientador quando houver, banca e data/horário pretendidos.',
      'Consulte o Departamento de Enfermagem e volte ao processo para confirmar o local realmente reservado.',
      'Depois da defesa e da Ata do orientador, envie TCC final, cinco palavras-chave, resumo sintético e, se desejar, resumo expandido.',
      'Defina separadamente a publicação do TCC completo e do resumo expandido e confira o Termo antes de enviá-lo para assinatura.'
    ]
  },
  orientador: {
    title: 'Orientador',
    description: 'Confere os dados, registra o resultado e o parecer da defesa e assina a Ata.',
    steps: [
      'Entre com o e-mail que foi cadastrado no processo pelo aluno.',
      'Abra o TCC e confira cuidadosamente nomes, matrícula dos alunos, SIAPE quando aplicável, título, banca, data e local.',
      'Corrija dados permitidos antes de concluir a avaliação, caso encontre erro.',
      'Marque Aprovado, Aprovado com ressalva ou Reprovado e informe o parecer final. O fluxo atual não utiliza nota numérica.',
      'Confira a prévia da Ata e escolha a via de assinatura disponível: Asten ou Gov.br.'
    ]
  },
  presidente: {
    title: 'Presidente da Comissão',
    description: 'Acompanha o encerramento dos processos e assina a declaração de participação da banca.',
    steps: [
      'Acompanhe os processos e suas pendências administrativas na Área do Presidente.',
      'O processo só chega à etapa final depois da entrega do aluno e das assinaturas anteriores aplicáveis.',
      'Confira a declaração da banca com título, participantes, data e local.',
      'Selecione as declarações aptas e escolha Asten ou Gov.br. A indisponibilidade de um provedor não bloqueia o outro.',
      'Após assinatura, arquivamento e demais requisitos aplicáveis, o processo pode ser concluído.'
    ]
  },
  visitante: {
    title: 'Visitante',
    description: 'Consulta somente a informação acadêmica definida como pública, sem acessar dados administrativos ou credenciais.',
    steps: [
      'Consulte o calendário público de defesas com protocolo, título, participantes acadêmicos, data e local disponibilizados pelo Portal.',
      'No repositório, consulte TCCs concluídos, resumo sintético e palavras-chave quando preenchidos.',
      'Matrícula, e-mail, SIAPE, identificadores internos, vínculos do Drive, tokens e registros administrativos não fazem parte do contrato público.',
      'O TCC completo e o resumo expandido só recebem link público após autorização correspondente e sincronização bem-sucedida da publicação.'
    ]
  }
};

const phases = [
  { n: 1, title: 'Cadastro inicial', actor: 'Aluno', icon: GraduationCap, text: 'Cadastro do TCC individual ou em dupla, participantes, título e data/horário pretendidos. O processo nasce com o local ainda pendente.' },
  { n: 2, title: 'Confirmação do local', actor: 'Aluno + Departamento', icon: CalendarCheck, text: 'O aluno verifica a reserva diretamente com o Departamento de Enfermagem. O fluxo permanece bloqueado até ele confirmar no Portal o local efetivamente reservado.' },
  { n: 3, title: 'Convite e calendário', actor: 'Portal', icon: Users, text: 'Após a confirmação do local, o Portal registra o evento no calendário, gera o convite e prepara o envio institucional aos participantes configurados.' },
  { n: 4, title: 'Defesa e Ata', actor: 'Orientador', icon: SearchCheck, text: 'O orientador revisa os dados, registra resultado e parecer sem nota numérica, confere a prévia da Ata e confirma o envio para assinatura.' },
  { n: 5, title: 'Entrega final', actor: 'Aluno', icon: BookOpenCheck, text: 'O aluno envia o trabalho final, cinco palavras-chave, resumo sintético e opcionalmente o resumo expandido, escolhendo separadamente o que poderá ser publicado.' },
  { n: 6, title: 'Termo de autorização', actor: 'Aluno(s) + Orientador', icon: FileSignature, text: 'Quando existir conteúdo autorizado para publicação, o Termo é gerado, conferido e encaminhado para assinatura dos autores e do orientador.' },
  { n: 7, title: 'Declaração da banca', actor: 'Presidente', icon: UserCheck, text: 'É a última emissão documental do fluxo padrão. A Presidente confere a declaração de participação da banca e a encaminha para assinatura.' },
  { n: 8, title: 'Conclusão', actor: 'Portal', icon: CheckCircle2, text: 'Somente após as etapas e assinaturas aplicáveis o processo é concluído. Arquivos privados permanecem privados; TCC completo e resumo expandido só ficam públicos quando a autorização e a sincronização de publicação forem confirmadas.' }
];

export const PortalTutorialPage: React.FC<PortalTutorialPageProps> = ({ onNavigate: _onNavigate }) => {
  const [role, setRole] = useState<Role>('aluno');
  const active = useMemo(() => roleContent[role], [role]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#06372d]/25 bg-[#06372d] p-5 text-white shadow-sm sm:p-6">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-slate-200 text-xs font-black uppercase tracking-[0.18em]"><ShieldCheck className="h-4 w-4"/>Guia operacional</div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">Como usar o Portal de TCC</h1>
          <p className="mt-2 text-sm sm:text-base leading-7 text-slate-100">Veja o que fazer em cada etapa. O Portal libera a próxima ação somente quando as dependências acadêmicas e documentais anteriores estiverem concluídas.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">O que você precisa fazer?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(roleContent) as Role[]).map(key => (
            <button key={key} type="button" onClick={() => setRole(key)} className={`rounded-full border px-4 py-2 text-xs font-black transition-colors ${role === key ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-400'}`}>
              {roleContent[key].title}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-black text-slate-900">{active.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{active.description}</p>
          <ol className="mt-4 grid gap-2 md:grid-cols-2">
            {active.steps.map((step, index) => (
              <li key={step} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#06372d] text-xs font-black text-white">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-black text-slate-950">Fluxo completo do TCC</h2>
          <p className="text-sm text-slate-600">A ordem abaixo é a ordem operacional do processo.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {phases.map(({ n, title, actor, icon: Icon, text }) => (
            <article key={n} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon className="h-5 w-5"/></div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600">Etapa {n}</span>
              </div>
              <h3 className="mt-3 font-black text-slate-950">{title}</h3>
              <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-[#06372d]">{actor}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-slate-700"/><h2 className="font-black text-slate-950">Dados protegidos</h2></div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Matrícula, e-mail, SIAPE, códigos de acesso, credenciais, identificadores internos, vínculos privados do Drive e registros administrativos ficam restritos aos usuários autorizados e às rotinas que realmente necessitam deles.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
          <div className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5 text-[#06372d]"/><h2 className="font-black text-[#06372d]">Informação acadêmica pública</h2></div>
          <p className="mt-2 text-sm leading-6 text-slate-700">O calendário e o repositório usam contratos públicos próprios, com o mínimo de dados necessário para consulta acadêmica. TCC completo e resumo expandido só recebem link público quando a autorização aplicável e a sincronização com o Drive forem concluídas; caso contrário, permanecem privados ou indicados como não apresentados.</p>
        </div>
      </section>
    </div>
  );
};
