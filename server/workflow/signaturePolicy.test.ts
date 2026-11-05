import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import {deriveSignatureSigners,canInitiateSignature,assertCurrentSignatureRecipients} from './signaturePolicy';
import {assertAstenEnvelopeSigners,buildAstenEnvelopeParams} from '../integrations/asten';

const settings = {commissionPresidentName:'Presidência', commissionPresidentEmail:'presidencia@ufes.br'};
const process = () => structuredClone(DEMO_PROCESSES[0]);

test('ata: exige orientador e dois examinadores titulares, na mesma prioridade', () => {
  const item = process();
  const signers = deriveSignatureSigners(item,'ATA',settings);
  assert.equal(signers.length,3);
  assert.deepEqual(signers.map(signer=>signer.role),['ADVISOR','EXAMINER','EXAMINER']);
  assert.deepEqual(signers.map(signer=>signer.signingOrder),[1,1,1]);
  assert.deepEqual(signers.map(signer=>signer.email),[
    item.orientador.email.toLowerCase(),
    item.banca.find(member=>member.funcao==='EXAMINER_2')!.email.toLowerCase(),
    item.banca.find(member=>member.funcao==='EXAMINER_3')!.email.toLowerCase(),
  ]);
  assert.equal(new Set(signers.map(signer=>signer.email)).size,3);
});

test('ata: apenas orientador e Master podem iniciar a solicitação', () => {
  const item = process();
  assert.equal(canInitiateSignature(item.orientador.email,item,'ATA',settings),true);
  for (const examiner of item.banca.filter(member=>member.funcao==='EXAMINER_2'||member.funcao==='EXAMINER_3')) {
    assert.equal(canInitiateSignature(examiner.email,item,'ATA',settings),false);
  }
  assert.equal(canInitiateSignature('master@example.com',item,'ATA',settings,['MASTER_ADMIN']),true);
  assert.equal(canInitiateSignature(item.aluno1.email,item,'ATA',settings),false);
  if (item.coorientador) assert.equal(canInitiateSignature(item.coorientador.email,item,'ATA',settings),false);
});

test('ata: impede solicitação sem exatamente os dois examinadores titulares', () => {
  const item = process();
  for (const funcao of ['EXAMINER_2','EXAMINER_3'] as const) {
    const altered = structuredClone(item);
    altered.banca = altered.banca.filter(member=>member.funcao!==funcao);
    assert.throws(()=>deriveSignatureSigners(altered,'ATA',settings),/dois examinadores titulares/);
  }
  const duplicated = structuredClone(item);
  duplicated.banca.push({...duplicated.banca.find(member=>member.funcao==='EXAMINER_2')!,id:'duplicado'});
  assert.throws(()=>deriveSignatureSigners(duplicated,'ATA',settings),/dois examinadores titulares/);
  const wrongEmail = structuredClone(item);
  wrongEmail.banca.find(member=>member.funcao==='EXAMINER_2')!.email=wrongEmail.orientador.email;
  assert.throws(()=>deriveSignatureSigners(wrongEmail,'ATA',settings),/e-mails distintos/);
});

test('ata: não reaproveita uma solicitação antiga com apenas o orientador', () => {
  const item = process();
  const signers=deriveSignatureSigners(item,'ATA',settings);
  assert.doesNotThrow(()=>assertCurrentSignatureRecipients(item,'ATA',{signers},settings));
  assert.throws(()=>assertCurrentSignatureRecipients(item,'ATA',{signers:signers.slice(0,1)},settings),/destinatário.*mudou/);
});

test('ata: Asten só confirma o conjunto de três assinaturas, bloqueando qualquer pendência', () => {
  const signers=deriveSignatureSigners(process(),'ATA',settings);
  const evidence=signers.map(signer=>({
    ordem:1,
    statusAssinatura:'Assinado',
    ConfigAssinatura:{emailSignatario:signer.email},
  }));
  const wanted=signers.map(signer=>({email:signer.email,order:signer.signingOrder}));
  assert.equal(assertAstenEnvelopeSigners({listaSignatariosEnvelope:{SignatarioEnvelope:evidence}},wanted).length,3);
  const missing=evidence.slice(0,2);
  assert.throws(()=>assertAstenEnvelopeSigners({listaSignatariosEnvelope:{SignatarioEnvelope:missing}},wanted),/divergem/);
  const pending=evidence.map((entry,index)=>index===2?{...entry,statusAssinatura:'Pendente'}:entry);
  assert.throws(()=>assertAstenEnvelopeSigners({listaSignatariosEnvelope:{SignatarioEnvelope:pending}},wanted),/ainda não confirma/);
});


test('ata: payload enviado à Asten contém os três destinatários, nomes completos e prioridade 1',()=>{
  const environment=globalThis.process.env;
  const fixture={ASTEN_WEBHOOK_SECRET:'w'.repeat(40),ASTEN_CALLBACK_URL:'https://portal.example/api/integrations/asten/webhook',PORTAL_PUBLIC_URL:'https://portal.example',ASTEN_REQUIRE_CODE:'false',ASTEN_AUTHENTICATION_OPTION:'0',ASTEN_SIGNING_PROFILE:'EMAIL_LINK',ASTEN_REQUIRE_LOGIN:'false'};
  const saved=Object.fromEntries(Object.keys(fixture).map(key=>[key,environment[key]]));
  try{
    Object.assign(environment,fixture);
    const signers=deriveSignatureSigners(process(),'ATA',settings);
    const payload=buildAstenEnvelopeParams({description:'TCC-TESTE — Ata',fileName:'ata.pdf',mimeType:'application/pdf',contentBase64:Buffer.from('%PDF-1.4\n%%EOF').toString('base64'),repositoryId:42,authenticationProfile:'EMAIL_LINK',signers:signers.map(signer=>({name:signer.name,email:signer.email,order:signer.signingOrder}))});
    const envelope=payload.Envelope as any;
    const actual=envelope.listaSignatariosEnvelope.SignatarioEnvelope;
    assert.equal(actual.length,3);
    assert.deepEqual(actual.map((entry:any)=>({email:entry.ConfigAssinatura.emailSignatario,name:entry.ConfigAssinatura.nomeSignatario,order:entry.ordem})),signers.map(signer=>({email:signer.email,name:signer.name,order:1})));
    assert.ok(actual.every((entry:any)=>entry.ConfigAssinatura.permitirDelegar==='N'));
  }finally{for(const [key,value] of Object.entries(saved)){if(value===undefined)delete environment[key];else environment[key]=value;}}
});
