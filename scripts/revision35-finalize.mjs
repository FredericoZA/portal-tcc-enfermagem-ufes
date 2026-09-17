import fs from 'node:fs';

function patchFile(path, patcher) {
  const original = fs.readFileSync(path, 'utf8');
  const next = patcher(original);
  if (next === original) throw new Error(`Nenhuma alteração aplicada em ${path}`);
  fs.writeFileSync(path, next);
}

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Trecho não encontrado: ${label}`);
  return source.replace(search, replacement);
}

patchFile('src/components/IntegrationStudioPanel.tsx', (input) => {
  let source = input;
  source = replaceOnce(
    source,
    "onChange={(e)=>updateSelectedEmail({attachments:Array.from(e.target.selectedOptions).map(option=>option.value)})}",
    "onChange={(e)=>updateSelectedEmail({attachments:Array.from(e.currentTarget.selectedOptions, (option: HTMLOptionElement) => option.value)})}",
    'tipagem de anexos do e-mail'
  );

  const actionAnchor = "  const removeWorkflowAction = (stageId:string,actionId:string) => {setWorkflowStages(previous=>previous.map(stage=>stage.id===stageId?{...stage,actions:stage.actions.filter(action=>action.id!==actionId)}:stage));setIsDirty(true);};\n";
  const actionHelpers = [
    actionAnchor.trimEnd(),
    '',
    '  const moveWorkflowAction = (stageId:string, actionIndex:number, direction:-1|1) => {',
    '    setWorkflowStages(previous=>previous.map(stage=>{',
    '      if(stage.id!==stageId)return stage;',
    '      const target=actionIndex+direction;',
    '      if(target<0||target>=stage.actions.length)return stage;',
    '      const actions=[...stage.actions];',
    '      [actions[actionIndex],actions[target]]=[actions[target],actions[actionIndex]];',
    '      return {...stage,actions};',
    '    }));',
    '    setIsDirty(true);',
    '  };',
    '',
    '  const setWorkflowDragPayload = (event:React.DragEvent, payload:Record<string,unknown>) => {',
    "    event.dataTransfer.effectAllowed='move';",
    "    event.dataTransfer.setData('application/x-portal-workflow', JSON.stringify(payload));",
    '  };',
    '',
    '  const readWorkflowDragPayload = (event:React.DragEvent):Record<string,any>|null => {',
    '    try {',
    "      const raw=event.dataTransfer.getData('application/x-portal-workflow');",
    '      return raw?JSON.parse(raw):null;',
    '    } catch {',
    '      return null;',
    '    }',
    '  };',
    '',
    '  const handleWorkflowStageDrop = (event:React.DragEvent, targetStageId:string) => {',
    '    event.preventDefault();',
    '    const payload=readWorkflowDragPayload(event);',
    '    if(!payload)return;',
    "    if(payload.kind==='palette' && typeof payload.value==='string'){",
    '      addWorkflowAction(targetStageId,payload.value);',
    '      return;',
    '    }',
    "    if(payload.kind==='stage' && typeof payload.stageId==='string' && payload.stageId!==targetStageId){",
    '      setWorkflowStages(previous=>{',
    '        const from=previous.findIndex(stage=>stage.id===payload.stageId);',
    '        const to=previous.findIndex(stage=>stage.id===targetStageId);',
    '        if(from<0||to<0)return previous;',
    '        const next=[...previous];',
    '        const [moved]=next.splice(from,1);',
    '        next.splice(to,0,moved);',
    '        return next.map((stage,index)=>({...stage,stageNumber:index+1}));',
    '      });',
    '      setIsDirty(true);',
    '      return;',
    '    }',
    "    if(payload.kind==='action' && typeof payload.stageId==='string' && typeof payload.actionId==='string'){",
    '      setWorkflowStages(previous=>{',
    '        const sourceStage=previous.find(stage=>stage.id===payload.stageId);',
    '        const action=sourceStage?.actions.find(item=>item.id===payload.actionId);',
    '        if(!action)return previous;',
    '        return previous.map(stage=>{',
    '          if(stage.id===payload.stageId && stage.id===targetStageId){',
    '            const actions=stage.actions.filter(item=>item.id!==payload.actionId);',
    '            return {...stage,actions:[...actions,action]};',
    '          }',
    '          if(stage.id===payload.stageId)return {...stage,actions:stage.actions.filter(item=>item.id!==payload.actionId)};',
    '          if(stage.id===targetStageId)return {...stage,actions:[...stage.actions,action]};',
    '          return stage;',
    '        });',
    '      });',
    '      setIsDirty(true);',
    '    }',
    '  };',
    ''
  ].join('\n');
  source = replaceOnce(source, actionAnchor, actionHelpers, 'helpers de drag and drop');

  const workflowStart = '            <div className="space-y-3">\n              {workflowStages.map((stage,index)=><div key={stage.id} className={`${panelClass} overflow-hidden`}>\n';
  const workflowReplacement = [
    '            <section className={`${panelClass} p-4`} aria-label="Paleta de ações do fluxo">',
    '              <div className="text-[10px] font-black uppercase text-slate-500">Arraste para uma etapa</div>',
    '              <div className="mt-2 flex flex-wrap gap-2">',
    "                {docTemplates.map(item=><button key={`palette-doc-${item.id}`} type=\"button\" draggable onDragStart={event=>setWorkflowDragPayload(event,{kind:'palette',value:`doc:${item.id}`})} className=\"portal-action cursor-grab\"><FileText className=\"h-3.5 w-3.5\"/>{item.label}</button>)}",
    "                {emailTemplates.map(item=><button key={`palette-email-${item.id}`} type=\"button\" draggable onDragStart={event=>setWorkflowDragPayload(event,{kind:'palette',value:`email:${item.id}`})} className=\"portal-action cursor-grab\"><Mail className=\"h-3.5 w-3.5\"/>{item.name}</button>)}",
    "                {formTemplates.map(item=><button key={`palette-form-${item.id}`} type=\"button\" draggable onDragStart={event=>setWorkflowDragPayload(event,{kind:'palette',value:`form:${item.id}`})} className=\"portal-action cursor-grab\"><ClipboardList className=\"h-3.5 w-3.5\"/>{item.title}</button>)}",
    "                <button type=\"button\" draggable onDragStart={event=>setWorkflowDragPayload(event,{kind:'palette',value:'action:internal'})} className=\"portal-action cursor-grab\"><Settings2 className=\"h-3.5 w-3.5\"/>Ação interna</button>",
    '              </div>',
    '              <p className="mt-2 text-[9px] text-slate-500">Também é possível usar os seletores e setas abaixo; o arrastar e soltar é um atalho, não a única forma de operar.</p>',
    '            </section>',
    '            <div className="space-y-3">',
    "              {workflowStages.map((stage,index)=><div key={stage.id} draggable onDragStart={event=>setWorkflowDragPayload(event,{kind:'stage',stageId:stage.id})} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='move';}} onDrop={event=>handleWorkflowStageDrop(event,stage.id)} className={`${panelClass} overflow-hidden`}>",
    ''
  ].join('\n');
  source = replaceOnce(source, workflowStart, workflowReplacement, 'paleta e destinos de drag and drop');

  const oldActionMap = "{stage.actions.map((action,actionIndex)=><div key={action.id} className=\"rounded-xl border border-slate-200 bg-slate-50 p-3\"><div className=\"grid gap-2 md:grid-cols-[auto_.8fr_1fr_auto]\"><span className=\"self-center rounded-full bg-white px-2 py-1 text-[9px] font-black text-slate-500\">{actionIndex+1}</span><div className=\"flex gap-1\"><button type=\"button\" aria-label={`Mover ${action.title} para cima`} disabled={actionIndex===0} onClick={()=>setWorkflowStages(previous=>previous.map(s=>{if(s.id!==stage.id)return s;const actions=[...s.actions];[actions[actionIndex-1],actions[actionIndex]]=[actions[actionIndex],actions[actionIndex-1]];return {...s,actions};}))} className=\"portal-action\">↑</button><button type=\"button\" aria-label={`Mover ${action.title} para baixo`} disabled={actionIndex===stage.actions.length-1} onClick={()=>setWorkflowStages(previous=>previous.map(s=>{if(s.id!==stage.id)return s;const actions=[...s.actions];[actions[actionIndex+1],actions[actionIndex]]=[actions[actionIndex],actions[actionIndex+1]];return {...s,actions};}))} className=\"portal-action\">↓</button></div>";
  const newActionMap = "{stage.actions.map((action,actionIndex)=><div key={action.id} draggable onDragStart={event=>{event.stopPropagation();setWorkflowDragPayload(event,{kind:'action',stageId:stage.id,actionId:action.id});}} className=\"rounded-xl border border-slate-200 bg-slate-50 p-3\"><div className=\"grid gap-2 md:grid-cols-[auto_.8fr_1fr_auto]\"><span className=\"self-center rounded-full bg-white px-2 py-1 text-[9px] font-black text-slate-500\">{actionIndex+1}</span><div className=\"flex gap-1\"><button type=\"button\" aria-label={`Mover ${action.title} para cima`} disabled={actionIndex===0} onClick={()=>moveWorkflowAction(stage.id,actionIndex,-1)} className=\"portal-action\">↑</button><button type=\"button\" aria-label={`Mover ${action.title} para baixo`} disabled={actionIndex===stage.actions.length-1} onClick={()=>moveWorkflowAction(stage.id,actionIndex,1)} className=\"portal-action\">↓</button></div>";
  source = replaceOnce(source, oldActionMap, newActionMap, 'ações arrastáveis');
  return source;
});

patchFile('server.ts', (input) => {
  let source = input;
  source = replaceOnce(
    source,
    "const invalid=normalized.filter(record=>!record.nome||!record.matricula||!isValidPortalEmail(record.email)||!emailMatchesDomains(record.email,profile.studentEmailDomains)||duplicateEmails.has(record.email));",
    "const invalid=normalized.filter(record=>!record.nome||!isValidPortalEmail(record.email)||!emailMatchesDomains(record.email,profile.studentEmailDomains)||duplicateEmails.has(record.email));",
    'matrícula opcional na importação em lote'
  );
  source = replaceOnce(
    source,
    "reason:duplicateEmails.has(record.email)?'E-mail duplicado no arquivo':'Nome, matrícula, e-mail institucional ou domínio inválido'",
    "reason:duplicateEmails.has(record.email)?'E-mail duplicado no arquivo':'Nome, e-mail institucional ou domínio inválido'",
    'mensagem da importação em lote'
  );

  source = replaceOnce(
    source,
    "const identity=getPortalIdentity(req)!;const type=String(req.params.type||'').toUpperCase() as 'CONVITE'|'ATA'|'TERMO'|'DECLARACAO';\n    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de publicar um modelo documental.',code:'REAUTHENTICATION_REQUIRED'});\n    if(!['CONVITE','ATA','TERMO','DECLARACAO'].includes(type))return res.status(400).json({error:'Tipo de modelo inválido.'});",
    "const identity=getPortalIdentity(req)!;const type=String(req.params.type||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48);\n    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de publicar um modelo documental.',code:'REAUTHENTICATION_REQUIRED'});\n    if(type.length<2)return res.status(400).json({error:'Tipo de modelo inválido.'});",
    'tipo genérico no upload de modelos'
  );
  source = replaceOnce(
    source,
    "const labels={CONVITE:'Carta-convite',ATA:'Ata de defesa',TERMO:'Termo de autorização para publicação',DECLARACAO:'Declaração de participação na banca'};\n        const before=currentSettings.documentModels?.[type];",
    "const labels:Record<string,string>={CONVITE:'Carta-convite',ATA:'Ata de defesa',TERMO:'Termo de autorização para publicação',DECLARACAO:'Declaração de participação na banca'};\n        const modelStore=(currentSettings.documentModels||{}) as Record<string,any>;const before=modelStore[type];",
    'catálogo genérico de modelos'
  );
  source = replaceOnce(
    source,
    "const model={id:`master-${type.toLowerCase()}`,type,label:labels[type],fileName:drive.name,templateContentText:'',driveFileId:drive.id,driveFileUrl:drive.webViewLink,variables:extracted.variables,uploadedAt:now,uploadedBy:identity.email,contentSha256:drive.contentSha256,driveRevisionId:drive.driveRevisionId,driveModifiedTime:drive.driveModifiedTime,activeVersion:nextVersion,versions:[...previousVersions,version].slice(-30)};",
    "const model={id:`master-${type.toLowerCase()}`,type,label:labels[type]||type.toLowerCase().split('_').filter(Boolean).map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' '),fileName:drive.name,templateContentText:'',driveFileId:drive.id,driveFileUrl:drive.webViewLink,variables:extracted.variables,uploadedAt:now,uploadedBy:identity.email,contentSha256:drive.contentSha256,driveRevisionId:drive.driveRevisionId,driveModifiedTime:drive.driveModifiedTime,activeVersion:nextVersion,versions:[...previousVersions,version].slice(-30)};",
    'rótulo genérico dos modelos'
  );

  source = replaceOnce(
    source,
    "app.post('/api/admin/models/:type/link',requireAuthenticated,requireAdministrator,async(req,res)=>{\n    const identity=getPortalIdentity(req)!;const type=String(req.params.type||'').toUpperCase() as 'CONVITE'|'ATA'|'TERMO'|'DECLARACAO';\n    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de importar um modelo documental.',code:'REAUTHENTICATION_REQUIRED'});\n    if(!['CONVITE','ATA','TERMO','DECLARACAO'].includes(type))return res.status(400).json({error:'Tipo de modelo inválido.'});",
    "app.post('/api/admin/models/:type/link',requireAuthenticated,requireAdministrator,async(req,res)=>{\n    const identity=getPortalIdentity(req)!;const type=String(req.params.type||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48);\n    if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Entre novamente antes de importar um modelo documental.',code:'REAUTHENTICATION_REQUIRED'});\n    if(type.length<2)return res.status(400).json({error:'Tipo de modelo inválido.'});",
    'tipo genérico na importação por link'
  );
  source = replaceOnce(
    source,
    "app.post('/api/admin/models/:type/versions/:version/restore',requireAuthenticated,requireAdministrator,(req,res)=>{const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Reautentique-se para restaurar um modelo.'});const type=String(req.params.type||'').toUpperCase() as 'CONVITE'|'ATA'|'TERMO'|'DECLARACAO';const model=currentSettings.documentModels?.[type],selected=model?.versions?.find(item=>item.version===Number(req.params.version));",
    "app.post('/api/admin/models/:type/versions/:version/restore',requireAuthenticated,requireAdministrator,(req,res)=>{const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Reautentique-se para restaurar um modelo.'});const type=String(req.params.type||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48);const model=(currentSettings.documentModels as Record<string,any>|undefined)?.[type],selected=model?.versions?.find((item:any)=>item.version===Number(req.params.version));",
    'restauração genérica de modelo'
  );
  return source;
});

patchFile('src/types/index.ts', (input) => {
  return replaceOnce(
    input,
    "  documentModels?: Partial<Record<DocumentType, {\n    id: string;\n    type: DocumentType;",
    "  documentModels?: Record<string, {\n    id: string;\n    type: string;",
    'tipagem extensível de modelos documentais'
  ).replace("  }>>;\n  createdAt: string;", "  }>;\n  createdAt: string;");
});

console.log('Revision 35 patch applied');
