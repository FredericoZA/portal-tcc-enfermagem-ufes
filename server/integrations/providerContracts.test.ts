import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertAstenEnvelopeSigners, buildAstenEnvelopeParams } from './asten';
import { buildGoogleAuthorizationUrl, decodeGoogleOAuthState, getGoogleWorkspaceScopes } from './googleWorkspace';
import { buildSupabaseAdminHeaders } from './supabase';
import { buildProtocol, emailMatchesDomains } from '../../src/utils/installationProfile';
import { DEFAULT_INSTALLATION_PROFILE } from '../../src/constants/installation';
import { parseStudentImportFile } from '../../src/utils/studentImport';

test('contrato Asten mantém PDF confidencial, envio explícito e prioridade paralela', () => {
  process.env.ASTEN_WEBHOOK_SECRET='w'.repeat(40);
  process.env.ASTEN_CALLBACK_URL='https://portal.example/api/integrations/asten/callback';
  process.env.PORTAL_PUBLIC_URL='https://portal.example';
  process.env.ASTEN_REQUIRE_CODE='true';
  const contentBase64=Buffer.from('%PDF-1.4\nobj\n%%EOF','utf8').toString('base64');
  const payload=buildAstenEnvelopeParams({description:'TCC-2026-0001 — Termo',fileName:'termo.pdf',mimeType:'application/pdf',contentBase64,repositoryId:42,signers:[{name:'Aluno',email:'aluno@example.edu',order:1},{name:'Orientador',email:'orientador@example.edu',order:1}]});
  const envelope=payload.Envelope as any;
  assert.equal(payload.encaminharImediatamente,'N');
  assert.equal(envelope.confidencial,'S');
  assert.deepEqual(envelope.listaSignatariosEnvelope.SignatarioEnvelope.map((item:any)=>item.ordem),[1,1]);
  assert.equal(envelope.listaSignatariosEnvelope.SignatarioEnvelope[0].ConfigAssinatura.permitirDelegar,'N');
  assert.equal(envelope.urlCallbackHeaderProp,'x-portal-webhook-key');
  assert.equal('tokenAPI' in envelope,false);
});

test('PDF Asten só é aceito com signatários e ordens exatamente confirmados', () => {
  const response={listaSignatariosEnvelope:{SignatarioEnvelope:[
    {ordem:1,statusAssinatura:'Assinado',ConfigAssinatura:{emailSignatario:'aluno@example.edu'}},
    {ordem:1,dataAssinatura:'2026-09-07T12:00:00Z',ConfigAssinatura:{emailSignatario:'orientador@example.edu'}}
  ]}};
  const expected=[{email:'aluno@example.edu',order:1},{email:'orientador@example.edu',order:1}];
  assert.doesNotThrow(()=>assertAstenEnvelopeSigners(response,expected));
  assert.throws(()=>assertAstenEnvelopeSigners(response,[...expected,{email:'intruso@example.edu',order:1}]),/divergem/);
  assert.throws(()=>assertAstenEnvelopeSigners({listaSignatariosEnvelope:{SignatarioEnvelope:[{ordem:1,statusAssinatura:'Pendente',ConfigAssinatura:{emailSignatario:'aluno@example.edu'}}]}},[{email:'aluno@example.edu',order:1}]),/ainda não confirma/);
});

test('estado OAuth Google rejeita adulteração e limita o retorno ao portal', () => {
  process.env.GOOGLE_OAUTH_CLIENT_ID='client.apps.googleusercontent.com';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET='secret';
  process.env.GOOGLE_OAUTH_STATE_SECRET='s'.repeat(48);
  process.env.PORTAL_SECRET_ENCRYPTION_KEY='e'.repeat(48);
  process.env.APP_URL='https://portal.example';
  const url=new URL(buildGoogleAuthorizationUrl({email:'master@example.edu',returnTo:'/?google=connected'}));
  const state=url.searchParams.get('state')!;
  assert.equal(decodeGoogleOAuthState(state).email,'master@example.edu');
  const [body,signature]=state.split('.');
  const replacement=body.startsWith('a')?'b':'a';
  assert.throws(()=>decodeGoogleOAuthState(`${replacement}${body.slice(1)}.${signature}`),/adulterado|inválido/i);
  assert.match(url.searchParams.get('scope')||'',/gmail\.send/);
  assert.match(url.searchParams.get('scope')||'',/drive\.file/);
});

