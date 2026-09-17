import fs from 'node:fs';

const read=f=>fs.readFileSync(f,'utf8');
const write=(f,t)=>fs.writeFileSync(f,t);
const req=(text,needle,label)=>{if(!text.includes(needle))throw new Error(`Trecho não localizado: ${label}`);};

// 1) Sessão durável + renovação no F5 sem transformar refresh em nova autenticação sensível.
{
  const file='server/security/firebaseAuth.ts'; let t=read(file);
  req(t,'const SESSION_TTL_SECONDS = 2 * 60 * 60;','TTL atual');
  t=t.replace('const SESSION_TTL_SECONDS = 2 * 60 * 60;','const SESSION_TTL_SECONDS = 12 * 60 * 60;');
  const anchor=`export function clearPortalSessionCookie(res: Response): void {`;
  req(t,anchor,'clear cookie');
  const fn=`export function refreshPortalSessionCookie(res: Response, identity: PortalIdentity): PortalIdentity {\n  const renewed: PortalIdentity = { ...identity, expiresAt: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };\n  const token = encodeSession(renewed);\n  const secure = secureRuntime();\n  res.setHeader('Set-Cookie', [\n    \`${'${cookieName()}'}=${'${encodeURIComponent(token)}'}\`, 'Path=/', 'HttpOnly', 'SameSite=Lax',\n    secure ? 'Secure' : '', 'Priority=High', \`Max-Age=${'${SESSION_TTL_SECONDS}'}\`\n  ].filter(Boolean).join('; '));\n  return renewed;\n}\n\n`;
  t=t.replace(anchor,fn+anchor); write(file,t);
}

