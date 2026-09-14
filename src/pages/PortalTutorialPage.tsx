import React, { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CalendarCheck,
  CheckCircle2,
  FileSignature,
  GraduationCap,
  LockKeyhole,
  LogIn,
  SearchCheck,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';

interface PortalTutorialPageProps {
  onNavigate: (tab: string) => void;
}

type Role = 'aluno' | 'orientador' | 'presidente' | 'visitante';
const ACCENT = '#47866A';

const roleContent: Record<Role, { title: string; description: string; steps: string[] }> = {
  aluno: {
    title: 'Aluno',
    description: 'Inicia o TCC, confirma o local, acompanha a defesa e conclui a entrega final.',
    steps: [
      'Entre com o e-mail previamente autorizado e o código enviado pelo Portal.',
      'Cadastre título, autoria, orientador, coorientador quando houver, banca e data/horário pretendidos.',
      'Consulte o Departamento de Enfermagem e volte ao processo para confirmar o local realmente reservado.',
      'Depois da defesa e da Ata do orientador, envie TCC final, cinco palavras-chave, resumo sintético e, se desejar, resumo expandido.',
      'Defina separadamente a publicação do TCC completo e do resumo expandido e confira o Termo antes de enviá-lo para assinatura.',
    ],
  },
  orientador: {
    title: 'Orientador',
    description: 'Confere os dados, registra o resultado e o parecer da defesa e assina a Ata.',
    steps: [
      'Entre com o e-mail que foi cadastrado no processo pelo aluno.',
      'Abra o TCC e confira nomes, matrícula dos alunos, SIAPE quando aplicável, título, banca, data e local.',
      'Corrija os dados permitidos antes de concluir a avaliação, caso encontre erro.',
      'Marque Aprovado, Aprovado com ressalva ou Reprovado e informe o parecer final. O fluxo atual não utiliza nota numérica.',
      'Confira a prévia da Ata e escolha a via de assinatura disponível: Asten ou Gov.br.',
    ],
  },
  presidente: {
    title: 'Presidente da Comissão',
    description: 'Acompanha o encerramento dos processos e assina a declaração de participação da banca.',
    steps: [
      'Acompanhe processos e pendências administrativas na Área do Presidente.',
      'O processo só chega à etapa final depois da entrega do aluno e das assinaturas anteriores aplicáveis.',
      'Confira a declaração da banca com título, participantes, data e local.',
      'Selecione as declarações aptas e escolha Asten ou Gov.br. A indisponibilidade de um provedor não bloqueia o outro.',
      'Após assinatura, arquivamento e demais requisitos aplicáveis, o processo pode ser concluído.',
    ],
  },
  visitante: {
    title: 'Visitante',
    description: 'Consulta somente a informação acadêmica pública, sem acessar dados administrativos ou credenciais.',
    steps: [
      'Consulte o calendário público com protocolo, título, participantes acadêmicos, data e local disponibilizados pelo Portal.',
      'No repositório, consulte TCCs concluídos, resumo sintético e palavras-chave quando preenchidos.',
      'Matrícula, e-mail, SIAPE, identificadores internos, vínculos do Drive, tokens e registros administrativos não fazem parte do contrato público.',
      'TCC completo e resumo expandido só recebem link público após autorização correspondente e sincronização bem-sucedida da publicação.',
    ],
  },
};

const phases = [
  { n: 1, title: 'Cadastro inicial', actor: 'Aluno', icon: GraduationCap, text: 'Cadastro do TCC, participantes, título e data/horário pretendidos.' },
  { n: 2, title: 'Confirmação do local', actor: 'Aluno + Departamento', icon: CalendarCheck, text: 'O local reservado é conferido e confirmado antes do avanço do fluxo.' },
  { n: 3, title: 'Convite e calendário', actor: 'Portal', icon: Users, text: 'O Portal registra o evento e prepara o convite institucional.' },
  { n: 4, title: 'Defesa e Ata', actor: 'Orientador', icon: SearchCheck, text: 'O orientador revisa os dados, registra resultado e parecer e confere a Ata.' },
  { n: 5, title: 'Entrega final', actor: 'Aluno', icon: BookOpenCheck, text: 'São enviados trabalho final, palavras-chave e resumos aplicáveis.' },
  { n: 6, title: 'Termo de autorização', actor: 'Aluno(s) + Orientador', icon: FileSignature, text: 'Quando aplicável, o Termo é conferido e encaminhado para assinatura.' },
  { n: 7, title: 'Declaração da banca', actor: 'Presidente', icon: UserCheck, text: 'A declaração de participação é conferida e encaminhada para assinatura.' },
  { n: 8, title: 'Conclusão', actor: 'Portal', icon: CheckCircle2, text: 'O processo termina somente após etapas e assinaturas aplicáveis.' },
];

export const PortalTutorialPage: React.FC<PortalTutorialPageProps> = ({ onNavigate }) => {
  const [role, setRole] = useState<Role>('aluno');
  const active = useMemo(() => roleContent[role], [role]);

  const actionClass = 'inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-black text-white transition hover:brightness-95';

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-[#005830]/30 bg-[#005830] p-4 text-white shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/80"><ShieldCheck className="h-4 w-4"/>Guia operacional</div>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight sm:text-3xl">Como usar o Portal de TCC</h1>
            <p className="mt-1.5 text-sm leading-6 text-white/85">Escolha seu perfil para ver somente o que precisa fazer. Abaixo, o fluxo completo fica disponível como referência rápida.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => onNavigate('home')} className={actionClass} style={{ backgroundColor: ACCENT, borderColor: ACCENT }}><CalendarCheck className="h-4 w-4"/>Calendário</button>
            <button type="button" onClick={() => onNavigate('biblioteca')} className={actionClass} style={{ backgroundColor: ACCENT, borderColor: ACCENT }}><BookOpenCheck className="h-4 w-4"/>Repositório</button>
            <button type="button" onClick={() => onNavigate('acessar-portal')} className={actionClass} style={{ backgroundColor: ACCENT, borderColor: ACCENT }}><LogIn className="h-4 w-4"/>Entrar</button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-black text-slate-950">Escolha seu perfil</h2><p className="text-xs text-slate-500">O conteúdo abaixo muda sem sair da página.</p></div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(roleContent) as Role[]).map(key => {
              const selected = role === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRole(key)}
                  className="rounded-full border px-3.5 py-1.5 text-xs font-black transition-colors"
                  style={selected
                    ? { backgroundColor: ACCENT, borderColor: ACCENT, color: '#ffffff' }
                    : { backgroundColor: '#ffffff', borderColor: ACCENT, color: ACCENT }}
                >
                  {roleContent[key].title}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: ACCENT }}><UserCheck className="h-5 w-5"/></div>
            <div><h3 className="font-black text-slate-950">{active.title}</h3><p className="mt-0.5 text-sm text-slate-600">{active.description}</p></div>
          </div>
          <ol className="mt-3 grid gap-2 md:grid-cols-2">
            {active.steps.map((step, index) => (
              <li key={step} className="flex gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 text-sm leading-5 text-slate-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white" style={{ backgroundColor: ACCENT }}>{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2.5"><h2 className="font-black text-slate-950">Fluxo completo do TCC</h2><p className="text-xs text-slate-500">Visão resumida da ordem operacional.</p></div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {phases.map(({ n, title, actor, icon: Icon, text }) => (
            <article key={n} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white"><Icon className="h-4 w-4" style={{ color: ACCENT }}/></div>
                <span className="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase" style={{ borderColor: ACCENT, color: ACCENT }}>Etapa {n}</span>
              </div>
              <h3 className="mt-2 text-sm font-black text-slate-950">{title}</h3>
              <p className="mt-0.5 text-[10px] font-black uppercase tracking-wide" style={{ color: ACCENT }}>{actor}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-2 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-slate-700"/><h2 className="font-black text-slate-950">Dados protegidos</h2></div>
          <p className="mt-1.5 text-xs leading-5 text-slate-600">Matrícula, e-mail, SIAPE, códigos de acesso, credenciais, identificadores internos, vínculos privados do Drive e registros administrativos ficam restritos a usuários e rotinas autorizados.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 shadow-sm">
          <div className="flex items-center gap-2"><BookOpenCheck className="h-5 w-5" style={{ color: ACCENT }}/><h2 className="font-black" style={{ color: ACCENT }}>Informação acadêmica pública</h2></div>
          <p className="mt-1.5 text-xs leading-5 text-slate-700">Calendário e repositório exibem apenas o conjunto de dados previsto para consulta pública. TCC completo e resumo expandido só recebem link público quando houver autorização aplicável e sincronização concluída.</p>
        </div>
      </section>
    </div>
  );
};
