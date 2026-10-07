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
  ['access key AWS', /\bAKIA[0-9A-Z]{16}\b/g],
  ['token npm', /\bnpm_[A-Za-z0-9]{30,}\b/g]
];

const sensitiveEnvKeys = [
  'PORTAL_SESSION_SECRET',
  'PORTAL_OTP_PEPPER',
  'PORTAL_SECRET_ENCRYPTION_KEY',
  'PORTAL_SECRET_ENCRYPTION_KEY_V2',
  'PORTAL_SECRET_ENCRYPTION_KEY_PREVIOUS',
  'PORTAL_VERIFICATION_SECRET',
  'PORTAL_UPLOAD_BINDING_SECRET',
  'PORTAL_SECURITY_WEBHOOK_SECRET',
  'CRON_SECRET',
  'MASTER_RECOVERY_SECRET_SHA256',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_PASSWORD',
  'DATABASE_URL',
  'DIRECT_URL',
  'POSTGRES_PASSWORD',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_STATE_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'GOOGLE_OAUTH_REFRESH_TOKEN',
  'GOOGLE_ACCESS_TOKEN',
  'ASTEN_TOKEN',
  'ASTEN_API_TOKEN',
  'ASTEN_API_KEY',
  'ASTEN_CLIENT_SECRET',
  'ASTEN_WEBHOOK_SECRET',
  'ASTEN_SESSION_ENCRYPTION_KEY',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_SERVICE_ACCOUNT',
  'SMTP_PASSWORD',
  'RESEND_API_KEY',
  'VERCEL_TOKEN',
  'VERCEL_ACCESS_TOKEN'
];

const assignmentPattern = new RegExp(
  `["']?\\b(${sensitiveEnvKeys.join('|')})\\b["']?\\s*(?:=|:)\\s*(.+)$`
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

  // Só uma substituição que ocupa o valor inteiro é considerada segura. Assim,
  // `${PROTO}://user:senha@host/db` continua sendo inspecionado como literal.
  if (/^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(value)) return true;
  if (/^\$\{\{\s*[^{}]+\s*\}\}$/.test(value)) return true;

  // Referências de ambiente em código são aceitas apenas quando todo o valor é
  // uma expressão simples, sem sufixos/prefixos literais que possam esconder segredo.
  if (/^process\.env\.[A-Z0-9_]+$/i.test(value)) return true;
  if (/^String\(process\.env\.[A-Z0-9_]+\s*\|\|\s*['"]{2}\)$/i.test(value)) return true;
  if (/^(?:true|false|null|undefined)$/i.test(value)) return true;

  // Valores calculados em código não são credenciais literais quando a expressão
  // inteira é uma chamada/acesso; strings interpoladas não entram nesta exceção.
  if (/^[A-Za-z_$][\w$]*(?:\.|\(|\[)[^'"`]*$/.test(value)) return true;

  return false;
}

function assertScannerContract() {
  // As chaves são montadas em partes para o próprio scanner não confundir
  // esses exemplos sintéticos com credenciais versionadas.
  const databaseKey = 'DATABASE_' + 'URL';
  const astenKey = 'ASTEN_' + 'API_KEY';
  const quotedJson = `"${databaseKey}": "postgresql://example:example@db.invalid/app",`;
  const envAssignment = `${astenKey}="example-token-not-a-real-credential"`;
  const placeholderJson = `"${databaseKey}": ""`;
  const wholeSubstitution = `${databaseKey}=\${DB_CONNECTION}`;
  const mixedSubstitution = `${databaseKey}=\${DB_PROTOCOL}://example:hardcoded-value@db.invalid/app`;

  const jsonMatch = assignmentPattern.exec(quotedJson);
  const envMatch = assignmentPattern.exec(envAssignment);
  const placeholderMatch = assignmentPattern.exec(placeholderJson);
  const wholeSubstitutionMatch = assignmentPattern.exec(wholeSubstitution);
  const mixedSubstitutionMatch = assignmentPattern.exec(mixedSubstitution);
  if (!jsonMatch || isPlaceholder(jsonMatch[2])) throw new Error('Contrato interno do scanner falhou para chave JSON citada.');
  if (!envMatch || isPlaceholder(envMatch[2])) throw new Error('Contrato interno do scanner falhou para atribuição .env.');
  if (!placeholderMatch || !isPlaceholder(placeholderMatch[2])) throw new Error('Contrato interno do scanner falhou para placeholder vazio.');
  if (!wholeSubstitutionMatch || !isPlaceholder(wholeSubstitutionMatch[2])) throw new Error('Contrato interno do scanner falhou para substituição integral.');
  if (!mixedSubstitutionMatch || isPlaceholder(mixedSubstitutionMatch[2])) throw new Error('Contrato interno do scanner falhou para substituição mista com literal.');
}

function shouldScanAssignments(file) {
  if (/(?:^|\/)(?:docs?|test-results|playwright-report)\//i.test(file)) return false;
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(file)) return false;
  if (/(?:^|\/)scripts\/test-/i.test(file)) return false;
  return true;
}

assertScannerContract();
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

  // Assinaturas conhecidas de provedores são procuradas em todo arquivo textual,
  // inclusive documentação e fixtures.
  for (const [label, pattern] of secretSignatures) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content))) {
      const line = content.slice(0, match.index).split('\n').length;
      findings.push({ file, line, reason: label });
    }
  }

  // A busca por atribuições literais é mais conservadora para evitar falsos
  // positivos em testes que usam segredos fictícios deliberadamente.
  if (!shouldScanAssignments(file)) continue;

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