// 2) Servidor: rascunhos duráveis por usuário/processo e renovação da sessão no /api/me.
{
  const file='server.ts'; let t=read(file);
  t=t.replace('requireAuthenticated, setPortalSessionCookie }', 'requireAuthenticated, setPortalSessionCookie, refreshPortalSessionCookie }');
  req(t,'registrationDrafts?: Record<string,RegistrationDraft>;','persisted drafts');
  t=t.replace('registrationDrafts?: Record<string,RegistrationDraft>;','registrationDrafts?: Record<string,RegistrationDraft>;\n  interactionDrafts?: Record<string,InteractionDraft>;');
  const formInterface='interface FormArchiveJob {';
  req(t,formInterface,'FormArchiveJob interface');
  t=t.replace(formInterface,`interface InteractionDraft {\n  id:string; processId:string; ownerEmail:string; draftKey:string; data:Record<string,unknown>; updatedAt:string;\n}\n\n${formInterface}`);
  req(t,'let registrationDraftsStore=pruneDrafts(persistedPortalState.registrationDrafts||{});','registrationDraftsStore');
  t=t.replace('let registrationDraftsStore=pruneDrafts(persistedPortalState.registrationDrafts||{});','let registrationDraftsStore=pruneDrafts(persistedPortalState.registrationDrafts||{});\nlet interactionDraftsStore:Record<string,InteractionDraft>=persistedPortalState.interactionDrafts||{};');
  req(t,'return { registrationDrafts:registrationDraftsStore, reminders:reminderRecordsStore,','snapshot');
  t=t.replace('return { registrationDrafts:registrationDraftsStore, reminders:reminderRecordsStore,','return { registrationDrafts:registrationDraftsStore, interactionDrafts:interactionDraftsStore, reminders:reminderRecordsStore,');
  const oldMe=`  app.get('/api/me', (req, res) => {\n    const identity=getPortalIdentity(req); const email=identity?.email||'visitante@publico.local';\n    const { globalRoles, memberships } = getUserRolesForEmail(email);\n\n    res.json({\n      userEmail: email,\n      globalRoles,\n      memberships,\n      isAuthenticated: Boolean(identity), authenticationMode:identity?.method||'PUBLIC'\n    });\n  });`;
  req(t,oldMe,'/api/me');
  const newMe=`  app.get('/api/me', (req, res) => {\n    const identity=getPortalIdentity(req); const email=identity?.email||'visitante@publico.local';\n    const { globalRoles, memberships } = getUserRolesForEmail(email);\n    const renewed=identity?refreshPortalSessionCookie(res,identity):null;\n    res.setHeader('Cache-Control','private, no-store');\n    res.json({\n      userEmail: email,\n      globalRoles,\n      memberships,\n      isAuthenticated: Boolean(identity), authenticationMode:identity?.method||'PUBLIC',\n      expiresAt:renewed?new Date(renewed.expiresAt*1000).toISOString():undefined\n    });\n  });`;
  t=t.replace(oldMe,newMe);
  const registrationAnchor="  app.get('/api/forms/registration-schema',requireAuthenticated";
  req(t,registrationAnchor,'registration schema anchor');
  const endpoints=`  const interactionDraftId=(email:string,processId:string,draftKey:string)=>createHash('sha256').update(\`${'${email}'}|${'${processId}'}|${'${draftKey}'}\`).digest('hex');\n  const validateInteractionDraft=(req:express.Request,res:express.Response)=>{\n    const identity=getPortalIdentity(req)!;const processId=String(req.params.id||'').trim();const draftKey=String(req.params.draftKey||'').trim();\n    if(!/^[A-Za-z0-9_.:-]{1,120}$/.test(draftKey))return{error:res.status(400).json({error:'Identificador de rascunho inválido.'})};\n    const process=processesStore.find(item=>item.id===processId);if(!process||!canAccessProcess(identity.email,processId))return{error:res.status(404).json({error:'Processo não encontrado.'})};\n    return{identity,processId,draftKey,id:interactionDraftId(identity.email,processId,draftKey)};\n  };\n  app.get('/api/processes/:id/drafts/:draftKey',requireAuthenticated,(req,res)=>{const ctx=validateInteractionDraft(req,res);if('error'in ctx)return;res.setHeader('Cache-Control','private, no-store');res.json(interactionDraftsStore[ctx.id]||null);});\n  app.put('/api/processes/:id/drafts/:draftKey',requireAuthenticated,async(req,res)=>{const ctx=validateInteractionDraft(req,res);if('error'in ctx)return;const data=req.body?.data;if(!data||typeof data!=='object'||Array.isArray(data))return res.status(400).json({error:'Rascunho inválido.'});const encoded=JSON.stringify(data);if(Buffer.byteLength(encoded,'utf8')>128*1024)return res.status(413).json({error:'Rascunho excede o limite permitido.'});const draft:InteractionDraft={id:ctx.id,processId:ctx.processId,ownerEmail:ctx.identity.email,draftKey:ctx.draftKey,data:JSON.parse(encoded),updatedAt:new Date().toISOString()};interactionDraftsStore[ctx.id]=draft;await persistPortalStateDurably();res.setHeader('Cache-Control','private, no-store');res.json(draft);});\n  app.delete('/api/processes/:id/drafts/:draftKey',requireAuthenticated,async(req,res)=>{const ctx=validateInteractionDraft(req,res);if('error'in ctx)return;delete interactionDraftsStore[ctx.id];await persistPortalStateDurably();res.json({deleted:true});});\n\n`;
  t=t.replace(registrationAnchor,endpoints+registrationAnchor);
  write(file,t);
}

// 3) Cliente API para os rascunhos protegidos.
{
  const file='src/services/apiClient.ts';let t=read(file);
  const anchor="  getProcessById: (id: string) => fetchApi<ProcessData>(`/api/processes/${id}`),";
  req(t,anchor,'api getProcessById');
  const add=`${anchor}\n  getInteractionDraft:(processId:string,draftKey:string)=>fetchApi<{data:Record<string,unknown>;updatedAt:string}|null>(\`/api/processes/${'${processId}'}/drafts/${'${encodeURIComponent(draftKey)}'}\`),\n  saveInteractionDraft:(processId:string,draftKey:string,data:Record<string,unknown>)=>fetchApi<{data:Record<string,unknown>;updatedAt:string}>(\`/api/processes/${'${processId}'}/drafts/${'${encodeURIComponent(draftKey)}'}\`,{method:'PUT',body:JSON.stringify({data})}),\n  deleteInteractionDraft:(processId:string,draftKey:string)=>fetchApi<{deleted:boolean}>(\`/api/processes/${'${processId}'}/drafts/${'${encodeURIComponent(draftKey)}'}\`,{method:'DELETE'}),`;
  t=t.replace(anchor,add);write(file,t);
}

