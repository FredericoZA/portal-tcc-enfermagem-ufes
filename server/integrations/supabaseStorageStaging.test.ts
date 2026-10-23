import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStagingObjectPath,
  resolveSupabaseStorageSignedUrl,
  validateStagedUploadDescriptor
} from './supabaseStorageStaging';

const validSha = 'a'.repeat(64);

test('valida finalidade, MIME, extensão, tamanho e vínculo do staging', () => {
  assert.doesNotThrow(() => validateStagedUploadDescriptor({
    purpose: 'DOCUMENT_MODEL', requesterBinding: 'session:test', fileName: 'ata.docx',
    size: 1024, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sha256: validSha
  }));
  assert.throws(() => validateStagedUploadDescriptor({
    purpose: 'PROCESS_FULL_WORK', requesterBinding: 'session:test', fileName: 'tcc.pdf',
    size: 1024, mimeType: 'application/pdf', sha256: validSha
  }), /vinculado a um processo/i);
  assert.throws(() => validateStagedUploadDescriptor({
    purpose: 'VERIFICATION_PDF', requesterBinding: 'public:test', verificationCode: 'codigo', fileName: 'arquivo.docx',
    size: 1024, mimeType: 'application/pdf', sha256: validSha
  }), /extensão esperada/i);
});

test('objeto temporário não expõe e-mail, processo ou nome original', () => {
  const previous = process.env.PORTAL_UPLOAD_BINDING_SECRET;
  process.env.PORTAL_UPLOAD_BINDING_SECRET = 'segredo-exclusivo-de-teste-com-mais-de-32-caracteres';
  try {
    const path = buildStagingObjectPath({
      purpose: 'PROCESS_FULL_WORK', requesterBinding: 'session:aluno@ufes.br',
      processId: 'TCC-2026-0001', fileName: 'Nome completo do aluno.pdf'
    }, '00000000-0000-4000-8000-000000000001');
    assert.match(path, /^pending\/process_full_work\/[a-f0-9]{20}\/[a-f0-9]{20}\/00000000-0000-4000-8000-000000000001\.pdf$/);
    assert.doesNotMatch(path, /aluno|ufes|TCC-2026|Nome completo/i);
  } finally {
    if (previous === undefined) delete process.env.PORTAL_UPLOAD_BINDING_SECRET;
    else process.env.PORTAL_UPLOAD_BINDING_SECRET = previous;
  }
});

test('URL assinada permanece na origem e no caminho de Storage do Supabase', () => {
  const previous = process.env.SUPABASE_URL;
  process.env.SUPABASE_URL = 'https://projeto.supabase.co';
  try {
    const accepted = resolveSupabaseStorageSignedUrl('/storage/v1/object/sign/portal-secure-transfer/arquivo.pdf?token=teste', 'documento.pdf');
    const parsed = new URL(accepted);
    assert.equal(parsed.origin, 'https://projeto.supabase.co');
    assert.equal(parsed.searchParams.get('download'), 'documento.pdf');
    assert.throws(() => resolveSupabaseStorageSignedUrl('https://malicioso.example/storage/v1/object/sign/arquivo.pdf'), /fora da origem/i);
    assert.throws(() => resolveSupabaseStorageSignedUrl('https://projeto.supabase.co/auth/v1/authorize'), /fora da origem/i);
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous;
  }
});

