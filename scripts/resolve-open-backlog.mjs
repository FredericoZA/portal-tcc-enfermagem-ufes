import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
function replaceOnce(text, search, replacement, label) {
  if (!text.includes(search)) throw new Error(`Trecho não localizado: ${label}`);
  return text.replace(search, replacement);
}

// Navegação: remove caminhos legados e mantém os nomes definidos para a instalação UFES.
{
  const path = 'src/App.tsx';
  let s = read(path);
  s = replaceOnce(s, "const VerificationPage = lazy(() => import('./pages/VerificationPage').then((module) => ({ default: module.VerificationPage })));\n", '', 'import VerificationPage');
  s = replaceOnce(s, "  const verificationCode = typeof window !== 'undefined' ? window.location.pathname.match(/^\\/validar\\/([^/]+)$/)?.[1] : undefined;\n", '', 'verificationCode');
  s = replaceOnce(s, "      case 'coordenador':\n      case 'assinaturas':\n        return <CoordenadorPage onSelectProcess={(id) => handleSelectProcess(id, false)} />;", "      case 'coordenador':\n        return <CoordenadorPage onSelectProcess={(id) => handleSelectProcess(id, false)} />;", 'alias assinaturas');
  s = replaceOnce(s, "  if (verificationCode) return <Suspense fallback={<PageLoadingFallback />}><VerificationPage code={decodeURIComponent(verificationCode)} /></Suspense>;\n\n", '', 'rota validar desativada');
  s = replaceOnce(s, "                  : (currentTab === 'coordenador' || currentTab === 'assinaturas') ? 'Área do Presidente'", "                  : currentTab === 'coordenador' ? 'Área do Presidente'", 'titulo assinaturas');
  s = replaceOnce(s, "                  : (currentTab === 'analise' || currentTab === 'indicadores') ? 'Análise'", "                  : (currentTab === 'analise' || currentTab === 'indicadores') ? 'Indicadores'", 'titulo indicadores');
  write(path, s);
}

// Texto da avaliação sem referência redundante ou nota numérica.
{
  const path = 'src/pages/AvaliacoesPage.tsx';
  let s = read(path);
  s = s.replace('Confira os dados do aluno, selecione o resultado e registre o parecer e preencha o parecer da banca.', 'Confira os dados do aluno, selecione o resultado e registre o parecer da banca.');
  write(path, s);
}

// Drive: uma versão reutilizada também precisa substituir a anterior, preservando metadados existentes.
{
  const path = 'server/integrations/googleDriveArchive.ts';
  let s = read(path);
  const anchor = `export async function uploadProcessSourcePdf(input:{accessToken:string;processFolderId:string;processId:string;artifactType:'TRABALHO_COMPLETO'|'RESUMO_EXPANDIDO'|'COMPROVANTE_LOCAL';fileName:string;version:number;previousFileId?:string;pdf:Buffer;sha256:string}){`;
  const helper = `export function buildSupersededAppProperties(existing:Record<string,string>|undefined,supersededBy:string,supersededAt:string){\n  return {...(existing||{}),lifecycle:'SUPERSEDED',supersededBy,supersededAt};\n}\n\nasync function markDriveFileSuperseded(accessToken:string,fileId:string,supersededBy:string){\n  if(!fileId||fileId===supersededBy)return;\n  const currentResponse=await driveRequest(\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(fileId)}'}?fields=id,appProperties&supportsAllDrives=true\`,accessToken);\n  const current=await currentResponse.json();\n  const appProperties=buildSupersededAppProperties(current.appProperties,String(supersededBy),new Date().toISOString());\n  await driveRequest(\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(fileId)}'}?fields=id&supportsAllDrives=true\`,accessToken,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({appProperties})});\n}\n\n${anchor}`;
  s = replaceOnce(s, anchor, helper, 'helper superseded');
  const reuse = `  if(existing.length>1)throw new Error('Foram encontrados arquivos duplicados para este TCC.');\n  if(existing[0])return existing[0];\n  const safeName=`;
  s = replaceOnce(s, reuse, `  if(existing.length>1)throw new Error('Foram encontrados arquivos duplicados para este TCC.');\n  if(existing[0]){\n    if(input.previousFileId&&input.previousFileId!==String(existing[0].id))await markDriveFileSuperseded(input.accessToken,input.previousFileId,String(existing[0].id));\n    return existing[0];\n  }\n  const safeName=`, 'reuso com substituição');
  const directPatch = `  if(input.previousFileId&&input.previousFileId!==created.id){\n    await driveRequest(\`${'${DRIVE_API}'}/files/${'${encodeURIComponent(input.previousFileId)}'}?fields=id&supportsAllDrives=true\`,input.accessToken,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({appProperties:{lifecycle:'SUPERSEDED',supersededBy:String(created.id),supersededAt:new Date().toISOString()}})});\n  }`;
  s = replaceOnce(s, directPatch, `  if(input.previousFileId&&input.previousFileId!==created.id)await markDriveFileSuperseded(input.accessToken,input.previousFileId,String(created.id));`, 'patch superseded preservando propriedades');
  write(path, s);
}

