import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertAstenEnvelopeSigners, buildAstenEnvelopeParams, parseAstenAccountAndRepository, extractAstenSignedPdf, extractAstenEnvelopeIdentity, callAsten } from './asten';
import { buildGoogleAuthorizationUrl, decodeGoogleOAuthState, getGoogleWorkspaceScopes } from './googleWorkspace';
import { buildSupabaseAdminHeaders } from './supabase';
import { buildProtocol, emailMatchesDomains } from '../../src/utils/installationProfile';
import { DEFAULT_INSTALLATION_PROFILE } from '../../src/constants/installation';
import { parseStudentImportFile } from '../../src/utils/studentImport';

test('contrato Asten mantém PDF confidencial, envio explícito e prioridade paralela', () => {
  process.env.ASTEN_WEBHOOK_SECRET='w'.repeat(40);
  process.env.ASTEN_CALLBACK_URL='https://portal.example/api/integrations/asten/webhook';
  process.env.PORTAL_PUBLIC_URL='https://portal.example';
  process.env.ASTEN_REQUIRE_CODE='false';
  process.env.ASTEN_AUTHENTICATION_OPTION='2';
  const contentBase64=Buffer.from('%PDF-1.4\nobj\n%%EOF','utf8').toString('base64');
  const payload=buildAstenEnvelopeParams({description:'TCC-2026-0001 — Termo',fileName:'termo.pdf',mimeType:'application/pdf',contentBase64,repositoryId:42,signers:[{name:'Aluno',email:'aluno@example.edu',order:1},{name:'Orientador',email:'orientador@example.edu',order:1}]});
  const envelope=payload.Envelope as any;
  assert.equal(payload.encaminharImediatamente,'N');
  assert.equal(envelope.confidencial,'S');
  assert.equal(envelope.usarOrdem,'S');
  assert.equal(envelope.listaSignatariosEnvelope.SignatarioEnvelope[0].ConfigAssinatura.exigirCodigo,'N');
  assert.deepEqual(envelope.listaSignatariosEnvelope.SignatarioEnvelope.map((item:any)=>item.ordem),[1,1]);
  assert.equal(envelope.listaSignatariosEnvelope.SignatarioEnvelope[0].ConfigAssinatura.permitirDelegar,'N');
  assert.equal(envelope.urlCallbackHeaderProp,'x-portal-webhook-key');
  assert.equal('tokenAPI' in envelope,false);
});

test('API Asten resolve Usuario.id e recusa repositório não autorizado',()=>{
  const identity={Usuario:{id:'3'}};
  const repos=[{id:'113',Usuario:{id:'3'},isProprietario:'S',compartilharCriacaoDocs:'S'}, {id:'44',Usuario:{id:'4'},isProprietario:'S'}];
  assert.deepEqual(parseAstenAccountAndRepository(identity,repos,undefined),{identifier:'3',repositoryId:113});
  assert.throws(()=>parseAstenAccountAndRepository(identity,repos,'44'),/não pertence/);
  assert.throws(()=>parseAstenAccountAndRepository({},repos,'113'),/Usuario.id/);
  assert.throws(()=>parseAstenAccountAndRepository(identity,[...repos,{id:'114',Usuario:{id:'3'},isProprietario:'S'}],undefined),/ASTEN_REPOSITORY_ID/);
});
test('Asten não encaminha documentos para ID de envelope inválido',()=>{
  assert.deepEqual(extractAstenEnvelopeIdentity({data:{idEnvelope:345}}),{id:'345'});
  assert.deepEqual(extractAstenEnvelopeIdentity({Envelope:{id:'4321'},hashSHA256:'h'}),{id:'4321',hash:'h'});
  for (const value of [0,-1,'',null,'sem-id','abc123','1; DROP', '0','9'.repeat(25)]) {
    assert.throws(()=>extractAstenEnvelopeIdentity({data:{idEnvelope:value}}),/ID numérico/);
  }
});

