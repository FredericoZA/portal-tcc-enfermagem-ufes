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
import {reservationEscape} from '../../src/utils/reservationConfirmationView';
export const reservationReceiptLink=(href:string)=>`<a href="${reservationEscape(href)}"><span aria-hidden="true">📥</span>Baixar comprovante</a>`;
