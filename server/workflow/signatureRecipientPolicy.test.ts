import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import {deriveSignatureSigners,captureSignaturePolicySnapshot,assertCurrentSignatureRecipients,signatureSignersFromSnapshot} from './signaturePolicy';
import {currentAtaArchived} from '../../src/utils/documentSignatureState';
import {getSignatureRecipientRoles,validateSignatureRecipientRoles} from '../../src/utils/signatureRecipientRoles';
import {assertAstenEnvelopeSigners,buildAstenEnvelopeParams} from '../integrations/asten';
const president={commissionPresidentName:'Presidência',commissionPresidentEmail:'president@example.invalid'};
const process=()=>{const p=structuredClone(DEMO_PROCESSES[0]);p.avaliacao.coadvisorPresent=false;p.avaliacao.status='CONCLUIDO';p.avaliacao.documentRevision=4;return p;};
const configured=(type:string,roles:string[])=>({...president,integrationStudio:{revision:8,docTemplates:[{id:`tmpl-${type.toLowerCase()}`,type,signatureRecipientRoles:roles}]} as any});
test('UI id-only document defaults and mandatory academic roles remain compatible',()=>{
 assert.deepEqual(getSignatureRecipientRoles({id:'tmpl-ata'}),['ADVISOR','EXAMINERS','AUTHORS','COADVISOR_PRESENT']);
 assert.throws(()=>validateSignatureRecipientRoles({type:'TERMO',signatureRecipientRoles:['AUTHORS']}));
 assert.throws(()=>validateSignatureRecipientRoles({type:'DECLARACAO',signatureRecipientRoles:['RESERVATION_RESPONSIBLE']}));
});
test('new versions derive additional registered roles and Asten payload contains exactly that set',async t=>{
 const env={ASTEN_WEBHOOK_SECRET:'w'.repeat(40),ASTEN_CALLBACK_URL:'https://portal.example/api/integrations/asten/webhook',PORTAL_PUBLIC_URL:'https://portal.example',ASTEN_REQUIRE_CODE:'false',ASTEN_AUTHENTICATION_OPTION:'0',ASTEN_SIGNING_PROFILE:'EMAIL_LINK',ASTEN_REQUIRE_LOGIN:'false'};
 for(const [key,value]of Object.entries(env)){const prior=globalThis.process.env[key];globalThis.process.env[key]=value;t.after(()=>{if(prior===undefined)delete globalThis.process.env[key];else globalThis.process.env[key]=prior;});}
 const p=process(),settings=configured('TERMO',['AUTHORS','ADVISOR','EXAMINERS','COMMISSION_PRESIDENT']);
 const signers=deriveSignatureSigners(p,'TERMO',settings);assert.equal(signers.length,5);assert.ok(signers.some(s=>s.role==='PRESIDENT'));
 const params=buildAstenEnvelopeParams({description:'Termo',fileName:'termo.pdf',mimeType:'application/pdf',contentBase64:Buffer.from('%PDF-1.4\n%%EOF').toString('base64'),signers:signers.map(s=>({name:s.name,email:s.email,order:s.signingOrder})),repositoryId:1,authenticationProfile:'EMAIL_LINK'});
 const outbound=(params.Envelope as any).listaSignatariosEnvelope.SignatarioEnvelope;assert.deepEqual(outbound.map((item:any)=>item.ConfigAssinatura.emailSignatario),signers.map(s=>s.email));
 const proof={listaSignatariosEnvelope:{SignatarioEnvelope:signers.map(s=>({ordem:1,statusAssinatura:'Assinado',ConfigAssinatura:{emailSignatario:s.email}}))}};
 assert.equal(assertAstenEnvelopeSigners(proof,signers.map(s=>({email:s.email,order:s.signingOrder}))).length,5);
 proof.listaSignatariosEnvelope.SignatarioEnvelope.pop();assert.throws(()=>assertAstenEnvelopeSigners(proof,signers.map(s=>({email:s.email,order:1}))),/divergem/);
});
test('frozen policy survives configuration and presidency contact changes but rejects signer or policy tampering',()=>{
 const p=process(),settings=configured('TERMO',['AUTHORS','ADVISOR','COMMISSION_PRESIDENT']);
 const signers=deriveSignatureSigners(p,'TERMO',settings),snapshot=captureSignaturePolicySnapshot(p,'TERMO',settings,signers),job={signers,signerPolicySnapshot:snapshot};
 const changed={...configured('TERMO',['AUTHORS','ADVISOR','EXAMINERS']),commissionPresidentEmail:'new@example.invalid'};
 assert.doesNotThrow(()=>assertCurrentSignatureRecipients(p,'TERMO',job,changed));
 assert.deepEqual(signatureSignersFromSnapshot(snapshot).map(s=>s.email),signers.map(s=>s.email));
 const altered=structuredClone(job);altered.signers[0].email='other@example.invalid';assert.throws(()=>assertCurrentSignatureRecipients(p,'TERMO',altered,changed),/política/);
 const policy=structuredClone(job);policy.signerPolicySnapshot.roles.push('EXAMINERS');assert.throws(()=>assertCurrentSignatureRecipients(p,'TERMO',policy,changed),/política/);
});
test('configured Ata accepts frozen extra signer only after all snapshot signers signed; seven are rejected before rendering',()=>{
 const p=process(),settings=configured('ATA',['ADVISOR','EXAMINERS','AUTHORS','COADVISOR_PRESENT','COMMISSION_PRESIDENT']);
 const signers=deriveSignatureSigners(p,'ATA',settings),snapshot=captureSignaturePolicySnapshot(p,'ATA',settings,signers);
 const job:any={id:'snapshot',processId:p.id,documentType:'ATA',sourceDataRevision:4,documentVersion:1,status:'ARCHIVED',driveSignedFileId:'signed',ataSignerPolicy:'BOARD_AUTHORS_V1',signerPolicySnapshot:snapshot,signers:signers.map(s=>({...s,status:'SIGNED'}))};
 assert.equal(currentAtaArchived(p,[job]),true);job.signers.at(-1).status='WAITING';assert.equal(currentAtaArchived(p,[job]),false);
 p.aluno2={...p.aluno1,email:'second@example.invalid'};p.coorientador={...p.orientador,email:'coadvisor@example.invalid'};p.avaliacao.coadvisorPresent=true;
 assert.throws(()=>deriveSignatureSigners(p,'ATA',settings),/máximo seis/);
});
test('legacy emitted jobs are not upgraded by newly configured extra groups',()=>{
 const p=process(),signers=deriveSignatureSigners(p,'ATA',president);
 assert.doesNotThrow(()=>assertCurrentSignatureRecipients(p,'ATA',{ataSignerPolicy:'BOARD_AUTHORS_V1',signers},configured('ATA',['ADVISOR','EXAMINERS','AUTHORS','COADVISOR_PRESENT','COMMISSION_PRESIDENT'])));
});
