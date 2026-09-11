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
