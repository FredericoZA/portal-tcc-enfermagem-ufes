import {isValidSignatureEmail,normalizeSignatureEmail} from './signaturePolicy';
export {reservationContact as reservationDepartmentEmail} from '../../src/utils/reservationContact';

export function reservationCopies(process:{aluno1:{email:string};aluno2?:{email:string}|null;orientador:{email:string}},department:string):string[]{
  const all=[process.aluno1.email,process.aluno2?.email,process.orientador.email];
  if(all.some(value=>value!==undefined&&!isValidSignatureEmail(value)))throw new Error('Confira os e-mails dos autores e do orientador antes de solicitar a reserva.');
  return [...new Set(all.filter((value):value is string=>Boolean(value)).map(normalizeSignatureEmail))].filter(email=>email!==normalizeSignatureEmail(department));
}

/** The receipt is a group message; the current room contact is not the historical decision signer. */
export function reservationReceiptRecipients(process:Parameters<typeof reservationCopies>[0],responsible:string):string[]{
  if(!isValidSignatureEmail(responsible))throw new Error('Confira o e-mail atual do responsável pela reserva antes de enviar o comprovante.');
  return [...new Set([...reservationCopies(process,''),normalizeSignatureEmail(responsible)])];
}
