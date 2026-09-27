import fs from 'node:fs';
const path='src/components/IntegrationStudioPanel.tsx';
let source=fs.readFileSync(path,'utf8');
const old="  const escaped=key.replace(/[.*+?^$()|[\\]{}]/g,'\\\\$&');";
const replacement="  const escaped=key.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&');";
if(!source.includes(old) && !source.includes(replacement)) throw new Error('Trecho de escape não encontrado');
if(source.includes(old)) source=source.replace(old,replacement);
fs.writeFileSync(path,source);
