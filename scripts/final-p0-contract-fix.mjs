import fs from 'node:fs';

const path = 'server.ts';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Trecho não localizado: ${label}`);
  source = source.replace(search, replacement);
}

const importAnchor = `import { workflowPolicy, registrationFindings } from './src/utils/workflowOperations';`;
replaceOnce(importAnchor, `${importAnchor}\nimport { publicCalendarView, publicLegacyProcessView, publicRepositoryView } from './server/publicViews';`, 'import public views');

const oldPublicView = `function publicProcessView(p:ProcessData):any{
  // DTO por lista branca: nenhuma matrícula, e-mail, SIAPE, ID interno de pessoa ou vínculo do Drive sai em rota anônima.
  const repositoryState=p.status!=='CONCLUIDO'?'NOT_PRESENTED':p.acervo?.publicationState==='PUBLIC'?'PUBLIC':'PRIVATE';
  return {
    id:p.protocolo,protocolo:p.protocolo,titulo:p.titulo,etapaAtual:p.etapaAtual,status:p.status,
    aluno1:{nome:p.aluno1.nome},aluno2:p.aluno2?{nome:p.aluno2.nome}:null,
    orientador:{nome:p.orientador.nome},coorientador:p.coorientador?{nome:p.coorientador.nome,instituicao:p.coorientador.instituicao||''}:null,
    banca:p.banca.map(member=>({nome:member.nome,funcao:member.funcao,membroTipo:member.membroTipo,instituicao:member.instituicao,profissao:member.profissao,titulacao:member.titulacao})),
    defesa:{startAt:p.defesa.startAt,endAt:p.defesa.endAt,local:p.defesa.local,localStatus:p.defesa.localStatus},
    avaliacao:{status:p.avaliacao.status,resultadoCode:p.avaliacao.resultadoCode,resultadoLabel:p.avaliacao.resultadoLabel},
    acervo:p.acervo?{palavrasChave:[...(p.acervo.palavrasChave||[])],resumoSintese:p.acervo.resumoSintese,publishFullWork:repositoryState==='PUBLIC'&&Boolean(p.acervo.publishFullWork&&p.acervo.publicFullWorkFileUrl),publishExpandedAbstract:repositoryState==='PUBLIC'&&Boolean(p.acervo.publishExpandedAbstract&&p.acervo.publicExpandedAbstractFileUrl),trabalhoCompletoFileUrl:repositoryState==='PUBLIC'&&p.acervo.publishFullWork?p.acervo.publicFullWorkFileUrl:undefined,resumoExpandidoFileUrl:repositoryState==='PUBLIC'&&p.acervo.publishExpandedAbstract?p.acervo.publicExpandedAbstractFileUrl:undefined,submittedAt:p.acervo.submittedAt,publicationState:repositoryState,publicationLabel:repositoryState==='PUBLIC'?'Publicado':repositoryState==='PRIVATE'?'Não publicado pelo autor':'Não apresentado'}:undefined,
    createdAt:p.createdAt,updatedAt:p.updatedAt
  };
}
`;
replaceOnce(oldPublicView, '', 'publicProcessView legado');

const oldEndpoints = `  app.get('/api/public/calendar',(_req,res)=>res.json(processesStore.filter(p=>p.status!=='EM_RASCUNHO'&&p.status!=='CONCLUIDO').map(publicProcessView)));
  app.get('/api/public/repository',(_req,res)=>res.json(processesStore.filter(p=>p.status==='CONCLUIDO').map(publicProcessView)));

  app.get('/api/processes', (req, res) => {
    const identity=getPortalIdentity(req);if(!identity)return res.json(processesStore.filter(p=>p.status!=='EM_RASCUNHO').map(publicProcessView));const email=identity.email;`;
const newEndpoints = `  app.get('/api/public/calendar',(_req,res)=>res.json(processesStore.filter(p=>p.status!=='EM_RASCUNHO'&&p.status!=='CONCLUIDO').map(publicCalendarView)));
  app.get('/api/public/repository',(_req,res)=>res.json(processesStore.filter(p=>p.status==='CONCLUIDO').map(publicRepositoryView)));

  app.get('/api/processes', (req, res) => {
    const identity=getPortalIdentity(req);if(!identity)return res.json(processesStore.filter(p=>p.status!=='EM_RASCUNHO').map(publicLegacyProcessView));const email=identity.email;`;
replaceOnce(oldEndpoints, newEndpoints, 'rotas públicas separadas');

replaceOnce(`return res.json(publicProcessView(proc));`, `return res.json(publicLegacyProcessView(proc));`, 'detalhe público por protocolo');

const oldIntegrity = `  app.post('/api/admin/integrity/drive',requireAuthenticated,requireAdministrator,async(req,res)=>{const identity=getPortalIdentity(req)!;if(!currentSettings.driveRootFolderId)return res.status(409).json({error:'Pasta raiz do Drive não configurada.'});try{`;
const newIntegrity = `  app.post('/api/admin/integrity/drive',requireAuthenticated,requireAdministrator,async(req,res)=>{const identity=getPortalIdentity(req)!;const persistence=getSupabaseRuntimeStatus();if(!persistence.durablePersistenceReady)return res.status(503).json({error:'A persistência Supabase não está pronta; a conferência Portal × Drive não pode ser considerada confiável.'});if(!currentSettings.driveRootFolderId)return res.status(409).json({error:'Pasta raiz do Drive não configurada.'});try{`;
replaceOnce(oldIntegrity, newIntegrity, 'integridade Supabase x Drive');

fs.writeFileSync(path, source);
console.log('Contratos públicos e integridade P0 atualizados.');
