import type {RegistrationAnswers} from '../types/operationalConfig';
import type {RegistrationDraft} from '../types/workflowOperations';

export interface RegistrationDraftStep {answers:RegistrationAnswers;section:number;schemaRevision:number}
export interface RegistrationDraftAttempt extends RegistrationDraftStep {expectedRevision:number;ownerEmail:string}
export class RegistrationDraftRecoveryConflict extends Error {
  readonly status=409;
  readonly code='REGISTRATION_DRAFT_CONFLICT';
  constructor(message='O rascunho mudou em outra sessão. Seus campos foram preservados; confira a versão atual antes de salvar.'){
    super(message);this.name='RegistrationDraftRecoveryConflict';
  }
}
const normalizedOwner=(owner:string)=>String(owner||'').trim().toLowerCase();
const sameAnswers=(left:RegistrationAnswers,right:RegistrationAnswers)=>{
  const a=Object.keys(left).sort(),b=Object.keys(right).sort();
  return a.length===b.length&&a.every((key,index)=>key===b[index]&&left[key]===right[key]);
};
const sameStep=(left:RegistrationDraftStep,right:RegistrationDraftStep)=>left.section===right.section
  &&left.schemaRevision===right.schemaRevision&&sameAnswers(left.answers,right.answers);
const runtimeBusy=(error:unknown)=>{
  const value=error as {status?:unknown;code?:unknown}|null;
  return value?.status===503&&value.code==='RUNTIME_BUSY';
};

/** One save per explicit call. An uncertain acknowledgement requires a readback on the next call. */
export class RegistrationDraftRecovery {
  readonly ownerEmail:string;
  private currentRevision:number;
  private savedAnswers:RegistrationAnswers|undefined;
  private uncertainAttempt:RegistrationDraftAttempt|null=null;
  private inFlight=false;
  constructor(private readonly ports:{
    ownerEmail:string;revision?:number;savedAnswers?:RegistrationAnswers;
    save:(input:{section:number;schemaRevision:number;expectedRevision:number}&({answers:RegistrationAnswers}|{answerPatch:Record<string,string|number|boolean|null>}))=>Promise<RegistrationDraft>;
    getDraft:()=>Promise<RegistrationDraft|null>;
  }){
    this.ownerEmail=normalizedOwner(ports.ownerEmail);
    this.currentRevision=ports.revision??0;
    this.savedAnswers=ports.savedAnswers&&structuredClone(ports.savedAnswers);
    if(!this.ownerEmail||!Number.isSafeInteger(this.currentRevision)||this.currentRevision<0)throw new Error('Identidade ou revisão do rascunho inválida.');
  }
  get revision():number{return this.currentRevision;}
  get pendingAttempt():RegistrationDraftAttempt|null{return this.uncertainAttempt?structuredClone(this.uncertainAttempt):null;}

  private input(step:RegistrationDraftStep,owner?:string):RegistrationDraftStep{
    if(owner!==undefined&&normalizedOwner(owner)!==this.ownerEmail)throw new RegistrationDraftRecoveryConflict('A conta ativa mudou. Os campos desta conta não serão gravados em outro cadastro.');
    if(!Number.isSafeInteger(step.section)||step.section<0||step.section>30||!Number.isSafeInteger(step.schemaRevision)||step.schemaRevision<0
      ||!step.answers||typeof step.answers!=='object'||Array.isArray(step.answers))throw new Error('Dados do rascunho inválidos.');
    if(step.answers.ALUNO_1_EMAIL!==undefined&&normalizedOwner(String(step.answers.ALUNO_1_EMAIL))!==this.ownerEmail)throw new RegistrationDraftRecoveryConflict('O autor do rascunho não corresponde à conta ativa.');
    const answers:RegistrationAnswers={};
    for(const [key,value] of Object.entries(step.answers)){
      if(value===undefined)continue;
      if(!['string','number','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value))throw new Error('Respostas do rascunho inválidas.');
      Object.defineProperty(answers,key,{value,writable:true,enumerable:true,configurable:true});
    }
    answers.ALUNO_1_EMAIL=this.ownerEmail;
    return{answers,section:step.section,schemaRevision:step.schemaRevision};
  }
  private assertOwner(draft:RegistrationDraft):void{
    if(normalizedOwner(draft.ownerEmail)!==this.ownerEmail||!draft.answers||typeof draft.answers!=='object'||Array.isArray(draft.answers)){
      throw new RegistrationDraftRecoveryConflict('A consulta não confirmou um rascunho desta conta. Seus campos foram preservados.');
    }
  }
  async saveStep(step:RegistrationDraftStep,owner?:string):Promise<RegistrationDraft>{
    const input=this.input(step,owner);
    if(this.inFlight)throw Object.assign(new Error('Há um salvamento em andamento. Aguarde sua conclusão.'),{status:503,code:'DRAFT_SAVE_IN_PROGRESS'});
    this.inFlight=true;
    try{
      const pending=this.uncertainAttempt;
      if(pending){
        const remote=await this.ports.getDraft();
        if(remote)this.assertOwner(remote);
        if(remote&&remote.revision===pending.expectedRevision+1&&sameStep(remote,pending)){
          this.currentRevision=remote.revision;
          this.savedAnswers=structuredClone(remote.answers);
          this.uncertainAttempt=null;
          if(sameStep(input,pending))return structuredClone(remote);
        }else if(remote?.revision===pending.expectedRevision||remote===null&&pending.expectedRevision===0){
          // The prior write did not advance the revision. This explicit call may make one CAS attempt.
          this.uncertainAttempt=null;
        }else throw new RegistrationDraftRecoveryConflict();
      }
      if(this.currentRevision===Number.MAX_SAFE_INTEGER)throw new Error('A revisão do rascunho atingiu o limite permitido.');
      const attempt:RegistrationDraftAttempt={...structuredClone(input),ownerEmail:this.ownerEmail,expectedRevision:this.currentRevision};
      this.uncertainAttempt=attempt;
      try{
        const previous=this.savedAnswers;
        const fields=previous?{
          answerPatch:Object.fromEntries(
            Array.from(new Set([...Object.keys(previous),...Object.keys(input.answers)]))
              .filter(key=>previous[key]!==input.answers[key])
              .map(key=>[key,input.answers[key]??null])
          ),
        }:{answers:input.answers};
        const saved=await this.ports.save({...fields,section:input.section,schemaRevision:input.schemaRevision,expectedRevision:attempt.expectedRevision});
        this.assertOwner(saved);
        if(saved.revision!==attempt.expectedRevision+1||!sameStep(saved,attempt))throw new RegistrationDraftRecoveryConflict('O servidor não confirmou exatamente os campos enviados. Seus campos locais foram preservados.');
        this.currentRevision=saved.revision;
        this.savedAnswers=structuredClone(saved.answers);
        this.uncertainAttempt=null;
        return structuredClone(saved);
      }catch(error){
        // This admission error is raised before the handler; no readback or automatic replay is needed.
        if(runtimeBusy(error))this.uncertainAttempt=null;
        if((error as {status?:unknown})?.status===409&&!(error instanceof RegistrationDraftRecoveryConflict))throw new RegistrationDraftRecoveryConflict(error instanceof Error?error.message:undefined);
        throw error;
      }
    }finally{this.inFlight=false;}
  }
}
