import { readFileSync, writeFileSync } from 'node:fs';

const file = 'src/components/IntegrationStudioPanel.tsx';
let source = readFileSync(file, 'utf8');

const start = source.indexOf('  const handleMergeVariables = () => {');
const end = source.indexOf('\n\n  const deleteSelectedVariable', start);
if (start < 0 || end < 0) throw new Error('Não encontrei o bloco de mescla de variáveis.');

const replacement = `  const buildVariableMergeImpact = (sourceVariable: MatrixColumn, targetVariable: MatrixColumn) => {
    const artifacts = { matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates };
    const sourceUsage = getVariableUsage([sourceVariable.id, sourceVariable.name, ...(sourceVariable.aliases || [])], artifacts);
    const targetUsage = getVariableUsage([targetVariable.id, targetVariable.name, ...(targetVariable.aliases || [])], artifacts);
    const affectedArtifacts = Array.from(new Set([...sourceUsage.documents, ...sourceUsage.emails, ...sourceUsage.forms]));
    const sourceFormat = sourceVariable.format || {};
    const targetFormat = targetVariable.format || {};
    const formatChanges = JSON.stringify(sourceFormat) !== JSON.stringify(targetFormat);
    return { sourceUsage, targetUsage, affectedArtifacts, formatChanges, sourceFormat, targetFormat };
  };

  const variableMergeImpact = useMemo(() => {
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return null;
    const sourceVariable = matrixColumns.find((column) => column.id === mergeSourceId);
    const targetVariable = matrixColumns.find((column) => column.id === mergeTargetId);
    return sourceVariable && targetVariable ? buildVariableMergeImpact(sourceVariable, targetVariable) : null;
  }, [mergeSourceId, mergeTargetId, matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates]);

  const handleMergeVariables = async () => {
    if (!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId) return;
    const sourceVariable = matrixColumns.find((column) => column.id === mergeSourceId);
    const targetVariable = matrixColumns.find((column) => column.id === mergeTargetId);
    if (!sourceVariable || !targetVariable) return;
    const impact = buildVariableMergeImpact(sourceVariable, targetVariable);
    const details = [
      \`${'${impact.sourceUsage.documents.length}'} documento(s)\`,
      \`${'${impact.sourceUsage.emails.length}'} e-mail(s)\`,
      \`${'${impact.sourceUsage.forms.length}'} formulário(s)\`,
      \`${'${impact.affectedArtifacts.length}'} artefato(s) único(s)\`
    ].join(' · ');
    const formattingNote = impact.formatChanges
      ? ' A formatação das duas variáveis difere; após a mescla prevalece a formatação da variável principal.'
      : '';
    if (!(await portalConfirm(\`Mesclar “${'${sourceVariable.label || sourceVariable.name}'}” em “${'${targetVariable.label || targetVariable.name}'}”? Impacto: ${'${details}'}.${'${formattingNote}'} A chave antiga será mantida como alias e as referências serão reescritas.\`))) return;
    const merged = mergeVariableAcrossArtifacts({ matrixColumns, matrixRows, docTemplates, emailTemplates, formTemplates }, sourceVariable.id, targetVariable.id);
    setMatrixColumns(merged.matrixColumns);
    setMatrixRows(merged.matrixRows);
    setDocTemplates(merged.docTemplates);
    setEmailTemplates(merged.emailTemplates);
    setFormTemplates(merged.formTemplates);
    setSelectedVariableId(targetVariable.id);
    setMergeSourceId('');
    setMergeTargetId('');
    recordAudit(createAuditEntry('VARIABLE_MERGED', 'variable', targetVariable.id, \`${'${sourceVariable.name}'} foi mesclada em ${'${targetVariable.name}'} após conferência explícita do impacto; todas as referências foram reescritas.\`, actorEmail, {
      before: sourceVariable, after: targetVariable, affectedArtifacts: merged.affectedArtifacts, impact
    }));
    notify(\`Mescla concluída em ${'${merged.affectedArtifacts.length}'} artefato(s).\`);
  };`;

source = source.slice(0, start) + replacement + source.slice(end);

const marker = '<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-900"><strong>Operação auditável:</strong> a chave descartada vira alias da principal e todas as referências em documentos, e-mails, formulários e matriz são reescritas.</div>';
if (!source.includes(marker)) throw new Error('Não encontrei o bloco visual da mescla.');
const preview = `{variableMergeImpact && <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-[10px] leading-relaxed text-violet-950"><div className="flex items-center gap-1.5 font-black uppercase"><CircleAlert className="h-3.5 w-3.5"/>Impacto antes da mescla</div><p className="mt-1">A variável descartada aparece em <strong>{variableMergeImpact.affectedArtifacts.length}</strong> artefato(s): {variableMergeImpact.sourceUsage.documents.length} documento(s), {variableMergeImpact.sourceUsage.emails.length} e-mail(s) e {variableMergeImpact.sourceUsage.forms.length} formulário(s).</p>{variableMergeImpact.affectedArtifacts.length > 0 && <p className="mt-1 break-words text-violet-800">{variableMergeImpact.affectedArtifacts.slice(0, 8).join(' · ')}{variableMergeImpact.affectedArtifacts.length > 8 ? ' …' : ''}</p>}{variableMergeImpact.formatChanges && <p className="mt-1 font-bold text-amber-800">A formatação das duas variáveis difere. Após a mescla prevalece a formatação da variável principal.</p>}</div>}<div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-900"><strong>Operação auditável:</strong> a chave descartada vira alias da principal e todas as referências em documentos, e-mails, formulários e matriz são reescritas somente após confirmação explícita.</div>`;
source = source.replace(marker, preview);

writeFileSync(file, source);
console.log('Impacto de mescla de variáveis aplicado.');
