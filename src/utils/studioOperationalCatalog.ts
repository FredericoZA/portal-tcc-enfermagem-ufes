import type {IntegrationStudioSettings} from '../types/integrationStudio';
export const OPERATIONAL_EMAIL_CATALOG=[
 ['email-reserva','Solicitação de reserva — departamento','{{DEPARTAMENTO_EMAIL}}','Solicitação de reserva · <<PROTOCOLO>>','Prezado Departamento,\n\nSolicitamos a reserva de <<DEFESA_LOCAL>> para a realização da defesa do Trabalho de Conclusão de Curso de autoria de <<CAMPO_01>>.\n\nTítulo: <<TITULO>>\nData e horário: <<DEFESA_DATA_HORA>>\nLocal: <<DEFESA_LOCAL>>\nOrientador: <<ORIENTADOR_NOME_COMPLETO>>\n\nAceite ou recuse o agendamento pelos botões abaixo.'],
 ['email-reserva-autores','Cadastro recebido — autores e orientador','{{ALUNO_1_EMAIL}}, {{ALUNO_2_EMAIL}}, {{ORIENTADOR_EMAIL}}','Cadastro recebido · <<PROTOCOLO>>','Prezados autores e orientador,\n\nO cadastro do trabalho foi recebido. A solicitação de reserva abaixo aguarda homologação do departamento.\n\nTítulo: <<TITULO>>\nAutoria: <<CAMPO_01>>\nData e horário: <<DEFESA_DATA_HORA>>\nLocal: <<DEFESA_LOCAL>>\nOrientador: <<ORIENTADOR_NOME_COMPLETO>>\n\nO departamento registrará a confirmação ou a negativa pelo formulário recebido. Acompanhem o agendamento pelo botão abaixo e pelos avisos enviados por e-mail.'],
 ['email-comprovante-reserva','Reserva confirmada — autores e orientador','{{ALUNO_1_EMAIL}}, {{ALUNO_2_EMAIL}}, {{ORIENTADOR_EMAIL}}','Reserva confirmada · <<PROTOCOLO>>','Prezados autores e orientador,\n\nO departamento confirmou a reserva. O comprovante está disponível em Dados do processo.'],
 ['email-resposta-departamento','Resposta ao formulário — departamento','{{DEPARTAMENTO_EMAIL}}','Resposta ao formulário de reserva registrada · <<PROTOCOLO>>','Prezado Departamento,\n\nO preenchimento do formulário de reserva foi registrado.'],
 ['email-local-indisponivel','Local indisponível — autores e orientador','{{ALUNO_1_EMAIL}}, {{ALUNO_2_EMAIL}}, {{ORIENTADOR_EMAIL}}','Local indisponível · <<PROTOCOLO>>','Prezados autores e orientador,\n\nO responsável recusou o agendamento solicitado. É necessário solicitar novamente a reserva para realizar a defesa.\n\nAbram o mesmo TCC, entrem em Dados do processo e cliquem em Refazer reserva. Confiram a disponibilidade com o responsável pelo local e enviem uma nova data, horário e local, para evitar retrabalho. O código do TCC será mantido; não criem outro trabalho.\n\nO comprovante de indisponibilidade está disponível em Documentos administrativos.'],
 ['email-convite','Convite para a banca','{{BANCA_EMAILS}}','Convite para a banca · <<PROTOCOLO>>','Prezados convidados,\n\nConvidamos vocês para participar da banca de defesa do Trabalho de Conclusão de Curso identificado abaixo.\n\nTítulo: <<TITULO>>\nAutoria: <<CAMPO_01>>\nData e horário: <<DEFESA_DATA_HORA>>\nLocal: <<DEFESA_LOCAL>>\nOrientador: <<ORIENTADOR_NOME_COMPLETO>>\nCoorientador: <<COORIENTADOR_NOME>>\n\nConvidados para a banca:\n<<BANCA_NOMES>>'],
 ['email-entrega-repositorio','Ata assinada — entrega final','{{ALUNO_1_EMAIL}}, {{ALUNO_2_EMAIL}}, {{ORIENTADOR_EMAIL}}','Ata assinada — entrega final · <<PROTOCOLO>>','Prezados autores,\n\nA ata da defesa foi assinada e arquivada. Concluam os ajustes solicitados pelo orientador e pela banca, se houver, e enviem o trabalho revisado pelo Portal.'],
 ['email-assinatura-termo','Termo de Autorização — assinaturas','{{ALUNO_1_EMAIL}}, {{ALUNO_2_EMAIL}}, {{ORIENTADOR_EMAIL}}','Termo de Autorização disponível · <<PROTOCOLO>>','Prezados autores e orientador,\n\nA entrega final foi registrada. O Termo de Autorização está disponível para conferência e assinatura dos responsáveis.'],
 ['email-conclusao','Assinaturas concluídas e documentos disponíveis','{{PARTICIPANTES_EMAILS}}','Assinaturas concluídas e documentos disponíveis · <<PROTOCOLO>>','Prezados participantes do TCC,\n\nAs assinaturas foram concluídas. Consulte e baixe os documentos assinados em Documentos do processo.']
] as const;
/** Built-in templates with a real operational path. OTP and provider notices are separate. */
export const OPERATIONAL_EMAIL_ROUTING = {
 'email-reserva': {audience:'reservation-approver', event:'TCC_CREATED', trigger:'Cadastro ou nova solicitação de reserva', recipients:'Departamento nos locais que administra; orientador em outro local'},
 'email-reserva-autores': {audience:'participants', event:'TCC_CREATED', trigger:'Cópia informativa da solicitação de reserva', recipients:'Autores e orientador'},
 'email-comprovante-reserva': {audience:'reservation-response', event:'LOCATION_CONFIRMED', trigger:'Aceite registrado pelo responsável pela reserva', recipients:'Responsável pela reserva, autores e orientador'},
 'email-local-indisponivel': {audience:'reservation-response', event:'LOCATION_CONFIRMED', trigger:'Recusa registrada pelo responsável pela reserva', recipients:'Responsável pela reserva, autores e orientador'},
 'email-convite': {audience:'committee', event:'INVITATION_SENT', trigger:'Reserva confirmada e carta-convite gerada', recipients:'Examinadores e coorientador, se houver, com autores e orientador em cópia'},
 'email-entrega-repositorio': {audience:'participants', event:'ATA_SIGNED', trigger:'Arquivamento da ata com as assinaturas exigidas', recipients:'Autores e orientador'},
 'email-assinatura-termo': {audience:'participants', event:'REPOSITORY_SUBMITTED', trigger:'Entrega com publicação autorizada, quando o aviso está vinculado à etapa', recipients:'Autores e orientador'},
 'email-conclusao': {audience:'all-participants', event:'PROCESS_COMPLETED', trigger:'Conclusão após arquivamento dos documentos exigidos', recipients:'Autores, orientador, coorientador, examinadores e presidência conforme os vínculos do TCC'},
} as const;
export function operationalEmailRouting(id: string | undefined) {
 return id ? OPERATIONAL_EMAIL_ROUTING[id as keyof typeof OPERATIONAL_EMAIL_ROUTING] : undefined;
}
export const DEPARTMENT_FORM={id:'form-reserva-departamento',title:'Confirmação do agendamento',stage:'Reserva do local',targetRole:'Departamento ou orientador',description:'O responsável aceita ou recusa o local, a data e o horário solicitados. O comprovante e os avisos são gerados automaticamente.',questions:[{id:'reservation-decision',fieldKey:'DECISAO_AGENDAMENTO',label:'Resposta ao agendamento',fieldType:'select',required:true,options:['Aceitar reserva','Recusar reserva']}]};
/** Add missing operational artifacts without replacing user edits or custom artifacts. */
export function withOperationalCatalog<T extends Partial<IntegrationStudioSettings>>(source:T):T{
 const value=structuredClone(source),retired=new Set(['email-instrucoes-cadastro','email-confirmacao','email-assinatura-ata','email-assinatura-declaracao','email-assinatura-registrada']);
 const templates=(value.emailTemplates||[]).filter(t=>!retired.has(String(t.id)));
 for(const[id,name,recipient,subject,body]of OPERATIONAL_EMAIL_CATALOG)if(!templates.some(t=>t.id===id))templates.push({id,name,recipient,subject,body,attachments:[],attachmentModes:{}});
 value.emailTemplates=templates.map(template=>{
  const standard=OPERATIONAL_EMAIL_CATALOG.find(item=>item[0]===template.id);
  const legacy=String(template.body||'');
  if(!standard||template.operationalCatalogEditable===true)return template;
  const outdated=template.id==='email-reserva'&&/respondam a este e-mail|confirmem ao aluno|confirmem o agendamento|solicitamos reserva para/i.test(legacy)||template.id==='email-convite'&&/Vossas Senhorias|V\.\s*Sa\.|Comissão Examinadora/i.test(legacy)||template.id==='email-conclusao'&&/A ata e as declarações concluídas|anexad/i.test(legacy);
  return outdated?{...template,name:standard[1],subject:standard[3],body:standard[4],htmlBody:'',attachments:[],attachmentModes:{}}:template;
 });
 if(value.workflowStages)value.workflowStages=value.workflowStages.map(stage=>({
  ...stage,
  ...(stage.triggerEvent==='EVALUATION_SUBMITTED'&&stage.description==='O orientador confere os dados, registra o resultado e escreve o parágrafo variável do parecer.'?{description:'O orientador registra conceito e parecer; depois, a ata exige assinatura do orientador e dos dois examinadores (prioridade 1) mediante solicitação explícita.'}:{}),
  actions:(Array.isArray(stage.actions)?stage.actions:[]).filter((action:any)=>!retired.has(String(action.refId||action.referenceId||''))).map((action:any)=>
    String(action.refId||action.referenceId||'')==='tmpl-ata'&&action.recipientOrDetail==='Assinatura do orientador'
      ?{...action,title:action.title==='Gera Ata de Defesa e envia à Asten'?'Prepara Ata de Defesa para assinatura':action.title,recipientOrDetail:'Orientador e dois examinadores · prioridade 1'}:action)
}));
 const forms=value.formTemplates||[];const nativeIndex=forms.findIndex(f=>f.id===DEPARTMENT_FORM.id);if(nativeIndex<0)forms.push(structuredClone(DEPARTMENT_FORM));else forms[nativeIndex]={...structuredClone(DEPARTMENT_FORM),...forms[nativeIndex],targetRole:DEPARTMENT_FORM.targetRole,questions:structuredClone(DEPARTMENT_FORM.questions)};value.formTemplates=forms;
 return value;
}
export function operationalEmailVariant(id:string|undefined,department:boolean,unavailable:boolean){return id==='email-reserva'&&!department?'email-reserva-autores':id==='email-comprovante-reserva'?(unavailable?'email-local-indisponivel':id):id;}
