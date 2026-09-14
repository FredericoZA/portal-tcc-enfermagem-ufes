import fs from 'node:fs';

const path = 'server.ts';
let source = fs.readFileSync(path, 'utf8');
const broken = "const raw=pdf.toString('latin1');const hasSignature=//ByteRanges*[/.test(raw)&&//Contentss*</.test(raw);";
const fixed = "const raw=pdf.toString('latin1');const hasSignature=raw.includes('/ByteRange')&&raw.includes('/Contents');";
if (!source.includes(broken)) throw new Error('Trecho inválido esperado não foi localizado após a geração.');
source = source.replace(broken, fixed);
fs.writeFileSync(path, source);
console.log('Validação estrutural Gov.br corrigida.');
