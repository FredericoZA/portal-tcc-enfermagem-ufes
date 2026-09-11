import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const envUfes = readFileSync(new URL('../.env.ufes.example', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

const institutionalMarkers = [
  'data do preenchimento',
  'alunos',
  'titulo do trabalho',
  'orientador (1)',
  'examinador (2)',
  'examinador (3)',
  'data da defesa (extenso total)',
  'hora de inicio da defesa (extenso)',
  'local da defesa',
  'hora de início da defesa (por extenso)',
  'data da defesa (por extenso total)',
  'situação',
  'parecer',
  'data da defesa (por extenso)',
  'nome completo aluno (1)',
  'nome completo aluno (2)',
  'coorientador',
  'Coorientador(a) Prof(ª). Dr(ª).'
];

const missing = institutionalMarkers.filter((marker) => !server.includes(`'${marker}'`));
if (missing.length) {
  console.error(`Marcadores institucionais sem compatibilidade explícita: ${missing.join(', ')}`);
  process.exit(1);
}

if (!envUfes.includes('GOOGLE_ALLOW_EXISTING_MODEL_LINKS="true"')) {
  console.error('O perfil UFES precisa permitir cadastro dos Google Docs institucionais existentes.');
  process.exit(1);
}

const driveRootId = '1zkG3fBm2tJESZjZP0_7jStUuPNXCwRPS';
const productionUrl = 'https://portal-tcc-enfermagem-ufes.vercel.app';
if (!envUfes.includes(`PORTAL_DRIVE_ROOT_FOLDER_ID="${driveRootId}"`)) {
  console.error('A pasta raiz institucional do Drive não está fixada no perfil UFES.');
  process.exit(1);
}

const expectedPublicVercelEnv = {
  APP_URL: productionUrl,
  PORTAL_PUBLIC_URL: productionUrl,
  PORTAL_BOOTSTRAP_MASTER_EMAIL: 'tccenfermagemufes@gmail.com',
  PORTAL_PERSISTENCE_PROVIDER: 'supabase',
  SUPABASE_URL: 'https://vvgdmycmotazqjvpywmk.supabase.co',
  SUPABASE_SECURE_FILES_BUCKET: 'portal-secure-transfer',
  PORTAL_DRIVE_ROOT_FOLDER_ID: driveRootId,
  GOOGLE_ALLOW_EXISTING_MODEL_LINKS: 'true',
  ASTEN_CALLBACK_URL: `${productionUrl}/api/integrations/asten/webhook`
};

if (!Array.isArray(vercel.regions) || vercel.regions.length !== 1 || vercel.regions[0] !== 'gru1') {
  console.error('A função de produção deve executar em gru1, próxima ao Supabase de São Paulo.');
  process.exit(1);
}

for (const [key, value] of Object.entries(expectedPublicVercelEnv)) {
  if (vercel.env?.[key] !== value) {
    console.error(`Parâmetro público divergente no vercel.json: ${key}.`);
    process.exit(1);
  }
}

const serializedVercelConfig = JSON.stringify(vercel);
for (const forbiddenSecret of [
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PORTAL_SESSION_SECRET',
  'PORTAL_OTP_PEPPER',
  'PORTAL_SECRET_ENCRYPTION_KEY',
  'PORTAL_UPLOAD_BINDING_SECRET',
  'PORTAL_VERIFICATION_SECRET',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_STATE_SECRET',
  'ASTEN_WEBHOOK_SECRET',
  'ASTEN_API_KEY',
  'CRON_SECRET'
]) {
  if (serializedVercelConfig.includes(`"${forbiddenSecret}"`)) {
    console.error(`Segredo não deve ser versionado no vercel.json: ${forbiddenSecret}.`);
    process.exit(1);
  }
}

console.log(`Contrato institucional validado: ${institutionalMarkers.length} marcadores, Drive institucional, Vercel gru1 e configuração pública sem segredos.`);
