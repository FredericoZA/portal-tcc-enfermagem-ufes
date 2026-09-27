import fs from 'node:fs';
const path='src/components/IntegrationStudioPanel.tsx';
let s=fs.readFileSync(path,'utf8');
const once=(a,b,label)=>{if(s.includes(b))return;if(!s.includes(a))throw new Error(label);s=s.replace(a,b);};
if(!s.includes('const PREVIEW_VARIABLES')){
 const anchor="function formatAuditAction(action: string): string {";
 const i=s.indexOf(anchor); if(i<0)throw new Error('preview helper anchor');
 const helper=[
  "const PREVIEW_VARIABLES: Record<string,string> = {",
  "  TITULO:'Segurança do paciente e qualidade da assistência de enfermagem', TCC_TITULO:'Segurança do paciente e qualidade da assistência de enfermagem', TITULO_TRABALHO:'Segurança do paciente e qualidade da assistência de enfermagem', CAMPO_02:'Segurança do paciente e qualidade da assistência de enfermagem',",
  "  ALUNOS_NOMES:'Ana Carolina Souza e Bruno Martins Lima', ALUNO_NOME:'Ana Carolina Souza', NOME_ALUNO:'Ana Carolina Souza', CAMPO_01:'Ana Carolina Souza e Bruno Martins Lima',",
  "  ORIENTADOR_NOME:'Profa. Dra. Maria Silva', CAMPO_03:'Profa. Dra. Maria Silva', DEFESA_DATA_HORA:'15 de outubro de 2026 às 14h', DEFESA_DATA_HORA_EXTENSO:'15 de outubro de 2026 às 14h', CAMPO_04:'15 de outubro de 2026 às 14h',",
  "  DEFESA_LOCAL:'Auditório do CCS — UFES', LOCAL_DEFESA:'Auditório do CCS — UFES', CAMPO_07_LOCAL:'Auditório do CCS — UFES', PROTOCOLO:'2026-999', CAMPO_12:'2026-999'",
  "};",
  "function applyPreviewVariables(value:string):string{",
  " let out=String(value||'');",
  " for(const[key,replacement]of Object.entries(PREVIEW_VARIABLES)){",
  "  const escaped=key.replace(/[.*+?^$()|[\\]{}]/g,'\\\\$&');",
  "  const patterns=[",
  "   new RegExp('\\\\{\\\\{\\\\s*'+escaped+'\\\\s*\\\\}\\\\}','gi'),",
  "   new RegExp('<<\\\\s*'+escaped+'\\\\s*>>','gi'),",
  "   new RegExp('\\\\[\\\\[\\\\s*'+escaped+'\\\\s*\\\\]\\\\]','gi'),",
  "   new RegExp('«\\\\s*'+escaped+'\\\\s*»','gi'),",
  "   new RegExp('-'+escaped+'-','gi')",
  "  ];",
  "  for(const pattern of patterns) out=out.replace(pattern,replacement);",
  " }",
  " return out;",
  "}",
  ""
 ].join('\n');
 s=s.slice(0,i)+helper+s.slice(i);
}
if(!s.includes('const flushDraftRef = useRef')){
 const anchor="  const draftFingerprint = useMemo(() => JSON.stringify({ brandKit, documentDesigns, emailDesigns, formDesigns, matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates, workflowStages, operationalConfig, operationsPolicy, replicationGuide, driveModelosFolderUrl }), [brandKit, documentDesigns, emailDesigns, formDesigns, matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates, workflowStages, operationalConfig, operationsPolicy, replicationGuide, driveModelosFolderUrl]);\n";
 if(!s.includes(anchor))throw new Error('draft fingerprint');
 const add="  const flushDraftRef = useRef<() => void>(()=>{});\n  flushDraftRef.current = () => { if(!hasHydratedRef.current||!isDirty||isSaving)return; const draft=buildSnapshot(); draft.revision=revision; draft.savedAt=new Date().toISOString(); draft.publication={status:'DRAFT',publishedRevision:initialMeta.publication?.publishedRevision,publishedAt:initialMeta.publication?.publishedAt,validationScore:validationReport.score}; saveLocalStudio(draft); };\n  useEffect(()=>()=>flushDraftRef.current(),[]);\n";
 s=s.replace(anchor,anchor+add);
}
const oldStart="    const body = selectedEmail.htmlBody?.trim()\n      ? selectedEmail.htmlBody\n      : `<div style=\"white-space:pre-wrap\">${safeHtmlText(selectedEmail.body || '')}</div>`;";
const newStart="    const previewSubject=applyPreviewVariables(selectedEmail.subject);\n    const bodySource=applyPreviewVariables(selectedEmail.htmlBody?.trim()?selectedEmail.htmlBody:selectedEmail.body||'');\n    const body = selectedEmail.htmlBody?.trim()?bodySource:`<div style=\"white-space:pre-wrap\">${safeHtmlText(bodySource)}</div>`;";
once(oldStart,newStart,'email body preview');
once('${safeHtmlText(selectedEmail.subject)}','${safeHtmlText(previewSubject)}','email subject preview');
once('${safeHtmlText(selectedEmailDesign.footerText)}','${safeHtmlText(applyPreviewVariables(selectedEmailDesign.footerText))}','email footer preview');
fs.writeFileSync(path,s);
