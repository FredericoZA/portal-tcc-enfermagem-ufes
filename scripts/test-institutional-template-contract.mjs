import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const envUfes = readFileSync(new URL('../.env.ufes.example', import.meta.url), 'utf8');

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

if (!envUfes.includes('PORTAL_DRIVE_ROOT_FOLDER_ID="1zkG3fBm2tJESZjZP0_7jStUuPNXCwRPS"')) {
  console.error('A pasta raiz institucional do Drive não está fixada no perfil UFES.');
  process.exit(1);
}

console.log(`Contrato institucional validado: ${institutionalMarkers.length} marcadores + perfil Drive/Google.`);
