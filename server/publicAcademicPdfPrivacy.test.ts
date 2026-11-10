import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts,PDFName,PDFString} from 'pdf-lib';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {assertPublicAcademicPdf} from './publicAcademicDocuments';
import {createHash} from 'node:crypto';
async function pdf(text:string,subject='',link=''){
 const document=await PDFDocument.create();const font=await document.embedFont(StandardFonts.Helvetica);const page=document.addPage();
 const longestWordWidth=Math.max(...text.split(/\s+/).map(word=>font.widthOfTextAtSize(word,1)));
 page.drawText(text,{x:30,y:780,font,size:Math.min(10,535/longestWordWidth),maxWidth:535,lineHeight:14});document.setSubject(subject);
 if(link)page.node.set(PDFName.of('Annots'),document.context.obj([document.context.obj({Type:'Annot',Subtype:'Link',Rect:[0,0,50,20],A:{S:'URI',URI:PDFString.of(link)}})]));
 return Buffer.from(await document.save());
}
test('documento público sem dados restritos preserva os bytes originais',async()=>{
 const bytes=await pdf('Ata da defesa. Banca examinadora e autores. Reserva confirmada.');const before=Buffer.from(bytes);await assertPublicAcademicPdf(bytes,structuredClone(DEMO_PROCESSES[0]));assert.deepEqual(bytes,before);
});
test('consulta pública recusa registro acadêmico e e-mail de assinatura sem alterar o original',async()=>{
 const process=structuredClone(DEMO_PROCESSES[0]);process.aluno1.matricula='REG-AZXY-TEST';
 process.orientador.siape='1234567';
 const bytes=await pdf('Ata da defesa. Autor: Ana Silva. Matricula: REG-AZXY-TEST. SIAPE: 1234567. Assinado por Professor Silva, professor@example.invalid. Asten Assinatura.','E-mail do signatário: professor@example.invalid; Registro: REG-AZXY-TEST');
 const before=Buffer.from(bytes),hash=createHash('sha256').update(bytes).digest('hex');
 await assert.rejects(assertPublicAcademicPdf(bytes,process),/identificação privada/);
 assert.deepEqual(bytes,before);assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
 for(const [body,metadata] of [
  ['Ata da defesa. Autoria e banca. Matrícula: AA-TESTE-99.',''],
  ['Ata da defesa. Autoria e banca. Matricula n.o 99.888/777.',''],
  ['Ata da defesa. Identificação do autor REG-AZXY-TEST.',''],
  ['Ata da defesa. Autoria e banca.','Signatária: pessoa@example.invalid'],
 ]) await assert.rejects(assertPublicAcademicPdf(await pdf(body,metadata),process),/identificação privada/);
});
test('PDF com texto conferível e conteúdo raster exige acesso restrito',async()=>{
 const document=await PDFDocument.load(await pdf('Ata da defesa. Autoria e composição da banca examinadora.'));
 const image=await document.embedPng(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lE0AAAAASUVORK5CYII=','base64'));
 document.getPage(0).drawImage(image,{x:50,y:700,width:40,height:30});
 const bytes=Buffer.from(await document.save());
 await assert.rejects(assertPublicAcademicPdf(bytes,structuredClone(DEMO_PROCESSES[0])),/imagem sem conferência/);
});
test('cópias públicas continuam recusando identificação civil e telefone explícitos',async()=>{
 const process=structuredClone(DEMO_PROCESSES[0]);
 for(const text of ['CPF: 000.000.000-00','Documento 000.000.000-00','Telefone: (27) 3000-0000','RG: 1234567','CNH: 123456789','Passaporte: 1234567','Celular: (27) 99999-9999','Data de nascimento: 01/01/2000'])await assert.rejects(assertPublicAcademicPdf(await pdf('Ata da defesa. '+text),process));
 await assert.rejects(assertPublicAcademicPdf(await pdf('Ata da defesa. Banca examinadora e autores.','CPF: 000.000.000-00'),process));
});
test('credenciais pessoais não são publicadas, mesmo em metadados',async()=>{
 const process=structuredClone(DEMO_PROCESSES[0]);
 for(const value of ['Seu codigo de acesso e 123456','https://portal.example.invalid/api/reservation-confirmation/personal-bearer-123?decision=accept','https://provider.example.invalid/signature/personal-bearer-123','https://provider.example.invalid/link?access_token=personal-secret','Bearer personal-secret-123','client_secret=personal-secret-123','token=personal-secret-123','https://provider.example.invalid/link?secret=personal-secret','access_token=fake-bearer-token','session_token=fake-bearer-token','https://user:password@provider.example.invalid/document']){
  await assert.rejects(assertPublicAcademicPdf(await pdf('Ata da defesa. '+value),process),/credencial/);
  await assert.rejects(assertPublicAcademicPdf(await pdf('Ata da defesa. Banca examinadora e autores.',value),process),/credencial/);
 }
});
test('links públicos de autenticidade não são confundidos com acesso pessoal nem ocultam OTP próximo',async()=>{
 const process=structuredClone(DEMO_PROCESSES[0]),options={portalBaseUrl:'https://portal.example.invalid'};
 for(const link of ['https://plataforma.astenassinatura.com.br/validar-documento/public-hash?code=123456','https://portal.example.invalid/api/public/verification/public-hash?code=123456']){
  const text=`Ata da defesa. Autenticidade: ${link}. Codigo de verificacao: 123456.`;
  await assertPublicAcademicPdf(await pdf(text),process,options);
  await assertPublicAcademicPdf(await pdf('Ata da defesa. Banca examinadora e autores.','',link),process,options);
  await assert.rejects(assertPublicAcademicPdf(await pdf(text+' Seu codigo de acesso e 654321.'),process,options),/credencial/);
 }
 for(const link of ['https://foreign.example.invalid/api/public/verification/public-hash?code=123456','https://plataforma.astenassinatura.com.br/signature/personal-token-123?code=123456','https://plataforma.astenassinatura.com.br/validar-documento/public-hash?access_token=personal-secret']){
  await assert.rejects(assertPublicAcademicPdf(await pdf('Ata da defesa. Banca examinadora e autores.','',link),process,options),/credencial/);
 }
});
test('metadados JSON e links de autenticidade não ocultam segredos explícitos ou JWT',async()=>{
 const process=structuredClone(DEMO_PROCESSES[0]),options={portalBaseUrl:'https://portal.example.invalid'};
 const jwt='eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.fakepersonalSignature123';
 for(const value of ['{"access_token":"fake-personal-secret"}','{"session_token":"fake-personal-secret"}',JSON.stringify({nested:JSON.stringify({client_secret:'fake-personal-secret'})})]){
  await assert.rejects(assertPublicAcademicPdf(await pdf('Ata da defesa. Banca examinadora e autores.',value),process,options),/credencial/);
 }
 for(const base of ['https://plataforma.astenassinatura.com.br/validar-documento/public-hash','https://portal.example.invalid/api/public/verification/public-hash']){
  for(const value of [jwt,'client_secret=fake-personal-secret',JSON.stringify({access_token:'fake-personal-secret'})]){
   const link=`${base}?code=${encodeURIComponent(value)}`;
   await assert.rejects(assertPublicAcademicPdf(await pdf('Ata da defesa. Autenticidade: '+link),process,options),/credencial/);
   await assert.rejects(assertPublicAcademicPdf(await pdf('Ata da defesa. Banca examinadora e autores.',link),process,options),/credencial/);
   await assert.rejects(assertPublicAcademicPdf(await pdf('Ata da defesa. Banca examinadora e autores.','',link),process,options),/credencial/);
  }
 }
});
