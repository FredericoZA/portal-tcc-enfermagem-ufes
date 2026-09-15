import React, { useMemo, useState } from 'react';
import { BookOpenCheck, CalendarCheck, HelpCircle, LogIn, UserCheck } from 'lucide-react';

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
    description: 'Consulta o calendário público, o repositório e as informações liberadas para consulta.',
    steps: [
      'Consulte o calendário público com protocolo, título, participantes acadêmicos, data e local disponibilizados pelo Portal.',
      'No repositório, consulte TCCs concluídos, resumo sintético e palavras-chave quando preenchidos.',
      'Use a página Como chegar para abrir a rota até o Departamento de Enfermagem e conferir os locais atuais de apresentação.',
      'Quando houver publicação autorizada, utilize os links disponibilizados pelo próprio repositório.',
    ],
  },
};

const topActionClass = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-white bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-900 shadow-sm transition hover:brightness-95';

export const PortalTutorialPage: React.FC<PortalTutorialPageProps> = ({ onNavigate }) => {
  const [role, setRole] = useState<Role>('aluno');
  const active = useMemo(() => roleContent[role], [role]);

  return (
    <div id="portal-tutorial-page" className="mx-auto max-w-5xl space-y-3 py-2">
      <section className="flex flex-col gap-2 rounded-2xl border border-emerald-900/80 bg-[#005830] px-3.5 py-3 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white shadow-2xs" aria-hidden="true">
            <HelpCircle className="h-4 w-4 text-slate-700" />
          </span>
          <h1 className="text-sm font-black uppercase tracking-tight text-white sm:text-base">Como usar o Portal de TCC</h1>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => onNavigate('home')} className={topActionClass}><CalendarCheck className="h-4 w-4" />Calendário</button>
          <button type="button" onClick={() => onNavigate('biblioteca')} className={topActionClass}><BookOpenCheck className="h-4 w-4" />Repositório</button>
          <button type="button" onClick={() => onNavigate('acessar-portal')} className={topActionClass}><LogIn className="h-4 w-4" />Entrar</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-300 bg-[#f0f0f0] shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-300 px-3 py-2.5 sm:px-4">
          <span className="mr-1 text-xs font-black uppercase tracking-wide text-slate-800">Filtrar:</span>
          {(Object.keys(roleContent) as Role[]).map((key) => {
            const selected = role === key;
            return (
              <button
                key={key}
                type="button"
                data-selected={selected ? 'true' : 'false'}
                onClick={() => setRole(key)}
                className="portal-table-filter-chip rounded-full border border-slate-300 px-3.5 py-1.5 text-xs font-black text-slate-900 transition-none"
              >
                {roleContent[key].title}
              </button>
            );
          })}
        </div>

        <div className="p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#337959] text-white shadow-sm"><UserCheck className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 className="font-black text-slate-950">{active.title}</h2>
              <p className="mt-0.5 text-sm leading-5 text-slate-600">{active.description}</p>
            </div>
          </div>
          <ol className="mt-3 grid gap-2 md:grid-cols-2">
            {active.steps.map((step, index) => (
              <li key={step} className="flex gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 text-slate-700 shadow-2xs">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#337959] text-[10px] font-black text-white">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
};
