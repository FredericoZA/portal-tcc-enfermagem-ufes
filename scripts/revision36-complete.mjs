import fs from 'node:fs';

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`Nenhuma alteração aplicada em ${path}`);
  fs.writeFileSync(path, after);
}
function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Trecho não encontrado: ${label}`);
  return source.replace(search, replacement);
}

patch('scripts/test-secure-flow.mjs', source => replaceOnce(
  source,
  "    assert.ok(studioPanel.includes('Fonte oficial única.'), 'a interface não explica a fonte externa única do modelo');",
  "    assert.ok(studioPanel.includes('O arquivo visual permanece no Google Drive'), 'a interface não orienta que o arquivo visual permanece no Drive');\n    assert.ok(!studioPanel.includes('Fonte oficial única.'), 'a caixa legada Fonte oficial única reapareceu');",
  'contrato seguro do editor documental'
));

patch('src/components/UnifiedPortalEditorModal.tsx', source => {
  for (const line of [
    "              {renderNavRow('global_table_buttons', 'Botões no Topo', Square)}\n",
    "              {renderNavRow('global_table_style', 'Estilo Base Planilhas', LayoutTemplate)}\n",
    "              {renderNavRow('table_columns', 'Colunas, ordem e linhas', Columns)}\n",
    "              {renderNavRow('global_popup_style', 'Estilo Base Pop-ups', Sliders)}\n",
    "              {renderNavRow('popup_hipoar', 'Análise Hipoar', Award)}\n",
    "              {renderNavRow('popup_correction', 'Solicitação de Correção', HelpCircle)}\n"
  ]) source = source.replace(line, '');
  source = source.replace("                  'global_table_buttons',\n                  'global_table_style',\n", '');
  source = source.replace("                  'global_popup_style',\n", '');
  source = source.replace("                  'popup_hipoar',\n", '');
  source = source.replace("                  'popup_correction'\n", '');
  return source;
});

patch('src/services/apiClient.ts', source => replaceOnce(
  source,
  "  restoreDocumentModelVersion:(type:string,version:number)=>fetchApi<any>(`/api/admin/models/${type}/versions/${version}/restore`,{method:'POST'}),",
  "  restoreDocumentModelVersion:(type:string,version:number)=>fetchApi<any>(`/api/admin/models/${type}/versions/${version}/restore`,{method:'POST'}),\n  deleteDocumentModel:(type:string)=>fetchApi<{deleted:boolean;type:string}>(`/api/admin/models/${encodeURIComponent(type)}`,{method:'DELETE'}),",
  'cliente de exclusão de modelo'
));

patch('server.ts', source => {
  const anchor = "  app.get(['/api/admin/access-list','/api/admin/students'],requireAuthenticated,requireAdministrator,(_req,res)=>res.json(authorizedStudentsStore));";
  const route = `  app.delete('/api/admin/models/:type',requireAuthenticated,requireAdministrator,async(req,res)=>{\n    const identity=getPortalIdentity(req)!;if(!hasRecentAuthentication(identity))return res.status(428).json({error:'Reautentique-se para excluir um modelo.',code:'REAUTHENTICATION_REQUIRED'});\n    const type=String(req.params.type||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48);if(type.length<2)return res.status(400).json({error:'Tipo de modelo inválido.'});\n    const models=(currentSettings.documentModels||{}) as Record<string,any>;const model=models[type];if(!model)return res.status(404).json({error:'Modelo não encontrado.'});\n    const studio=currentSettings.integrationStudio;const refs=[...(studio?.docTemplates||[]).flatMap((item:any)=>[item.id,item.type,item.templateId,item.documentType]),...(studio?.workflowStages||[]).flatMap((stage:any)=>(stage.actions||[]).filter((action:any)=>action.type==='doc').flatMap((action:any)=>[action.refId,action.documentType]))].map(value=>String(value||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,''));\n    if(refs.includes(type)||refs.includes(String(model.id||'').toUpperCase()))return res.status(409).json({error:'Este modelo ainda é referenciado pelo Estúdio/fluxo publicado. Remova ou substitua a referência antes da exclusão.',code:'DOCUMENT_MODEL_IN_USE'});\n    const next={...models};delete next[type];const now=new Date().toISOString();currentSettings={...currentSettings,documentModels:next,updatedAt:now};auditLogsStore.push({id:\`log-\${Date.now()}-model-delete\`,actorEmail:identity.email,actorRoles:getUserRolesForEmail(identity.email).globalRoles,action:'MODELO_DOCUMENTAL_REMOVIDO',entityType:'document_model',entityId:type,before:{fileName:model.fileName,driveFileId:model.driveFileId,activeVersion:model.activeVersion},after:{deleted:true,driveArtifactPreserved:true},timestamp:now});await persistPortalStateDurably();res.json({deleted:true,type});\n  });\n\n`;
  return replaceOnce(source, anchor, route + anchor, 'rota de exclusão de modelo');
});

patch('src/components/IntegrationStudioPanel.tsx', source => {
  const anchor = "  const variableUsage = selectedVariable\n    ? getVariableUsage([selectedVariable.id, selectedVariable.name, ...(selectedVariable.aliases || [])], { matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates })\n    : { documents: [], emails: [], forms: [] };\n";
  const addition = `${anchor}\n  const similarVariableSuggestions = useMemo(() => {\n    const canonical = (value:string) => normalizeVariableKey(value).split('_').filter(Boolean);\n    const pairs:Array<{source:MatrixColumn;target:MatrixColumn;score:number;reason:string}> = [];\n    for(let i=0;i<matrixColumns.length;i++)for(let j=i+1;j<matrixColumns.length;j++){\n      const a=matrixColumns[i],b=matrixColumns[j],aTokens=canonical(a.name),bTokens=canonical(b.name);\n      const shared=aTokens.filter(token=>bTokens.includes(token));\n      const union=new Set([...aTokens,...bTokens]);\n      const tokenScore=union.size?shared.length/union.size:0;\n      const aKey=normalizeVariableKey(a.name),bKey=normalizeVariableKey(b.name);\n      const prefixScore=aKey.startsWith(bKey)||bKey.startsWith(aKey)?0.82:0;\n      const aliasScore=[...(a.aliases||[]),a.name].some(alias=>[...(b.aliases||[]),b.name].map(normalizeVariableKey).includes(normalizeVariableKey(alias)))?1:0;\n      const score=Math.max(tokenScore,prefixScore,aliasScore);\n      if(score>=0.5)pairs.push({source:a,target:b,score,reason:aliasScore===1?'Alias/chave equivalente':prefixScore?'Chaves com prefixo equivalente':\`Vocabulário compartilhado: \${shared.join(', ')}\`});\n    }\n    return pairs.sort((a,b)=>b.score-a.score).slice(0,8);\n  }, [matrixColumns]);\n`;
  source = replaceOnce(source, anchor, addition, 'sugestões de variáveis semelhantes');
  const uiAnchor = "            <div className=\"grid gap-4 xl:grid-cols-[.75fr_1.25fr]\">\n";
  const ui = `            {similarVariableSuggestions.length > 0 && <div className={\`${panelClass} p-4\`}><div className=\"flex items-center gap-2\"><WandSparkles className=\"h-4 w-4 text-violet-700\"/><h4 className=\"text-xs font-black uppercase\">Sugestões inteligentes de normalização</h4></div><p className=\"mt-2 text-[11px] text-slate-600\">O Portal destaca chaves potencialmente duplicadas e mostra a semelhança antes de qualquer mescla. Nada é alterado sem confirmação explícita.</p><div className=\"mt-3 grid gap-2 md:grid-cols-2\">{similarVariableSuggestions.map(({source,target,score,reason})=><button key={\`similar-\${source.id}-\${target.id}\`} type=\"button\" onClick={()=>{setMergeSourceId(source.id);setMergeTargetId(target.id);}} className=\"rounded-xl border border-violet-200 bg-violet-50 p-3 text-left hover:border-violet-400\"><div className=\"flex items-center justify-between gap-2\"><strong className=\"text-[11px] text-violet-950\">{source.label||source.name} → {target.label||target.name}</strong><span className=\"rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-violet-700\">{Math.round(score*100)}%</span></div><p className=\"mt-1 text-[10px] text-violet-800\">{reason}</p></button>)}</div></div>}\n${uiAnchor}`;
  source = replaceOnce(source, uiAnchor, ui, 'painel de sugestões semelhantes');
  return source;
});

patch('src/components/UserSimulatorBar.tsx', source => {
  source = replaceOnce(source,
    'className="bg-slate-950 text-slate-100 text-xs px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shadow-inner"',
    'className="bg-slate-950 text-slate-100 text-xs px-2 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3 border-b border-slate-800 shadow-inner overflow-x-hidden"',
    'simulador responsivo');
  source = replaceOnce(source,
    'className="flex items-center gap-3 flex-wrap"',
    'className="flex min-w-0 w-full sm:w-auto items-center gap-2 sm:gap-3 flex-wrap"',
    'grupo responsivo do simulador');
  source = replaceOnce(source,
    'className="flex items-center gap-1.5"',
    'className="flex min-w-0 max-w-full items-center gap-1.5"',
    'seletor responsivo do simulador');
  source = replaceOnce(source,
    'className="bg-slate-900 text-slate-100 border border-slate-700 rounded-full px-3 py-1 text-xs focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"',
    'className="min-w-0 max-w-[190px] sm:max-w-[300px] bg-slate-900 text-slate-100 border border-slate-700 rounded-full px-2 sm:px-3 py-1 text-xs focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"',
    'select responsivo do simulador');
  source = replaceOnce(source,
    'className="bg-slate-900 text-slate-100 border border-slate-700 rounded-full px-3 py-1 w-36 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"',
    'className="min-w-0 bg-slate-900 text-slate-100 border border-slate-700 rounded-full px-3 py-1 w-28 sm:w-36 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"',
    'campo responsivo do simulador');
  return source;
});

console.log('Revision 36 patch applied.');
