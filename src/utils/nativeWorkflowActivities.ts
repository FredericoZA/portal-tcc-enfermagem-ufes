import type {IntegrationStudioSettings} from '../types/integrationStudio';

/** Activities handled by existing screens/routes; never schedule them a second time. */
export const NATIVE_WORKFLOW_ACTIVITIES = [
 {id:'registration',event:'TCC_CREATED',title:'Preencher e enviar o cadastro inicial do TCC',typeLabel:'Formulário',formId:'form-reserva-aluno',roles:['AUTHORS'],audience:'Autor que cadastra o TCC',trigger:'Autor autorizado inicia o cadastro. O envio válido cria o processo e libera o pedido de reserva.'},
 {id:'reservation-response',event:'LOCATION_CONFIRMED',title:'Aceitar ou recusar o agendamento solicitado',typeLabel:'Formulário',formId:'form-reserva-departamento',roles:['RESERVATION_RESPONSIBLE'],audience:'Responsável pela reserva: departamento nos locais administrados; orientador em outro local',trigger:'Pedido de reserva enviado → resposta pelo link pessoal. O aceite libera o convite; a recusa libera uma nova solicitação.'},
 {id:'reservation-notice',event:'TCC_CREATED',title:'Avisar autores e orientador sobre o pedido de reserva',typeLabel:'E-mail automático',emailId:'email-reserva-autores',audience:'Autores e orientador; auditoria conforme configuração',trigger:'Depois do pedido ao responsável → envia o aviso informativo aos autores e ao orientador. Envio integrante da solicitação, sem duplicação.'},
 {id:'reservation-accepted',event:'LOCATION_CONFIRMED',title:'Gerar e enviar o comprovante de reserva aceita',typeLabel:'E-mail e comprovante',emailId:'email-comprovante-reserva',audience:'Responsável pela reserva, autores e orientador',trigger:'Somente após aceite → comprovante em PDF e resposta na conversa do pedido. Depois são preparados a carta-convite e seu e-mail.'},
 {id:'reservation-declined',event:'LOCATION_CONFIRMED',title:'Gerar e enviar o comprovante de reserva recusada',typeLabel:'E-mail e comprovante',emailId:'email-local-indisponivel',audience:'Responsável pela reserva, autores e orientador',trigger:'Somente após recusa → comprovante de indisponibilidade e orientação para refazer a reserva. O convite permanece bloqueado.'},
 {id:'defense',event:'INVITATION_SENT',title:'Preparar e realizar a sessão de defesa',typeLabel:'Atividade do processo',audience:'Autores, orientador, examinadores e coorientador, quando houver',trigger:'Convite enviado → aguardar a data e o horário da defesa. O conceito continua reservado ao orientador.'},
 {id:'minutes',event:'EVALUATION_SUBMITTED',title:'Registrar conceito e parecer, conferir e confirmar a ata',typeLabel:'Atividade do processo',audience:'Orientador do trabalho',trigger:'Local confirmado, convite enviado e defesa liberada → orientador confere e registra. Depois são preparados a ata e o envio automático pela ASTEN.'},
 {id:'repository',event:'REPOSITORY_SUBMITTED',title:'Entregar arquivos, resumo, palavras-chave e autorização de publicação',typeLabel:'Atividade do processo',audience:'Um dos autores do trabalho',trigger:'Ata assinada e entrega liberada → autor confirma arquivos e escolhas de publicação. Depois é gerado o termo aplicável e enviado pela ASTEN.'},
] as const;
export function nativeWorkflowActivity(action:{type?:unknown;refId?:unknown;referenceId?:unknown}){
 if(String(action.type).toLowerCase()!=='interaction')return undefined;
 return NATIVE_WORKFLOW_ACTIVITIES.find(item=>item.id===String(action.refId||action.referenceId));
}
/** Upgrade draft coverage once, retaining identifiers, configured actions and custom stages. */
export function withNativeWorkflowActivities<T extends Partial<IntegrationStudioSettings>>(source:T):T{
 const value=structuredClone(source);if(!value.workflowStages?.length)return value;
 const stages=value.workflowStages;let repaired=false;
 for(const activity of NATIVE_WORKFLOW_ACTIVITIES){
  if(stages.some(stage=>(stage.actions as Record<string,unknown>[]||[]).some(action=>nativeWorkflowActivity(action)?.id===activity.id)))continue;
  repaired=true;
  let stage=stages.find(stage=>stage.triggerEvent===activity.event);
  if(!stage){stage={id:`stage-native-${activity.id}`,triggerEvent:activity.event,title:activity.title,actions:[]};stages.push(stage);}
  const next={id:`native-${activity.id}`,type:'interaction',refId:activity.id,title:activity.title};
  const actions=(stage.actions||[]) as Record<string,unknown>[];
  if(activity.id==='reservation-notice')stage.actions=[...actions,next];
  else if(activity.id==='reservation-accepted'||activity.id==='reservation-declined'){const index=actions.findIndex(action=>nativeWorkflowActivity(action)?.id===(activity.id==='reservation-declined'?'reservation-accepted':'reservation-response'));stage.actions=[...actions.slice(0,index+1),next,...actions.slice(index+1)];}
  else stage.actions=[next,...actions];
 }
 if(repaired){
  const order=['TCC_CREATED','LOCATION_CONFIRMED','INVITATION_SENT','EVALUATION_SUBMITTED','ATA_SIGNED','SIGNATURE_COMPLETED','REPOSITORY_SUBMITTED','PUBLICATION_CLEARED','PROCESS_COMPLETED'];
  // Sort only built-in slots; custom stages keep their positions and content.
  const builtins=stages.filter(stage=>order.includes(String(stage.triggerEvent))).sort((a,b)=>order.indexOf(String(a.triggerEvent))-order.indexOf(String(b.triggerEvent)));
  let index=0;value.workflowStages=stages.map(stage=>order.includes(String(stage.triggerEvent))?builtins[index++]:stage).map((stage,index)=>({...stage,stageNumber:index+1}));
 }
 return value;
}
