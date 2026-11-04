import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export interface PdfLayoutOptions {
  signatureReservePoints?: number;
  maximumPages?: number;
  needsSignature?: boolean;
}
export interface PdfQualityReport {
  pages: number;
  issues: Array<{page:number;code:string;severity:'ERROR'|'WARNING';message:string}>;
  extractedCharacters: number;
  requiresVisualReview: true;
}

// Only this static application source is evaluated. Uploaded bytes remain data.
const source = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
const { PDFDocument, PDFRawStream, PDFName, PDFArray, PDFDict } = require('pdf-lib');
const { decodePDFRawStream } = require('pdf-lib/cjs/core/streams/decode');
const DecodeStream = require('pdf-lib/cjs/core/streams/DecodeStream').default;
const originalEnsureBuffer = DecodeStream.prototype.ensureBuffer;
let allocated = 0;
DecodeStream.prototype.ensureBuffer = function(requested) {
  if (!Number.isSafeInteger(requested) || requested < 0 || requested > 8*1024*1024) throw Error('O PDF excede o limite de expansão segura.');
  if (requested > this.buffer.byteLength) {
    let size = this.minBufferLength;
    if (!Number.isFinite(size) || size < 1 || size > 8*1024*1024) throw Error('O PDF excede o limite de expansão segura.');
    while (size < requested) size *= 2;
    allocated += size;
    if (allocated > 32*1024*1024) throw Error('O PDF excede o limite de expansão segura.');
  }
  return originalEnsureBuffer.call(this, requested);
};
(async () => {
  let doc, task;
  try {
    const { bytes, options, pdfjsUrl } = workerData;
    const preliminary = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: true });
    const pages = preliminary.getPageCount();
    const report = { pages, issues: [], extractedCharacters: 0, requiresVisualReview: true };
    if (pages > options.maximumPages) {
      report.issues.push({page:0,code:'PAGE_LIMIT',severity:'ERROR',message:'O PDF excede o limite de páginas configurado.'});
      parentPort.postMessage({ok:true,report}); return;
    }
    let decodedBytes = 0, pixels = 0;
    const aliases = {Fl:'FlateDecode',LZW:'LZWDecode',A85:'ASCII85Decode',AHx:'ASCIIHexDecode',RL:'RunLengthDecode',DCT:'DCTDecode',CCF:'CCITTFaxDecode'};
    const lossless = new Set(['FlateDecode','LZWDecode','ASCII85Decode','ASCIIHexDecode','RunLengthDecode']);
    const imageCodecs = new Set(['DCTDecode','JPXDecode','CCITTFaxDecode','JBIG2Decode']);
    const objects = preliminary.context.enumerateIndirectObjects();
    if (objects.length > 100000) throw Error('O PDF excede o limite de componentes internos.');
    for (const [, object] of objects) {
      if (!(object instanceof PDFRawStream)) continue;
      const filter = object.dict.lookup(PDFName.of('Filter'));
      const filters = filter instanceof PDFArray ? Array.from({length:filter.size()},(_,index)=>filter.lookup(index,PDFName)) : filter ? [filter] : [];
      const names = filters.map(value => { if (!(value instanceof PDFName)) throw Error('Filtro inválido.'); const name=value.decodeText(); return aliases[name]||name; });
      const image = object.dict.lookup(PDFName.of('Subtype'))?.toString() === '/Image';
      const terminalImageCodec = image && imageCodecs.has(names[names.length-1]);
      const guardedNames = terminalImageCodec ? names.slice(0,-1) : names;
      if (guardedNames.some(name=>!lossless.has(name))) throw Error('Filtro não suportado pela análise segura.');
      const parameters=object.dict.lookup(PDFName.of('DecodeParms'));
      const parameterList=parameters instanceof PDFArray ? Array.from({length:parameters.size()},(_,index)=>parameters.lookup(index)) : [parameters];
      for (const parameter of parameterList) {
        if (!(parameter instanceof PDFDict)) continue;
        const number=(key,fallback)=>parameter.lookup(PDFName.of(key))?.asNumber?.()??fallback;
        const predictor=number('Predictor',1);
        if (predictor>1) {
          const columns=number('Columns',1),colors=number('Colors',1),bits=number('BitsPerComponent',8);
          if (![columns,colors,bits].every(value=>Number.isSafeInteger(value)&&value>0) || ![1,2,4,8,16].includes(bits) || Math.ceil(columns*colors*bits/8)>8*1024*1024) throw Error('O PDF excede o limite de expansão segura.');
        }
      }
      if (guardedNames.length || !terminalImageCodec) {
        // Apply every lossless decoder in order, including filters after ASCII85/Hex,
        // under the same bounded DecodeStream allocator. Resolve indirect filter names.
        const dictionary=object.dict.clone();
        if (guardedNames.length) dictionary.set(PDFName.of('Filter'),preliminary.context.obj(guardedNames.map(name=>PDFName.of(name))));
        else dictionary.delete(PDFName.of('Filter'));
        const decoded=decodePDFRawStream(PDFRawStream.of(dictionary,object.getContents())).decode();
        if (decoded.byteLength>8*1024*1024) throw Error('O PDF excede o limite de expansão segura.');
        decodedBytes += decoded.byteLength;
        if (decodedBytes > 32*1024*1024) throw Error('O PDF excede o limite de expansão segura.');
      }
      if (image) {
        const width = object.dict.lookup(PDFName.of('Width'))?.asNumber?.();
        const height = object.dict.lookup(PDFName.of('Height'))?.asNumber?.();
        if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width*height > 16000000) throw Error('O PDF excede o limite de imagem segura.');
        pixels += width*height;
        if (pixels > 32000000) throw Error('O PDF excede o limite de imagem segura.');
      }
    }
    const { getDocument } = await import(pdfjsUrl);
    task = getDocument({data:new Uint8Array(bytes),useSystemFonts:true,verbosity:0,isEvalSupported:false,maxImageSize:16000000,isImageDecoderSupported:false});
    doc = await task.promise;
    if (await doc.getJSActions()) report.issues.push({page:0,code:'ACTIVE_CONTENT',severity:'ERROR',message:'O PDF contém ações JavaScript. Remova o conteúdo ativo.'});
    let operationCount = 0;
    for (let number=1; number<=doc.numPages; number++) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      const items = content.items.filter(i => typeof i.str === 'string');
      const text = items.map(i => i.str).join(' ');
      report.extractedCharacters += text.trim().length;
      if (items.length > 100000 || report.extractedCharacters > 2000000) throw Error('O PDF excede o limite de texto seguro.');
      if (/<<[^<>]{1,100}>>|\{\{[^{}]{1,100}\}\}|\[\[[^\[\]]{1,100}\]\]|«[^«»]{1,100}»/.test(text)) report.issues.push({page:number,code:'UNRESOLVED_MARKER',severity:'ERROR',message:'Há um marcador sem preenchimento no PDF.'});
      const operators = await page.getOperatorList();
      operationCount += operators.fnArray.length;
      if (operationCount > 250000) throw Error('O PDF excede o limite de operações seguras.');
      if (!text.trim() && operators.fnArray.length < 6) report.issues.push({page:number,code:'EMPTY_PAGE',severity:'WARNING',message:'Página possivelmente vazia.'});
      else if (!text.trim()) report.issues.push({page:number,code:'NO_EXTRACTABLE_TEXT',severity:'WARNING',message:'Página sem texto extraível: confira se há imagem ou conteúdo vazio.'});
      let outOfBounds=false, lowest=Infinity;
      for (const item of items) {
        if (!item.str.trim()) continue;
        const [a,b,c,d,x,y]=item.transform, height=item.height||Math.hypot(c,d)||Math.hypot(a,b), width=item.width||0;
        if (Math.abs(b)<0.1 && Math.abs(c)<0.1) {
          if (x<page.view[0]-2 || x+width>page.view[2]+2 || y<page.view[1]-2 || y+height>page.view[3]+3) outOfBounds=true;
          lowest=Math.min(lowest,y-page.view[1]);
        }
      }
      if (outOfBounds) report.issues.push({page:number,code:'TEXT_OUTSIDE_PAGE',severity:'WARNING',message:'Há texto cuja caixa estimada ultrapassa a página. Confira possível corte.'});
      if (options.needsSignature && number===doc.numPages && lowest<(options.signatureReservePoints??90)) report.issues.push({page:number,code:'SIGNATURE_SPACE',severity:'WARNING',message:'O texto ocupa a reserva inferior configurada para assinaturas. Confira a composição final.'});
      page.cleanup();
    }
    parentPort.postMessage({ok:true,report});
  } catch (error) {
    const message = error instanceof Error && /^O PDF excede/.test(error.message) ? error.message : 'Não foi possível analisar o PDF com segurança.';
    parentPort.postMessage({ok:false,message});
  } finally {
    if (doc) await doc.destroy(); else if (task) await task.destroy();
  }
})();
`;

let activeInspections = 0;
export function inspectPdfLayoutInWorker(bytes: Buffer, options: PdfLayoutOptions = {}): Promise<PdfQualityReport> {
  if (!bytes.length || bytes.length > 24*1024*1024) return Promise.reject(new Error('PDF acima do limite de análise de 24 MB ou vazio.'));
  if (activeInspections >= 2) return Promise.reject(new Error('A análise de documentos está ocupada. Tente novamente.'));
  const maximumPages = Math.min(60, Math.max(1, Math.floor(options.maximumPages || 20)));
  const requireFromProject = createRequire(path.join(process.cwd(), 'package.json'));
  const pdfjsUrl = pathToFileURL(requireFromProject.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href;
  return new Promise((resolve,reject) => {
    // The static worker is CommonJS; parent loaders/module flags must not change it.
    // V8 flags set at process startup can still override resourceLimits, so the
    // explicit byte/pixel/operation budgets, deadline and slot cap remain required.
    const worker = new Worker(source, {eval:true,execArgv:[],workerData:{bytes,options:{...options,maximumPages},pdfjsUrl},resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16,stackSizeMb:4}});
    activeInspections++;
    let finished = false;
    const finish = (error?:Error, report?:PdfQualityReport) => {
      if (finished) return;
      finished=true; clearTimeout(timer);
      // Do not release the slot until the parser has actually stopped.
      void worker.terminate().finally(() => { activeInspections--; error ? reject(error) : resolve(report!); });
    };
    const timer = setTimeout(() => finish(new Error('O PDF excedeu o tempo de análise segura.')), 10000);
    worker.once('message', result => result?.ok === true ? finish(undefined,result.report) : finish(new Error(result?.message || 'Não foi possível analisar o PDF com segurança.')));
    worker.once('error', error => finish(new Error('O PDF excedeu os recursos de análise segura.',{cause:error})));
    worker.once('exit', () => { if (!finished) finish(new Error('A análise do PDF foi interrompida.')); });
  });
}
