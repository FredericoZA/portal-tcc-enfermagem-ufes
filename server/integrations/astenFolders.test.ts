import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAstenFolders, getAstenDocumentFolders, saveAstenDocumentFolders, resolveAstenDocumentFolder, validateAstenDocumentFolder } from './astenFolders';
import { buildAstenEnvelopeParams } from './asten';
import { saveIntegrationSecret, loadIntegrationSecret, deleteIntegrationSecret } from './integrationSecrets';

const folder = (id: number, repositoryId = 42) => ({ id: String(id), nome: `Pasta ${id}`, Repositorio: { id: String(repositoryId), Usuario: { id: '3' } } });

test('pastas Asten exigem lista documentada, IDs seguros e o repositório esperado', () => {
  assert.deepEqual(parseAstenFolders({ response: [folder(11)] }, 42), [{ id: 11, name: 'Pasta 11' }]);
  assert.deepEqual(parseAstenFolders([], 42), []);
  for (const data of [null, {}, { response: {} }, { Pasta: [folder(11)] }, [folder(11), folder(11)], [folder(11, 43)], [{ ...folder(11), id: true }], [{ ...folder(11), id: '11e2' }], [{ ...folder(11), id: Number.MAX_SAFE_INTEGER + 1 }], [{ ...folder(11), nome: '\n' }], [{ ...folder(11), Repositorio: {} }]]) {
    assert.throws(() => parseAstenFolders(data, 42));
  }
});