test('acesso a modelos preexistentes do Drive exige opção administrativa explícita', () => {
  delete process.env.GOOGLE_ALLOW_EXISTING_MODEL_LINKS;
  assert.equal(getGoogleWorkspaceScopes().includes('https://www.googleapis.com/auth/drive.readonly'),false);
  process.env.GOOGLE_ALLOW_EXISTING_MODEL_LINKS='true';
  assert.equal(getGoogleWorkspaceScopes().includes('https://www.googleapis.com/auth/drive.readonly'),true);
  delete process.env.GOOGLE_ALLOW_EXISTING_MODEL_LINKS;
});

test('chave moderna do Supabase nunca é enviada como Bearer', () => {
  process.env.SUPABASE_SECRET_KEY='sb_secret_contract_test';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const modern=buildSupabaseAdminHeaders();
  assert.equal(modern.apikey,'sb_secret_contract_test');
  assert.equal(modern.Authorization,undefined);
  delete process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY='legacy.jwt.value';
  const legacy=buildSupabaseAdminHeaders();
  assert.equal(legacy.Authorization,'Bearer legacy.jwt.value');
});

test('instalação por curso controla protocolo e domínios sem alterar o código', () => {
  const profile={...DEFAULT_INSTALLATION_PROFILE,protocolPrefix:'MED',studentEmailDomains:['alunos.universidade.br']};
  assert.equal(buildProtocol(profile,2027,9),'MED-2027-0009');
  assert.equal(emailMatchesDomains('ana@alunos.universidade.br',profile.studentEmailDomains),true);
  assert.equal(emailMatchesDomains('ana@externo.test',profile.studentEmailDomains),false);
});

test('importação CSV aceita ponto e vírgula, acentos e matrícula', async () => {
  const file=new File(['\uFEFFnome;email;matrícula\nAna Silva;ANA@ALUNOS.UNIVERSIDADE.BR;20270001\n'],'alunos.csv',{type:'text/csv'});
  const rows=await parseStudentImportFile(file);
  assert.deepEqual(rows,[{row:2,nome:'Ana Silva',email:'ana@alunos.universidade.br',matricula:'20270001'}]);
});

test('contrato Vercel encaminha API ao handler e SPA ao build estático', () => {
  const config=JSON.parse(readFileSync(new URL('../../vercel.json',import.meta.url),'utf8'));
  const packageJson=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8'));
  const viteConfig=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
  const serverSource=readFileSync(new URL('../../server.ts',import.meta.url),'utf8');
  assert.equal(config.rewrites[0].source,'/api/(.*)');
  assert.equal(config.rewrites[0].destination,'/api/index');
  assert.equal(config.rewrites.at(-1).destination,'/index.html');
  assert.equal(config.outputDirectory,'dist/client');
  assert.equal(config.functions['api/index.ts'].maxDuration,300);
  assert.deepEqual(config.crons,[{path:'/api/cron/storage-cleanup',schedule:'17 3 * * *'}]);
  assert.match(packageJson.scripts.build,/--outfile=dist\/server\/server\.cjs/);
  assert.doesNotMatch(packageJson.scripts.build,/--sourcemap/);
  assert.match(viteConfig,/outDir:\s*'dist\/client'/);
  assert.match(serverSource,/dotenv\.config\(\{path:'\.env\.local',override:false,quiet:true\}\)/);
  assert.match(serverSource,/path\.join\(process\.cwd\(\), 'dist', 'client'\)/);
});

test('outbox Asten bloqueia recriação após resultado ambíguo', () => {
  const migration=readFileSync(new URL('../../supabase/migrations/202609060001_asten_transactional_outbox_v6.sql',import.meta.url),'utf8');
  assert.match(migration,/portal_asten_dispatch_claims/);
  assert.match(migration,/for update/i);
  assert.match(migration,/CLAIM_EXPIRED_WITHOUT_CONFIRMATION/);
  assert.match(migration,/return jsonb_build_object\('outcome','UNCERTAIN'\)/);
  assert.match(migration,/asten_transactional_outbox', true/);
  assert.match(migration,/force row level security/i);
});
