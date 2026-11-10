import type {ProcessData} from '../../src/types';
import {createHmac,timingSafeEqual} from 'node:crypto';
export interface ReservationClaim {processId:string;revision:number;recipient:string;expiresAt:number;}
export function reservationToken(claim:ReservationClaim,secret:string){
 if(secret.length<24)throw new Error('Chave de confirmação de reserva não configurada.');
 const data=Buffer.from(JSON.stringify(claim)).toString('base64url');
 return data+'.'+createHmac('sha256',secret).update('reservation-confirmation:'+data).digest('base64url');
}
export function readReservationToken(token:string,secret:string,now=Date.now()):ReservationClaim|null{
 try{const [data,signature,...extra]=token.split('.');if(extra.length||!data||!signature||token.length>2048)return null;const expected=reservationToken(JSON.parse(Buffer.from(data,'base64url').toString()),secret).split('.')[1];const a=Buffer.from(signature),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))return null;const claim=JSON.parse(Buffer.from(data,'base64url').toString()) as ReservationClaim;if(!claim.processId||!claim.recipient||!Number.isInteger(claim.revision)||claim.expiresAt<now||!Number.isFinite(claim.expiresAt))return null;return claim;}catch{return null;}
}
export {reservationEscape,reservationPage,reservationSubmitFeedback} from '../../src/utils/reservationConfirmationView';
import {reservationEscape,reservationPage} from '../../src/utils/reservationConfirmationView';
export const reservationReceiptLink=(href:string)=>`<a href="${reservationEscape(href)}"><span aria-hidden="true">📥</span>Baixar comprovante</a>`;

export function reservationAlreadyAnsweredPage(decision: 'CONFIRMED'|'UNAVAILABLE', receiptPath: string) {
 const result = decision === 'CONFIRMED' ? 'Reserva aceita' : 'Reserva recusada';
 return reservationPage(result, `<p>A reserva já foi ${decision === 'CONFIRMED' ? 'aceita' : 'recusada'}.</p>${reservationReceiptLink(receiptPath)}`);
}

/** Recover only a decision committed for this exact signed link. */
export async function readSavedReservationDecision(
 requestPath:string,
 secret:()=>string,
 readSnapshot:()=>Promise<{processes:ProcessData[]}|null>,
){
 const token=/^\/reservation-confirmation\/([A-Za-z0-9_.-]+)$/.exec(requestPath)?.[1];
 if(!token)return null;
 try {
  const claim=readReservationToken(token,secret());
  if(!claim)return null;
  const snapshot=await readSnapshot();
  const defense=snapshot?.processes.find(process=>process.id===claim.processId)?.defesa;
  const response=defense?.departmentResponse;
  if(!defense||!response||(defense.reservationRevision??0)!==claim.revision
    ||(response.revision??0)!==claim.revision
    ||!(response.attribution==='EMAIL_LINK'&&response.respondedBy===claim.recipient
      ||response.attribution==='MASTER_ADMIN'&&defense.reservationRequestRecipient===claim.recipient))return null;
  if(response.decision!=='CONFIRMED'&&response.decision!=='UNAVAILABLE')return null;
  return {decision:response.decision,receiptPath:`/api/reservation-confirmation/${token}/receipt`};
 }catch{return null;}
}

/** A busy runtime must not expose raw API JSON to a person following an email link.
 * Never guess the saved decision from memory or replay a POST while admission failed. */
export function reservationRuntimeUnavailablePage(requestPath:string, originalUrl:string):string|null {
 if(!/^\/reservation-confirmation\/[^/]+(?:\/receipt)?$/.test(requestPath))return null;
 const href=originalUrl.startsWith('/api/reservation-confirmation/')?originalUrl:'/';
 return reservationPage('Consultando reserva', `<p>Não foi possível consultar o resultado da reserva agora. Aguarde alguns segundos e consulte novamente.</p><a href="${reservationEscape(href)}">Consultar reserva</a>`);
}
