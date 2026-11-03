/** Address the recipient's role; names belong in the process details. */
export function processEmailGreeting(templateId='',eventCode='',department=false){
 if(department)return 'Prezado Departamento,';
 if(templateId==='email-assinatura-ata'||eventCode==='EVALUATION_SUBMITTED')return 'Prezado orientador,';
 if(templateId==='email-entrega-repositorio')return 'Prezados autores,';
 if(templateId==='email-convite'||eventCode==='INVITATION_SENT')return 'Prezados,';
 if(templateId==='email-assinatura-declaracao'||eventCode==='PUBLICATION_CLEARED')return 'Prezada Presidência,';
 if(templateId==='email-conclusao'||eventCode==='PROCESS_COMPLETED')return 'Prezados participantes do TCC,';
 if(['email-reserva','email-comprovante-reserva','email-instrucoes-cadastro','email-confirmacao','email-assinatura-ata','email-entrega-repositorio','email-assinatura-termo'].includes(templateId)||['EVALUATION_SUBMITTED','REPOSITORY_SUBMITTED'].includes(eventCode))return 'Prezados autores e orientador,';
 return 'Prezados participantes do TCC,';
}
export function applyProcessEmailGreeting(text:string,templateId='',eventCode='',department=false){
 const greeting=processEmailGreeting(templateId,eventCode,department);
 const firstLine=/^(?:Prezad[oa]s?(?:\(a\))?|Olá)[^\n]*[,.][ \t]*(?=\n|$)/i;
 return firstLine.test(text)?text.replace(firstLine,greeting):greeting+'\n\n'+text;
}