// 4) Idle de 15 min com salvamento cooperativo antes de sair. A sessão HttpOnly segue válida/renovável no F5.
{
  const file='src/context/AuthContext.tsx';let t=read(file);
  t=t.replace("import React, { createContext, useContext, useState, useEffect } from 'react';","import React, { createContext, useContext, useState, useEffect, useRef } from 'react';");
  req(t,'const [isAuthenticated,setIsAuthenticated]=useState(false);','auth state');
  t=t.replace('const [isAuthenticated,setIsAuthenticated]=useState(false);',`const [isAuthenticated,setIsAuthenticated]=useState(false);\n  const idleTimer=useRef<ReturnType<typeof setTimeout>|null>(null);\n  const lastSessionRefresh=useRef(0);`);
  const oldLogout="  const logout=async()=>{await apiClient.logout();setActiveUserEmail('');setUserEmailState('');setGlobalRoles([]);setMemberships([]);setIsAuthenticated(false);await refreshAuth();};";
  req(t,oldLogout,'logout');
  const newLogout=`  const logout=async()=>{try{await apiClient.logout();}catch(error){console.warn('Não foi possível confirmar o logout no servidor; limpando a sessão local.',error);}finally{setActiveUserEmail('');setUserEmailState('');setGlobalRoles([]);setMemberships([]);setIsAuthenticated(false);}await refreshAuth();};\n\n  useEffect(()=>{\n    if(typeof window==='undefined'||!isAuthenticated)return;\n    const IDLE_MS=15*60_000;\n    const schedule=()=>{if(idleTimer.current)clearTimeout(idleTimer.current);idleTimer.current=setTimeout(async()=>{window.dispatchEvent(new CustomEvent('portal:autosave-request',{detail:{reason:'idle-timeout'}}));await new Promise(resolve=>setTimeout(resolve,1200));await logout();},IDLE_MS);};\n    const activity=()=>{schedule();const now=Date.now();if(now-lastSessionRefresh.current>5*60_000){lastSessionRefresh.current=now;void apiClient.getMe().then(me=>{if(me.isAuthenticated){setUserEmailState(me.userEmail);setGlobalRoles(me.globalRoles);setMemberships(me.memberships);}}).catch(()=>undefined);}};\n    const events=['pointerdown','keydown','input','change','touchstart'] as const;events.forEach(event=>window.addEventListener(event,activity,{passive:true}));schedule();\n    return()=>{if(idleTimer.current)clearTimeout(idleTimer.current);events.forEach(event=>window.removeEventListener(event,activity));};\n  },[isAuthenticated]);`;
  t=t.replace(oldLogout,newLogout);write(file,t);
}

// 5) Cadastro inicial já possuía draft durável; reduzir janela de perda e responder ao autosave global.
{
  const file='src/components/ConfigurableRegistration.tsx';let t=read(file);
  t=t.replace('const timer=setTimeout(queueSave,900);','const timer=setTimeout(queueSave,350);');
  const anchor="  const check=(all:boolean)=>{";
  req(t,anchor,'registration check');
  const listener=`  useEffect(()=>{const flush=()=>queueSave();window.addEventListener('portal:autosave-request',flush);return()=>window.removeEventListener('portal:autosave-request',flush);},[answers,currentSection,eligibility,busy,studio?.revision,isMasterAdmin,draftReview]);\n`;
  t=t.replace(anchor,listener+anchor);write(file,t);
}

