import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function replaceExact(path, from, to, label) {
  let source = fs.readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`Trecho não encontrado em ${path}: ${label}`);
  source = source.replace(from, to);
  fs.writeFileSync(path, source);
}

function insertBefore(path, marker, addition, label) {
  let source = fs.readFileSync(path, 'utf8');
  if (!source.includes(marker)) throw new Error(`Marcador não encontrado em ${path}: ${label}`);
  if (source.includes(addition.trim())) return;
  source = source.replace(marker, `${addition}\n${marker}`);
  fs.writeFileSync(path, source);
}

// 1) A área pública precisa indicar quais documentos institucionais já estão efetivamente disponíveis.
insertBefore(
  'server.ts',
  'function publicProcessView(p:ProcessData):ProcessData{',
  `function publicDocumentLinks(p:ProcessData):Record<string,string>{
  const links:Record<string,string>={};
  if(p.defesa.invitationDriveFileId&&p.defesa.invitationSentAt)links.CONVITE=\`/api/public/processes/\${p.id}/documents/convite/download\`;
  const signedTypes:[string,string][]=[['ATA','ata'],['TERMO','autorizacao'],['DECLARACAO','declaracao']];
  for(const [documentType,slug] of signedTypes){
    const archived=signatureJobsStore
      .filter(job=>job.processId===p.id&&job.documentType===documentType&&job.status==='ARCHIVED'&&Boolean(job.driveSignedFileId))
      .sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)))[0];
    if(archived)links[documentType]=\`/api/public/processes/\${p.id}/documents/\${slug}/download\`;
  }
  return links;
}`,
  'links públicos dos documentos'
);

replaceExact(
  'server.ts',
  "    acervo:p.acervo?{palavrasChave:[...(p.acervo.palavrasChave||[])],resumoSintese:p.acervo.resumoSintese,publishFullWork:Boolean(p.acervo.publishFullWork),publishExpandedAbstract:Boolean(p.acervo.publishExpandedAbstract),trabalhoCompletoFileUrl:p.acervo.publishFullWork?`/api/public/processes/${p.id}/files/trabalho-completo/download`:undefined,resumoExpandidoFileUrl:p.acervo.publishExpandedAbstract?`/api/public/processes/${p.id}/files/resumo-expandido/download`:undefined,submittedAt:p.acervo.submittedAt}:undefined,\n    dataRevision:p.dataRevision,createdAt:p.createdAt,updatedAt:p.updatedAt",
  "    acervo:p.acervo?{palavrasChave:[...(p.acervo.palavrasChave||[])],resumoSintese:p.acervo.resumoSintese,publishFullWork:Boolean(p.acervo.publishFullWork),publishExpandedAbstract:Boolean(p.acervo.publishExpandedAbstract),trabalhoCompletoFileUrl:p.acervo.publishFullWork?`/api/public/processes/${p.id}/files/trabalho-completo/download`:undefined,resumoExpandidoFileUrl:p.acervo.publishExpandedAbstract?`/api/public/processes/${p.id}/files/resumo-expandido/download`:undefined,submittedAt:p.acervo.submittedAt}:undefined,\n    ...({publicDocuments:publicDocumentLinks(p)} as any),\n    dataRevision:p.dataRevision,createdAt:p.createdAt,updatedAt:p.updatedAt",
  'DTO público com links de documentos'
);

