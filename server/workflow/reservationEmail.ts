import {isValidSignatureEmail,normalizeSignatureEmail} from './signaturePolicy';
export function reservationDepartmentEmail(templateRecipient:unknown,legacyRecipient:unknown):string{
  for(const value of [templateRecipient,legacyRecipient])if(isValidSignatureEmail(value))return normalizeSignatureEmail(value);
  return '';
}

export function reservationCopies(process:{aluno1:{email:string};aluno2?:{email:string}|null;orientador:{email:string}},department:string):string[]{
  const all=[process.aluno1.email,process.aluno2?.email,process.orientador.email];
  if(all.some(value=>value!==undefined&&!isValidSignatureEmail(value)))throw new Error('Confira os e-mails dos autores e do orientador antes de solicitar a reserva.');
  return [...new Set(all.filter((value):value is string=>Boolean(value)).map(normalizeSignatureEmail))].filter(email=>email!==normalizeSignatureEmail(department));
}
