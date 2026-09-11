import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGoogleDocsReplacementRequests,
  extractGoogleDriveFileId,
  findUnresolvedTemplateMarkers,
  renderGoogleDriveTemplateToPdf
} from './googleDocsRenderer';

const jsonResponse = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

test('extrai IDs de links Google Docs, Drive e ID puro', () => {
  assert.equal(extractGoogleDriveFileId('https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit'), '1AbCdEfGhIjKlMnOp');
  assert.equal(extractGoogleDriveFileId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view'), '1AbCdEfGhIjKlMnOp');
  assert.equal(extractGoogleDriveFileId('1AbCdEfGhIjKlMnOp'), '1AbCdEfGhIjKlMnOp');
  assert.throws(() => extractGoogleDriveFileId('https://example.com/modelo.docx'), /inválido/i);
});

test('gera substituições somente para marcadores explícitos e inclui todas as abas', () => {
  const requests = buildGoogleDocsReplacementRequests({ NOME_ALUNO: 'Ana', VAZIO: null }, ['t.0', 't.1']);
  assert.equal(requests.length, 10);
  assert.deepEqual(requests[0].replaceAllText.tabsCriteria, { tabIds: ['t.0', 't.1'] });
  assert.equal(requests[0].replaceAllText.containsText.text, '<<NOME_ALUNO>>');
  assert.equal(requests[4].replaceAllText.containsText.text, '-NOME_ALUNO-');
  assert.equal(requests[5].replaceAllText.replaceText, '');
  assert.throws(() => buildGoogleDocsReplacementRequests({ '<marcador><invalido>': 'x' }), /Variável de modelo inválida/);
});

test('detecta marcadores restantes sem confundir títulos comuns', () => {
  const document = { body: { content: [
    { paragraph: { elements: [{ textRun: { content: 'ATA DE DEFESA — <<CAMPO_DESCONHECIDO>>' } }] } },
    { paragraph: { elements: [{ textRun: { content: 'Parecer: -CAMPO_11-' } }] } }
  ] } };
  assert.deepEqual(findUnresolvedTemplateMarkers(document), ['<<CAMPO_DESCONHECIDO>>', '-CAMPO_11-']);
  assert.deepEqual(findUnresolvedTemplateMarkers({ body: { content: [{ textRun: { content: 'ATA DE DEFESA' } }] } }), []);
});

test('copia Google Doc nativo, mescla, exporta PDF e remove temporário', async () => {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const fetchImpl = (async (resource: URL | RequestInfo, init: RequestInit = {}) => {
    const url = String(resource);
    const method = String(init.method || 'GET');
    calls.push({ url, method, body: typeof init.body === 'string' ? init.body : undefined });
    if (url.includes('/files/1AbCdEfGhIjKlMnOp?fields=')) return jsonResponse({ id: '1AbCdEfGhIjKlMnOp', name: 'Ata.docx', mimeType: 'application/vnd.google-apps.document', capabilities: { canCopy: true } });
    if (url.includes('/copy?')) return jsonResponse({ id: 'tmpGoogleDoc12345' });
    if (url.includes('/documents/tmpGoogleDoc12345?')) return jsonResponse({ documentId: 'tmpGoogleDoc12345', revisionId: 'rev-1', tabs: [{ tabProperties: { tabId: 't.0' } }] });
    if (url.endsWith('/documents/tmpGoogleDoc12345:batchUpdate')) return jsonResponse({ documentId: 'tmpGoogleDoc12345', replies: [{ replaceAllText: { occurrencesChanged: 1 } }] });
    if (url.includes('/export?')) return new Response(Buffer.from('%PDF-1.4\nportal'));
    if (url.includes('/files/tmpGoogleDoc12345?supportsAllDrives=true') && method === 'DELETE') return new Response(null, { status: 204 });
    throw new Error(`Chamada inesperada: ${method} ${url}`);
  }) as typeof fetch;

  const result = await renderGoogleDriveTemplateToPdf({
    accessToken: 'token-for-test-only',
    templateUrlOrId: '1AbCdEfGhIjKlMnOp',
    replacements: { NOME_ALUNO: 'Ana Souza' },
    outputName: 'TCC-2026-0001__ANA__ATA.pdf',
    fetchImpl
  });

  assert.ok(result.pdf.subarray(0, 5).equals(Buffer.from('%PDF-')));
  assert.equal(result.fileName, 'TCC-2026-0001__ANA__ATA.pdf');
  assert.equal(result.convertedFromDocx, false);
  assert.equal(result.replacementsChanged, 1);
  assert.equal(calls.filter(call => call.url.includes('/copy?')).length, 1);
  assert.equal(calls.filter(call => call.method === 'DELETE').length, 1);
  assert.equal(calls.filter(call => call.url.includes('/files/1AbCdEfGhIjKlMnOp?') && ['PATCH', 'DELETE'].includes(call.method)).length, 0);
});

test('converte DOCX em Google Doc temporário antes da exportação', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fetchImpl = (async (resource: URL | RequestInfo, init: RequestInit = {}) => {
    const url = String(resource);
    const method = String(init.method || 'GET');
    calls.push({ url, method });
    if (url.includes('/files/1DocxTemplate2345?fields=')) return jsonResponse({ id: '1DocxTemplate2345', name: 'Termo.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', capabilities: { canCopy: true, canDownload: true } });
    if (url.includes('/files/1DocxTemplate2345?alt=media')) return new Response(Buffer.from('PK\u0003\u0004mock-docx'));
    if (url.includes('/upload/drive/v3/files?uploadType=multipart')) return jsonResponse({ id: 'tmpConvertedDoc123' });
    if (url.includes('/documents/tmpConvertedDoc123?')) return jsonResponse({ documentId: 'tmpConvertedDoc123', revisionId: 'rev-docx' });
    if (url.includes('/export?')) return new Response(Buffer.from('%PDF-1.4\nconverted'));
    if (url.includes('/files/tmpConvertedDoc123?supportsAllDrives=true') && method === 'DELETE') return new Response(null, { status: 204 });
    throw new Error(`Chamada inesperada: ${method} ${url}`);
  }) as typeof fetch;

  const result = await renderGoogleDriveTemplateToPdf({
    accessToken: 'token-for-test-only',
    templateUrlOrId: '1DocxTemplate2345',
    replacements: {},
    fetchImpl
  });
  assert.equal(result.convertedFromDocx, true);
  assert.equal(result.fileName, 'Termo.pdf');
  assert.equal(calls.some(call => call.url.includes('/upload/drive/v3/files?uploadType=multipart')), true);
  assert.equal(calls.filter(call => call.method === 'DELETE').length, 1);
});