insertBefore(
  'server.ts',
  "  app.get('/api/public/processes/:id/files/:kind/download',async(req,res)=>{",
  `  app.get('/api/public/processes/:id/documents/:kind/download',async(req,res)=>{
    if(!allowPublicDownload(req.ip||''))return res.status(429).json({error:'Limite temporário de downloads atingido. Tente novamente em instantes.'});
    const process=processesStore.find(item=>item.id===req.params.id);
    if(!process||process.status==='EM_RASCUNHO')return res.status(404).json({error:'Documento público não encontrado.'});
    const kind=String(req.params.kind||'').toLowerCase();
    const documentType=({convite:'CONVITE',ata:'ATA',autorizacao:'TERMO',declaracao:'DECLARACAO'} as Record<string,string>)[kind];
    if(!documentType)return res.status(404).json({error:'Documento público não encontrado.'});
    let fileId='';
    let expected:Record<string,string>|undefined;
    if(documentType==='CONVITE'){
      if(!process.defesa.invitationDriveFileId||!process.defesa.invitationSentAt)return res.status(404).json({error:'Convite ainda não disponível.'});
      fileId=process.defesa.invitationDriveFileId;
      expected={processId:process.id,artifactType:'CONVITE'};
    }else{
      const job=signatureJobsStore
        .filter(item=>item.processId===process.id&&item.documentType===documentType&&item.status==='ARCHIVED'&&Boolean(item.driveSignedFileId))
        .sort((a,b)=>String(b.updatedAt||b.createdAt).localeCompare(String(a.updatedAt||a.createdAt)))[0];
      if(!job?.driveSignedFileId)return res.status(404).json({error:'Documento assinado ainda não disponível.'});
      fileId=job.driveSignedFileId;
      expected={processId:process.id,artifactType:documentType,signatureJobId:job.id};
    }
    try{
      const file=await downloadDrivePdf(await getGoogleWorkspaceAccessToken(),fileId,expected);
      await deliverPortalDownload({res,bytes:file.pdf,fileName:file.fileName,mimeType:'application/pdf',requesterBinding:\`public:\${process.id}:\${kind}\`,cacheControl:'public, max-age=60'});
    }catch(error){
      console.error('[PublicDocument] Falha ao entregar documento público:',error);
      res.status(502).json({error:'Não foi possível consultar o documento público no momento.'});
    }
  });
`,
  'rota pública de documentos institucionais'
);

// 2) Pasta privada pode ser compartilhada com usuários específicos; o que é proibido é exposição ampla.
replaceExact(
  'server/integrations/googleDriveArchive.ts',
  "  const unauthorized=permissions.filter((permission:any)=>permission.type!=='user'||permission.role!=='owner');\n  if(unauthorized.length)throw new Error('O destino no Google Drive não é exclusivo da conta proprietária. Remova acessos por link, domínio, grupo ou usuário adicional antes de armazenar documentos sigilosos.');",
  "  const unauthorized=permissions.filter((permission:any)=>permission.type!=='user'||!['owner','writer'].includes(permission.role));\n  if(unauthorized.length)throw new Error('O destino no Google Drive não pode possuir acesso público, por domínio, grupo ou link. Mantenha apenas usuários institucionais explicitamente autorizados.');",
  'privacidade do Drive sem bloquear colaborador privado'
);

// 3) Há apenas um tutorial canônico; a HomePage antiga passa a reutilizar a página atual.
replaceExact(
  'src/pages/HomePage.tsx',
  "import { OnlineSystemTutorial } from '../components/OnlineSystemTutorial';",
  "import { PortalTutorialPage } from './PortalTutorialPage';",
  'import do tutorial canônico'
);
replaceExact(
  'src/pages/HomePage.tsx',
  '<OnlineSystemTutorial onNavigate={onNavigate} />',
  '<PortalTutorialPage onNavigate={onNavigate} />',
  'render do tutorial canônico'
);

// 4) Remove artefatos claramente temporários e componentes mortos somente quando nenhum outro arquivo os referencia.
function refsOutsideSelf(symbol, ownPath) {
  try {
    const out = execFileSync('git', ['grep', '-l', symbol, '--', '*.ts', '*.tsx'], { encoding: 'utf8' });
    return out.split(/\r?\n/).filter(Boolean).filter(path => path !== ownPath);
  } catch (error) {
    if (error?.status === 1) return [];
    throw error;
  }
}

function removeIfUnused(path, symbol) {
  if (!fs.existsSync(path)) return;
  const refs = refsOutsideSelf(symbol, path);
  if (refs.length === 0) {
    fs.unlinkSync(path);
    console.log(`Removido componente sem uso: ${path}`);
  } else {
    console.log(`Mantido ${path}; referências ativas: ${refs.join(', ')}`);
  }
}

removeIfUnused('src/components/OnlineSystemTutorial.tsx', 'OnlineSystemTutorial');
removeIfUnused('src/components/TutorialInfographicView.tsx', 'TutorialInfographicView');
removeIfUnused('src/components/UnifiedFlowSystem.tsx', 'UnifiedFlowSystem');
removeIfUnused('src/components/UnifiedPortalEditorModal.tsx', 'UnifiedPortalEditorModal');

if(fs.existsSync('docs/.go-live-probe')){
  fs.unlinkSync('docs/.go-live-probe');
  console.log('Removido marcador temporário de go-live.');
}

console.log('Limpeza canônica final aplicada.');
