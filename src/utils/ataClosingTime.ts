import {formatDatePt,formatTime24h} from './formatters';
/** Documentary closing time; never substitutes the provider's real signature timestamp. */
export function ataClosingTime(startAt:string):{iso:string;label:string}{
 // Civil timestamps without an offset are expressed in the Portal's São Paulo zone.
 const value=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(startAt)?`${startAt}-03:00`:startAt;
 const instant=Date.parse(value);if(!Number.isFinite(instant))throw new Error('Data e horário da defesa inválidos para calcular o encerramento da ata.');
 const iso=new Date(instant+60*60_000).toISOString();
 return {iso,label:`${formatDatePt(iso)} às ${formatTime24h(iso)}`};
}
