import { readFileSync, writeFileSync } from 'node:fs';
const file='src/components/IntegrationStudioPanel.tsx';
let source=readFileSync(file,'utf8');
const old="before: sourceVariable, after: targetVariable, affectedArtifacts: merged.affectedArtifacts, impact";
const next="before: sourceVariable, after: { target: targetVariable, impact }, affectedArtifacts: merged.affectedArtifacts";
if(!source.includes(old))throw new Error('Trecho de auditoria esperado não encontrado.');
source=source.replace(old,next);
writeFileSync(file,source);
console.log('Auditoria da mescla ajustada sem ampliar o schema.');
