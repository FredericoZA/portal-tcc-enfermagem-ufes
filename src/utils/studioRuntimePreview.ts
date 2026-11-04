import type {ProcessData} from '../types';
import type {IntegrationStudioSettings} from '../types/integrationStudio';
import {processEmailMessage} from './processEmailMessage';
import {academicName} from './personPresentation';
import {formatDateNumericWithWeekday,formatTime24h} from './formatters';

/** Synthetic identities only. Never read a real process to illustrate a configuration. */
export function studioSampleProcess():ProcessData {
 return {id:'amostra-configuracoes',protocolo:'TCC-2026-0001',titulo:'Educação em Saúde na Atenção Primária',etapaAtual:'CADASTRO',status:'AGUARDANDO_CONFIRMACAO_LOCAL',dataRevision:1,
 aluno1:{nome:'Mariana Alves da Silva',email:'mariana@example.invalid',matricula:'DEMO001',tratamento:'Aluna'},
 aluno2:{nome:'Lucas Pereira Costa',email:'lucas@example.invalid',matricula:'DEMO002',tratamento:'Aluno'},
 orientador:{nome:'Ana Carolina Martins',email:'ana@example.invalid',tratamento:'Professora',titulacao:'Doutora',instituicao:'UFES',siape:'DEMO003'},
 coorientador:{nome:'Paulo Henrique Souza',email:'paulo@example.invalid',tratamento:'Professor',titulacao:'Mestre',instituicao:'UFES',siape:'DEMO004'},
 banca:[{id:'b-1',nome:'Beatriz Oliveira Santos',email:'beatriz@example.invalid',funcao:'EXAMINER_2',tratamento:'Professora',titulacao:'Doutora',instituicao:'UFES'},{id:'b-2',nome:'Rafael Almeida Lima',email:'rafael@example.invalid',funcao:'EXAMINER_3',tratamento:'Professor',titulacao:'Doutor',instituicao:'UFES'}],
 defesa:{startAt:'2026-11-20T17:00:00.000Z',endAt:'2026-11-20T18:30:00.000Z',local:'Auditório do Prédio do Departamento de Enfermagem - CCS/UFES',localStatus:'PENDENTE',reservationRevision:0},
 createdAt:'2026-11-04T12:00:00.000Z',updatedAt:'2026-11-04T12:00:00.000Z'} as ProcessData;
}
export function studioEmailPreview(studio:Partial<IntegrationStudioSettings>,id:string){
 const process=studioSampleProcess(),selected=studio.emailTemplates?.find(item=>item.id===id);
 let templateId=id,eventCode='TCC_CREATED',departmentUrl:string|undefined;
 if(id==='email-reserva')departmentUrl='https://portal.example.invalid/api/reservation-confirmation/amostra-sem-validade';
 if(id==='email-reserva-autores')templateId='email-reserva';
 if(['email-comprovante-reserva','email-resposta-departamento','email-local-indisponivel'].includes(id)){
  templateId='email-comprovante-reserva';eventCode='LOCATION_CONFIRMED';
  process.defesa.departmentResponse={decision:id==='email-local-indisponivel'?'UNAVAILABLE':'CONFIRMED',revision:0,respondedBy:'departamento@example.invalid',departmentEmail:'departamento@example.invalid',respondedAt:'2026-11-04T15:41:00.000Z',startAt:process.defesa.startAt,endAt:process.defesa.endAt,local:process.defesa.local};
  if(id==='email-resposta-departamento')departmentUrl='https://portal.example.invalid/api/reservation-confirmation/amostra-sem-validade';
 }
 if(id==='email-convite')eventCode='INVITATION_SENT';
 if(id==='email-entrega-repositorio')eventCode='ATA_SIGNED';
 return processEmailMessage({process,recipient:'mariana@example.invalid',subject:String(selected?.subject||''),text:String(selected?.body||''),templateId,eventCode,baseUrl:'https://portal.example.invalid',courseName:studio.brandKit?.courseName||'Curso de Graduação em Enfermagem e Obstetrícia',studio,departmentUrl});
}
/** Start customization from the effective message, retaining live variables rather than sample identities. */
export function studioEditableEmail(studio:Partial<IntegrationStudioSettings>,id:string){
 const template=studio.emailTemplates?.find(item=>item.id===id);
 if(!template||template.operationalCatalogEditable===true)return template;
 const message=studioEmailPreview(studio,id),p=studioSampleProcess();
 const replacements:Array<[string,string]>=[
  [[p.aluno1.nome,p.aluno2!.nome].join(' e '),'ALUNOS'],
  [academicName(p.orientador,'abbreviated'),'ORIENTADOR_NOME_COMPLETO'],
  [academicName(p.coorientador!,'abbreviated'),'COORIENTADOR_NOME_COMPLETO'],
  [p.banca.map(person=>academicName(person,'abbreviated')).join('\n'),'BANCA_NOMES'],
  [p.aluno1.nome,'ALUNO_1_NOME'],[p.aluno2!.nome,'ALUNO_2_NOME'],[p.protocolo,'PROTOCOLO'],[p.titulo,'TITULO'],[p.defesa.local,'DEFESA_LOCAL'],
  [formatDateNumericWithWeekday(p.defesa.startAt),'DEFESA_DATA'],['14:00 às 15:30','DEFESA_HORARIO'],['14:00','DEFESA_HORA'],
  [formatDateNumericWithWeekday('2026-11-04T15:41:00Z')+', '+formatTime24h('2026-11-04T15:41:00Z'),'RESPOSTA_REGISTRADA_EM']
 ];
 const source=(value:string)=>replacements.reduce((text,[sample,key])=>sample?text.replaceAll(sample,`<<${key}>>`):text,value);
 return {...template,subject:source(message.subject),body:source(message.bodyText.split('ORIENTAÇÕES DO PROCESSO')[0].replace(/^.*https:\/\/portal\.example\.invalid[^\n]*$/gm,'').replace('reserva do auditório','reserva do local indicado abaixo').trim())};
}
