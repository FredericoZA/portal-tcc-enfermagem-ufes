import fs from 'node:fs';

function replaceOnce(path, oldText, newText, label) {
  const source = fs.readFileSync(path, 'utf8');
  if (source.includes(newText)) return false;
  if (!source.includes(oldText)) throw new Error(`${label}: trecho não encontrado em ${path}`);
  fs.writeFileSync(path, source.replace(oldText, newText));
  console.log(`alterado: ${label}`);
  return true;
}

replaceOnce(
  'src/services/apiClient.ts',
  "  getSignatureJobs:()=>fetchApi<SignatureJob[]>('/api/signatures/jobs'),\n  retrySignatureJob:(id:string)=>fetchApi<SignatureJob>(`/api/signatures/jobs/${id}/retry`,{method:'POST'}),",
  "  getSignatureJobs:()=>fetchApi<SignatureJob[]>('/api/signatures/jobs'),\n  retrySignatureJob:(id:string)=>fetchApi<SignatureJob>(`/api/signatures/jobs/${id}/retry`,{method:'POST'}),\n  reconcileSignatureJob:(id:string)=>fetchApi<SignatureJob>(`/api/signatures/jobs/${id}/reconcile`,{method:'POST'}),",
  'cliente de reconciliação de assinatura',
);

replaceOnce(
  'src/components/IntegrationStudioPanel.tsx',
  'Selecione uma área à esquerda e trabalhe com seleção, edição e visualização no mesmo contexto.',
  'Selecione uma área acima e trabalhe com seleção, edição e visualização no mesmo contexto.',
  'orientação do editor',
);

const studioPath = 'src/components/IntegrationStudioPanel.tsx';
{
  let source = fs.readFileSync(studioPath, 'utf8');
  if (!source.includes('portal-studio-tabs')) {
    const startText = '      <div className="flex min-h-[68vh] flex-col md:flex-row">\n        <aside className="w-full shrink-0 border-b border-slate-300 bg-[#d5dce0] p-2 md:w-56 md:border-b-0 md:border-r">';
    const start = source.indexOf(startText);
    if (start < 0) throw new Error('início da segunda barra lateral não encontrado');
    const contentStartText = '        <div className="min-w-0 flex-1 bg-slate-50/40 p-3 sm:p-4">';
    const contentStart = source.indexOf(contentStartText, start);
    if (contentStart < 0) throw new Error('área de conteúdo do estúdio não encontrada');
    const replacement = `      <div className="min-h-[68vh]" style={{ backgroundColor: 'var(--portal-surface-layer-1)' }}>\n        <nav className="portal-studio-tabs flex flex-wrap items-center gap-1.5 border-b border-slate-300 p-2.5" style={{ backgroundColor: 'var(--portal-surface-layer-2)' }} aria-label="Áreas de modelos e variáveis">\n          {tabs.map((tab) => {\n            const Icon = tab.icon;\n            const selected = activeTab === tab.id;\n            return <button\n              key={tab.id}\n              type="button"\n              onClick={() => setActiveTab(tab.id)}\n              className={\`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-black uppercase transition-colors \${selected ? 'text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-[#337959]'}\`}\n              style={selected ? { backgroundColor: 'var(--portal-green-action)', borderColor: 'var(--portal-green-action-border)' } : undefined}\n            ><Icon className="h-3.5 w-3.5 shrink-0"/>{tab.label}</button>;\n          })}\n        </nav>\n        <div className="min-w-0 p-3 sm:p-4" style={{ backgroundColor: 'var(--portal-surface-layer-1)' }}>`;
    source = source.slice(0, start) + replacement + source.slice(contentStart + contentStartText.length);
    fs.writeFileSync(studioPath, source);
    console.log('alterado: remove segunda barra lateral do estúdio');
  }
}

const homePath = 'src/pages/HomePage.tsx';
{
  let source = fs.readFileSync(homePath, 'utf8');
  if (!source.includes('const localMatch = desc.match(/Local:')) {
    const oldReturn = '  return { aluno, trabalho, time, orientador, coorientador, banca };';
    if (!source.includes(oldReturn)) throw new Error('retorno parseGcalEvent não encontrado');
    const replacement = `  let local = "";\n  const localMatch = desc.match(/Local:\\s*([^\\n]+)/i);\n  if (localMatch && localMatch[1]) local = localMatch[1].trim();\n\n  return { aluno, trabalho, time, orientador, coorientador, banca, local };`;
    source = source.replace(oldReturn, replacement);
  }
  const oldSummary = "                          const summary = startLabel + ' · ' + parsed.trabalho;";
  const newSummary = "                          const summary = [startLabel, parsed.trabalho, parsed.aluno, parsed.local].filter(Boolean).join(' · ');";
  if (!source.includes(newSummary)) {
    if (!source.includes(oldSummary)) throw new Error('resumo Google Calendar não encontrado');
    source = source.replace(oldSummary, newSummary);
  }
  fs.writeFileSync(homePath, source);
  console.log('alterado: detalhamento de eventos externos do calendário');
}