test('destinos Asten são validados na conta e ficam vinculados à instalação sem expor o token', async (t) => {
  const keys = ['NODE_ENV', 'VERCEL', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PORTAL_ALLOW_LOCAL_SECRET_STORE', 'PORTAL_PUBLIC_URL', 'APP_URL'] as const;
  const previous = keys.map((key) => process.env[key]);
  const originalFetch = globalThis.fetch;
  let folders = [folder(11), folder(12), folder(13), folder(21), folder(22), folder(23)];
  let detailOwner = '3';
  const calls: Array<{ service: string; params: any }> = [];
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.VERCEL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.PORTAL_ALLOW_LOCAL_SECRET_STORE = 'true';
    process.env.PORTAL_PUBLIC_URL = 'https://portal.example';
    delete process.env.APP_URL;
    await saveIntegrationSecret('asten', 'token-ficticio-somente-para-teste', { repositoryId: 42, identifier: '3', validatedContractVersion: 2 });
    await deleteIntegrationSecret('asten_document_folders');
    globalThis.fetch = async (url, init) => {
      assert.match(String(url), /^https:\/\/plataforma\.astenassinatura\.com\.br\/api\//);
      const service = String(url).split('/').at(-1)!;
      const { params } = JSON.parse(String(init?.body));
      calls.push({ service, params });
      if (service === 'getPastasDoRepositorio') {
        assert.deepEqual(params, { idRepositorio: 42 });
        return Response.json({ response: folders });
      }
      assert.equal(service, 'getDadosPasta');
      const data = folders.find((item) => Number(item.id) === params.idPasta);
      return Response.json({ response: data ? { ...data, Repositorio: { id: '42', Usuario: { id: detailOwner } } } : {} });
    };

    await t.test('nenhum destino é escolhido por nome ou automaticamente', async () => {
      const status = await getAstenDocumentFolders();
      assert.equal(status.configured, false);
      assert.deepEqual(status.mapping, {});
      await assert.rejects(resolveAstenDocumentFolder('ATA'), /Selecione as pastas/);
    });
    await t.test('salva os três tipos após consultar existência e proprietário', async () => {
      const status = await saveAstenDocumentFolders({ ATA: 11, TERMO: 12, DECLARACAO: 13 });
      assert.equal(status.configured, true);
      assert.equal(JSON.stringify(status).includes('token-ficticio'), false);
      assert.equal(await resolveAstenDocumentFolder('ATA'), 11);
      const stored = await loadIntegrationSecret('asten_document_folders');
      assert.equal(stored!.metadata.portalOrigin, 'https://portal.example');
      assert.equal(stored!.metadata.identifier, '3');
      assert.equal(stored!.metadata.repositoryId, 42);
      assert.deepEqual(JSON.parse(stored!.value).mapping, { ATA: 11, TERMO: 12, DECLARACAO: 13 });
      assert.ok(calls.some((call) => call.service === 'getDadosPasta' && call.params.idPasta === 13));
    });
    await t.test('recusa tipos ausentes, destinos repetidos e pastas desconhecidas sem sobrescrever configuração', async () => {
      for (const value of [{ ATA: 11 }, { ATA: 11, TERMO: 11, DECLARACAO: 13 }, { ATA: 99, TERMO: 12, DECLARACAO: 13 }, { ATA: 11, TERMO: 12, DECLARACAO: 13, CONVITE: 21 }]) {
        await assert.rejects(saveAstenDocumentFolders(value));
      }
      assert.equal(await resolveAstenDocumentFolder('ATA'), 11);
    });
    await t.test('recusa pasta de outro proprietário mesmo com ID listado', async () => {
      detailOwner = '4';
      await assert.rejects(saveAstenDocumentFolders({ ATA: 11, TERMO: 12, DECLARACAO: 13 }), /proprietário/);
      await assert.rejects(validateAstenDocumentFolder(11, 42), /proprietário/);
      detailOwner = '3';
    });
    await t.test('mudar origem invalida a configuração e não devolve destinos antigos ao navegador', async () => {
      process.env.PORTAL_PUBLIC_URL = 'https://outra-instalacao.example';
      await assert.rejects(resolveAstenDocumentFolder('ATA'), /outra instalação/);
      const status = await getAstenDocumentFolders();
      assert.equal(status.configured, false);
      assert.deepEqual(status.mapping, {});
      process.env.PORTAL_PUBLIC_URL = 'https://portal.example';
    });
    await t.test('trocar conta invalida destinos do proprietário anterior', async () => {
      await saveIntegrationSecret('asten', 'token-ficticio-somente-para-teste', { repositoryId: 42, identifier: '4', validatedContractVersion: 2 });
      await assert.rejects(resolveAstenDocumentFolder('ATA'), /outra instalação, conta ou repositório/);
      await saveIntegrationSecret('asten', 'token-ficticio-somente-para-teste', { repositoryId: 42, identifier: '3', validatedContractVersion: 2 });
    });
    await t.test('pasta removida bloqueia novo envio e aparece como pendência', async () => {
      folders = folders.filter((item) => item.id !== '11');
      const status = await getAstenDocumentFolders();
      assert.equal(status.configured, false);
      assert.deepEqual(status.missingTypes, ['ATA']);
      await assert.rejects(resolveAstenDocumentFolder('ATA'), /não está mais disponível/);
      folders.push(folder(11));
    });
    await t.test('jobs existentes mantêm o destino válido anterior após nova seleção', async () => {
      await saveAstenDocumentFolders({ ATA: 21, TERMO: 22, DECLARACAO: 23 });
      assert.equal(await resolveAstenDocumentFolder('ATA'), 21);
      await assert.doesNotReject(validateAstenDocumentFolder(11, 42));
      await assert.rejects(validateAstenDocumentFolder(11, 43), /outro repositório/);
      await assert.rejects(validateAstenDocumentFolder(0, 42), /inválida/);
      await assert.rejects(resolveAstenDocumentFolder('CONVITE' as any), /sem destino/);
    });
  } finally {
    globalThis.fetch = originalFetch;
    await deleteIntegrationSecret('asten_document_folders');
    await deleteIntegrationSecret('asten');
    keys.forEach((key, i) => { if (previous[i] === undefined) delete process.env[key]; else process.env[key] = previous[i]; });
  }
});

test('envelope inclui somente a pasta válida explicitamente escolhida', () => {
  const values: Record<string, string> = { ASTEN_WEBHOOK_SECRET: 'w'.repeat(40), ASTEN_CALLBACK_URL: 'https://portal.example/api/integrations/asten/webhook', PORTAL_PUBLIC_URL: 'https://portal.example', ASTEN_REQUIRE_CODE: 'false', ASTEN_AUTHENTICATION_OPTION: '4' };
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    Object.assign(process.env, values);
    const input = { description: 'ATA de teste', fileName: 'ata.pdf', mimeType: 'application/pdf', contentBase64: Buffer.from('%PDF-1.4\n%%EOF').toString('base64'), repositoryId: 42, authenticationProfile: 'CONFIDENTIAL_SMS' as const, signers: [{ name: 'Orientador', email: 'orientador@example.edu', order: 1, cellphone: '11999999999' }] };
    assert.deepEqual(buildAstenEnvelopeParams({ ...input, folderId: 11 }).Envelope.Pasta, { id: 11 });
    assert.equal(Object.hasOwn(buildAstenEnvelopeParams(input).Envelope, 'Pasta'), false);
    for (const id of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => buildAstenEnvelopeParams({ ...input, folderId: id }), /pasta.*inválida/);
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
