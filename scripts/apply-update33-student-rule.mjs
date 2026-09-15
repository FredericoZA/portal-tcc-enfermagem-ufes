import fs from 'node:fs';

const replaceOnce=(source,from,to,label)=>{if(!source.includes(from))throw new Error(`Padrão não encontrado: ${label}`);return source.replace(from,to);};

{
  const file='server.ts';
  let source=fs.readFileSync(file,'utf8');
  const from=`    try { req.body = { ...req.body, ...acceptRegistration(req.body, currentSettings.integrationStudio) }; }\n    catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Cadastro inválido.' }); }`;
  const to=`    try { req.body = { ...req.body, ...acceptRegistration(req.body, currentSettings.integrationStudio) }; }\n    catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Cadastro inválido.' }); }\n\n    const requestedStudentEmails = [req.body?.aluno1?.email, req.body?.aluno2?.email]\n      .map((value) => normalizeEmail(String(value || '')))\n      .filter(Boolean);\n    const duplicateStudentEmail = requestedStudentEmails.find((studentEmail) => processesStore.some((process) =>\n      normalizeEmail(process.aluno1?.email || '') === studentEmail\n      || normalizeEmail(process.aluno2?.email || '') === studentEmail\n    ));\n    if (duplicateStudentEmail) {\n      return res.status(409).json({\n        error: 'Cada aluno pode participar como autor de apenas um TCC. Já existe um TCC cadastrado para um dos alunos informados.',\n        code: 'STUDENT_TCC_ALREADY_EXISTS'\n      });\n    }`;
  source=replaceOnce(source,from,to,'regra backend de aluno único');
  fs.writeFileSync(file,source);
}

{
  const file='src/pages/MeusProcessosPage.tsx';
  let source=fs.readFileSync(file,'utf8');
  const from=`  }, [processes, userEmail, memberships]);\n\n  // Available categories depending on user privileges`;
  const to=`  }, [processes, userEmail, memberships]);\n\n  const canCreateStudentTcc = roleCounts.ALUNO === 0;\n\n  // Available categories depending on user privileges`;
  source=replaceOnce(source,from,to,'regra visual aluno único');
  source=replaceOnce(source,"{processes.length > 0 && meusProcessosTextFormat.showCadastrarTrabalhoButton !== false && (","{processes.length > 0 && canCreateStudentTcc && meusProcessosTextFormat.showCadastrarTrabalhoButton !== false && (",'condição do botão cadastrar');
  fs.writeFileSync(file,source);
}

{
  const file='server/update33RestrictedAreaContract.test.ts';
  let source=fs.readFileSync(file,'utf8');
  source += `\n\ntest('regra acadêmica impede segundo TCC para o mesmo aluno',async()=>{const [server,mine]=await Promise.all([source('server.ts'),source('src/pages/MeusProcessosPage.tsx')]);assert.ok(server.includes('STUDENT_TCC_ALREADY_EXISTS'));assert.ok(server.includes('Cada aluno pode participar como autor de apenas um TCC'));assert.ok(mine.includes('const canCreateStudentTcc = roleCounts.ALUNO === 0'));assert.ok(mine.includes('processes.length > 0 && canCreateStudentTcc'));});\n`;
  fs.writeFileSync(file,source);
}
