import type {AuditLog} from '../types';
import {auditStatusLabel,redactAuditText} from './auditLogPresentation';
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const text=(value:unknown,max=220)=>typeof value==='string'?redactAuditText(value).slice(0,max):'';
const documents:Record<string,string>={ATA:'Ata',TERMO:'Termo de autorização e publicação',DECLARACAO:'Declaração de participação',CONVITE:'Carta-convite'};
const roles:Record<string,string>={ADVISOR:'Orientador',EXAMINER:'Examinador',STUDENT:'Autor',CO_ADVISOR:'Coorientador',PRESIDENT:'Presidência da comissão'};
const stages:Record<string,string>={DOCUMENT_PREPARED:'Preparação da assinatura',PROVIDER_SIGNERS_VERIFIED:'Conferência das assinaturas',SIGNED_DOCUMENT_ARCHIVED:'Arquivamento do documento assinado',PROVIDER_CALLBACK_RECONCILED:'Atualização da assinatura',HISTORICAL_CALLBACK_IGNORED:'Retorno de versão anterior',TCC_CREATED:'Cadastro',LOCATION_CONFIRMED:'Agendamento e convite',INVITATION_SENT:'Preparação da defesa',EVALUATION_SUBMITTED:'Conceito e Ata',ATA_SIGNED:'Ata assinada e entrega final',SIGNATURE_COMPLETED:'Assinaturas',REPOSITORY_SUBMITTED:'Entrega final e termo',PUBLICATION_CLEARED:'Declaração da banca',PROCESS_COMPLETED:'Conclusão'};
const documentActions=new Set(['SOLICITACAO_ASSINATURA','SOLICITACAO_ASSINATURA_FALHOU','CALLBACK_ASTEN_RECONCILIADO','CALLBACK_ASTEN_VERSAO_ENCERRADA','DOCUMENTO_PREPARADO_PARA_ASSINATURA','SIGNATARIOS_CONFIRMADOS_PELO_PROVEDOR','DOCUMENTO_ASSINADO_ARQUIVADO','GOVBR_PDF_RECEBIDO_PARA_CONFERENCIA','GOVBR_CONFERENCIA_MANUAL_APROVADA','CONVITE_GERADO_PELO_FLUXO']);
export function auditDocumentEvent(log:AuditLog){
 const data=record(log.after),before=record(log.before);
 const type=text(data.documentType||before.documentType,30);
 if(!documents[type]&&!documentActions.has(log.action)&&log.entityType!=='signature_job')return null;
 const title=documents[type]||text(data.documentTitle)||'Documento não identificado neste registro';
 const version=Number.isInteger(data.documentVersion)&&Number(data.documentVersion)>0?Number(data.documentVersion):undefined;
 const provider=data.provider==='ASTEN'?'ASTEN':data.provider==='GOV_BR'?'Gov.br':log.action.startsWith('CALLBACK_ASTEN')?'ASTEN':'';
 const stageCode=text(data.eventStage||data.workflowEventCode||data.eventCode,120);
 const stage=stages[stageCode]||stageCode;
 const total=Number.isInteger(data.expectedSignerCount)&&Number(data.expectedSignerCount)>0?Number(data.expectedSignerCount):undefined;
 const count=Number.isInteger(data.verifiedSignerCount)&&Number(data.verifiedSignerCount)>=0&&total!==undefined&&Number(data.verifiedSignerCount)<=total?Number(data.verifiedSignerCount):undefined;
 const verified=Array.isArray(data.verifiedSigners)?data.verifiedSigners.slice(0,12).map(record).filter(person=>text(person.name)||text(person.email)).map(person=>({name:text(person.name)||text(person.email),email:text(person.email,254),role:roles[text(person.role)]||text(person.role),signedAt:text(person.signedAt,60)})):[];
 const expected = Array.isArray(data.expectedSigners) ? data.expectedSigners.slice(0, 12).map(record)
   .filter(person => text(person.name)).map(person => ({name: text(person.name), role: roles[text(person.role)] || text(person.role)})) : [];
 const outstanding = Array.isArray(data.outstandingSigners) ? data.outstandingSigners.slice(0, 12).map(record)
   .filter(person => text(person.name) || text(person.email)).map(person => ({
     name: text(person.name) || text(person.email),
     role: roles[text(person.role)] || text(person.role),
     status: person.status === 'DECLINED' ? 'Recusou a assinatura' : person.status === 'VIEWED' ? 'Visualizou, assinatura pendente' : 'Aguardando assinatura',
   })) : [];
 const status=text(data.status,80);const previousStatus=text(before.status,80);
 const generated=log.action==='DOCUMENTO_PREPARADO_PARA_ASSINATURA'||log.action==='CONVITE_GERADO_PELO_FLUXO';
 const archived=log.action==='DOCUMENTO_ASSINADO_ARQUIVADO';
 const result=archived?'Documento assinado e arquivado no Drive':generated?'Documento gerado':status?auditStatusLabel(status):'';
 return {title,type,version,provider,stage,result,previousStatus:previousStatus&&previousStatus!==status?auditStatusLabel(previousStatus):'',total,count,verified,expected,outstanding,evidence:text(data.evidenceSource,120),archived,generated};
}
export function auditDocumentSearchText(log:AuditLog):string{const event=auditDocumentEvent(log);return event?[event.title,event.version,event.provider,event.stage,event.result,...event.verified.flatMap(person=>[person.name,person.email,person.role])].filter(Boolean).join(' '):'';}
