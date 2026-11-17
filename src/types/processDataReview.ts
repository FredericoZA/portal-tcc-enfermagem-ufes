import type { RegistrationAnswers } from './operationalConfig';
import type { CommitteeTreatment } from '../utils/personPresentation';

export interface ReviewedAuthor {
  nome: string;
  email: string;
  tratamento: 'Aluno' | 'Aluna';
}
export interface ReviewedFaculty {
  nome: string;
  email: string;
  tratamento: '' | 'Professor' | 'Professora';
  titulacao: string;
  instituicao: string;
}
export interface ReviewedExaminer extends Omit<ReviewedFaculty, 'tratamento'> {
  tratamento: '' | CommitteeTreatment;
  id: string;
  funcao: 'EXAMINER_2' | 'EXAMINER_3';
  membroTipo: 'INTERNO' | 'EXTERNO';
}
export interface ProcessDataReviewInput {
  expectedDataRevision: number;
  confirmed: true;
  titulo?: string;
  aluno1?: ReviewedAuthor;
  aluno2?: ReviewedAuthor | null;
  authorOrder?: 'ALUNO_1_FIRST' | 'ALUNO_2_FIRST';
  orientador?: ReviewedFaculty;
  coorientador?: ReviewedFaculty | null;
  banca?: ReviewedExaminer[];
  defesa?: {
    date: string;
    time: string;
    locationChoice: string;
    customLocation?: string;
  };
  registrationAnswers?: RegistrationAnswers;
}
