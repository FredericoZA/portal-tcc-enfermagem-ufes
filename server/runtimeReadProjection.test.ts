import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeReadProjection } from './runtimeReadProjection';

test('public repository and legacy references retain the historical catalog', () => {
  for (const path of [
    '/public/repository',
    '/account-view/accounts',
    '/processes/proc-1/publication-choice',
    '/processes/proc-1/files/trabalho-completo/download',
    '/processes/legado-0001/files/resumo-expandido/download',
    '/public/processes/TCC%20-%2000001',
    '/public/processes/legacy-108',
    '/legacy-academic-records',
    '/legacy-academic-records/legacy-108/files/0/download',
    '/legacy-academic-records/legado-0001/evaluation-documents',
    '/legacy-academic-records/legado-0001/evaluation-documents/1/download',
    '/admin/legacy-academic-records/legado-0001/evaluation-participants',
    '/public/indicators',
  ]) {
    assert.equal(runtimeReadProjection('GET', path), 'LITE', path);
  }
});

test('current document reads retain consent, signatures, revisions and ACL state without audit or legacy history', () => {
  for (const path of [
    '/forms/registration-suggestions',
    '/processes/proc-1',
    '/processes/proc-1/data-review/schema',
    '/table-preferences/repository',
    '/public/processes/proc-1/reservation-receipts',
    '/public/processes/proc-1/reservation-receipt',
    '/public/processes/proc-1/documents/doc-ata/download',
    '/public/processes/proc-1/files/trabalho-completo/download',
    '/public/processes/proc-1/files/resumo-expandido/download',
  ]) {
    assert.equal(runtimeReadProjection('GET', path), 'LEAN', path);
  }
});

test('every mutation and unreviewed endpoint still requires canonical hydration', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) {
    for (const path of [
      '/public/repository',
      '/processes/proc-1',
      '/processes/proc-1/signatures',
      '/coordinator/signature-queue',
      '/signatures/jobs',
        '/public/processes/proc-1/files/trabalho-completo/download',
    ]) {
      assert.equal(
        runtimeReadProjection(method, path),
        'FULL',
        `${method} ${path}`,
      );
    }
  }
  for (const path of [
    '/audit-logs',
    '/audit-logs/export',
    '/processes/proc-1/audit-logs',
    '/processes/proc-1/export',
    '/processes/proc-1/signatures/extra',
    '/integrations/asten/webhook',
    '/public/processes/proc-1/files/unknown/download',
    '/public/processes/proc-1/documents/doc-ata/download/extra',
    '/unknown',
    '/public/processes/',
    '/public/processes/proc-1?hidden=1',
  ]) {
    assert.equal(runtimeReadProjection('GET', path), 'FULL', path);
  }
});

test('signature status reads use the reviewed signature projection only',()=>{
  for(const path of ['/processes/proc-1/signatures','/coordinator/signature-queue','/president/signature-queue','/signatures/jobs'])
    assert.equal(runtimeReadProjection('GET',path),'SIGNATURES',path);
  for(const path of ['/processes/proc-1/detail','/processes/proc-1/signatures/extra','/signatures/jobs/export'])
    assert.equal(runtimeReadProjection('GET',path),'FULL',path);
});
