export interface PublicationChoice {
  publishFullWork: boolean;
  publishExpandedAbstract: boolean;
}
export interface PublicationChoiceRequest extends PublicationChoice {
  id: string;
  requestedBy: string;
  requestedAt: string;
  revision: number;
  status: 'REVOKING_DRIVE' | 'EDITING' | 'AWAITING_SIGNATURE' | 'COMPLETED';
  previousTermJobIds: string[];
  revokeFileIds: string[];
  previousTermFileIds?: string[];
  previousTermsDestroyedAt?: string;
  signatureJobId?: string;
  signedTermFileId?: string;
  completedAt?: string;
  lastError?: string;
}
export interface PublicationChoiceView extends PublicationChoice {
  availableFullWork: boolean;
  availableExpandedAbstract: boolean;
  revision: number;
  request?: Pick<PublicationChoiceRequest, 'id' | 'status' | 'requestedAt' | 'completedAt' | 'lastError'> & {
    canRetry: boolean;
  };
}
