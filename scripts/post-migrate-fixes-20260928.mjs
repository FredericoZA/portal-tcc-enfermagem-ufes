import fs from 'node:fs';

const path = 'server.ts';
let source = fs.readFileSync(path, 'utf8');
const anchor = "    const studentEmails=[aluno1Email,aluno2?.email?normalizeEmail(aluno2.email):''].filter(Boolean);\n    if(studentEmails.some(email=>!isValidPortalEmail(email)))return res.status(400).json({error:'Informe e-mails válidos para os alunos autores.'});\n";
const replacement = `${anchor}    const installationProfile=resolveInstallationProfile(currentSettings);\n`;
if (source.includes(anchor) && !source.includes(`${anchor}    const installationProfile=resolveInstallationProfile(currentSettings);`)) {
  source = source.replace(anchor, replacement);
}
fs.writeFileSync(path, source);
console.log('Post-migration fixes applied.');
