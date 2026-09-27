import fs from 'node:fs';
const path='src/components/IntegrationStudioPanel.tsx';
let source=fs.readFileSync(path,'utf8');
const lines=source.split('\n');
const index=lines.findIndex(line=>line.includes('const escaped=key.replace('));
if(index<0) throw new Error('Trecho de escape não encontrado');
lines[index] = "  const escaped=key.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&');";
source=lines.join('\n');
fs.writeFileSync(path,source);
