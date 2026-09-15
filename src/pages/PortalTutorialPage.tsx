import React, { useMemo, useState } from 'react';
import { HelpCircle, Info, UserCheck } from 'lucide-react';

interface PortalTutorialPageProps {
  onNavigate: (tab: string) => void;
}

type Role = 'aluno' | 'orientador' | 'presidente' | 'visitante';

type RoleGuide = {
  title: string;
  description: string;
  steps: string[];
  attention: string;
  finish: string;
};

const roleContent: Record<Role, RoleGuide> = {
  aluno: {
    title: 'Aluno',
    description: 'O aluno inicia o processo, acompanha as confirmações e encerra sua participação com a entrega final e as autorizações de publicação aplicáveis.',
    steps: [
      'Entre com o e-mail previamente autorizado. O acesso ao processo é vinculado ao endereço cadastrado no Portal.',
      'No cadastro inicial, informe título, autoria, orientador, coorientador quando houver, banca e a data/horário pretendidos para a defesa.',
      'Depois de solicitar a reserva ao Departamento, volte ao processo e confirme somente o local que realmente foi reservado para a apresentação.',
      'Acompanhe o calendário e o próprio processo. Quando o local estiver confirmado, o Portal passa a preparar o convite institucional da banca.',
      'Após a defesa e o registro da Ata pelo orientador, envie a versão final do TCC, cinco palavras-chave, resumo sintético e o resumo expandido quando houver.',
      'Escolha separadamente o que poderá ser publicado e, quando houver Termo de autorização, confira os dados antes de encaminhá-lo para assinatura.',
    ],
    attention: 'Antes de avançar, confira nomes, título, banca, data e local. Esses dados alimentam os documentos gerados nas etapas seguintes.',
    finish: 'Sua etapa termina quando a entrega final e as escolhas de publicação aplicáveis estão registradas no processo.',
  },
  orientador: {
    title: 'Orientador',
    description: 'O orientador atua principalmente na conferência acadêmica da defesa, no registro do resultado e do parecer e na validação da Ata.',
    steps: [
      'Entre com o mesmo e-mail informado pelo aluno no cadastro do TCC; esse vínculo identifica os processos em que você atua como orientador.',
      'Abra o processo e confira autoria, título, banca, data, horário e local antes de registrar qualquer informação da defesa.',
      'Quando houver erro em dado que ainda possa ser corrigido, ajuste-o antes de concluir a avaliação para evitar divergência na documentação.',
      'Registre o resultado da banca — Aprovado, Aprovado com ressalva ou Reprovado — e informe o parecer final. O fluxo atual não utiliza nota numérica.',
      'Confira a prévia da Ata com atenção aos nomes, funções dos membros e dados da apresentação antes de iniciar a assinatura.',
      'Escolha a via de assinatura disponível no Portal. Asten e Gov.br funcionam como alternativas independentes quando estiverem habilitadas.',
    ],
    attention: 'A avaliação concluída passa a compor o documento institucional. Evite finalizar enquanto ainda houver informação divergente na Ata.',
    finish: 'A participação principal do orientador fica concluída quando a avaliação foi registrada e a Ata seguiu corretamente para assinatura.',
  },
  presidente: {
    title: 'Presidente da Comissão',
    description: 'A Presidência acompanha as pendências administrativas do fluxo e atua nos documentos finais que dependem da Comissão de TCC.',
    steps: [
      'Use a Área do Presidente para acompanhar processos, pendências documentais e situações que ainda impedem o encerramento.',
      'Verifique se a defesa já foi registrada, se a entrega final foi feita e se as assinaturas anteriores exigidas para aquele processo foram concluídas.',
      'Quando a declaração da banca estiver disponível, confira título, participantes, data, local e composição da banca antes de encaminhá-la.',
      'Selecione a via de assinatura disponível. A indisponibilidade de um provedor não deve impedir o uso do outro quando ambos estiverem configurados.',
      'Acompanhe eventuais falhas de geração, assinatura ou arquivamento e retome a etapa somente depois de corrigida a causa da pendência.',
      'Depois que os requisitos finais forem satisfeitos, confira se o processo está apto à conclusão e se a publicação autorizada foi sincronizada quando aplicável.',
    ],
    attention: 'A Presidência não precisa refazer etapas acadêmicas já concluídas; o foco é identificar o que ainda está pendente e liberar o encerramento correto.',
    finish: 'O processo fica pronto para conclusão quando documentos, assinaturas e entregas exigidos para aquele TCC estão resolvidos.',
  },
  visitante: {
    title: 'Visitante',
    description: 'O visitante utiliza somente as áreas públicas do Portal para acompanhar apresentações e consultar produções que tenham sido liberadas.',
    steps: [
      'Consulte o calendário público para localizar as defesas divulgadas pelo curso, com data, horário, local e informações acadêmicas disponibilizadas.',
      'Abra os detalhes de uma apresentação para conferir as informações públicas daquele TCC sem precisar entrar em uma área administrativa.',
      'No repositório, pesquise trabalhos concluídos por título, autor, orientador, palavra-chave ou outros filtros disponíveis na própria página.',
      'Quando houver arquivo autorizado para publicação, use o link apresentado no repositório para acessar o conteúdo disponibilizado pelo Portal.',
      'Use a página Como chegar para abrir a rota até o Departamento de Enfermagem e conferir os locais atualmente utilizados para as apresentações.',
      'Se uma informação não estiver publicada, ela continua restrita ao fluxo interno e não será exibida apenas por estar cadastrada no processo.',
    ],
    attention: 'As páginas públicas mostram somente o que foi preparado para consulta externa; documentos internos do processo não fazem parte dessa navegação.',
    finish: 'Para acompanhar uma defesa, normalmente basta usar o calendário, o repositório e a página Como chegar.',
  },
};

