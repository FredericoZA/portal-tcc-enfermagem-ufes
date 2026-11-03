import React from 'react';
import { ProcessoDetailPage } from '../pages/ProcessoDetailPage';

/** Compatibility entry point; public and private details share the same layout. */
export function PublicProcessDetail({processId,onBack}:{processId:string;onBack:()=>void}) {
  return <ProcessoDetailPage processId={processId} onBack={onBack} readOnly isModal />;
}
