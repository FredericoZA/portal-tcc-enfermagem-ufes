import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveSignatureSigners} from '../workflow/signaturePolicy';
import {buildAstenEnvelopeParams} from './asten';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import {academicName} from '../../src/utils/personPresentation';

test('ASTEN receives complete registered names and academic forms for all four to six minutes signers',()=>{
 const env={ASTEN_WEBHOOK_SECRET:'fixture-only-'.repeat(4),ASTEN_CALLBACK_URL:'https://portal.example/api/integrations/asten/webhook',PORTAL_PUBLIC_URL:'https://portal.example',ASTEN_REQUIRE_CODE:'false',ASTEN_AUTHENTICATION_OPTION:'4'};
 const previous=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));
 try{
  Object.assign(process.env,env);
  for(const second of [false,true])for(const coadvisor of [false,true]){
   const p=structuredClone(DEMO_PROCESSES[0]);
   p.aluno1={...p.aluno1,nome:'Ana Maria da Silva',email:'author-one@example.invalid'};
   p.aluno2=second?{...p.aluno1,nome:'João Pedro de Souza',email:'author-two@example.invalid'}:null;
   p.orientador={...p.orientador,nome:'Maria Clara Ferreira',tratamento:'Professora',titulacao:'Doutora',email:'advisor@example.invalid'};
   p.banca=[{...p.banca[0],funcao:'EXAMINER_2',nome:'Paulo César Oliveira',tratamento:'Professor',titulacao:'Doutor',email:'examiner-one@example.invalid'},{...p.banca[0],funcao:'EXAMINER_3',nome:'Beatriz Costa',tratamento:'Professora',titulacao:'Mestra',email:'examiner-two@example.invalid'}];
   p.coorientador={...p.orientador,nome:'Helena Martins Santos',email:'coadvisor@example.invalid'};
   p.avaliacao.coadvisorPresent=coadvisor;
   const participants=[p.orientador,...p.banca,p.aluno1,...(p.aluno2?[p.aluno2]:[]),...(coadvisor?[p.coorientador]:[])];
   const signers=deriveSignatureSigners(p,'ATA',{});
   const payload=buildAstenEnvelopeParams({description:'Ata fictícia',fileName:'ata.pdf',mimeType:'application/pdf',contentBase64:Buffer.from('%PDF-1.4\n%%EOF').toString('base64'),repositoryId:42,authenticationProfile:'EMAIL_LINK',signers:signers.map(s=>({name:s.name,email:s.email,order:s.signingOrder}))});
   const wire=(payload.Envelope.listaSignatariosEnvelope as any).SignatarioEnvelope;
   assert.equal(wire.length,4+Number(second)+Number(coadvisor));
   for(const person of participants){
    const config=wire.find((item:any)=>item.ConfigAssinatura.emailSignatario===person.email)?.ConfigAssinatura;
    assert.ok(config);
    const expected=person.email.startsWith('author-')?person.nome:academicName(person,'abbreviated');
    assert.equal(config.nomeSignatario,expected);
    assert.ok(config.nomeSignatario.includes(person.nome));
    assert.equal(config.exigirLogin,'N');assert.equal(config.permitirDelegar,'N');
   }
  }
 }finally{for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
