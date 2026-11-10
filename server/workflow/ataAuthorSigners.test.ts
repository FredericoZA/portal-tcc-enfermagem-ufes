import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import type {SignatureJob} from '../../src/types/signatures';
import {deriveSignatureSigners,assertCurrentSignatureRecipients,canInitiateSignature,canReturnGovbrDocument} from './signaturePolicy';
import {currentAtaArchived} from '../../src/utils/documentSignatureState';
import {assertAstenEnvelopeSigners} from '../integrations/asten';

const fixture=()=>{
  const process=structuredClone(DEMO_PROCESSES[0]);
  process.avaliacao={status:'CONCLUIDO',documentRevision:4,coadvisorPresent:false};
  return process;
};
test('new minutes require each author and only an explicitly attending coadvisor, between four and six distinct people',()=>{
  for(const second of [false,true])for(const coadvisorPresent of [false,true]){
    const process=fixture();process.aluno2=second?{...process.aluno1,nome:'Segundo Autor',email:'second@example.invalid'}:null;
    process.avaliacao.coadvisorPresent=coadvisorPresent;
    const signers=deriveSignatureSigners(process,'ATA',{});
    assert.equal(signers.length,4+Number(second)+Number(coadvisorPresent));
    assert.equal(signers.filter(s=>s.role==='STUDENT').length,second?2:1);
    assert.equal(signers.filter(s=>s.role==='CO_ADVISOR').length,coadvisorPresent?1:0);
    assert.ok(signers.every(s=>s.signingOrder===1));
    const job={processId:process.id,documentType:'ATA',ataSignerPolicy:'BOARD_AUTHORS_V1',sourceDataRevision:4,status:'ARCHIVED',driveSignedFileId:'confirmed-file',signers:signers.map(s=>({...s,status:'SIGNED'}))} as SignatureJob;
    assert.equal(currentAtaArchived(process,[job]),true);
    assert.equal(currentAtaArchived(process,[{...job,signers:job.signers.slice(0,-1)}]),false);
    assert.equal(currentAtaArchived(process,[{...job,signers:job.signers.map((s,i)=>i===job.signers.length-1?{...s,status:'WAITING'}:s)}]),false);
    assert.doesNotThrow(()=>assertCurrentSignatureRecipients(process,'ATA',job,{}));
    for(const signer of signers.filter(s=>['STUDENT','CO_ADVISOR','EXAMINER'].includes(s.role))){
      assert.equal(canInitiateSignature(signer.email,process,'ATA',{}),false);
      assert.equal(canReturnGovbrDocument(signer.email,process,'ATA',{}),false);
    }
    const evidence=signers.map(s=>({ordem:1,statusAssinatura:'Assinado',ConfigAssinatura:{emailSignatario:s.email}}));
    assert.equal(assertAstenEnvelopeSigners({listaSignatariosEnvelope:{SignatarioEnvelope:evidence}},signers.map(s=>({email:s.email,order:1}))).length,signers.length);
    assert.throws(()=>assertAstenEnvelopeSigners({listaSignatariosEnvelope:{SignatarioEnvelope:evidence.slice(0,-1)}},signers.map(s=>({email:s.email,order:1}))),/divergem/);
  }
});
test('coadvisor registration is not attendance and an absent coadvisor never becomes a signer',()=>{
  const process=fixture();delete process.avaliacao.coadvisorPresent;
  assert.throws(()=>deriveSignatureSigners(process,'ATA',{}),/Confirme se o coorientador participou/);
  process.avaliacao.coadvisorPresent=false;assert.equal(deriveSignatureSigners(process,'ATA',{}).some(s=>s.role==='CO_ADVISOR'),false);
  process.avaliacao.coadvisorPresent=true;process.coorientador!.email=process.aluno1.email;
  assert.throws(()=>deriveSignatureSigners(process,'ATA',{}),/e-mails distintos/);
});
test('historical three-person envelopes remain unchanged and valid instead of being silently upgraded',()=>{
  const process=fixture();delete process.avaliacao.coadvisorPresent;
  const signers=deriveSignatureSigners(process,'ATA',{},'BOARD_ONLY_LEGACY');
  const job={processId:process.id,documentType:'ATA',sourceDataRevision:4,status:'ARCHIVED',driveSignedFileId:'historical-file',signers:signers.map(s=>({...s,status:'SIGNED'}))} as SignatureJob;
  const before=structuredClone(job);
  assert.doesNotThrow(()=>assertCurrentSignatureRecipients(process,'ATA',job,{}));assert.equal(currentAtaArchived(process,[job]),true);
  assert.deepEqual(job,before);assert.equal(job.signers.length,3);assert.equal(job.ataSignerPolicy,undefined);
  assert.equal(currentAtaArchived(process,[{...job,ataSignerPolicy:'BOARD_AUTHORS_V1'}]),false);
});

test('minutes without historical documentRevision still honor latest-version selection and the new roster',()=>{
  const process=fixture();delete process.avaliacao.documentRevision;
  const signers=deriveSignatureSigners(process,'ATA',{}).map(s=>({...s,status:'SIGNED' as const}));
  const job={processId:process.id,documentType:'ATA',documentVersion:2,sourceDataRevision:4,status:'ARCHIVED',driveSignedFileId:'new-file',ataSignerPolicy:'BOARD_AUTHORS_V1',signers} as SignatureJob;
  assert.equal(currentAtaArchived(process,[job]),true);
  const legacy={...job,ataSignerPolicy:undefined,documentVersion:1,sourceDataRevision:3,signers:signers.slice(0,3)} as SignatureJob;
  assert.equal(currentAtaArchived(process,[legacy,{...job,status:'SENT',driveSignedFileId:undefined}]),false);
});
