import fs from 'node:fs';

{
  const path = 'server.ts';
  let source = fs.readFileSync(path, 'utf8');
  const broken = "const raw=pdf.toString('latin1');const hasSignature=//ByteRanges*[/.test(raw)&&//Contentss*</.test(raw);";
  const fixed = "const raw=pdf.toString('latin1');const hasSignature=raw.includes('/ByteRange')&&raw.includes('/Contents');";
  if (!source.includes(broken)) throw new Error('Trecho inválido esperado não foi localizado após a geração.');
  source = source.replace(broken, fixed);
  fs.writeFileSync(path, source);
}

{
  const path = 'src/pages/HomePage.tsx';
  let source = fs.readFileSync(path, 'utf8');
  const old = '<p className={`mt-0.5 text-xs ${currentTheme.accentText} font-semibold`}>';
  const replacement = '<p className="mt-0.5 text-xs font-semibold text-slate-100">';
  if (!source.includes(old)) throw new Error('Subtítulo do modal de acesso não foi localizado.');
  source = source.split(old).join(replacement);
  fs.writeFileSync(path, source);
}

console.log('Validação Gov.br e contraste do modal de acesso corrigidos.');
