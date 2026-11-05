import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import {storeReviewPdf} from './localReviewFiles';
import {assertPublicAcademicPdf} from './publicAcademicDocuments';
async function pdf(text:string){const d=await PDFDocument.create(),font=await d.embedFont(StandardFonts.Helvetica);d.addPage().drawText(text,{x:40,y:700,font,size:12});return Buffer.from(await d.save());}
test('cópias administrativas públicas preservam bytes e aceitam e-mail e registro acadêmico',async()=>{
 const p=structuredClone(DEMO_PROCESSES[0]);const clean=await pdf('Ata da defesa de Ana Silva, Universidade Federal.');const hash=createHash('sha256').update(clean).digest('hex');await assertPublicAcademicPdf(clean,p);assert.equal(createHash('sha256').update(clean).digest('hex'),hash);
 const contact=await pdf('Ata de Ana Silva. E-mail do signatario professor@example.invalid');await assertPublicAcademicPdf(contact,p);
 const registration=await pdf('Ata da defesa de Ana Silva. Matricula: 9988776655');await assertPublicAcademicPdf(registration,p);
});

test('HTTP público: protocolo abre ficha sanitizada e somente documentos expedidos, mantendo originais privados',{timeout:40000},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'portal-public-access-')),port=42000+Math.floor(Math.random()*500),base=`http://127.0.0.1:${port}`;
 const env={...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),PORTAL_DATA_DIR:dir,PORTAL_PUBLIC_URL:base,APP_URL:base,PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_LOCAL_REVIEW_DATA:'true',ASTEN_INTEGRATION_ENABLED:'false',PORTAL_SESSION_SECRET:'public-access-fixture-secret-0123456789',SUPABASE_URL:'',SUPABASE_SECRET_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',VERCEL:''};
 const old=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));let child:any;
 try{
  Object.assign(process.env,env);
  const p=structuredClone(DEMO_PROCESSES[0]);p.id='public-fixture';p.protocolo='TCC-2026-7777';p.status='CONCLUIDO';p.etapaAtual='CONCLUIDO';p.aluno1.email='secret-contact@example.invalid';p.aluno1.matricula='9988776655';p.registrationAnswers={PRIVATE_VALUE:'secret-internal'};
  const bytes=await pdf('Carta convite da defesa de Ana Silva, Universidade Federal.');const file=storeReviewPdf({processId:p.id,artifactType:'CONVITE',fileName:'convite.pdf',pdf:bytes,sha256:createHash('sha256').update(bytes).digest('hex')});p.defesa={...p.defesa,localStatus:'CONFIRMADO',invitationDriveFileId:file.id,invitationSentAt:new Date().toISOString()};
  const draft={...structuredClone(p),id:'draft-fixture',protocolo:'TCC-2026-8888',status:'EM_RASCUNHO'};
  await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:{...INITIAL_SETTINGS,documentModels:{CONVITE:{type:'CONVITE',driveFileId:'fixture'}}},processes:[p,draft],signatureJobs:[],memberships:[]}));
  child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env,stdio:'ignore'});
  const until=Date.now()+20000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>until||child.exitCode!==null)throw Error('Fixture failed to start');await new Promise(r=>setTimeout(r,100));}
  const response=await fetch(base+'/api/public/processes/'+p.protocolo);assert.equal(response.status,200);const body=await response.json(),serialized=JSON.stringify(body);assert.equal(body.protocolo,p.protocolo);assert.equal(body.canAccessPrivate,false);assert.equal(body.documents.length,1);assert.doesNotMatch(serialized,/secret-contact|9988776655|secret-internal|driveFileId|matricula|siape|"email"|local_review_/i);
  const fileResponse=await fetch(base+body.documents[0].url);assert.equal(fileResponse.status,200);assert.deepEqual(Buffer.from(await fileResponse.arrayBuffer()),bytes);
  assert.equal((await fetch(base+'/api/public/processes/draft-fixture')).status,404);assert.equal((await fetch(base+'/api/public/processes/'+p.protocolo+'/documents/doc-ata/download')).status,404);assert.equal((await fetch(base+'/api/public/processes/'+p.protocolo+'/files/trabalho-completo/download')).status,404);
  assert.equal((await fetch(base+'/api/processes/'+p.id+'/documents')).status,401);assert.equal((await fetch(base+'/api/processes/'+p.id+'/signatures')).status,401);
 }finally{if(child&&child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await done;}for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await rm(dir,{recursive:true,force:true});}
});
test('catálogo público só lista documentos aceitos e termo aplicável, sem campos operacionais',async()=>{
 const {publicAcademicDocuments}=await import('./publicAcademicDocuments');const p=structuredClone(DEMO_PROCESSES[0]);p.acervo={...p.acervo,publishFullWork:false,publishExpandedAbstract:false} as any;
 const docs=['CONVITE','ATA','TERMO','DECLARACAO'].map((type,index)=>({id:'doc-'+type.toLowerCase(),type,title:type,status:type==='CONVITE'?'DISPONIVEL':'ASSINADO',currentVersion:1,driveFileId:'internal-file',visibleToRoles:['STUDENT']})) as any;
 assert.deepEqual(publicAcademicDocuments(p,docs).map(d=>d.type),['CONVITE','ATA','DECLARACAO']);p.acervo!.publishExpandedAbstract=true;assert.equal(publicAcademicDocuments(p,docs).length,4);
 docs[1].status='AGUARDANDO_ASSINATURA';assert.equal(publicAcademicDocuments(p,docs).length,3);assert.doesNotMatch(JSON.stringify(publicAcademicDocuments(p,docs)),/internal-file|visibleToRoles/);
});
