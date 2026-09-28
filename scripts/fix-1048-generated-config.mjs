import fs from 'node:fs';
const file='src/pages/ConfiguracoesPage.tsx';
let src=fs.readFileSync(file,'utf8');
const needle=`          })()}\n\n      {personalizationHubOpen && (`;
const replacement=`          })()}\n        </>\n      )}\n\n      {personalizationHubOpen && (`;
if(!src.includes(needle)) throw new Error('Estrutura gerada de Configurações não encontrada para fechamento');
src=src.replace(needle,replacement);
fs.writeFileSync(file,src);
console.log('Estrutura de Configurações fechada.');
