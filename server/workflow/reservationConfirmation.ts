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
export const reservationEscape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function reservationPage(title:string,content:string){
 const icon=/Resposta.*registrada/i.test(title)?'✅':/indisponível|Conflito|Não foi possível|Confira/.test(title)?'⚠️':'📅';
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${reservationEscape(title)}</title><style>body{margin:0;background:#f6f7f8;color:#243c34;font:16px Arial,sans-serif}main{max-width:620px;margin:32px auto;background:#fdfefd;border:1px solid #c4ced4;border-radius:16px;overflow:hidden}.reservation-header{padding:24px;background:#005830;color:#fff;text-align:center}.reservation-header img{display:block;width:48px;height:48px;object-fit:contain;margin:0 auto 16px;background:transparent}h1{display:flex;justify-content:center;align-items:center;gap:12px;margin:0;font-size:22px;line-height:1.35}.reservation-content{padding:28px;line-height:1.6}main a{display:inline-flex;align-items:center;gap:8px;padding:12px 18px;border-radius:8px;background:#337959;color:#fff;font-weight:bold;text-decoration:none}main a:hover{background:#005830}main a:focus-visible{outline:3px solid #afcdba;outline-offset:3px}@media(max-width:660px){main{margin:16px 12px}.reservation-content{padding:22px}.reservation-header{padding:22px 18px}h1{font-size:20px}}</style></head><body><main><header class="reservation-header"><img src="/colenf-logo.png" alt="Curso de Enfermagem da UFES"><h1><span aria-hidden="true">${icon}</span><span>${reservationEscape(title)}</span></h1></header><div class="reservation-content">${content}</div></main>${content.includes('data-reservation-response')?'<script src="/reservation-confirmation.js" defer></script>':''}</body></html>`;
}

export const reservationReceiptLink=(href:string)=>`<a href="${reservationEscape(href)}"><span aria-hidden="true">📥</span>Baixar comprovante</a>`;

export const reservationSubmitFeedback = `<div id="reservation-submit-feedback" hidden style="margin:18px 0;padding:16px;border:1px solid #c4ced4;border-radius:12px;background:#f6f7f8;color:#243c34"><p role="status" aria-live="polite" style="margin:0 0 10px;font-weight:bold">Registrando sua resposta e preparando o comprovante…</p><progress aria-label="Envio da resposta em andamento" style="display:block;width:100%;height:10px;accent-color:#005830"></progress></div>`;
