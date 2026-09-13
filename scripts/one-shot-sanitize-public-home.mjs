import fs from 'node:fs';

const file = 'src/pages/HomePage.tsx';
let source = fs.readFileSync(file, 'utf8');
const original = source;

// Remove matrícula das rotinas públicas de busca/exportação.
source = source.replace(/^\s*const mat = proc\.aluno1\?\.matricula \? ` \(Matrícula: \$\{proc\.aluno1\.matricula\}\)` : '';\r?\n/gm, '');
source = source.replace(/^\s*const mat = proc\.aluno2\?\.matricula \? ` \(Matrícula: \$\{proc\.aluno2\.matricula\}\)` : '';\r?\n/gm, '');
source = source.replace(/name \+ mat/g, 'name');

const visualBlocks = [
`                        <div className="text-[9px] text-slate-500 font-mono font-normal mt-1 uppercase tracking-tight">
                          {formatCellText('aluno1', 'Matrícula', defensesTextFormat, '🪪')}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono font-normal leading-tight">{proc.aluno1?.matricula || '—'}</div>
`,
`                            <div className="text-[9px] text-slate-500 font-mono font-normal mt-1 uppercase tracking-tight">
                              {formatCellText('aluno2', 'Matrícula', defensesTextFormat, '🪪')}
                            </div>
                            <div className="text-[9px] text-slate-500 font-mono font-normal leading-tight">{proc.aluno2.matricula || '—'}</div>
`,
`                          <div className="text-[9px] text-slate-500 font-mono font-normal mt-1 uppercase tracking-tight">
                            {formatCellText('aluno1', 'Matrícula', acervoTextFormat, '🪪')}
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono font-normal leading-tight">{proc.aluno1?.matricula || '2026101890'}</div>
`,
`                              <div className="text-[9px] text-slate-500 font-mono font-normal mt-1 uppercase tracking-tight">
                                {formatCellText('aluno2', 'Matrícula', acervoTextFormat, '🪪')}
                              </div>
                              <div className="text-[9px] text-slate-500 font-mono font-normal leading-tight">{proc.aluno2.matricula || '2026101891'}</div>
`
];

for (const block of visualBlocks) {
  if (!source.includes(block)) {
    throw new Error(`Bloco esperado não encontrado; abortando para evitar patch parcial: ${block.split('\n')[1] || block}`);
  }
  source = source.replace(block, '');
}

const forbidden = [
  '2026101890',
  '2026101891',
  "'Matrícula', defensesTextFormat",
  "'Matrícula', acervoTextFormat",
  'proc.aluno1?.matricula',
  'proc.aluno2?.matricula',
  'proc.aluno1.matricula',
  'proc.aluno2.matricula'
];
for (const token of forbidden) {
  if (source.includes(token)) throw new Error(`Referência pública de matrícula permaneceu em HomePage.tsx: ${token}`);
}

if (source === original) throw new Error('Nenhuma alteração aplicada.');
fs.writeFileSync(file, source);
console.log('HomePage pública sanitizada: matrícula e fallbacks fictícios removidos.');
