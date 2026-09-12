import fs from 'node:fs';

function patchFile(path, patches) {
  let source = fs.readFileSync(path, 'utf8');
  for (const patch of patches) {
    const before = source;
    if (patch.regex) source = source.replace(patch.regex, patch.replacement);
    else source = source.replace(patch.from, patch.to);
    if (source === before) throw new Error(`Patch não aplicado em ${path}: ${patch.label}`);
  }
  fs.writeFileSync(path, source);
}

patchFile('server.ts', [
  {
    label: 'matrículas públicas sem expor e-mails',
    from: "aluno1:{nome:p.aluno1.nome,email:'',matricula:''},aluno2:p.aluno2?{nome:p.aluno2.nome,email:'',matricula:''}:null,",
    to: "aluno1:{nome:p.aluno1.nome,email:'',matricula:p.aluno1.matricula},aluno2:p.aluno2?{nome:p.aluno2.nome,email:'',matricula:p.aluno2.matricula}:null,"
  },
  {
    label: 'lista pública acompanha processos submetidos',
    from: "const identity=getPortalIdentity(req);if(!identity)return res.json(processesStore.filter(p=>p.status==='CONCLUIDO'&&publicationRequested(p)).map(publicProcessView));const email=identity.email;",
    to: "const identity=getPortalIdentity(req);if(!identity)return res.json(processesStore.filter(p=>p.status!=='EM_RASCUNHO').map(publicProcessView));const email=identity.email;"
  },
  {
    label: 'detalhe público acompanha processo submetido',
    from: "const identity=getPortalIdentity(req);if(!identity){if(proc.status!=='CONCLUIDO'||!publicationRequested(proc))return res.status(404).json({error:'Processo não encontrado.'});return res.json(publicProcessView(proc));}if(!canAccessProcess(identity.email,proc.id))return res.status(404).json({error:'Processo não encontrado.'});res.json(proc);",
    to: "const identity=getPortalIdentity(req);if(!identity){if(proc.status==='EM_RASCUNHO')return res.status(404).json({error:'Processo não encontrado.'});return res.json(publicProcessView(proc));}if(!canAccessProcess(identity.email,proc.id))return res.status(404).json({error:'Processo não encontrado.'});res.json(proc);"
  }
]);

patchFile('src/pages/HomePage.tsx', [
  {
    label: 'remove matrícula fictícia aluno 1',
    from: "{proc.aluno1?.matricula || '2026101890'}",
    to: "{proc.aluno1?.matricula || '—'}"
  },
  {
    label: 'remove matrícula fictícia aluno 2',
    from: "{proc.aluno2.matricula || '2026101891'}",
    to: "{proc.aluno2.matricula || '—'}"
  }
]);

patchFile('src/pages/ProcessoDetailPage.tsx', [
  {
    label: 'visitante não falha ao consultar documentos protegidos',
    from: "apiClient.getProcessDocuments(processId),\n        apiClient.getProcessSignatureJobs(processId),",
    to: "apiClient.getProcessDocuments(processId).catch(() => []),\n        apiClient.getProcessSignatureJobs(processId).catch(() => []),"
  }
]);

patchFile('server/integrations/googleDriveArchive.ts', [
  {
    label: 'usa estrutura canônica 01_DOCUMENTOS',
    from: "    const documents=await ensureFolder(input.accessToken,input.rootFolderId,'Documentos');\n    const names:Record<string,string>={CONVITE:'Convite',ATA:'Ata',TERMO:'Termo de autorização',DECLARACAO:'Declaração'};\n    const typeFolder=await ensureFolder(input.accessToken,documents.id,names[input.documentType]||input.documentType);\n    const processFolder=await ensureFolder(input.accessToken,typeFolder.id,input.protocol);\n    parentId=processFolder.id;\n  } else {\n    const legacy=await ensureFolder(input.accessToken,input.processFolderId,DOCUMENT_FOLDER[input.documentType]||'07_COMPROVANTES_ASTEN');\n    parentId=legacy.id;\n  }\n  const destination=await ensureFolder(input.accessToken,parentId,input.lifecycle==='GERADO'?'Gerados':'Assinados');",
    to: "    const documents=await ensureFolder(input.accessToken,input.rootFolderId,'01_DOCUMENTOS');\n    const names:Record<string,string>={CONVITE:'01_CARTA_CONVITE',ATA:'02_ATA_DEFESA',TERMO:'03_TERMO_AUTORIZACAO',DECLARACAO:'04_DECLARACAO_PARTICIPACAO'};\n    const typeFolder=await ensureFolder(input.accessToken,documents.id,names[input.documentType]||input.documentType);\n    const lifecycleFolder=await ensureFolder(input.accessToken,typeFolder.id,input.lifecycle==='GERADO'?'02_GERADOS':'03_ASSINADOS');\n    const processFolder=await ensureFolder(input.accessToken,lifecycleFolder.id,input.protocol);\n    parentId=processFolder.id;\n  } else {\n    const legacy=await ensureFolder(input.accessToken,input.processFolderId,DOCUMENT_FOLDER[input.documentType]||'07_COMPROVANTES_ASTEN');\n    parentId=legacy.id;\n  }\n  const destination=input.rootFolderId&&input.protocol?{id:parentId}:await ensureFolder(input.accessToken,parentId,input.lifecycle==='GERADO'?'Gerados':'Assinados');"
  }
]);

console.log('Política pública e estrutura canônica aplicadas com sucesso.');