test('PDF Asten usa envelopeContent e recusa ZIP ou retorno genérico',()=>{
  const pdf=Buffer.concat([Buffer.from('%PDF-1.4\\n'),Buffer.alloc(130),Buffer.from('%%EOF')]);
  assert.deepEqual(extractAstenSignedPdf({envelopeContent:pdf.toString('base64'),mimeType:'application/pdf'}),pdf);
  assert.throws(()=>extractAstenSignedPdf({envelopeContent:Buffer.from('ZIP').toString('base64'),mimeType:'application/zip'}),/PDF/);
  assert.throws(()=>extractAstenSignedPdf({outraPropriedade:pdf.toString('base64')}),/envelopeContent/);
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

test('OAuth Google mantém returnTo restrito ao próprio portal', () => {
  process.env.NODE_ENV='development';
  process.env.GOOGLE_OAUTH_CLIENT_ID='client.apps.googleusercontent.com';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET='secret';
  process.env.GOOGLE_OAUTH_STATE_SECRET='s'.repeat(48);
  process.env.PORTAL_SECRET_ENCRYPTION_KEY='e'.repeat(48);
  process.env.APP_URL='https://portal.example';

  const external=new URL(buildGoogleAuthorizationUrl({email:'master@example.edu',returnTo:'https://attacker.invalid/roubo'}));
  assert.equal(decodeGoogleOAuthState(external.searchParams.get('state')!).returnTo,'/?google=connected');

  const protocolRelative=new URL(buildGoogleAuthorizationUrl({returnTo:'//attacker.invalid/roubo'}));
  assert.equal(decodeGoogleOAuthState(protocolRelative.searchParams.get('state')!).returnTo,'/?google=connected');

  const internal=new URL(buildGoogleAuthorizationUrl({returnTo:'/configuracoes?aba=integracoes'}));
  assert.equal(decodeGoogleOAuthState(internal.searchParams.get('state')!).returnTo,'/configuracoes?aba=integracoes');
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
  const genericApiRewrite=config.rewrites.find((rewrite:any)=>rewrite.source==='/api/(.*)');
  const replicationRewrite=config.rewrites.find((rewrite:any)=>rewrite.source==='/api/public/replication-models/:slug/download');
  assert.equal(genericApiRewrite?.destination,'/api/index');
  assert.equal(replicationRewrite?.destination,'/api/replication-model?slug=:slug');
  assert.ok(config.rewrites.indexOf(replicationRewrite)<config.rewrites.indexOf(genericApiRewrite));
  assert.equal(config.rewrites.at(-1).destination,'/index.html');
  assert.equal(config.outputDirectory,'dist/client');
  assert.equal(config.functions['api/index.ts'].maxDuration,300);
  assert.equal(config.functions['api/replication-model.ts'].maxDuration,60);
  assert.deepEqual(config.crons,[{path:'/api/cron/storage-cleanup',schedule:'17 3 * * *'},{path:'/api/cron/asten-reconcile',schedule:'23 4 * * *'}]);
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


test('Asten bloqueia mutações mas permite consultar envelopes sem habilitar envios', async () => {
  const savedFlag=process.env.ASTEN_INTEGRATION_ENABLED;
  const savedPilot=process.env.ASTEN_PILOT_APPROVED;
  const originalFetch=globalThis.fetch;
  const called:string[]=[];
  try{
    process.env.ASTEN_INTEGRATION_ENABLED='false';
    process.env.ASTEN_PILOT_APPROVED='false';
    globalThis.fetch=async (request)=>{
      const url=String(request);
      called.push(url);
      if(url.endsWith('/getIdentificador')){
        return new Response(JSON.stringify({response:{Usuario:{id:26}}}),{status:200,headers:{'content-type':'application/json'}});
      }
      return new Response(JSON.stringify({response:{status:2}}),{status:200,headers:{'content-type':'application/json'}});
    };
    const token='token-de-teste-exclusivamente-ficticio';
    const identity=await callAsten('getIdentificador',{},token);
    assert.equal(identity.Usuario.id,26);
    await callAsten('getRepositoriosDoUsuario',{idProprietario:26},token);
    await callAsten('getDadosEnvelope',{idEnvelope:11},token);
    await callAsten('getSignatariosPorEnvelope',{idEnvelope:11},token);
    await callAsten('downloadPDFEnvelopeDocs',{idEnvelope:11,incluirDocs:'N'},token);
    for(const service of ['inserirEnvelope','encaminharEnvelopeParaAssinaturas','reenviarLinksDeAssinatura','cancelarEnvelope'] as const){
      await assert.rejects(callAsten(service,{},token),/bloquead/i);
    }
    assert.equal(called.length,5,'As operações proibidas não devem alcançar a rede da Asten');
  }finally{
    globalThis.fetch=originalFetch;
    if(savedFlag===undefined)delete process.env.ASTEN_INTEGRATION_ENABLED;
    else process.env.ASTEN_INTEGRATION_ENABLED=savedFlag;
    if(savedPilot===undefined)delete process.env.ASTEN_PILOT_APPROVED;
    else process.env.ASTEN_PILOT_APPROVED=savedPilot;
  }
});
