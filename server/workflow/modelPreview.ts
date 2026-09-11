import { registrationPayload, registrationQuestions } from '../../src/utils/operationalConfig';
import { buildProcessVariables } from './runtime';
import type { IntegrationStudioSettings } from '../../src/types/integrationStudio';
import type { ProcessData } from '../../src/types';
export function previewProcess(studio:Partial<IntegrationStudioSettings>, supplied:Record<string,unknown>={}) {
  const answers:Record<string,string|number|boolean>={};
  for(const question of registrationQuestions(studio)){
    const key=question.fieldKey;const suppliedValue=supplied[key];
    if(suppliedValue!==undefined){if(!['string','number','boolean'].includes(typeof suppliedValue)||String(suppliedValue).length>10000)throw new Error(`Amostra inválida: ${key}.`);answers[key]=suppliedValue as string;continue;}
    answers[key]=question.options?.[0]||(/_EMAIL$/.test(key)?`${key.toLowerCase()}@example.invalid`:/_NOME$/.test(key)?`${question.label} de Demonstração`:/MATRICULA|SIAPE/.test(key)?'0000001':key==='TITULO'?'Trabalho fictício para revisão do modelo':question.fieldType==='datetime-local'?'2026-10-20T14:30':question.fieldType==='date'?'2026-10-20':question.fieldType==='number'?8:question.fieldType==='checkbox'?true:`Exemplo de ${question.label}`);
  }
  for(const [rawKey,value] of Object.entries(supplied)){
    const key=rawKey.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').toUpperCase();
    if(!key||key.length>100||key in answers)continue;
    if(!['string','number','boolean'].includes(typeof value)||String(value).length>10000)throw new Error(`Amostra inválida: ${key}.`);
    answers[key]=value as string|number|boolean;
  }
  answers.TEM_ALUNO_2=supplied.TEM_ALUNO_2==='Sim'?'Sim':'Não';answers.TEM_COORIENTADOR=supplied.TEM_COORIENTADOR==='Sim'?'Sim':'Não';
  const payload=registrationPayload(answers,studio.operationsPolicy?.timezone||'America/Sao_Paulo');
  const person=(value:any)=>({nome:value.nome,email:value.email,matricula:value.matricula});
  const advisor=(value:any)=>value?{nome:value.nome,email:value.email,siape:value.siape,instituicao:value.instituicao}:null;
  const yes=(value:unknown,fallback=false)=>value===undefined?fallback:value===true||/^(sim|true|1)$/i.test(String(value).trim());
  const keywords=String(supplied.PALAVRAS_CHAVE||'').split(/[;,\n]+/).map(value=>value.trim()).filter(Boolean);
  const p:ProcessData={id:'model-preview',protocolo:'AMOSTRA-SEM-VALIDADE',createdByEmail:'amostra@example.invalid',createdAt:'2026-10-01T12:00:00Z',updatedAt:'2026-10-01T12:00:00Z',dataRevision:1,status:'AGUARDANDO_ASSINATURA',etapaAtual:'REPOSITORIO',titulo:payload.titulo,aluno1:person(payload.aluno1),aluno2:payload.aluno2?person(payload.aluno2):null,orientador:advisor(payload.orientador)!,coorientador:advisor(payload.coorientador),banca:payload.banca.map((member,index)=>({id:`sample-${index+1}`,nome:member.nome,email:member.email,siape:member.siape,instituicao:member.instituicao,funcao:(index===0?'EXAMINER_2':'EXAMINER_3')})),defesa:{...payload.defesa,endAt:new Date(Date.parse(payload.defesa.startAt)+90*60_000).toISOString(),localStatus:'CONFIRMADO'},registrationAnswers:payload.registrationAnswers,avaliacao:{status:'CONCLUIDO',resultadoCode:'APROVADO',resultadoLabel:String(supplied.RESULTADO||'Aprovado'),notaFinal:Number(supplied.NOTA_FINAL||supplied.CAMPO_10||8),parecer:String(supplied.PARECER||'Parecer fictício para conferência do modelo.')},acervo:{submittedAt:'2026-10-21T12:00:00Z',publishFullWork:yes(supplied.PUBLICAR_TRABALHO,true),publishExpandedAbstract:yes(supplied.PUBLICAR_RESUMO_EXPANDIDO),palavrasChave:keywords.length?keywords.slice(0,5):['Cuidado','Ensino','Pesquisa','Saúde','Enfermagem'],resumoSintese:String(supplied.RESUMO_SINTETICO||'Resumo fictício.\n\nMétodo fictício.\n\nResultados fictícios.')}};
  return {process:p,variables:buildProcessVariables({process:p,eventCode:'MODEL_PREVIEW',actorEmail:'amostra@example.invalid',actorRoles:[],extraVariables:answers})};
}