export const PortalTutorialPage: React.FC<PortalTutorialPageProps> = ({ onNavigate }) => {
  void onNavigate;
  const [role, setRole] = useState<Role>('aluno');
  const active = useMemo(() => roleContent[role], [role]);

  return (
    <div id="portal-tutorial-page" className="mx-auto max-w-5xl space-y-3 py-2">
      <section className="rounded-2xl border border-emerald-900/80 bg-[#005830] px-3 py-2 text-white shadow-sm sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white shadow-2xs" aria-hidden="true">
            <HelpCircle className="h-4 w-4 text-slate-700" />
          </span>
          <h1 className="text-base font-black uppercase tracking-tight text-white sm:text-lg">Como usar o Portal de TCC</h1>
        </div>

        <div className="mt-2 pt-1.5 border-t border-white/25 flex flex-wrap items-center gap-2 text-xs min-w-0 w-full">
          <span className="text-[10px] opacity-80 font-black uppercase tracking-wider shrink-0">Filtrar visão:</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(Object.keys(roleContent) as Role[]).map((key) => {
              const selected = role === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRole(key)}
                  data-selected={selected ? 'true' : 'false'}
                  className={`portal-table-filter-chip inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide cursor-pointer transition-all border select-none ${
                    selected ? 'shadow-xs scale-[1.02]' : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <span>{roleContent[key].title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-300 bg-[#f0f0f0] shadow-sm">
        <div className="p-3 sm:p-4">
          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#337959] text-white shadow-sm"><UserCheck className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#337959]">Visão selecionada</div>
              <h2 className="mt-0.5 text-lg font-black text-slate-950">{active.title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{active.description}</p>
            </div>
          </div>

          <ol className="mt-3 grid gap-2.5 md:grid-cols-2">
            {active.steps.map((step, index) => (
              <li key={step} className="flex gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-5 text-slate-700 shadow-2xs">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#337959] text-[10px] font-black text-white">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-3 grid gap-2.5 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-900">
                <Info className="h-4 w-4 text-[#337959]" />
                Antes de avançar
              </div>
              <p className="mt-1.5 text-xs leading-5 text-slate-600">{active.attention}</p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3.5 py-3 shadow-2xs">
              <div className="text-xs font-black uppercase tracking-wide text-slate-900">Quando esta visão termina</div>
              <p className="mt-1.5 text-xs leading-5 text-slate-700">{active.finish}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
