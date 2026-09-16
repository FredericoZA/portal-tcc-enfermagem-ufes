import fs from 'node:fs';
// Reexecução idempotente após falha transitória do push do GitHub Actions.
const file='src/components/UnifiedPortalEditorModal.tsx';
let text=fs.readFileSync(file,'utf8');
if(!text.includes('Solicitação Ouvinte')) throw new Error('Legado Solicitação Ouvinte não encontrado.');
text=text.replaceAll('Solicitação Ouvinte','Solicitação de Correção');
fs.writeFileSync(file,text);
for(const temp of ['scripts/fix-update33-final.mjs','.github/workflows/fix-update33-final.yml']){try{fs.unlinkSync(temp);}catch{}}
console.log('Último legado de ouvinte removido.');
