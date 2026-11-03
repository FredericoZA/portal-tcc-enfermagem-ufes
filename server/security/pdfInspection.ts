import { Worker } from 'node:worker_threads';

// Static worker source is bundled with the server; no uploaded text is executable.
// Keep the decoder guard isolated from the application's PDF renderers.
const source = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const { PDFDocument, PDFDict, PDFArray, PDFName, PDFRawStream } = require('pdf-lib');
const DecodeStream = require('pdf-lib/cjs/core/streams/DecodeStream').default;
const originalEnsureBuffer = DecodeStream.prototype.ensureBuffer;
let allocated = 0;
DecodeStream.prototype.ensureBuffer = function(requested) {
  if (!Number.isSafeInteger(requested) || requested < 0 || requested > 4 * 1024 * 1024) throw Error('O PDF excede o limite de expansão segura.');
  if (requested > this.buffer.byteLength) {
    let size = this.minBufferLength;
    if (!Number.isFinite(size) || size < 1 || size > 4 * 1024 * 1024) throw Error('O PDF excede o limite de expansão segura.');
    while (size < requested) size *= 2;
    allocated += size;
    if (allocated > 32 * 1024 * 1024) throw Error('O PDF excede o limite de expansão segura.');
  }
  return originalEnsureBuffer.call(this, requested);
};
(async () => {
  try {
    const document = await PDFDocument.load(workerData, { updateMetadata: false, throwOnInvalidObject: true });
    const pages = document.getPageCount();
    if (pages < 1 || pages > 10000) throw Error('O PDF possui quantidade de páginas inválida.');
    const objects = document.context.enumerateIndirectObjects();
    if (objects.length > 100000) throw Error('O PDF excede o limite de componentes internos.');
    const prohibited = new Set(['JavaScript', 'JS', 'Launch', 'EmbeddedFile', 'EmbeddedFiles', 'RichMedia', 'SubmitForm', 'ImportData', 'XFA']);
    const pending = objects.map(([, object]) => ({ object, depth: 0 }));
    const visited = new Set();
    let inspected = 0;
    while (pending.length) {
      const { object, depth } = pending.pop();
      if (visited.has(object)) continue;
      visited.add(object);
      if (++inspected > 500000 || depth > 64) throw Error('O PDF possui estrutura excessivamente complexa.');
      if (object instanceof PDFName && prohibited.has(object.decodeText())) throw Error('O PDF contém recurso ativo ou incorporado não permitido pelo Portal.');
      const add = child => pending.push({ object: child, depth: depth + 1 });
      if (object instanceof PDFDict) for (const [key, value] of object.entries()) { add(key); add(value); }
      else if (object instanceof PDFArray) for (const child of object.asArray()) add(child);
      else if (object instanceof PDFRawStream) add(object.dict);
    }
    parentPort.postMessage({ ok: true });
  } catch (error) {
    const message = error instanceof Error && /^O PDF (excede|possui|contém)/.test(error.message)
      ? error.message : 'O PDF está corrompido, protegido ou não pode ser verificado.';
    parentPort.postMessage({ ok: false, message });
  }
})();
`;

export function inspectPdfInWorker(bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(source, { eval: true, workerData: bytes,
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 4 } });
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      void worker.terminate();
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => finish(new Error('O PDF excedeu o tempo de verificação.')), 10_000);
    worker.once('message', result => finish(result?.ok === true ? undefined : new Error(result?.message || 'Não foi possível verificar o PDF.')));
    worker.once('error', () => finish(new Error('O PDF excedeu os recursos de verificação ou não pôde ser lido.')));
    worker.once('exit', () => { if (!finished) finish(new Error('A verificação do PDF foi interrompida.')); });
  });
}
