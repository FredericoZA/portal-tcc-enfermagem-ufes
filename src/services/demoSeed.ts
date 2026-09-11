import { ProcessData, GlobalSettings, ProcessMembership, AuditLog } from '../types';
import { DEFAULT_FEATURE_FLAGS, DEFAULT_INSTALLATION_PROFILE } from '../constants/installation';

export const INITIAL_SETTINGS: GlobalSettings = {
  installationProfile: DEFAULT_INSTALLATION_PROFILE,
  academicCycles: [],
  featureFlags: DEFAULT_FEATURE_FLAGS,
  masterEmail: 'master@portal.local',
  commissionPresidentEmail: 'presidente@portal.local',
  masterRecoveryEmails: [],
  commissionPresidentName: '',
  substituteCoordinatorName: '',
  portalMaintainerName: '',
  contactEmail: '',
  whatsappUrl: '',
  appEnvironment: 'development',
  timezone: 'America/Sao_Paulo',
  slotDurationMinutes: 90,
  defaultEditLockMode: 'UNTIL_EVALUATION_SUBMITTED',
  optionalTimeLockEnabled: false,
  optionalEditLockHoursBeforeDefense: 48,
  evaluationOutcomeOptions: [
    { code: 'APROVADO', label: 'Aprovado (x ≥ 7,00)' },
    { code: 'APROVADO_COM_RESTRICAO', label: 'Aprovado com Restrição (5,00 ≤ x < 7,00)' },
    { code: 'NAO_APROVADO', label: 'Não Aprovado (x < 5,00)' },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEMO_PROCESSES: ProcessData[] = [
  {
    id: 'demo-proc-1',
    protocolo: 'TCC-2026-0001',
    titulo: 'Cuidados de Enfermagem na Saúde da Mulher no Período Puerperal',
    etapaAtual: 'DEFESA',
    status: 'AGUARDANDO_DEFESA',
    createdByEmail: 'mariana.silva@aluno.ufes.br',
    aluno1: {
      nome: 'Mariana Silva de Oliveira',
      matricula: '2022101234',
      email: 'mariana.silva@aluno.ufes.br'
    },
    aluno2: null,
    orientador: {
      nome: 'Dra. Ana Paula Santos',
      email: 'ana.santos@ufes.br',
      instituicao: 'UFES'
    },
    coorientador: {
      nome: 'Dr. Roberto Lima',
      email: 'roberto.lima@ufes.br',
      instituicao: 'UFES / Hospital Universitário Cassiano Antonio Moraes'
    },
    banca: [
      { id: 'b1', nome: 'Dra. Ana Paula Santos', email: 'ana.santos@ufes.br', funcao: 'ORIENTADOR', membroTipo: 'INTERNO', instituicao: 'UFES - Departamento de Enfermagem', profissao: 'Enfermeira', titulacao: 'Doutora em Enfermagem' },
      { id: 'b2', nome: 'Prof. Dr. Carlos Eduardo Rocha', email: 'carlos.rocha@ufes.br', funcao: 'EXAMINER_2', membroTipo: 'INTERNO', instituicao: 'UFES - Departamento de Enfermagem', profissao: 'Professor Titular', titulacao: 'Doutor' },
      { id: 'b3', nome: 'Dra. Beatriz Ferreira Mendes', email: 'beatriz.mendes@fiocruz.br', funcao: 'EXAMINER_3', membroTipo: 'EXTERNO', instituicao: 'Fiocruz / Escola Nacional de Saúde Pública', profissao: 'Pesquisadora em Saúde Pública', titulacao: 'Doutora' }
    ],
    defesa: {
      startAt: '2026-08-15T14:00:00.000Z',
      endAt: '2026-08-15T15:30:00.000Z',
      local: 'Auditório do Departamento de Enfermagem - CCS/UFES'
    },
    avaliacao: {
      status: 'PENDENTE'
    },
    acervo: {
      palavrasChave: ['Puerpério', 'Saúde da Mulher', 'Assistência de Enfermagem', 'Atenção Primária', 'Humanização'],
      resumoSintese: 'Este Trabalho de Conclusão de Curso investiga a assistência de enfermagem voltada para puérperas no âmbito do SUS, destacando os cuidados preventivos e o acompanhamento no pós-parto imediato e tardio.',
      resumoExpandidoFileUrl: 'Resumo_Expandido_Mariana_Silva.pdf',
      trabalhoCompletoFileUrl: 'Monografia_Completa_Mariana_Silva.pdf',
      submittedAt: '2026-07-02T11:00:00.000Z'
    },
    dataRevision: 1,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z'
  },
  {
    id: 'demo-proc-2',
    protocolo: 'TCC-2026-0002',
    titulo: 'Impacto do Atendimento Humanizado em Unidades de Terapia Intensiva Neonatal',
    etapaAtual: 'AVALIACAO',
    status: 'EM_AVALIACAO',
    createdByEmail: 'joao.pedro@aluno.ufes.br',
    aluno1: {
      nome: 'João Pedro de Souza',
      matricula: '2022105678',
      email: 'joao.pedro@aluno.ufes.br'
    },
    aluno2: {
      nome: 'Beatriz Costa e Silva',
      matricula: '2022105679',
      email: 'beatriz.costa@aluno.ufes.br'
    },
    orientador: {
      nome: 'Dra. Ana Paula Santos',
      email: 'ana.santos@ufes.br'
    },
    coorientador: null,
    banca: [
      { id: 'b1', nome: 'Dra. Ana Paula Santos', email: 'ana.santos@ufes.br', funcao: 'ORIENTADOR' },
      { id: 'b2', nome: 'Dr. Fernando Dias', email: 'fernando.dias@ufes.br', funcao: 'EXAMINER_2' },
      { id: 'b3', nome: 'Dra. Camila Nogueira', email: 'camila.nogueira@ufes.br', funcao: 'EXAMINER_3' }
    ],
    defesa: {
      startAt: '2026-07-20T09:00:00.000Z',
      endAt: '2026-07-20T10:30:00.000Z',
      local: 'Auditório do Departamento de Enfermagem - CCS/UFES'
    },
    avaliacao: {
      status: 'PENDENTE'
    },
    acervo: {
      palavrasChave: ['UTI Neonatal', 'Atendimento Humanizado', 'Enfermagem Neonatal', 'Recém-Nascido', 'Cuidado Centrado na Família'],
      resumoSintese: 'Estudo descritivo que analisa a implementação de protocolos de humanização em Unidades de Terapia Intensiva Neonatal no Espírito Santo.',
      resumoExpandidoFileUrl: 'Resumo_Expandido_UTI_Neonatal.pdf',
      trabalhoCompletoFileUrl: 'Monografia_Humanizacao_UTIN.pdf',
      submittedAt: '2026-07-06T14:00:00.000Z'
    },
    dataRevision: 1,
    createdAt: '2026-07-05T14:30:00.000Z',
    updatedAt: '2026-07-20T09:00:00.000Z'
  },
  {
    id: 'demo-proc-3',
    protocolo: 'TCC-2026-0003',
    titulo: 'Sistemática de Assistência de Enfermagem ao Paciente Oncológico em Tratamento Quimioterápico',
    etapaAtual: 'ASSINATURA',
    status: 'AGUARDANDO_ASSINATURA',
    createdByEmail: 'lucas.almeida@aluno.ufes.br',
    aluno1: {
      nome: 'Lucas Almeida Ribeiro',
      matricula: '2021209988',
      email: 'lucas.almeida@aluno.ufes.br'
    },
    aluno2: null,
    orientador: {
      nome: 'Prof. Dr. Carlos Eduardo Rocha',
      email: 'carlos.rocha@ufes.br'
    },
    coorientador: {
      nome: 'Dra. Ana Paula Santos',
      email: 'ana.santos@ufes.br'
    },
    banca: [
      { id: 'b1', nome: 'Prof. Dr. Carlos Eduardo Rocha', email: 'carlos.rocha@ufes.br', funcao: 'ORIENTADOR' },
      { id: 'b2', nome: 'Dra. Beatriz Ferreira Mendes', email: 'beatriz.mendes@ufes.br', funcao: 'EXAMINER_2' },
      { id: 'b3', nome: 'Dr. Fernando Dias', email: 'fernando.dias@ufes.br', funcao: 'EXAMINER_3' }
    ],
    defesa: {
      startAt: '2026-07-10T15:00:00.000Z',
      endAt: '2026-07-10T16:30:00.000Z',
      local: 'Auditório do Departamento de Enfermagem - CCS/UFES'
    },
    avaliacao: {
      status: 'CONCLUIDO',
      resultadoCode: 'APROVADO',
      resultadoLabel: 'Aprovado (x ≥ 7,00)',
      notaFinal: 9.5,
      parecer: 'O candidato apresentou o trabalho com relevante domínio teórico-prático e excelente clareza metodológica. A banca examinadora aprova o trabalho com nota final 9,50.',
      submittedBy: 'carlos.rocha@ufes.br',
      submittedAt: '2026-07-10T16:45:00.000Z',
      updatedAt: '2026-07-10T16:45:00.000Z'
    },
    acervo: {
      palavrasChave: ['Oncologia', 'Quimioterapia', 'Assistência de Enfermagem', 'SAE', 'Segurança do Paciente'],
      resumoSintese: 'Trabalho focado na Sistematização da Assistência de Enfermagem (SAE) prestada a pacientes oncológicos submetidos a esquemas quimioterápicos.',
      resumoExpandidoFileUrl: 'Resumo_Expandido_Lucas_Almeida.pdf',
      trabalhoCompletoFileUrl: 'TCC_Monografia_Lucas_Almeida_Oncologia.pdf',
      submittedAt: '2026-07-11T09:00:00.000Z'
    },
    dataRevision: 2,
    createdAt: '2026-06-15T08:00:00.000Z',
    updatedAt: '2026-07-10T16:45:00.000Z'
  },
  {
    id: 'demo-proc-4',
    protocolo: 'TCC-2026-0004',
    titulo: 'Análise Epidemiológica das Internações por Infecções Puerperais no Espírito Santo',
    etapaAtual: 'DEFESA',
    status: 'AGUARDANDO_DEFESA',
    createdByEmail: 'roberta.vasconcelos@aluno.ufes.br',
    aluno1: {
      nome: 'Roberta Vasconcelos de Aguiar',
      matricula: '2022109911',
      email: 'roberta.vasconcelos@aluno.ufes.br'
    },
    aluno2: null,
    orientador: {
      nome: 'Prof.ª Drª. Luciana de Cássia Nunes Nascimento',
      email: 'luciana.nascimento@ufes.br'
    },
    coorientador: null,
    banca: [
      { id: 'b1', nome: 'Prof.ª Drª. Luciana de Cássia Nunes Nascimento', email: 'luciana.nascimento@ufes.br', funcao: 'ORIENTADOR' },
      { id: 'b2', nome: 'Prof.ª Drª. Márcia Valéria de Souza Almeida', email: 'marcia.almeida@ufes.br', funcao: 'EXAMINER_2' },
      { id: 'b3', nome: 'Dra. Ana Paula Santos', email: 'ana.santos@ufes.br', funcao: 'EXAMINER_3' }
    ],
    defesa: {
      startAt: '2026-07-21T13:00:00.000Z',
      endAt: '2026-07-21T14:30:00.000Z',
      local: 'Auditório do Departamento de Enfermagem - CCS/UFES'
    },
    avaliacao: {
      status: 'PENDENTE'
    },
    acervo: {
      palavrasChave: ['Epidemiologia', 'Infecções Puerperais', 'Puerpério', 'Saúde Pública', 'Espírito Santo'],
      resumoSintese: 'Estudo epidemiológico descritivo das internações por infecções puerperais nos hospitais da rede pública do Espírito Santo, relacionando fatores de risco socioeconômicos e clínicos.',
      resumoExpandidoFileUrl: 'Resumo_Expandido_Roberta_Vasconcelos.pdf',
      trabalhoCompletoFileUrl: 'Monografia_Roberta_Vasconcelos_Epidemiologia.pdf',
      submittedAt: '2026-07-08T10:00:00.000Z'
    },
    dataRevision: 1,
    createdAt: '2026-07-07T09:00:00.000Z',
    updatedAt: '2026-07-08T10:00:00.000Z'
  },
  {
    id: 'demo-proc-5',
    protocolo: 'TCC-2026-0005',
    titulo: 'O Impacto do Estresse Ocupacional na Saúde Mental das Equipes de Enfermagem em UTIs Adulto',
    etapaAtual: 'AVALIACAO',
    status: 'EM_AVALIACAO',
    createdByEmail: 'mateus.lima@aluno.ufes.br',
    aluno1: {
      nome: 'Mateus de Souza Lima',
      matricula: '2022108822',
      email: 'mateus.lima@aluno.ufes.br'
    },
    aluno2: null,
    orientador: {
      nome: 'Prof. Dr. Carlos Eduardo Rocha',
      email: 'carlos.rocha@ufes.br'
    },
    coorientador: null,
    banca: [
      { id: 'b1', nome: 'Prof. Dr. Carlos Eduardo Rocha', email: 'carlos.rocha@ufes.br', funcao: 'ORIENTADOR' },
      { id: 'b2', nome: 'Dra. Beatriz Ferreira Mendes', email: 'beatriz.mendes@ufes.br', funcao: 'EXAMINER_2' },
      { id: 'b3', nome: 'Prof.ª Drª. Luciana de Cássia Nunes Nascimento', email: 'luciana.nascimento@ufes.br', funcao: 'EXAMINER_3' }
    ],
    defesa: {
      startAt: '2026-07-22T17:00:00.000Z',
      endAt: '2026-07-22T18:30:00.000Z',
      local: 'Auditório do Departamento de Enfermagem - CCS/UFES'
    },
    avaliacao: {
      status: 'PENDENTE'
    },
    acervo: {
      palavrasChave: ['Saúde Trabalhador', 'Estresse Ocupacional', 'UTI Adulto', 'Burnout', 'Saúde Mental'],
      resumoSintese: 'Análise dos níveis de estresse e esgotamento profissional em profissionais de enfermagem atuantes em Unidades de Terapia Intensiva Adulto no município de Vitória/ES.',
      resumoExpandidoFileUrl: 'Resumo_Expandido_Mateus_Lima.pdf',
      trabalhoCompletoFileUrl: 'Monografia_Mateus_Lima_Estresse_UTI.pdf',
      submittedAt: '2026-07-09T14:00:00.000Z'
    },
    dataRevision: 1,
    createdAt: '2026-07-08T11:00:00.000Z',
    updatedAt: '2026-07-09T14:00:00.000Z'
  },
  {
    id: 'demo-proc-6',
    protocolo: 'TCC-2026-0006',
    titulo: 'Humanização no Atendimento de Urgência e Emergência Pediátrica: Desafios e Práticas',
    etapaAtual: 'DEFESA',
    status: 'AGUARDANDO_DEFESA',
    createdByEmail: 'fernanda.gomes@aluno.ufes.br',
    aluno1: {
      nome: 'Fernanda Silveira Gomes',
      matricula: '2022107733',
      email: 'fernanda.gomes@aluno.ufes.br'
    },
    aluno2: null,
    orientador: {
      nome: 'Prof.ª Drª. Márcia Valéria de Souza Almeida',
      email: 'marcia.almeida@ufes.br'
    },
    coorientador: null,
    banca: [
      { id: 'b1', nome: 'Prof.ª Drª. Márcia Valéria de Souza Almeida', email: 'marcia.almeida@ufes.br', funcao: 'ORIENTADOR' },
      { id: 'b2', nome: 'Dra. Ana Paula Santos', email: 'ana.santos@ufes.br', funcao: 'EXAMINER_2' },
      { id: 'b3', nome: 'Dr. Fernando Dias', email: 'fernando.dias@ufes.br', funcao: 'EXAMINER_3' }
    ],
    defesa: {
      startAt: '2026-07-24T19:00:00.000Z',
      endAt: '2026-07-24T20:30:00.000Z',
      local: 'Auditório do Departamento de Enfermagem - CCS/UFES'
    },
    avaliacao: {
      status: 'PENDENTE'
    },
    acervo: {
      palavrasChave: ['Urgência Pediátrica', 'Humanização', 'Emergência', 'Acolhimento', 'Pediatria'],
      resumoSintese: 'Pesquisa sobre os desafios enfrentados pela equipe de enfermagem no acolhimento com classificação de risco em pronto-socorros pediátricos.',
      resumoExpandidoFileUrl: 'Resumo_Expandido_Fernanda_Gomes.pdf',
      trabalhoCompletoFileUrl: 'Monografia_Fernanda_Gomes_Pediatria.pdf',
      submittedAt: '2026-07-12T16:00:00.000Z'
    },
    dataRevision: 1,
    createdAt: '2026-07-11T13:00:00.000Z',
    updatedAt: '2026-07-12T16:00:00.000Z'
  },
  {
    id: 'demo-proc-7',
    protocolo: 'TCC-2026-0007',
    titulo: 'Acolhimento e Estratégias de Humanização da Enfermagem em Saúde Mental na Atenção Básica',
    etapaAtual: 'CADASTRO',
    status: 'EM_RASCUNHO',
    createdByEmail: 'carolina.fonseca@aluno.ufes.br',
    aluno1: {
      nome: 'Carolina Mendes Fonseca',
      matricula: '2022104455',
      email: 'carolina.fonseca@aluno.ufes.br'
    },
    aluno2: null,
    orientador: {
      nome: 'Prof.ª Drª. Luciana de Cássia Nunes Nascimento',
      email: 'luciana.nascimento@ufes.br'
    },
    coorientador: null,
    banca: [
      { id: 'b1', nome: 'Prof.ª Drª. Luciana de Cássia Nunes Nascimento', email: 'luciana.nascimento@ufes.br', funcao: 'ORIENTADOR' },
      { id: 'b2', nome: 'Prof.ª Drª. Márcia Valéria de Souza Almeida', email: 'marcia.almeida@ufes.br', funcao: 'EXAMINER_2' },
      { id: 'b3', nome: 'Dra. Beatriz Ferreira Mendes', email: 'beatriz.mendes@ufes.br', funcao: 'EXAMINER_3' }
    ],
    defesa: {
      startAt: '2026-09-15T13:00:00.000Z',
      endAt: '2026-09-15T14:30:00.000Z',
      local: 'Auditório do Departamento de Enfermagem - CCS/UFES'
    },
    avaliacao: {
      status: 'PENDENTE'
    },
    acervo: {
      palavrasChave: ['Saúde Mental', 'Atenção Básica', 'Acolhimento', 'Enfermagem', 'Humanização'],
      resumoSintese: 'Investigação acerca do papel da enfermagem na atenção primária à saúde frente ao sofrimento psíquico e reabilitação psicossocial na rede de atenção à saúde.',
      resumoExpandidoFileUrl: 'Resumo_Expandido_Carolina_Fonseca.pdf',
      trabalhoCompletoFileUrl: 'Monografia_Carolina_Fonseca_SaudeMental.pdf',
      submittedAt: '2026-07-14T10:00:00.000Z'
    },
    dataRevision: 1,
    createdAt: '2026-07-13T09:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z'
  },
  {
    id: 'demo-proc-8',
    protocolo: 'TCC-2026-0008',
    titulo: 'Avaliação dos Fatores de Risco em Unidades de Terapia Intensiva Neonatal',
    etapaAtual: 'DEFESA',
    status: 'AGUARDANDO_DEFESA',
    createdByEmail: 'ana.souza@aluno.ufes.br',
    aluno1: {
      nome: 'Ana Carolina Souza',
      matricula: '2022105671',
      email: 'ana.souza@aluno.ufes.br'
    },
    aluno2: {
      nome: 'Matheus de Souza Lima',
      matricula: '2022105672',
      email: 'mateus.lima@aluno.ufes.br'
    },
    orientador: {
      nome: 'Dra. Ana Paula Santos',
      email: 'ana.santos@ufes.br'
    },
    coorientador: null,
    banca: [
      { id: 'b1', nome: 'Dra. Ana Paula Santos', email: 'ana.santos@ufes.br', funcao: 'ORIENTADOR', profissao: 'Docente UFES',  titulacao: 'Doutora' },
      { id: 'b2', nome: 'Prof. Dr. Carlos Eduardo Rocha', email: 'carlos.rocha@ufes.br', funcao: 'EXAMINER_2', profissao: 'Docente UFES',  titulacao: 'Doutor' },
      { id: 'b3', nome: 'Dra. Beatriz Ferreira Mendes', email: 'beatriz.mendes@ufes.br', funcao: 'EXAMINER_3', profissao: 'Enfermeira Assistencial', titulacao: 'Mestre' }
    ],
    defesa: {
      startAt: '2026-07-20T08:00:00.000Z',
      endAt: '2026-07-20T09:30:00.000Z',
      local: 'Auditório do Departamento de Enfermagem - CCS/UFES'
    },
    avaliacao: {
      status: 'PENDENTE'
    },
    acervo: {
      palavrasChave: ['UTI Neonatal', 'Fatores de Risco', 'Recém-Nascido', 'Enfermagem Pediátrica'],
      resumoSintese: 'Trabalho que estuda os principais fatores de risco associados a internações prolongadas em Unidades de Terapia Intensiva Neonatal no Espírito Santo.'
    },
    dataRevision: 1,
    createdAt: '2026-07-10T10:00:00.000Z',
    updatedAt: '2026-07-10T10:00:00.000Z'
  },
  {
    id: 'demo-proc-9',
    protocolo: 'TCC-2026-0009',
    titulo: 'Impacto da Humanização no Cuidado de Enfermagem na Urgência e Emergência',
    etapaAtual: 'DEFESA',
    status: 'AGUARDANDO_DEFESA',
    createdByEmail: 'juliana.melo@aluno.ufes.br',
    aluno1: {
      nome: 'Juliana Barbosa Melo',
      matricula: '2022105673',
      email: 'juliana.melo@aluno.ufes.br'
    },
    aluno2: null,
    orientador: {
      nome: 'Prof. Dr. Carlos Eduardo Rocha',
      email: 'carlos.rocha@ufes.br'
    },
    coorientador: null,
    banca: [
      { id: 'b1', nome: 'Prof. Dr. Carlos Eduardo Rocha', email: 'carlos.rocha@ufes.br', funcao: 'ORIENTADOR', profissao: 'Docente UFES',  titulacao: 'Doutor' },
      { id: 'b2', nome: 'Prof.ª Drª. Luciana de Cássia Nunes Nascimento', email: 'luciana.nascimento@ufes.br', funcao: 'EXAMINER_2', profissao: 'Docente UFES',  titulacao: 'Doutora' },
      { id: 'b3', nome: 'Dr. Fernando Dias', email: 'fernando.dias@ufes.br', funcao: 'EXAMINER_3', profissao: 'Docente Convidado',  titulacao: 'Doutor' }
    ],
    defesa: {
      startAt: '2026-07-20T09:30:00.000Z',
      endAt: '2026-07-20T11:00:00.000Z',
      local: 'Auditório do Departamento de Enfermagem - CCS/UFES'
    },
    avaliacao: {
      status: 'PENDENTE'
    },
    acervo: {
      palavrasChave: ['Humanização', 'Urgência e Emergência', 'Acolhimento', 'Classificação de Risco'],
      resumoSintese: 'Análise qualitativa sobre os efeitos de práticas humanizadas no tempo de resposta e satisfação de pacientes em prontos-socorros.'
    },
    dataRevision: 1,
    createdAt: '2026-07-11T10:00:00.000Z',
    updatedAt: '2026-07-11T10:00:00.000Z'
  },
  {
    id: 'demo-proc-10',
    protocolo: 'TCC-2026-0010',
    titulo: 'Prevalência de Lesões por Pressão em Idosos Hospitalizados: Abordagem Preventiva',
    etapaAtual: 'DEFESA',
    status: 'AGUARDANDO_DEFESA',
    createdByEmail: 'lucas.cruz@aluno.ufes.br',
    aluno1: {
      nome: 'Lucas de Oliveira Cruz',
      matricula: '2022105674',
      email: 'lucas.cruz@aluno.ufes.br'
    },
    aluno2: null,
    orientador: {
      nome: 'Prof.ª Drª. Luciana de Cássia Nunes Nascimento',
      email: 'luciana.nascimento@ufes.br'
    },
    coorientador: null,
    banca: [
      { id: 'b1', nome: 'Prof.ª Drª. Luciana de Cássia Nunes Nascimento', email: 'luciana.nascimento@ufes.br', funcao: 'ORIENTADOR', profissao: 'Docente UFES',  titulacao: 'Doutora' },
      { id: 'b2', nome: 'Prof.ª Drª. Márcia Valéria de Souza Almeida', email: 'marcia.almeida@ufes.br', funcao: 'EXAMINER_2', profissao: 'Docente UFES',  titulacao: 'Doutora' },
      { id: 'b3', nome: 'Dra. Camila Nogueira', email: 'camila.nogueira@ufes.br', funcao: 'EXAMINER_3', profissao: 'Docente Convidada',  titulacao: 'Doutora' }
    ],
    defesa: {
      startAt: '2026-07-20T11:00:00.000Z',
      endAt: '2026-07-20T12:30:00.000Z',
      local: 'Auditório do Departamento de Enfermagem - CCS/UFES'
    },
    avaliacao: {
      status: 'PENDENTE'
    },
    acervo: {
      palavrasChave: ['Lesão por Pressão', 'Idosos', 'Prevenção', 'Cuidados Intensivos'],
      resumoSintese: 'Estudo epidemiológico transversal sobre a incidência de lesões por pressão em idosos acamados e as melhores diretrizes preventivas.'
    },
    dataRevision: 1,
    createdAt: '2026-07-12T10:00:00.000Z',
    updatedAt: '2026-07-12T10:00:00.000Z'
  },
  {
    id: 'demo-proc-11',
    protocolo: 'TCC-2026-0011',
    titulo: 'Uso de Tecnologias Digitais na Educação em Saúde de Pacientes Diabéticos',
    etapaAtual: 'DEFESA',
    status: 'AGUARDANDO_DEFESA',
    createdByEmail: 'leticia.rosa@aluno.ufes.br',
    aluno1: {
      nome: 'Letícia Guimarães Rosa',
      matricula: '2022105675',
      email: 'leticia.rosa@aluno.ufes.br'
    },
    aluno2: {
      nome: 'Fernanda Martins Correia',
      matricula: '2022105676',
      email: 'fernanda.correia@aluno.ufes.br'
    },
    orientador: {
      nome: 'Prof.ª Drª. Márcia Valéria de Souza Almeida',
      email: 'marcia.almeida@ufes.br'
    },
    coorientador: null,
    banca: [
      { id: 'b1', nome: 'Prof.ª Drª. Márcia Valéria de Souza Almeida', email: 'marcia.almeida@ufes.br', funcao: 'ORIENTADOR', profissao: 'Docente UFES',  titulacao: 'Doutora' },
      { id: 'b2', nome: 'Dra. Ana Paula Santos', email: 'ana.santos@ufes.br', funcao: 'EXAMINER_2', profissao: 'Docente UFES',  titulacao: 'Doutora' },
      { id: 'b3', nome: 'Dra. Beatriz Ferreira Mendes', email: 'beatriz.mendes@ufes.br', funcao: 'EXAMINER_3', profissao: 'Enfermeira UFES',  titulacao: 'Mestre' }
    ],
    defesa: {
      startAt: '2026-07-20T14:00:00.000Z',
      endAt: '2026-07-20T15:30:00.000Z',
      local: 'Auditório do Departamento de Enfermagem - CCS/UFES'
    },
    avaliacao: {
      status: 'PENDENTE'
    },
    acervo: {
      palavrasChave: ['Tecnologia Digital', 'Educação em Saúde', 'Diabetes Mellitus', 'Teleenfermagem'],
      resumoSintese: 'Investigação do impacto de aplicativos móveis no acompanhamento e controle glicêmico de idosos diabéticos cadastrados na Estratégia Saúde da Família.'
    },
    dataRevision: 1,
    createdAt: '2026-07-13T10:00:00.000Z',
    updatedAt: '2026-07-13T10:00:00.000Z'
  },
  {
    id: 'demo-proc-12',
    protocolo: 'TCC-2026-0012',
    titulo: 'A Importância do Pré-Natal Conduzido pela Enfermagem na Atenção Primária',
    etapaAtual: 'DEFESA',
    status: 'AGUARDANDO_DEFESA',
    createdByEmail: 'thiago.araujo@aluno.ufes.br',
    aluno1: {
      nome: 'Thiago Mendes Araujo',
      matricula: '2022105677',
      email: 'thiago.araujo@aluno.ufes.br'
    },
    aluno2: null,
    orientador: {
      nome: 'Dra. Ana Paula Santos',
      email: 'ana.santos@ufes.br'
    },
    coorientador: null,
    banca: [
      { id: 'b1', nome: 'Dra. Ana Paula Santos', email: 'ana.santos@ufes.br', funcao: 'ORIENTADOR', profissao: 'Docente UFES',  titulacao: 'Doutora' },
      { id: 'b2', nome: 'Dr. Fernando Dias', email: 'fernando.dias@ufes.br', funcao: 'EXAMINER_2', profissao: 'Docente Convidado',  titulacao: 'Doutor' },
      { id: 'b3', nome: 'Dra. Camila Nogueira', email: 'camila.nogueira@ufes.br', funcao: 'EXAMINER_3', profissao: 'Docente Convidada',  titulacao: 'Doutora' }
    ],
    defesa: {
      startAt: '2026-07-20T15:30:00.000Z',
      endAt: '2026-07-20T17:00:00.000Z',
      local: 'Auditório do Departamento de Enfermagem - CCS/UFES'
    },
    avaliacao: {
      status: 'PENDENTE'
    },
    acervo: {
      palavrasChave: ['Pré-Natal', 'Atenção Primária', 'Enfermagem Obstétrica', 'Saúde da Mulher'],
      resumoSintese: 'Trabalho que destaca as competências e a importância do profissional de enfermagem nas consultas de pré-natal de baixo risco na Atenção Básica.'
    },
    dataRevision: 1,
    createdAt: '2026-07-14T10:00:00.000Z',
    updatedAt: '2026-07-14T10:00:00.000Z'
  },
  {
    id: 'demo-proc-13',
    protocolo: 'TCC-2026-0013',
    titulo: 'Saúde Mental da Equipe de Enfermagem no Contexto Pós-Pandemia',
    etapaAtual: 'DEFESA',
    status: 'AGUARDANDO_DEFESA',
    createdByEmail: 'camila.santos@aluno.ufes.br',
    aluno1: {
      nome: 'Camila Vieira Santos',
      matricula: '2022105678',
      email: 'camila.santos@aluno.ufes.br'
    },
    aluno2: null,
    orientador: {
      nome: 'Prof. Dr. Carlos Eduardo Rocha',
      email: 'carlos.rocha@ufes.br'
    },
    coorientador: null,
    banca: [
      { id: 'b1', nome: 'Prof. Dr. Carlos Eduardo Rocha', email: 'carlos.rocha@ufes.br', funcao: 'ORIENTADOR', profissao: 'Docente UFES',  titulacao: 'Doutor' },
      { id: 'b2', nome: 'Prof.ª Drª. Luciana de Cássia Nunes Nascimento', email: 'luciana.nascimento@ufes.br', funcao: 'EXAMINER_2', profissao: 'Docente UFES',  titulacao: 'Doutora' },
      { id: 'b3', nome: 'Prof.ª Drª. Márcia Valéria de Souza Almeida', email: 'marcia.almeida@ufes.br', funcao: 'EXAMINER_3', profissao: 'Docente UFES',  titulacao: 'Doutora' }
    ],
    defesa: {
      startAt: '2026-07-20T17:00:00.000Z',
      endAt: '2026-07-20T18:30:00.000Z',
      local: 'Auditório do Departamento de Enfermagem - CCS/UFES'
    },
    avaliacao: {
      status: 'PENDENTE'
    },
    acervo: {
      palavrasChave: ['Saúde Mental', 'Equipe de Enfermagem', 'Pós-Pandemia', 'Ansiedade', 'Depressão'],
      resumoSintese: 'Análise transversal dos agravos de saúde mental sofridos por enfermeiros e técnicos de enfermagem após o período crítico de enfrentamento da COVID-19.'
    },
    dataRevision: 1,
    createdAt: '2026-07-15T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z'
  }
];

export const DEMO_MEMBERSHIPS: ProcessMembership[] = [
  // Mariana Silva (proc 1)
  { id: 'm1', processId: 'demo-proc-1', email: 'mariana.silva@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-01T10:00:00.000Z', updatedAt: '2026-07-01T10:00:00.000Z' },
  { id: 'm2', processId: 'demo-proc-1', email: 'ana.santos@ufes.br', roles: ['ADVISOR'], active: true, createdAt: '2026-07-01T10:00:00.000Z', updatedAt: '2026-07-01T10:00:00.000Z' },
  // João Pedro & Beatriz (proc 2)
  { id: 'm3', processId: 'demo-proc-2', email: 'joao.pedro@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-05T14:30:00.000Z', updatedAt: '2026-07-05T14:30:00.000Z' },
  { id: 'm4', processId: 'demo-proc-2', email: 'beatriz.costa@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-05T14:30:00.000Z', updatedAt: '2026-07-05T14:30:00.000Z' },
  { id: 'm5', processId: 'demo-proc-2', email: 'ana.santos@ufes.br', roles: ['ADVISOR'], active: true, createdAt: '2026-07-05T14:30:00.000Z', updatedAt: '2026-07-05T14:30:00.000Z' },
  // Lucas Almeida (proc 3)
  { id: 'm6', processId: 'demo-proc-3', email: 'lucas.almeida@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-06-15T08:00:00.000Z', updatedAt: '2026-06-15T08:00:00.000Z' },
  { id: 'm7', processId: 'demo-proc-3', email: 'carlos.rocha@ufes.br', roles: ['ADVISOR'], active: true, createdAt: '2026-06-15T08:00:00.000Z', updatedAt: '2026-06-15T08:00:00.000Z' },
  // Roberta Vasconcelos (proc 4)
  { id: 'm8', processId: 'demo-proc-4', email: 'roberta.vasconcelos@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-07T09:00:00.000Z', updatedAt: '2026-07-07T09:00:00.000Z' },
  { id: 'm9', processId: 'demo-proc-4', email: 'luciana.nascimento@ufes.br', roles: ['ADVISOR'], active: true, createdAt: '2026-07-07T09:00:00.000Z', updatedAt: '2026-07-07T09:00:00.000Z' },
  // Mateus de Souza Lima (proc 5)
  { id: 'm10', processId: 'demo-proc-5', email: 'mateus.lima@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-08T11:00:00.000Z', updatedAt: '2026-07-08T11:00:00.000Z' },
  { id: 'm11', processId: 'demo-proc-5', email: 'carlos.rocha@ufes.br', roles: ['ADVISOR'], active: true, createdAt: '2026-07-08T11:00:00.000Z', updatedAt: '2026-07-08T11:00:00.000Z' },
  // Fernanda Silveira Gomes (proc 6)
  { id: 'm12', processId: 'demo-proc-6', email: 'fernanda.gomes@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-11T13:00:00.000Z', updatedAt: '2026-07-11T13:00:00.000Z' },
  { id: 'm13', processId: 'demo-proc-6', email: 'marcia.almeida@ufes.br', roles: ['ADVISOR'], active: true, createdAt: '2026-07-11T13:00:00.000Z', updatedAt: '2026-07-11T13:00:00.000Z' },
  // Carolina Mendes Fonseca (proc 7)
  { id: 'm14', processId: 'demo-proc-7', email: 'carolina.fonseca@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-13T09:00:00.000Z', updatedAt: '2026-07-13T09:00:00.000Z' },
  { id: 'm15', processId: 'demo-proc-7', email: 'luciana.nascimento@ufes.br', roles: ['ADVISOR'], active: true, createdAt: '2026-07-13T09:00:00.000Z', updatedAt: '2026-07-13T09:00:00.000Z' },
  // Memberships for simulated defenses
  { id: 'm-sim8-s1', processId: 'demo-proc-8', email: 'ana.souza@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-10T10:00:00.000Z', updatedAt: '2026-07-10T10:00:00.000Z' },
  { id: 'm-sim8-s2', processId: 'demo-proc-8', email: 'mateus.lima@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-10T10:00:00.000Z', updatedAt: '2026-07-10T10:00:00.000Z' },
  { id: 'm-sim8-a1', processId: 'demo-proc-8', email: 'ana.santos@ufes.br', roles: ['ADVISOR'], active: true, createdAt: '2026-07-10T10:00:00.000Z', updatedAt: '2026-07-10T10:00:00.000Z' },
  
  { id: 'm-sim9-s1', processId: 'demo-proc-9', email: 'juliana.melo@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-11T10:00:00.000Z', updatedAt: '2026-07-11T10:00:00.000Z' },
  { id: 'm-sim9-a1', processId: 'demo-proc-9', email: 'carlos.rocha@ufes.br', roles: ['ADVISOR'], active: true, createdAt: '2026-07-11T10:00:00.000Z', updatedAt: '2026-07-11T10:00:00.000Z' },

  { id: 'm-sim10-s1', processId: 'demo-proc-10', email: 'lucas.cruz@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-12T10:00:00.000Z', updatedAt: '2026-07-12T10:00:00.000Z' },
  { id: 'm-sim10-a1', processId: 'demo-proc-10', email: 'luciana.nascimento@ufes.br', roles: ['ADVISOR'], active: true, createdAt: '2026-07-12T10:00:00.000Z', updatedAt: '2026-07-12T10:00:00.000Z' },

  { id: 'm-sim11-s1', processId: 'demo-proc-11', email: 'leticia.rosa@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-13T10:00:00.000Z', updatedAt: '2026-07-13T10:00:00.000Z' },
  { id: 'm-sim11-s2', processId: 'demo-proc-11', email: 'fernanda.correia@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-13T10:00:00.000Z', updatedAt: '2026-07-13T10:00:00.000Z' },
  { id: 'm-sim11-a1', processId: 'demo-proc-11', email: 'marcia.almeida@ufes.br', roles: ['ADVISOR'], active: true, createdAt: '2026-07-13T10:00:00.000Z', updatedAt: '2026-07-13T10:00:00.000Z' },

  { id: 'm-sim12-s1', processId: 'demo-proc-12', email: 'thiago.araujo@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-14T10:00:00.000Z', updatedAt: '2026-07-14T10:00:00.000Z' },
  { id: 'm-sim12-a1', processId: 'demo-proc-12', email: 'ana.santos@ufes.br', roles: ['ADVISOR'], active: true, createdAt: '2026-07-14T10:00:00.000Z', updatedAt: '2026-07-14T10:00:00.000Z' },

  { id: 'm-sim13-s1', processId: 'demo-proc-13', email: 'camila.santos@aluno.ufes.br', roles: ['STUDENT'], active: true, createdAt: '2026-07-15T10:00:00.000Z', updatedAt: '2026-07-15T10:00:00.000Z' },
  { id: 'm-sim13-a1', processId: 'demo-proc-13', email: 'carlos.rocha@ufes.br', roles: ['ADVISOR'], active: true, createdAt: '2026-07-15T10:00:00.000Z', updatedAt: '2026-07-15T10:00:00.000Z' },
];

export const DEMO_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    processId: 'demo-proc-1',
    actorEmail: 'mariana.silva@aluno.ufes.br',
    actorRoles: ['STUDENT'],
    action: 'CRIACAO_PROCESSO',
    entityType: 'processo',
    entityId: 'demo-proc-1',
    after: { protocolo: 'TCC-2026-0001' },
    timestamp: '2026-07-01T10:00:00.000Z'
  },
  {
    id: 'log-2',
    processId: 'demo-proc-3',
    actorEmail: 'carlos.rocha@ufes.br',
    actorRoles: ['ADVISOR'],
    action: 'CONCLUSAO_AVALIACAO',
    entityType: 'avaliacao',
    entityId: 'demo-proc-3',
    after: { resultadoCode: 'APROVADO_COM_LOUVOR' },
    timestamp: '2026-07-10T16:45:00.000Z'
  }
];
