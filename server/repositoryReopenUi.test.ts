import {ApiRequestError} from '../src/services/apiClient';
import {repositorySubmissionConfirmed} from '../src/utils/repositorySubmissionConfirmation';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

function fixture(){
 const source=readFileSync('src/pages/ProcessoDetailPage.tsx','utf8');
 const start=source.indexOf('  const handleReopenRepository=async()=>{'),end=source.indexOf('\n  const canStudentEdit',start);
 assert.ok(start>0&&end>start);
 const state:any={posts:0,confirms:0,notices:[],process:null,busy:false,message:'',refreshes:0,blocking:[],form:{}};
 const context:any={Error,ApiRequestError,repositorySubmissionConfirmed,userEmail:'author@example.invalid',editingSectionRef:{current:null},canSubmitAcervo:true,readOnly:false,process:{id:'p'},repositoryReopenInFlight:{current:false},repositorySubmitInFlight:{current:false},setEditingSection:()=>{},setRemoteUpdatePending:()=>{},legacyAccessScope:{current:'p|owner'},lastProcessRevision:{current:null},
  portalPrompt:async(_text:string,_initial:string,options:any)=>{state.confirms++;assert.equal(options.tone,'warning');return 'Correção dos arquivos da entrega';},
  portalNotice:(message:string)=>state.notices.push(message),
  apiClient:{reopenRepository:async(_id:string,reason:string)=>{assert.equal(reason,'Correção dos arquivos da entrega');state.posts++;return {id:'p',dataRevision:5,updatedAt:'now',acervo:{publishFullWork:false,publishExpandedAbstract:false,palavrasChave:['saúde'],resumoSintese:'Resumo'}};}},
  withBlockingPortalOperation:async(label:string,operation:()=>Promise<unknown>)=>{state.blocking.push(label);return operation();},
  loadData:async(options:any)=>{state.refreshes++;assert.equal(options.quiet,true);assert.equal(options.preserveAcervoDraft,true);},
  setProcess:(value:unknown)=>{state.process=value;},setIsSubmittingAcervo:(value:boolean)=>{state.busy=value;},setRepositoryReopenNotice:(value:string)=>{state.message=value;},
 };
 for(const field of ['Keywords','Resumo','ResumoExpandido','TrabalhoCompleto','IsPublic','ExpandedPublic'])context['setAcervo'+field]=(value:unknown)=>{state.form[field]=value;};
 const handler=runInNewContext(ts.transpileModule('(function(){'+source.slice(start,end)+';return {open:handleReopenRepository,retry:retryRepositoryDocuments};})()',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {state,context,handler};
}
test('reopen locks synchronously across confirmation and unlocks fields only after canonical POST success',async()=>{
 const f=fixture();let confirm!:(value:string)=>void,resolvePost!:(value:unknown)=>void;
 f.context.portalPrompt=()=>{f.state.confirms++;return new Promise(resolve=>{confirm=resolve;});};
 f.context.apiClient.reopenRepository=()=>{f.state.posts++;return new Promise(resolve=>{resolvePost=resolve;});};
 const pending=f.handler.open();await f.handler.open();assert.equal(f.state.confirms,1);assert.equal(f.state.posts,0);
 confirm("Correção dos arquivos da entrega");for(let i=0;i<5;i++)await Promise.resolve();assert.equal(f.state.posts,1);assert.equal(f.state.process,null);assert.equal(f.state.busy,true);
 resolvePost({id:'p',dataRevision:5,updatedAt:'now',acervo:{publishFullWork:false,publishExpandedAbstract:false}});await pending;
 assert.equal(f.state.process.dataRevision,5);assert.equal(f.state.form.IsPublic,false);assert.equal(f.state.form.ExpandedPublic,false);assert.equal(f.state.busy,false);assert.equal(f.context.repositoryReopenInFlight.current,false);assert.equal(f.context.editingSectionRef.current,'acervo');
});
test('failed quiet refresh preserves confirmed reopen and retries GET only, without replacing editable fields',async()=>{
 const f=fixture();f.context.loadData=async()=>{f.state.refreshes++;throw Error('read unavailable');};
 await f.handler.open();assert.equal(f.state.posts,1);assert.equal(f.state.process.dataRevision,5);assert.match(f.state.message,/Entrega reaberta/);assert.equal(f.state.notices.length,0);
 f.state.form.Resumo='Edição local preservada';f.context.loadData=async(options:any)=>{f.state.refreshes++;assert.equal(options.preserveAcervoDraft,true);};
 await f.handler.retry();assert.equal(f.state.posts,1);assert.equal(f.state.message,'');assert.equal(f.state.form.Resumo,'Edição local preservada');
});
test('cancel, failed POST and identity change never unlock fields or replay a mutation',async()=>{
 const canceled=fixture();canceled.context.portalPrompt=async()=>null;await canceled.handler.open();assert.equal(canceled.state.posts,0);assert.equal(canceled.state.process,null);
 const denied=fixture();denied.context.apiClient.reopenRepository=async()=>{denied.state.posts++;throw Error('Acesso negado');};await denied.handler.open();assert.equal(denied.state.posts,1);assert.equal(denied.state.process,null);assert.equal(denied.state.refreshes,0);assert.equal(denied.state.notices[0],'Acesso negado');assert.equal(denied.context.editingSectionRef.current,null);
 const changed=fixture();changed.context.portalPrompt=async()=>{changed.context.legacyAccessScope.current='p|other';return 'Correção dos arquivos da entrega';};await changed.handler.open();assert.equal(changed.state.posts,0);assert.equal(changed.state.process,null);
});

test('motivo vazio, curto ou cancelado não envia reabertura',async()=>{
 for(const reason of [null,'','curto','   ']){
  const f=fixture();f.context.portalPrompt=async()=>reason;await f.handler.open();assert.equal(f.state.posts,0);assert.equal(f.state.process,null);
 }
});
test('stale administrative cards stay hidden until the quiet refresh is confirmed',()=>{
 const source=readFileSync('src/pages/ProcessoDetailPage.tsx','utf8');
 assert.match(source,/isTabVisible\('docs'\) && \(repositoryReopenNotice\?<aside[\s\S]*?:<ProcessDocumentsPanel/);
});

function finalDelivery(f:ReturnType<typeof fixture>){
 const source=readFileSync('src/pages/ProcessoDetailPage.tsx','utf8'),start=source.indexOf('  const handleSubmitAcervo = async'),end=source.indexOf('\n  const handleAcervoPdfUpload',start);
 Object.assign(f.context,{isAcervoSubmitted:false,isSubmittingAcervo:false,acervoUploading:'',ataIsArchived:true,acervoKeywords:'um,dois,três,quatro,cinco',acervoResumo:'Resumo',acervoTrabalhoCompleto:'Trabalho.pdf',acervoExpandedPublic:false,acervoResumoExpandido:'',acervoIsPublic:false,processId:'p',termSignatureProvider:'ASTEN',automaticAsten:true,setActiveTab:()=>{},setProcessLink:()=>{},setSignatureNotice:()=>{},finalDeliveryMessage:()=> 'Entrega confirmada.'});
 return runInNewContext(ts.transpileModule('(function(){'+source.slice(start,end)+';return handleSubmitAcervo;})()',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,f.context);
}
test('confirmed final delivery releases the edit guard even when detail refresh fails, without reporting a failed save',async()=>{
 const f=fixture();f.context.editingSectionRef.current='acervo';
 f.context.apiClient.submitFinalData=async()=>{f.state.posts++;return {id:'p',dataRevision:6,acervo:{submittedAt:'now'}};};
 f.context.loadData=async()=>{throw Error('read unavailable');};
 await finalDelivery(f)({preventDefault:()=>{}});
 assert.equal(f.context.editingSectionRef.current,null);assert.equal(f.state.process.dataRevision,6);assert.match(f.state.message,/Entrega confirmada/);assert.equal(f.state.notices.length,0);assert.equal(f.state.posts,1);
});
test('failed final delivery preserves the edit guard and its draft; fresh detail clears the previous recovery warning',async()=>{
 const f=fixture();f.context.editingSectionRef.current='acervo';f.context.apiClient.submitFinalData=async()=>{throw Error('write unavailable');};
 await finalDelivery(f)({preventDefault:()=>{}});assert.equal(f.context.editingSectionRef.current,'acervo');assert.equal(f.state.process,null);
 f.context.loadData=async()=>{};f.state.message='Entrega reaberta. Atualize documentos.';f.context.apiClient.submitFinalData=async()=>({id:'p',dataRevision:6,acervo:{submittedAt:'now'}});
 await finalDelivery(f)({preventDefault:()=>{}});assert.equal(f.context.editingSectionRef.current,null);assert.equal(f.state.message,'');
});

test('resposta atrasada da mesma revisão não substitui atualização operacional mais recente',async()=>{
 const f=fixture(),source=readFileSync('src/pages/ProcessoDetailPage.tsx','utf8');
 const start=source.indexOf('  const loadData = async'),end=source.indexOf('\n\n  useEffect(() => {',start);
 Object.assign(f.context,{processId:'p',ApiRequestError:class extends Error{},deletionDialogRef:{current:false},setIsLoading:()=>{},setErrorMsg:()=>{},setCanRetryLoad:()=>{},setRemoteUpdatePending:()=>{}});
 f.context.lastProcessRevision.current={revision:6,updatedAt:'2030-01-01T12:00:00Z'};
 f.state.process={id:'p',dataRevision:6,updatedAt:'2030-01-01T12:00:00Z'};
 f.context.apiClient.getProcessDetail=async()=>({process:{id:'p',dataRevision:6,updatedAt:'2030-01-01T11:59:00Z'},documents:[],signatures:[],verifications:[],auditLogs:[]});
 const load=runInNewContext(ts.transpileModule('(function(){'+source.slice(start,end)+';return loadData;})()',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,f.context);
 await load(true);assert.equal(f.state.process.updatedAt,'2030-01-01T12:00:00Z');assert.equal(f.context.lastProcessRevision.current.updatedAt,'2030-01-01T12:00:00Z');
});
test('an older background read finishing after final-delivery ACK cannot overwrite its confirmed revision',async()=>{
 const f=fixture(),source=readFileSync('src/pages/ProcessoDetailPage.tsx','utf8');
 const start=source.indexOf('  const loadData = async'),end=source.indexOf('\n\n  useEffect(() => {',start);
 Object.assign(f.context,{processId:'p',ApiRequestError:class extends Error{},deletionDialogRef:{current:false},setIsLoading:()=>{},setErrorMsg:()=>{},setCanRetryLoad:()=>{},setRemoteUpdatePending:()=>{}});
 let resolveOld!:(value:unknown)=>void;
 f.context.apiClient.getProcessDetail=()=>new Promise(resolve=>{resolveOld=resolve;});
 const load=runInNewContext(ts.transpileModule('(function(){'+source.slice(start,end)+';return loadData;})()',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,f.context);
 f.context.editingSectionRef.current='acervo';const pending=load(true);
 f.context.loadData=async()=>{};
 f.context.apiClient.submitFinalData=async()=>({id:'p',dataRevision:6,updatedAt:'new',acervo:{submittedAt:'now'}});
 await finalDelivery(f)({preventDefault:()=>{}});
 assert.equal(f.context.lastProcessRevision.current.revision,6);assert.equal(f.context.editingSectionRef.current,null);
 resolveOld({process:{id:'p',dataRevision:5,updatedAt:'old',acervo:{}},documents:[],signatures:[],verifications:[],auditLogs:[]});
 await pending;assert.equal(f.state.process.dataRevision,6);assert.equal(f.state.process.acervo.submittedAt,'now');
});


test('durable delivery ACK unlocks and opens documents without awaiting a stalled detail read',async()=>{
 const f=fixture();f.context.editingSectionRef.current='acervo';let tab='',remote=true,editing='acervo';
 Object.assign(f.context,{setActiveTab:(value:string)=>{tab=value;},setRemoteUpdatePending:(value:boolean)=>{remote=value;},setEditingSection:(value:any)=>{editing=value;}});
 f.context.loadData=()=>new Promise(()=>{});
 f.context.apiClient.submitFinalData=async()=>{f.state.posts++;return{id:'p',dataRevision:6,updatedAt:'now',acervo:{submittedAt:'now'}};};
 const submit=finalDelivery(f);
 // finalDelivery installs default UI setters; retain observable ones for this case.
 f.context.setActiveTab=(value:string)=>{tab=value;};
 let settled=false;void submit({preventDefault:()=>{}}).then(()=>{settled=true;});
 await new Promise<void>(resolve=>setImmediate(resolve));
 assert.equal(settled,true);assert.equal(tab,'docs');assert.equal(remote,false);assert.equal(editing,null);assert.equal(f.state.busy,false);assert.equal(f.context.repositorySubmitInFlight.current,false);assert.equal(f.state.notices.length,0);
});
test('delivery locks synchronously against duplicate clicks until server confirms the write',async()=>{
 const f=fixture();let release!:(value:any)=>void;
 f.context.apiClient.submitFinalData=async()=>{f.state.posts++;return new Promise(resolve=>{release=resolve;});};
 const submit=finalDelivery(f),pending=submit({preventDefault:()=>{}});await submit({preventDefault:()=>{}});
 assert.equal(f.state.posts,1);assert.equal(f.context.repositorySubmitInFlight.current,true);assert.equal(f.state.process,null);
 release({id:'p',dataRevision:6,updatedAt:'now',acervo:{submittedAt:'now'}});await pending;
 assert.equal(f.context.repositorySubmitInFlight.current,false);assert.equal(f.state.busy,false);
});


for(const outcome of ['confirmed','changed','denied']as const)test(`lost delivery reply ${outcome}: one POST and bounded authorized read`,async()=>{
 const f=fixture();f.context.process={id:'p',dataRevision:5,acervo:{trabalhoCompletoFileId:'file'}};let reads=0;
 f.context.apiClient.submitFinalData=async()=>{f.state.posts++;throw new ApiRequestError('Unconfirmed timeout',0,'REQUEST_TIMEOUT');};
 f.context.apiClient.getProcessById=async(_id:string,options:any)=>{reads++;assert.equal(options.timeoutMs,10000);if(outcome==='denied')throw new ApiRequestError('denied',403);return{id:'p',dataRevision:6,updatedAt:'now',acervo:{trabalhoCompletoFileId:'file',submittedBy:'author@example.invalid',submittedAt:'now',resumoSintese:outcome==='changed'?'different':'Resumo',palavrasChave:['um','dois','três','quatro','cinco'],publishFullWork:false,publishExpandedAbstract:false,workType:'MONOGRAFIA'}};};
 await finalDelivery(f)({preventDefault:()=>{}});
 assert.equal(f.state.posts,1);assert.equal(reads,1);assert.equal(f.state.busy,false);
 if(outcome==='confirmed'){assert.equal(f.state.process.dataRevision,6);assert.equal(f.state.notices.length,0);}else{assert.equal(f.state.process,null);assert.match(f.state.notices[0],/Unconfirmed timeout/);}
});
