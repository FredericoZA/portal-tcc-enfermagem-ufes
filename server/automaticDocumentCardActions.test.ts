import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {automaticAstenDocumentStatus} from '../src/utils/signatureGuidance';

test('ata, termo e declaração nunca oferecem disparo manual ASTEN, inclusive antes de carregar a configuração',()=>{
 const source=readFileSync('src/pages/ProcessoDetailPage.tsx','utf8');
 const start=source.indexOf('                const usesAutomaticAsten ='),end=source.indexOf('                let status =',start);
 assert.ok(start>0&&end>start);
 const code=ts.transpileModule(`(function(){${source.slice(start,end)}return {canSendAsten,automaticStatus};})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 for(const type of ['ATA','TERMO','DECLARACAO'])for(const automaticAsten of [false,true]){
  const context={automaticAsten,doc:{type,status:'GERADO'},canRequestSignature:true,astenJob:undefined,process:{astenSignatureIntent:{documentType:type,revision:4},signatureProviderPreferences:{}},revision:4,readOnly:false,termDeclined:false,signatureOpen:true,automaticAstenDocumentStatus};
  const pending=runInNewContext(code,context);
  assert.equal(pending.canSendAsten,false,type);assert.match(pending.automaticStatus,/ASTEN - Preparando envio/);
  const sent=runInNewContext(code,{...context,astenJob:{status:'SENT',providerDispatchState:'SENT'}});
  assert.equal(sent.canSendAsten,false);assert.match(sent.automaticStatus,/E-mail enviado/);
  const unsigned=runInNewContext(code,{...context,astenJob:{status:'PROVIDER_ERROR'}});
  assert.doesNotMatch(unsigned.automaticStatus,/E-mail enviado/);
 }
 assert.match(source,/\{automaticStatus && !pendingSignature && <p role="status"/);
 assert.match(source,/\{canUseGovbr && <button[^>]+onClick=\{\(\)=>\{setGovbrDownloadOnly\(!canRequestSignature\);setGovbrDocument\(doc\);\}\}/);
});