test('quota é anterior à assinatura e identifica a mesma pessoa após renovar a sessão', async () => {
  const env={...process.env};const originalFetch=globalThis.fetch;
  Object.assign(process.env,{NODE_ENV:'test',PORTAL_PERSISTENCE_PROVIDER:'supabase',SUPABASE_URL:'https://quota-test.supabase.co',SUPABASE_SECRET_KEY:'dummy-test-secret',PORTAL_UPLOAD_BINDING_SECRET:'quota-test-binding-secret-longer-than-32-characters'});
  const rows:any[]=[];let signatures=0;
  globalThis.fetch=async(url,init)=>{
    if(String(url).includes('/bucket/'))return new Response(JSON.stringify({public:false,file_size_limit:110*1024*1024}),{status:200});
    if(String(url).includes('/portal_upload_staging')){rows.push(JSON.parse(String(init?.body)));return new Response('{}',{status:429});}
    signatures++;throw new Error('Nenhuma assinatura pode ser emitida após negar a reserva.');
  };
  try{
    const {createSupabaseStagedUpload,StagedUploadCapacityError}=await import('./supabaseStorageStaging');
    for(const issuedAt of [100,200])await assert.rejects(createSupabaseStagedUpload({purpose:'PROCESS_FULL_WORK',requesterBinding:`session:mesma-pessoa:${issuedAt}`,processId:'processo-oficial',fileName:'tcc.pdf',size:1024,mimeType:'application/pdf',sha256:validSha}),StagedUploadCapacityError);
    assert.equal(rows.length,2);assert.equal(rows[0].principal_hash,rows[1].principal_hash);assert.notEqual(rows[0].requester_hash,rows[1].requester_hash);assert.equal(signatures,0);
  }finally{globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
});

test('limpeza mantém reservas até expirar a URL do provedor, além do prazo do aplicativo', async () => {
  const env={...process.env};const originalFetch=globalThis.fetch;let requested='';const before=Date.now();
  Object.assign(process.env,{NODE_ENV:'test',PORTAL_PERSISTENCE_PROVIDER:'supabase',SUPABASE_URL:'https://quota-test.supabase.co',SUPABASE_SECRET_KEY:'dummy-test-secret',PORTAL_UPLOAD_BINDING_SECRET:'quota-test-binding-secret-longer-than-32-characters'});
  globalThis.fetch=async(url)=>{requested=String(url);return new Response('[]',{status:200});};
  try{
    const {cleanupExpiredStagedUploads}=await import('./supabaseStorageStaging');assert.equal(await cleanupExpiredStagedUploads(),0);
    const query=new URL(requested).searchParams;const cutoff=Date.parse(query.get('created_at')!.slice(3));
    assert.ok(cutoff<=Date.now()-134*60_000);assert.ok(cutoff>=before-136*60_000);assert.ok(query.has('expires_at'));
  }finally{globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
});

test('download sem cota não aloca objeto nem emite URL assinada', async () => {
  const env={...process.env};const originalFetch=globalThis.fetch;const requests:string[]=[];
  Object.assign(process.env,{NODE_ENV:'test',PORTAL_PERSISTENCE_PROVIDER:'supabase',SUPABASE_URL:'https://quota-test.supabase.co',SUPABASE_SECRET_KEY:'dummy-test-secret',PORTAL_UPLOAD_BINDING_SECRET:'quota-test-binding-secret-longer-than-32-characters'});
  globalThis.fetch=async(url)=>{requests.push(String(url));if(String(url).includes('/bucket/'))return new Response(JSON.stringify({public:false,file_size_limit:110*1024*1024}),{status:200});if(String(url).includes('/portal_download_transfers')&&String(url).includes('?'))return new Response('[]',{status:200});if(String(url).includes('/portal_download_transfers'))return new Response('{}',{status:429});throw new Error('Objeto não pode ser criado sem reserva.');};
  try{
    const {createSupabaseEphemeralDownload,StagedUploadCapacityError}=await import('./supabaseStorageStaging');
    await assert.rejects(createSupabaseEphemeralDownload({bytes:Buffer.from('%PDF-1.7\n'),fileName:'teste.pdf',mimeType:'application/pdf',requesterBinding:'public:visitante'}),StagedUploadCapacityError);
    assert.equal(requests.length,4);assert.ok(requests.every(url=>!url.includes('/object/')));assert.ok(requests[1].includes('/portal_download_transfers'));
  }finally{globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
});