// Troca de arquivo final invalida a autorização da versão anterior e remove a cópia pública antiga.
{
  const path = 'server.ts';
  let s = read(path);
  const old = `        const uploaded=await uploadProcessSourcePdf({accessToken,processFolderId:process.driveFolderId,processId:process.id,artifactType,fileName:canonicalName,version,previousFileId:previousId,pdf:file.bytes,sha256});\n        const now=new Date().toISOString();const nextAcervo={...(process.acervo||{})};\n        if(artifactType==='TRABALHO_COMPLETO'){nextAcervo.trabalhoCompletoFileId=String(uploaded.id);nextAcervo.trabalhoCompletoFileName=String(uploaded.name||canonicalName);nextAcervo.trabalhoCompletoFileUrl=localUrl;nextAcervo.trabalhoCompletoSha256=sha256;nextAcervo.trabalhoCompletoVersion=version;}\n        else{nextAcervo.resumoExpandidoFileId=String(uploaded.id);nextAcervo.resumoExpandidoFileName=String(uploaded.name||canonicalName);nextAcervo.resumoExpandidoFileUrl=localUrl;nextAcervo.resumoExpandidoSha256=sha256;nextAcervo.resumoExpandidoVersion=version;}\n        processesStore[index]={...process,acervo:nextAcervo,dataRevision:process.dataRevision+1,updatedAt:now};\n        auditLogsStore.push({id:\`log-${'${Date.now()}'}\`,processId:process.id,actorEmail:identity.email,actorRoles:[...getUserRolesForEmail(identity.email).globalRoles,...roles],action:'UPLOAD_PDF_DRIVE',entityType:'process_file',entityId:String(uploaded.id),before:previousId?{driveFileId:previousId,version:previousVersion||1,lifecycle:'SUPERSEDED'}:undefined,after:{artifactType,fileName:String(uploaded.name||canonicalName),sha256,version,lifecycle:'CURRENT'},timestamp:now});`;
  const replacement = `        const uploaded=await uploadProcessSourcePdf({accessToken,processFolderId:process.driveFolderId,processId:process.id,artifactType,fileName:canonicalName,version,previousFileId:previousId,pdf:file.bytes,sha256});\n        const replacingPrevious=Boolean(previousId&&previousId!==String(uploaded.id));\n        const previousPublicFileId=artifactType==='TRABALHO_COMPLETO'?process.acervo?.publicFullWorkFileId:process.acervo?.publicExpandedAbstractFileId;\n        if(replacingPrevious&&previousPublicFileId)await withdrawDriveFilePublicAccess(accessToken,previousPublicFileId);\n        const now=new Date().toISOString();const nextAcervo={...(process.acervo||{})};\n        if(artifactType==='TRABALHO_COMPLETO'){nextAcervo.trabalhoCompletoFileId=String(uploaded.id);nextAcervo.trabalhoCompletoFileName=String(uploaded.name||canonicalName);nextAcervo.trabalhoCompletoFileUrl=localUrl;nextAcervo.trabalhoCompletoSha256=sha256;nextAcervo.trabalhoCompletoVersion=version;if(replacingPrevious){nextAcervo.publicFullWorkFileId=undefined;nextAcervo.publicFullWorkFileUrl=undefined;}}\n        else{nextAcervo.resumoExpandidoFileId=String(uploaded.id);nextAcervo.resumoExpandidoFileName=String(uploaded.name||canonicalName);nextAcervo.resumoExpandidoFileUrl=localUrl;nextAcervo.resumoExpandidoSha256=sha256;nextAcervo.resumoExpandidoVersion=version;if(replacingPrevious){nextAcervo.publicExpandedAbstractFileId=undefined;nextAcervo.publicExpandedAbstractFileUrl=undefined;}}\n        if(replacingPrevious){nextAcervo.authorizationConfirmedAt=undefined;nextAcervo.publicationSyncedAt=undefined;nextAcervo.publicationState=publicationRequested(process)?'PENDING_SYNC':'NOT_REQUESTED';}\n        processesStore[index]={...process,acervo:nextAcervo,dataRevision:process.dataRevision+1,updatedAt:now};\n        auditLogsStore.push({id:\`log-${'${Date.now()}'}\`,processId:process.id,actorEmail:identity.email,actorRoles:[...getUserRolesForEmail(identity.email).globalRoles,...roles],action:replacingPrevious?'VERSAO_ARQUIVO_SUBSTITUIDA':'UPLOAD_PDF_DRIVE',entityType:'process_file',entityId:String(uploaded.id),before:previousId?{driveFileId:previousId,version:previousVersion||1,lifecycle:'SUPERSEDED',publicCopyFileId:previousPublicFileId||undefined}:undefined,after:{artifactType,fileName:String(uploaded.name||canonicalName),sha256,version,lifecycle:'CURRENT',publicationAuthorizationInvalidated:replacingPrevious,publicCopyAccessRemoved:Boolean(replacingPrevious&&previousPublicFileId)},timestamp:now});`;
  s = replaceOnce(s, old, replacement, 'substituição de arquivo final');
  write(path, s);
}

// Teste puro da preservação de metadados ao substituir versão no Drive.
{
  const path = 'server/integrations/googleDriveArchive.test.ts';
  let s = read(path);
  s = s.replace(`import { buildProcessArchiveFileName, isUnsafePrivateContainerPermission } from './googleDriveArchive';`, `import { buildProcessArchiveFileName, buildSupersededAppProperties, isUnsafePrivateContainerPermission } from './googleDriveArchive';`);
  if (!s.includes("preserva metadados do arquivo substituído")) {
    s += `\n\ntest('preserva metadados do arquivo substituído', () => {\n  const result=buildSupersededAppProperties({portal:'portal-tcc',sha256:'abc',artifactType:'TRABALHO_COMPLETO'},'novo-id','2026-09-12T20:00:00.000Z');\n  assert.deepEqual(result,{portal:'portal-tcc',sha256:'abc',artifactType:'TRABALHO_COMPLETO',lifecycle:'SUPERSEDED',supersededBy:'novo-id',supersededAt:'2026-09-12T20:00:00.000Z'});\n});\n`;
  }
  write(path, s);
}

console.log('Pendências de código corrigidas.');
