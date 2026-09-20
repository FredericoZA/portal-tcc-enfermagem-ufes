import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const secretSignatures = [
  ['chave privada', /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g],
  ['token GitHub', /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g],
  ['segredo OAuth Google', /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/g],
  ['chave de API Google', /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ['chave secreta Supabase', /\bsb_secret_[A-Za-z0-9._-]{16,}\b/g],
  ['access key AWS', /\bAKIA[0-9A-Z]{16}\b/g]
];

const sensitiveEnvKeys = [
  'PORTAL_SESSION_SECRET',
  'PORTAL_OTP_PEPPER',
  'PORTAL_SECRET_ENCRYPTION_KEY',
  'PORTAL_VERIFICATION_SECRET',
  'PORTAL_UPLOAD_BINDING_SECRET',
  'CRON_SECRET',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_STATE_SECRET',
  'ASTEN_TOKEN',
  'ASTEN_API_TOKEN',
  'ASTEN_WEBHOOK_SECRET',
  'ASTEN_SESSION_ENCRYPTION_KEY'
];

const assignmentPattern = new RegExp(
  `\\b(${sensitiveEnvKeys.join('|')})\\b\\s*(?:=|:)\\s*(.+)$`
);

function isPlaceholder(rawValue) {
  let value = String(rawValue || '').trim();
  if (!value) return true;

  value = value.replace(/[;,]$/, '').trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }

  if (!value) return true;
  if (/^(?:\.\.\.|<[^>]+>|CHANGE_ME|REPLACE_ME|SEU[-_A-Z0-9]*|ID_DA_[A-Z0-9_]+)$/i.test(value)) return true;
  if (value.startsWith('${{') || value.startsWith('${') || value.includes('process.env.')) return true;
  if (/^(?:true|false|null|undefined)$/i.test(value)) return true;

  // Valores calculados em código não são credenciais literais.
  if (/^[A-Za-z_$][\w$]*(?:\.|\(|\[)/.test(value)) return true;

  return false;
}

const findings = [];

for (const file of trackedFiles) {
  let stat;
  try {
    stat = statSync(file);
  } catch {
    continue;
  }
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (content.includes('\u0000')) continue;

  for (const [label, pattern] of secretSignatures) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content))) {
      const line = content.slice(0, match.index).split('\n').length;
      findings.push({ file, line, reason: label });
    }
  }

  const lines = content.split('\n');
  lines.forEach((lineText, index) => {
    const match = assignmentPattern.exec(lineText);
    if (!match) return;
    const [, key, value] = match;
    if (!isPlaceholder(value)) {
      findings.push({ file, line: index + 1, reason: `valor literal em ${key}` });
    }
  });
}

if (findings.length) {
  console.error('Falha de segurança: possível segredo em arquivo versionado.');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} — ${finding.reason}`);
  }
  console.error('Remova a credencial do Git, rotacione-a se ela já foi real e tente novamente.');
  process.exit(1);
}

console.log(`Verificação de segredos: ${trackedFiles.length} arquivo(s) versionado(s) sem credencial literal detectada.`);
