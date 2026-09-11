import type { StudioCondition, StudioValidationRule } from './integrationStudio';
export type CatalogKind = 'AREA_TEMATICA' | 'TEMA_PRINCIPAL' | 'TIPO_DE_ESTUDO' | 'FINALIDADE_DO_TRABALHO';
export interface CatalogEntry { id: string; kind: CatalogKind; label: string; aliases: string[]; validFrom?: string; validUntil?: string; active: boolean }
export interface VariablePresentation {
  marker: string; source: string;
  format: 'original' | 'date' | 'date_long' | 'time' | 'time_long' | 'datetime' | 'datetime_long';
  letterCase: 'original' | 'upper' | 'lower'; bold: boolean;
}
export interface OperationalConfig {
  workflow?: import('./workflowOperations').WorkflowOperationsPolicy;
  reservation: { departmentEmail: string; locations: string[] };
  catalogs: CatalogEntry[];
  diagnostics: { staleDays: number; minimumCoverage: number; priority: 'P1' | 'P2' | 'P3' };
  presentations: Record<string, VariablePresentation[]>;
}
export interface RegistrationQuestion {
  id: string; fieldKey: string; label: string; fieldType: string; required: boolean;
  section?: string; helpText?: string; placeholder?: string; options?: string[];
  visibleWhen?: StudioCondition; validation?: StudioValidationRule;
}
export type RegistrationAnswers = Record<string, string | number | boolean>;
