import { readFileSync, writeFileSync } from 'node:fs';

const path = 'server.ts';
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`[update34] ${label}: trecho de origem não encontrado.`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`[update34] ${label}: trecho ambíguo; mais de uma ocorrência.`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  'matrícula opcional no cadastro individual',
  "    if(role==='STUDENT'&&!matricula)return res.status(400).json({error:'Informe a matrícula para cadastrar um estudante.'});\n",
  "    // A matrícula ajuda na identificação acadêmica, mas não bloqueia o cadastro individual prévio.\n",
);

replaceOnce(
  'qualidade administrativa inicial',
  "    const entry=upsertAuthorizedAccess({nome,email,matricula,role,origin:'MASTER_LIST',actor:identity.email,active:true});\n    entry.memberType=memberType;\n",
  "    const entry=upsertAuthorizedAccess({nome,email,matricula,role,origin:'MASTER_LIST',actor:identity.email,active:true});\n    entry.accessType=role; // qualidade administrativa única; os papéis por TCC permanecem nas memberships.\n    entry.memberType=memberType;\n",
);

replaceOnce(
  'troca de qualidade administrativa',
  "    const roles=requestedRole?Array.from(new Set([...(before.roles||[before.accessType||'STUDENT']),requestedRole])) as ProcessRole[]:(before.roles||[before.accessType||'STUDENT']);\n    const memberType=req.body?.memberType!==undefined?(String(req.body.memberType).toUpperCase()==='EXTERNAL'?'EXTERNAL':'INTERNAL'):before.memberType;\n",
  "    const roles=requestedRole?Array.from(new Set([...(before.roles||[before.accessType||'STUDENT']),requestedRole])) as ProcessRole[]:(before.roles||[before.accessType||'STUDENT']);\n    const accessType=requestedRole&&req.body?.replaceRole===true?requestedRole:(before.accessType||roles[0]);\n    const memberType=req.body?.memberType!==undefined?(String(req.body.memberType).toUpperCase()==='EXTERNAL'?'EXTERNAL':'INTERNAL'):before.memberType;\n",
);

replaceOnce(
  'persistência da qualidade administrativa',
  "roles,accessType:(before.accessType||roles[0]),memberType,active",
  "roles,accessType,memberType,active",
);

const publicFallbackStart = source.indexOf('    // Public web scrape fallback if no access token or API returned 0 files\n');
if (publicFallbackStart < 0) throw new Error('[update34] fallback público do Drive não encontrado.');
const publicFallbackEnd = source.indexOf('    res.json({ folderId, files });', publicFallbackStart);
if (publicFallbackEnd < 0) throw new Error('[update34] fim do fallback público do Drive não encontrado.');
source = source.slice(0, publicFallbackStart)
  + "    // Sem fallback público: a varredura usa exclusivamente a conta Google autorizada no servidor.\n\n"
  + source.slice(publicFallbackEnd);

writeFileSync(path, source, 'utf8');
console.log('[update34] server.ts atualizado com sucesso.');
