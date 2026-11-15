import type {ProcessEtapa} from '../types';
export const ETAPAS_CONFIG: { code: ProcessEtapa; label: string; description: string }[] = [
  { code: 'CADASTRO', label: 'Cadastro', description: 'Dados do trabalho cadastrados no Portal.' },
  { code: 'AGENDAMENTO', label: 'Agendamento', description: 'Data, horário e local da defesa em confirmação.' },
  { code: 'CONVITE', label: 'Convite e Banca', description: 'Banca definida e convite encaminhado aos participantes.' },
  { code: 'DEFESA', label: 'Defesa', description: 'Apresentação do Trabalho de Conclusão de Curso.' },
  { code: 'AVALIACAO', label: 'Conceito e Ata', description: 'Registro do conceito deliberado pela banca e da ata da defesa.' },
  { code: 'ASSINATURA', label: 'Assinaturas', description: 'Documentos encaminhados para assinatura eletrônica.' },
  { code: 'DOCUMENTOS', label: 'Documentos', description: 'Documentos finais gerados, assinados, enviados ao repositório e arquivados.' },
  { code: 'CONCLUIDO', label: 'Concluído', description: 'Fluxo acadêmico e documental finalizado.' },
];

export const ETAPA_PROGRESS_ALIAS: Partial<Record<ProcessEtapa, ProcessEtapa>> = {
  CONFIRMACAO_LOCAL: 'AGENDAMENTO',
  REPOSITORIO: 'DOCUMENTOS',
};

export const ETAPA_CURRENT_LABEL: Partial<Record<ProcessEtapa, string>> = {
  CONFIRMACAO_LOCAL: 'Confirmação dos dados e local',
  REPOSITORIO: 'Repositório',
};
