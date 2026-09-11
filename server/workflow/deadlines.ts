import { createHash } from 'node:crypto';
import type { ProcessData, SignatureJob } from '../../src/types';
import type { ReminderRecord, WaitingMilestone, WorkflowOperationsPolicy } from '../../src/types/workflowOperations';
import { latestSignature, ataArchived, declarationReady } from './gates';
export const MILESTONE_LABELS: Record<WaitingMilestone,string>={LOCATION:'Confirmação do local',EVALUATION:'Avaliação da defesa',ATA:'Assinatura da Ata',FINAL_DELIVERY:'Entrega final',TERM:'Assinatura do Termo',DECLARATION:'Assinatura da Declaração'};
const dayMs=86400000;
export function calendarDate(instant:string,timezone='America/Sao_Paulo'){return new Intl.DateTimeFormat('sv-SE',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));}
const timestamp=(date:string)=>Date.parse(date+'T12:00:00Z');
export function isBusinessDay(date:string,policy:WorkflowOperationsPolicy){return policy.weekdays.includes(new Date(timestamp(date)).getUTCDay())&&!policy.holidays.includes(date);}
export function addBusinessDays(start:string,count:number,policy:WorkflowOperationsPolicy){
  if(!policy.weekdays.length||count<0||count>3650)throw new Error('Calendário útil inválido.');
  let current=timestamp(start),remaining=count,iterations=0;
  while(remaining>0){current+=dayMs;const date=new Date(current).toISOString().slice(0,10);if(isBusinessDay(date,policy))remaining--;if(++iterations>15000)throw new Error('O calendário não oferece dias úteis suficientes.');}
  return new Date(current).toISOString().slice(0,10);
}
export function waitingMilestone(p:ProcessData,jobs:SignatureJob[]):{milestone:WaitingMilestone;startedAt:string;responsible:string[]}|null{
  if(p.status==='CONCLUIDO')return null;
  const students=[p.aluno1.email,p.aluno2?.email].filter(Boolean) as string[];
  if(p.defesa.localStatus!=='CONFIRMADO')return {milestone:'LOCATION',startedAt:p.createdAt,responsible:students};
  if(p.avaliacao.status!=='CONCLUIDO')return {milestone:'EVALUATION',startedAt:p.defesa.startAt,responsible:[p.orientador.email]};
  const ata=latestSignature(p,jobs,'ATA');
  if(!ataArchived(p,jobs))return {milestone:'ATA',startedAt:ata?.createdAt||p.avaliacao.submittedAt||p.updatedAt,responsible:[p.orientador.email]};
  if(!p.acervo?.submittedAt)return {milestone:'FINAL_DELIVERY',startedAt:ata.completedAt||p.updatedAt,responsible:students};
  const term=latestSignature(p,jobs,'TERMO');
  if(!declarationReady(p,jobs))return {milestone:'TERM',startedAt:term?.createdAt||p.acervo.submittedAt,responsible:[...students,p.orientador.email]};
  const declaration=latestSignature(p,jobs,'DECLARACAO');
  if(declaration?.status!=='ARCHIVED'||!declaration.driveSignedFileId)return {milestone:'DECLARATION',startedAt:declaration?.createdAt||term?.completedAt||p.acervo.submittedAt,responsible:declaration?.signers.map(s=>s.email)||[]};
  return null;
}
export function plannedDeadlines(processes:ProcessData[],jobs:SignatureJob[],policy:WorkflowOperationsPolicy,timezone:string,now=new Date()){
  const today=calendarDate(now.toISOString(),timezone);
  return processes.flatMap(p=>{const waiting=waitingMilestone(p,jobs);if(!waiting||!Number.isFinite(Date.parse(waiting.startedAt)))return [];
    return policy.deadlines.filter(rule=>rule.active&&rule.milestone===waiting.milestone).map(rule=>{
      const dueDate=addBusinessDays(calendarDate(waiting.startedAt,timezone),rule.businessDays,policy);
      return {processId:p.id,protocol:p.protocolo,...waiting,label:MILESTONE_LABELS[waiting.milestone],rule,dueDate,overdue:today>dueDate,today};
    });
  });
}
export function claimableReminder(plan:ReturnType<typeof plannedDeadlines>[number],recipient:string,records:ReminderRecord[],policy:WorkflowOperationsPolicy,now=new Date()):ReminderRecord|null{
  if(!plan.overdue||!isBusinessDay(plan.today,policy))return null;
  const relevant=records.filter(r=>r.processId===plan.processId&&r.policyId===plan.rule.id&&r.dueDate===plan.dueDate&&r.recipient===recipient);
  if(relevant.some(r=>r.status!=='SENT')||relevant.length>=plan.rule.maxReminders)return null;
  const nextDate=addBusinessDays(plan.dueDate,1+relevant.length*plan.rule.reminderEveryDays,policy);if(plan.today<nextDate)return null;
  const ordinal=relevant.length+1;
  const id=createHash('sha256').update([plan.processId,plan.rule.id,plan.dueDate,recipient,ordinal].join('|')).digest('hex');
  return {id,processId:plan.processId,milestone:plan.milestone,policyId:plan.rule.id,dueDate:plan.dueDate,recipient,ordinal,status:'SENDING',createdAt:now.toISOString()};
}
