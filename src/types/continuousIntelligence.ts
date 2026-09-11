export type LivingPortalArtifactKind = 'FLOW_IMPROVEMENT_MEMORY' | 'TCC_STATISTICAL_REPORT';
export type ImprovementPriority = 'P1' | 'P2' | 'P3';
export type ImprovementStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED';

export interface StatisticalDistributionEntry {
  label: string;
  count: number;
  share: number;
}

export interface StatisticalDistribution {
  entries: StatisticalDistributionEntry[];
  unknown: number;
  suppressed: number;
}

export interface TccStatisticalSnapshot {
  generatedAt: string;
  window: { from: string | null; to: string | null; academicCycleId: string | null };
  privacy: {
    containsPersonalData: false;
    minimumCategorySize: number;
    note: string;
  };
  totals: {
    processes: number;
    authors: number;
    coauthoredProcesses: number;
    defended: number;
    completed: number;
    publicationRequested: number;
  };
  rates: {
    completion: number;
    publication: number;
    coauthorship: number;
  };
  timing: {
    medianCompletionDays: number | null;
    medianAgeOpenDays: number | null;
  };
  distributions: {
    status: StatisticalDistribution;
    outcome: StatisticalDistribution;
    workType: StatisticalDistribution;
    defenseFormat: StatisticalDistribution;
    themes: StatisticalDistribution;
    areas: StatisticalDistribution;
    studyTypes: StatisticalDistribution;
    purposes: StatisticalDistribution;
    keywords: StatisticalDistribution;
  };
  dataQuality: {
    areaCoverage: number;
    themeCoverage: number;
    studyTypeCoverage: number;
    purposeCoverage: number;
    keywordCoverage: number;
  };
}

export interface ImprovementProposal {
  id: string;
  category: 'WORKFLOW' | 'EMAIL' | 'SIGNATURE' | 'DRIVE' | 'DATA_QUALITY' | 'PROCESS_TIME' | 'REWORK';
  title: string;
  evidence: string;
  recommendedAction: string;
  priority: ImprovementPriority;
  status: ImprovementStatus;
  evidenceActive: boolean;
  firstDetectedAt: string;
  lastObservedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface LivingPortalArtifact {
  kind: LivingPortalArtifactKind;
  fileName: string;
  version: number;
  generatedAt: string;
  sha256: string;
  markdown: string;
  driveSyncStatus: 'NOT_CONFIGURED' | 'PENDING' | 'SYNCED' | 'FAILED';
  driveFileId?: string;
  driveWebViewLink?: string;
  driveSyncedAt?: string;
  driveError?: string;
}

export interface ContinuousIntelligenceState {
  schemaVersion: 1;
  lastRefreshAt: string;
  lastRefreshActor: 'SYSTEM' | 'MASTER';
  statistics: TccStatisticalSnapshot;
  proposals: ImprovementProposal[];
  artifacts: Record<LivingPortalArtifactKind, LivingPortalArtifact>;
}

export interface ContinuousIntelligenceOverview {
  schemaVersion: 1;
  lastRefreshAt: string;
  lastRefreshActor: 'SYSTEM' | 'MASTER';
  statistics: TccStatisticalSnapshot;
  proposals: ImprovementProposal[];
  artifacts: Record<LivingPortalArtifactKind, Omit<LivingPortalArtifact, 'markdown'>>;
}
