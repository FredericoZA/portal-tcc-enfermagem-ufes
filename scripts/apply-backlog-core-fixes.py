from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} occurrence(s), found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new))


# A regra vigente permite o mesmo aluno em múltiplos TCCs. A validação antiga
# no servidor tornava a correção de frontend ineficaz e precisava ser removida.
replace_exact(
    "server.ts",
    """    const requestedStudentEmails = [req.body?.aluno1?.email, req.body?.aluno2?.email]\n      .map((value) => normalizeEmail(String(value || '')))\n      .filter(Boolean);\n    const duplicateStudentEmail = requestedStudentEmails.find((studentEmail) => processesStore.some((process) =>\n      normalizeEmail(process.aluno1?.email || '') === studentEmail\n      || normalizeEmail(process.aluno2?.email || '') === studentEmail\n    ));\n    if (duplicateStudentEmail) {\n      return res.status(409).json({\n        error: 'Cada aluno pode participar como autor de apenas um TCC. Já existe um TCC cadastrado para um dos alunos informados.',\n        code: 'STUDENT_TCC_ALREADY_EXISTS'\n      });\n    }\n""",
    "",
)

# Variáveis passam a seguir a mesma política de autosave do restante do Estúdio.
studio = Path("src/components/IntegrationStudioPanel.tsx")
text = studio.read_text()
anchor = """    recordAudit(createAuditEntry('VARIABLE_UPDATED', 'variable', selectedVariable.id, `Variável ${selectedVariable.name} atualizada e propagada.`, actorEmail, { before, after }));\n  };\n\n  const buildVariableMergeImpact"""
insert = """    recordAudit(createAuditEntry('VARIABLE_UPDATED', 'variable', selectedVariable.id, `Variável ${selectedVariable.name} atualizada e propagada.`, actorEmail, { before, after }));\n  };\n\n  useEffect(() => {\n    if (!selectedVariable || !variableDraft || selectedVariable.id !== variableDraft.id) return;\n    const nextName = normalizeVariableKey(variableDraft.name || '');\n    if (!nextName) return;\n    const comparable = (value: Partial<MatrixColumn>) => JSON.stringify({\n      name: normalizeVariableKey(String(value.name || '')),\n      label: String(value.label || ''),\n      dataType: value.dataType || 'text',\n      description: String(value.description || ''),\n      aliases: [...(value.aliases || [])].map(String).sort(),\n      format: value.format || {}\n    });\n    if (comparable(selectedVariable) === comparable({ ...variableDraft, name: nextName })) return;\n    const timer = window.setTimeout(() => updateVariableAndPropagate({ ...variableDraft, name: nextName }), 800);\n    return () => window.clearTimeout(timer);\n  }, [variableDraft, selectedVariable]);\n\n  const buildVariableMergeImpact"""
if text.count(anchor) != 1:
    raise SystemExit(f"IntegrationStudioPanel autosave anchor count={text.count(anchor)}")
text = text.replace(anchor, insert)

old_button = """                <button type=\"button\" onClick={() => updateVariableAndPropagate(variableDraft)} className={`${actionClass} border-violet-700 bg-violet-700 text-white hover:bg-violet-800`}><Save className=\"h-3.5 w-3.5\" />Salvar e propagar variável</button>"""
new_status = """                <div className=\"inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-emerald-800\"><Check className=\"h-3.5 w-3.5\" />Alterações propagadas automaticamente</div>"""
if text.count(old_button) != 1:
    raise SystemExit(f"IntegrationStudioPanel variable save button count={text.count(old_button)}")
text = text.replace(old_button, new_status)
studio.write_text(text)
