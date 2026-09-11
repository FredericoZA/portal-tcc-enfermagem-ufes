import assert from 'node:assert/strict';
import test from 'node:test';
import { upsertLivingIntelligenceFile } from './googleWorkspace';

test('arquivo vivo existente é atualizado no mesmo ID para preservar revisões', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method: string }> = [];
  globalThis.fetch = async (input, init?: RequestInit) => {
    const url = String(input);
    const method = String(init.method || 'GET');
    calls.push({ url, method });
    const decoded = decodeURIComponent(url).replace(/\+/g, ' ');
    if (url.includes('/permissions?')) return new Response(JSON.stringify({ permissions: [] }), { status: 200 });
    if (method === 'GET' && decoded.includes("name = '00_SISTEMA'")) return new Response(JSON.stringify({ files: [{ id: 'system-folder', name: '00_SISTEMA', mimeType: 'application/vnd.google-apps.folder' }] }), { status: 200 });
    if (method === 'GET' && decoded.includes("name = '01_INTELIGENCIA_CONTINUA'")) return new Response(JSON.stringify({ files: [{ id: 'intelligence-folder', name: '01_INTELIGENCIA_CONTINUA', mimeType: 'application/vnd.google-apps.folder' }] }), { status: 200 });
    if (method === 'GET' && decoded.includes("name = 'PANORAMA_ESTATISTICO_DOS_TCCS.md'")) return new Response(JSON.stringify({ files: [{ id: 'report-file', name: 'PANORAMA_ESTATISTICO_DOS_TCCS.md', mimeType: 'text/markdown', webViewLink: 'https://drive.google.com/file/d/report-file/view' }] }), { status: 200 });
    if (method === 'PATCH' && url.includes('/upload/drive/v3/files/report-file')) return new Response(JSON.stringify({ id: 'report-file', name: 'PANORAMA_ESTATISTICO_DOS_TCCS.md' }), { status: 200 });
    if (method === 'PATCH' && url.includes('/drive/v3/files/report-file?')) return new Response(JSON.stringify({ id: 'report-file', name: 'PANORAMA_ESTATISTICO_DOS_TCCS.md', webViewLink: 'https://drive.google.com/file/d/report-file/view' }), { status: 200 });
    return new Response(JSON.stringify({ error: { message: `Chamada inesperada: ${method} ${url}` } }), { status: 500 });
  };
  try {
    const result = await upsertLivingIntelligenceFile({ accessToken: 'token', rootFolderId: 'root-folder', fileName: 'PANORAMA_ESTATISTICO_DOS_TCCS.md', content: '# Relatório', kind: 'TCC_STATISTICAL_REPORT', sha256: 'a'.repeat(64), version: 2, generatedAt: '2026-09-08T00:00:00.000Z' });
    assert.equal(result.id, 'report-file');
    assert.equal(result.created, false);
    assert.equal(calls.filter((call) => call.method === 'POST').length, 0);
    assert.equal(calls.filter((call) => call.method === 'PATCH' && call.url.includes('/upload/')).length, 1);
  } finally { globalThis.fetch = originalFetch; }
});