// 6) Avaliação: recuperar/salvar rascunho no servidor e remover após envio definitivo.
{
  const file='src/components/AdvisorEvaluationPanel.tsx';let t=read(file);
  t=t.replace("import React, { useEffect, useState } from 'react';","import React, { useEffect, useRef, useState } from 'react';");
  req(t,"  const [schemaRetry, setSchemaRetry] = useState(0);",'schemaRetry');
  t=t.replace("  const [schemaRetry, setSchemaRetry] = useState(0);","  const [schemaRetry, setSchemaRetry] = useState(0);\n  const draftReady=useRef(false);\n  const answersRef=useRef<RegistrationAnswers>({});\n  useEffect(()=>{answersRef.current=answers;},[answers]);");
  const oldEffect=`    if (canEvaluate) apiClient.getEvaluationSchema(process.id).then(value => { if (active) setSchema(value); }).catch(e => { if (active) setError(e.message); });`;
  req(t,oldEffect,'evaluation schema load');
  const newEffect=`    draftReady.current=false;\n    if (canEvaluate) Promise.all([apiClient.getEvaluationSchema(process.id),apiClient.getInteractionDraft(process.id,'evaluation')]).then(([value,draft]) => { if (!active)return;setSchema(value);const data=draft?.data||{};const recovered=(data.answers&&typeof data.answers==='object'?data.answers:{}) as RegistrationAnswers;setAnswers(recovered);setConfirmed(Boolean(data.confirmed));draftReady.current=true; }).catch(e => { if (active) setError(e.message); });`;
  t=t.replace(oldEffect,newEffect);
  const afterTimer="  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);";
  req(t,afterTimer,'evaluation timer');
  const autosave=`${afterTimer}\n  useEffect(()=>{if(!canEvaluate||process.avaliacao.status==='CONCLUIDO'||!draftReady.current)return;const timer=setTimeout(()=>{void apiClient.saveInteractionDraft(process.id,'evaluation',{answers,confirmed}).catch(()=>undefined);},500);return()=>clearTimeout(timer);},[answers,confirmed,canEvaluate,process.id,process.avaliacao.status]);\n  useEffect(()=>{const flush=()=>{if(canEvaluate&&process.avaliacao.status!=='CONCLUIDO')void apiClient.saveInteractionDraft(process.id,'evaluation',{answers:answersRef.current,confirmed}).catch(()=>undefined);};window.addEventListener('portal:autosave-request',flush);return()=>window.removeEventListener('portal:autosave-request',flush);},[canEvaluate,confirmed,process.id,process.avaliacao.status]);`;
  t=t.replace(afterTimer,autosave);
  req(t,'      await onUpdated();','evaluation onUpdated');
  t=t.replace('      await onUpdated();','      await apiClient.deleteInteractionDraft(process.id,\'evaluation\').catch(()=>undefined);\n      await onUpdated();');
  write(file,t);
}

