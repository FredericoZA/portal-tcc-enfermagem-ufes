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
