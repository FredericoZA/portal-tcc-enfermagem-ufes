import fs from 'node:fs';

const replaceRequired=(file,from,to)=>{
  let text=fs.readFileSync(file,'utf8');
  if(!text.includes(from)) throw new Error(`Trecho não encontrado em ${file}: ${from.slice(0,120)}`);
  text=text.replace(from,to);
  fs.writeFileSync(file,text);
};

// Meus TCCs: exibir Cadastrar na toolbar sempre que o usuário puder criar um TCC.
replaceRequired(
  'src/pages/MeusProcessosPage.tsx',
  "{processes.length > 0 && canCreateStudentTcc && meusProcessosTextFormat.showCadastrarTrabalhoButton !== false && (",
  "{canCreateStudentTcc && meusProcessosTextFormat.showCadastrarTrabalhoButton !== false && ("
);

// Calendário: marcadores semânticos permitem usar somente as superfícies neutras já existentes.
replaceRequired(
  'src/pages/HomePage.tsx',
  'className={`border-r border-b border-slate-200 p-2 flex flex-col justify-between transition-all duration-150 relative group select-none ${',
  'className={`portal-calendar-day-cell ${hasEvents ? \'portal-calendar-day-has-events \' : \'\'}${isWeekend ? \'portal-calendar-day-weekend \' : \'\'}border-r border-b border-slate-200 p-2 flex flex-col justify-between transition-all duration-150 relative group select-none ${'
);

// Presidente: duas colunas de assinatura, uma para Asten e outra para Gov.br.
{
  const file='src/pages/CoordenadorPage.tsx';
  let text=fs.readFileSync(file,'utf8');
  const start=text.indexOf('  const renderSignatureActionCell = (proc: ProcessData) => {');
  const end=text.indexOf('\n\n  // Download only the authenticated declaration',start);
  if(start<0||end<0) throw new Error('renderSignatureActionCell não localizado.');
  const replacement=`  const renderSignatureActionCells = (proc: ProcessData) => {\n    const job=getDeclarationJob(proc.id);\n    const working=signingIds.includes(proc.id);\n    const status=getDeclarationStatus(proc.id);\n    const actionable=isDeclarationActionable(proc.id);\n    return (<>\n      <td className={\`${'${styles.cellPadClass} ${styles.borderClass}'} min-w-[92px] text-center align-middle\`}>\n        <button type=\"button\" onClick={()=>handleSignOne(proc.id)} disabled={working||!actionable} className=\"portal-sign-provider-btn\" title=\"Assinar esta declaração pela Asten\"><Shield className=\"h-3.5 w-3.5\"/><span>Asten</span></button>\n        {!actionable&&<span className={\`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${'${status.tone}'}\`} title={job?.lastError||status.label}>{status.label}</span>}\n      </td>\n      <td className={\`${'${styles.cellPadClass} ${styles.borderClass}'} min-w-[92px] text-center align-middle\`}>\n        <button type=\"button\" onClick={()=>void handleGovOne(proc.id)} disabled={working||!actionable} className=\"portal-sign-provider-btn\" title=\"Preparar PDF e abrir o Assinador Gov.br\"><FileCheck className=\"h-3.5 w-3.5\"/><span>Gov</span></button>\n      </td>\n    </>);\n  };`;
  text=text.slice(0,start)+replacement+text.slice(end);
  const oldHeader='<th className={`${styles.headerThClass} ${styles.cellPadClass} min-w-[150px] text-center align-middle ${styles.headerBorderClass}`}>\n                            <span>Asten</span>\n                          </th>';
  const newHeader='<th className={`${styles.headerThClass} ${styles.cellPadClass} min-w-[92px] text-center align-middle ${styles.headerBorderClass}`}>\n                            <span>Asten</span>\n                          </th>\n                          <th className={`${styles.headerThClass} ${styles.cellPadClass} min-w-[92px] text-center align-middle ${styles.headerBorderClass}`}>\n                            <span>Gov</span>\n                          </th>';
  if(!text.includes(oldHeader)) throw new Error('Cabeçalho Asten não localizado.');
  text=text.replace(oldHeader,newHeader).replace('{renderSignatureActionCell(proc)}','{renderSignatureActionCells(proc)}');
  fs.writeFileSync(file,text);
}

// Contrato do bloco 1.
const testFile='server/update34VisualContract.test.ts';
let test=fs.readFileSync(testFile,'utf8');
test += `\n\ntest('bloco 1 integra ações e células reais às telas',async()=>{\n  const [mine,president,home]=await Promise.all([source('src/pages/MeusProcessosPage.tsx'),source('src/pages/CoordenadorPage.tsx'),source('src/pages/HomePage.tsx')]);\n  assert.ok(mine.includes(\"{canCreateStudentTcc && meusProcessosTextFormat.showCadastrarTrabalhoButton !== false && (\"));\n  assert.ok(home.includes('portal-calendar-day-cell'));\n  assert.ok(president.includes('renderSignatureActionCells'));\n  assert.ok(president.includes('<span>Asten</span>'));\n  assert.ok(president.includes('<span>Gov</span>'));\n});\n`;
fs.writeFileSync(testFile,test);

console.log('Bloco 1 funcional aplicado.');