// 7) Formulários dinâmicos: recuperar, autosalvar e limpar rascunhos por formulário.
{
  const file='src/components/DynamicStudioForms.tsx';let t=read(file);
  req(t,'  const activeProcess = useRef<string | null>(processId);','activeProcess');
  t=t.replace('  const activeProcess = useRef<string | null>(processId);','  const activeProcess = useRef<string | null>(processId);\n  const answersRef=useRef<Record<string,Record<string,string|number|boolean>>>({});\n  const draftTimers=useRef<Record<string,ReturnType<typeof setTimeout>>>({});\n  useEffect(()=>{answersRef.current=answers;},[answers]);');
  const load=`      const [available, previous] = await Promise.all([apiClient.getStudioForms(processId), apiClient.getStudioFormSubmissions(processId)]);\n      if (generation !== requestGeneration.current) return;\n      setForms(available);\n      setSubmissions(previous);`;
  req(t,load,'forms refresh');
  const loadDrafts=`      const [available, previous] = await Promise.all([apiClient.getStudioForms(processId), apiClient.getStudioFormSubmissions(processId)]);\n      if (generation !== requestGeneration.current) return;\n      setForms(available);\n      setSubmissions(previous);\n      const drafts=await Promise.all(available.map(async(form:any)=>[form.id,await apiClient.getInteractionDraft(processId,\`form:${'${form.id}'}\`).catch(()=>null)] as const));\n      if(generation!==requestGeneration.current)return;\n      const recovered:Record<string,Record<string,string|number|boolean>>={};for(const [formId,draft] of drafts){if(draft?.data?.answers&&typeof draft.data.answers==='object')recovered[formId]=draft.data.answers as Record<string,string|number|boolean>;}setAnswers(previousAnswers=>({...recovered,...previousAnswers}));`;
  t=t.replace(load,loadDrafts);
  const oldUpdate=`    setAnswers(previous => ({ ...previous, [formId]: { ...(previous[formId] || {}), [field]: value } }));\n    setErrors(previous => ({ ...previous, [formId]: { ...(previous[formId] || {}), [field]: '' } }));`;
  req(t,oldUpdate,'updateAnswer');
  const newUpdate=`    setAnswers(previous => {const next={ ...previous, [formId]: { ...(previous[formId] || {}), [field]: value } };answersRef.current=next;if(draftTimers.current[formId])clearTimeout(draftTimers.current[formId]);draftTimers.current[formId]=setTimeout(()=>{void apiClient.saveInteractionDraft(processId,\`form:${'${formId}'}\`,{answers:next[formId]}).catch(()=>undefined);},500);return next;});\n    setErrors(previous => ({ ...previous, [formId]: { ...(previous[formId] || {}), [field]: '' } }));`;
  t=t.replace(oldUpdate,newUpdate);
  const priorAnchor='  const priorByForm = useMemo';
  req(t,priorAnchor,'priorByForm');
  const flush=`  useEffect(()=>{const flush=()=>{for(const [formId,values] of Object.entries(answersRef.current))void apiClient.saveInteractionDraft(processId,\`form:${'${formId}'}\`,{answers:values}).catch(()=>undefined);};window.addEventListener('portal:autosave-request',flush);return()=>window.removeEventListener('portal:autosave-request',flush);},[processId]);\n\n`;
  t=t.replace(priorAnchor,flush+priorAnchor);
  req(t,'      await refresh();','forms refresh after submit');
  t=t.replace('      await refresh();','      await apiClient.deleteInteractionDraft(processId,`form:${form.id}`).catch(()=>undefined);\n      setAnswers(previous=>{const next={...previous};delete next[form.id];answersRef.current=next;return next;});\n      await refresh();');
  write(file,t);
}

// Contratos do bloco B.
fs.writeFileSync('server/update34SessionDraftContract.test.ts',`import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import path from'node:path';\nconst root=path.resolve(process.cwd());const source=(file:string)=>readFile(path.join(root,file),'utf8');\ntest('sessão sobrevive a F5 e renova cookie sem renovar autenticação sensível',async()=>{const [auth,server]=await Promise.all([source('server/security/firebaseAuth.ts'),source('server.ts')]);assert.ok(auth.includes('const SESSION_TTL_SECONDS = 12 * 60 * 60'));assert.ok(auth.includes('refreshPortalSessionCookie'));assert.ok(auth.includes('{ ...identity, expiresAt:'));assert.ok(server.includes('refreshPortalSessionCookie(res,identity)'));});\ntest('idle de 15 minutos salva antes de sair',async()=>{const auth=await source('src/context/AuthContext.tsx');assert.ok(auth.includes('const IDLE_MS=15*60_000'));assert.ok(auth.includes("portal:autosave-request"));assert.ok(auth.includes('await new Promise(resolve=>setTimeout(resolve,1200))'));});\ntest('avaliação e formulários possuem rascunho durável',async()=>{const [server,api,evaluation,forms]=await Promise.all([source('server.ts'),source('src/services/apiClient.ts'),source('src/components/AdvisorEvaluationPanel.tsx'),source('src/components/DynamicStudioForms.tsx')]);assert.ok(server.includes("/api/processes/:id/drafts/:draftKey"));assert.ok(server.includes('interactionDrafts:interactionDraftsStore'));assert.ok(api.includes('saveInteractionDraft'));assert.ok(evaluation.includes("saveInteractionDraft(process.id,'evaluation'"));assert.ok(forms.includes('saveInteractionDraft(processId'));});\n`);
console.log('Bloco B aplicado: sessão renovável, idle seguro e rascunhos duráveis.');
