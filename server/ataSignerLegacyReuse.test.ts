import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {assertCurrentSignatureRecipients,assertSignatureEligibility,assertDocumentSignatureOpen,deriveSignatureSigners,signatureJobMatchesCurrentRevision} from './workflow/signaturePolicy';
import {signatureDocumentRevision} from '../src/utils/documentSignatureState';
import {reusableAstenSignatureJob} from './workflow/signatureOrder';
import type {SignatureJob} from '../src/types/signatures';

test('existing Asten and Gov.br board-only jobs are reused before new-signature preflight, without upgrade or resend',async()=>{
  const server=readFileSync('server.ts','utf8'),start=server.indexOf('async function createSignatureJobUnlocked(');
  const body=server.slice(start,server.indexOf('\n}\n',start)+2);
  for(const provider of ['ASTEN','GOV_BR'] as const){
    const process=structuredClone(DEMO_PROCESSES[0]);process.avaliacao={status:'CONCLUIDO',documentRevision:4};
    const job={id:'historical-job',processId:process.id,documentType:'ATA',provider,status:'SENT',documentVersion:1,sourceDataRevision:4,signers:deriveSignatureSigners(process,'ATA',{},'BOARD_ONLY_LEGACY')} as SignatureJob;
    const jobs=[job],before=structuredClone(jobs);
    const ports={Error,signatureJobsStore:jobs,currentSettings:{},assertDocumentSignatureOpen,assertSignatureEligibility:(p:any,t:any)=>assertSignatureEligibility(p,t,jobs),signatureDocumentRevision,reusableAstenSignatureJob,signatureJobMatchesCurrentRevision,assertCurrentSignatureRecipients,getSupabaseRuntimeStatus:()=>assert.fail('Historical job must return before schema checks.'),renderOfficialTemplatePdf:()=>assert.fail('Historical job must not be rendered or sent again.')};
    // The wrapper in server normally supplies the job list to the eligibility/open gates.
    const create=runInNewContext(ts.transpileModule('('+body+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ports);
    assert.equal(await create(process,'ATA',process.orientador.email,{},provider),job);
    assert.deepEqual(jobs,before);assert.equal(job.ataSignerPolicy,undefined);
  }
});
