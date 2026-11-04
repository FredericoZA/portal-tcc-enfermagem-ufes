import type {IntegrationStudioSettings} from '../types/integrationStudio';
export const DEFAULT_RECEIPT_DESIGN={
 confirmedTitle:'Comprovante de reserva',declinedTitle:'Comprovante de indisponibilidade',
 confirmedText:'A reserva da defesa foi confirmada para o local, a data e o horário registrados neste comprovante.',
 declinedText:'O agendamento solicitado foi recusado. Os autores poderão solicitar uma nova data pelo Portal.'
};
export function receiptDesign(studio?:Partial<IntegrationStudioSettings>){
 const source=studio?.receiptDesign;
 return Object.fromEntries(Object.entries(DEFAULT_RECEIPT_DESIGN).map(([key,fallback])=>{
  const value=source?.[key as keyof typeof source];
  return [key,typeof value==='string'&&value.trim()?value.replace(/[\u0000-\u001f]/g,' ').trim().slice(0,key.endsWith('Title')?100:500):fallback];
 })) as typeof DEFAULT_RECEIPT_DESIGN;
}
