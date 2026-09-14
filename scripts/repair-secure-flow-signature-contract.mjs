import fs from 'node:fs';
const p='scripts/test-secure-flow.mjs';
let s=fs.readFileSync(p,'utf8');
const old="    assert.match(server, /if\\(type==='TERMO'\\)[^\\n]*role:'STUDENT'[^\\n]*signingOrder:1[^\\n]*role:'ADVISOR'[^\\n]*signingOrder:1/);";
const replacement="    assert.match(server, /if\\(type==='TERMO'\\)\\{[\\s\\S]{0,1400}role:'STUDENT'[\\s\\S]{0,500}signingOrder:1[\\s\\S]{0,1200}role:'ADVISOR'[\\s\\S]{0,400}signingOrder:2/);";
if(!s.includes(old)) throw new Error('Contrato antigo de ordem do TERMO não localizado.');
s=s.replace(old,replacement);
fs.writeFileSync(p,s);
console.log('Contrato seguro atualizado: alunos assinam antes do orientador.');
