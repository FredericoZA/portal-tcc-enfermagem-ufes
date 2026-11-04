import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument, PDFName } from 'pdf-lib';
import { deflateSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { Worker } from 'node:worker_threads';
import { assertSafeUploadedDocument } from './fileSafety';
import { inspectPdfLayout } from '../workflow/documentQuality';

// Keep original worker failures visible in tests without exposing raw errors in the API.
const originalWorkerEmit=Worker.prototype.emit;
Worker.prototype.emit=function(event:string|symbol,...args:any[]){
  if(event==='error')console.error('[PDF fixture worker failure]',args[0]?.code,args[0]?.stack||args[0]);
  return originalWorkerEmit.call(this,event,...args);
};
test.after(()=>{Worker.prototype.emit=originalWorkerEmit;});

test('a análise rejeita expansão de stream de página que passa pela verificação estrutural', async () => {
  const document = await PDFDocument.create();
  const page = document.addPage([595,842]);
  const stream = document.context.flateStream(Buffer.alloc(9*1024*1024,32));
  page.node.set(PDFName.of('Contents'),document.context.register(stream));
  const bytes = Buffer.from(await document.save({useObjectStreams:false}));
  assert.ok(bytes.length < 12000);
  // This is an ordinary content stream, not the already-guarded ObjStm case.
  await assert.doesNotReject(assertSafeUploadedDocument(bytes,'PDF'));
  await assert.rejects(inspectPdfLayout(bytes),/analisar o PDF com segurança|expansão segura/);
  const ordinary = await PDFDocument.create(); ordinary.addPage().drawText('Documento normal após a rejeição');
  assert.ok((await inspectPdfLayout(Buffer.from(await ordinary.save()))).extractedCharacters > 20);
});

test('o limite de páginas interrompe a análise antes de decodificar o conteúdo excedente', async () => {
  const document = await PDFDocument.create();
  document.addPage().drawText('Página inicial');
  const page = document.addPage();
  page.node.set(PDFName.of('Contents'),document.context.register(document.context.flateStream(Buffer.alloc(9*1024*1024,32))));
  const report = await inspectPdfLayout(Buffer.from(await document.save()),{maximumPages:1});
  assert.equal(report.pages,2);
  assert.deepEqual(report.issues.map(issue=>issue.code),['PAGE_LIMIT']);
  assert.equal(report.extractedCharacters,0);
});

test('dimensões excessivas de imagem são recusadas antes da extração PDF.js', async () => {
  const document = await PDFDocument.create(); const page = document.addPage();
  const image = document.context.stream(Buffer.from([0]),{
    Type:'XObject',Subtype:'Image',Width:100000,Height:100000,ColorSpace:'DeviceGray',BitsPerComponent:8,
  });
  const ref = document.context.register(image);
  page.node.set(PDFName.of('Resources'),document.context.obj({XObject:{Image1:ref}}));
  await assert.rejects(inspectPdfLayout(Buffer.from(await document.save())),/imagem segura/);
});

test('o orçamento de expansão cobre cadeias de filtros e RunLength, mantendo cadeias comuns válidas', async () => {
  for (const encoding of ['hex-flate', 'run-length']) {
    const document = await PDFDocument.create(); const page = document.addPage();
    const contents = encoding === 'hex-flate'
      ? Buffer.from(deflateSync(Buffer.alloc(9*1024*1024,32)).toString('hex') + '>')
      : Buffer.concat([Buffer.from(Array.from({length:9*1024*1024/128},()=>[129,32]).flat()),Buffer.from([128])]);
    const stream = document.context.stream(contents,{Filter:encoding==='hex-flate'?['ASCIIHexDecode','FlateDecode']:'RunLengthDecode'});
    page.node.set(PDFName.of('Contents'),document.context.register(stream));
    const bytes=Buffer.from(await document.save({useObjectStreams:false}));
    await assert.rejects(inspectPdfLayout(bytes),/analisar o PDF com segurança|expansão segura/,encoding);
  }
  const document=await PDFDocument.create(); const page=document.addPage();
  page.drawText('Cadeia de filtros comum deve continuar funcionando');
  const original=page.node.Contents()!;
  const stream=document.context.lookup((original as any).get(0)) as any;
  const wrapped=document.context.stream(Buffer.from(Buffer.from(stream.getContents()).toString('hex')+'>'),{Filter:['ASCIIHexDecode','FlateDecode']});
  page.node.set(PDFName.of('Contents'),document.context.register(wrapped));
  assert.ok((await inspectPdfLayout(Buffer.from(await document.save({useObjectStreams:false})))).extractedCharacters>30);
});

test('os slots ficam reservados até a parada do worker e voltam a aceitar documentos', async () => {
  const document=await PDFDocument.create();document.addPage().drawText('Análise concorrente limitada');
  const bytes=Buffer.from(await document.save());
  const first=inspectPdfLayout(bytes),second=inspectPdfLayout(bytes);
  await assert.rejects(inspectPdfLayout(bytes),/ocupada/);
  await Promise.all([first,second]);
  assert.ok((await inspectPdfLayout(bytes)).extractedCharacters>10);
});

test('o bundle CJS isola flags do pai e preserva a causa de uma falha real do worker', async () => {
  const compiled=await build({entryPoints:['server/workflow/documentQuality.ts'],bundle:true,platform:'node',format:'cjs',target:'node22',packages:'external',write:false});
  const code=`
    const assert=require('node:assert/strict');
    const threads=require('node:worker_threads');const NativeWorker=threads.Worker;const emit=NativeWorker.prototype.emit;
    NativeWorker.prototype.emit=function(event,...args){if(event==='error')console.error(args[0]?.code,args[0]?.stack||args[0]);return emit.call(this,event,...args);};
    let failNextWorker=false;
    threads.Worker=class extends NativeWorker {
      constructor(source,options){
        if(failNextWorker){failNextWorker=false;source="throw Object.assign(new Error('internal fixture failure'),{code:'PDF_FIXTURE_WORKER_FAILURE'});";}
        super(source,options);
      }
    };
    const {Module}=require('node:module');
    const runtime=new Module(process.cwd()+'/pdf-layout-cjs-smoke.cjs');
    runtime.filename=runtime.id;runtime.paths=Module._nodeModulePaths(process.cwd());
    runtime._compile(${JSON.stringify(compiled.outputFiles[0].text)},runtime.filename);
    (async()=>{const {PDFDocument}=require('pdf-lib');const doc=await PDFDocument.create();doc.addPage().drawText('Documento compilado em CJS');
      const bytes=Buffer.from(await doc.save());
      const report=await runtime.exports.inspectPdfLayout(bytes);
      failNextWorker=true;
      await assert.rejects(runtime.exports.inspectPdfLayout(bytes),error=>{
        assert.equal(error.message,'O PDF excedeu os recursos de análise segura.');
        assert.equal(error.cause?.code,'PDF_FIXTURE_WORKER_FAILURE');
        assert.match(error.cause.stack,/internal fixture failure/);
        assert.equal(JSON.stringify(error),'{}');
        return true;
      });
      assert.ok((await runtime.exports.inspectPdfLayout(bytes)).extractedCharacters>15);
      console.log(JSON.stringify({pages:report.pages,characters:report.extractedCharacters}));
    })().catch(error=>{console.error(error.stack,error.cause?.code,error.cause?.stack);process.exitCode=1;});
  `;
  for(const parentMode of ['commonjs','module']) {
    const prefix=parentMode==='module'?"import {createRequire} from 'node:module';const require=createRequire(process.cwd()+'/pdf-layout-parent.mjs');":'';
    const child=spawnSync(process.execPath,['--input-type='+parentMode,'-e',prefix+code],{cwd:process.cwd(),encoding:'utf8',timeout:20000,maxBuffer:1024*1024});
    assert.equal(child.status,0,parentMode+': '+(child.stderr||String(child.error||'')));
    const result=JSON.parse(child.stdout.trim().split('\n').at(-1)!);
    assert.equal(result.pages,1);assert.ok(result.characters>15);
  }
});
