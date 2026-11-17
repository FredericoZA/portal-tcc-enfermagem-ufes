import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {INITIAL_SETTINGS} from '../src/services/demoSeed';
import {canonicalLegacyRecord} from './legacyArchive';

test('HTTP verified historical readers receive evaluation-only access through normal local OTP and Master revocation', {timeout:60000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'portal-legacy-evaluation-access-'));
 const master='master-legacy-evaluation@example.invalid',author='alice-legacy@example.invalid',secondAuthor='bruno-legacy@example.invalid',advisor='advisor-legacy@example.invalid',otherAuthor='other-author-legacy@example.invalid',examiner='examiner-legacy@example.invalid';
 const pdf=async(text:string)=>{const file=await PDFDocument.create(),font=await file.embedFont(StandardFonts.Helvetica);file.addPage().drawText(text,{x:30,y:700,size:12,font});return Buffer.from(await file.save());};
 const evaluation=await pdf('Instrumento de avaliacao demonstrativo. Nota privada: 9.'),minutes=await pdf('Ata historica demonstrativa expedida. Autoria e composicao da banca.');
 const sourceDirectory=path.join(directory,'legacy-import','drive-pdfs');await mkdir(sourceDirectory,{recursive:true});
 await Promise.all([writeFile(path.join(sourceDirectory,'evaluation.pdf'),evaluation),writeFile(path.join(sourceDirectory,'minutes.pdf'),minutes)]);
 const document=(kind:string,driveFileId:string,fileName:string,bytes:Buffer)=>({kind,driveFileId,folderId:'private_historical_folder_123',fileName,sourceFileName:fileName,sha256:createHash('sha256').update(bytes).digest('hex'),visibility:'PRIVATE_ADMINISTRATIVE_DOCUMENT'});
 const historical=(serial:number,authors:string[],advisorName:string):any=>canonicalLegacyRecord({
  id:`legado-${String(serial).padStart(4,'0')}`,protocolo:`${String(serial).padStart(3,'0')} - Legado`,sourceFingerprint:String(serial).repeat(64),
  titulo:`Trabalho historico demonstrativo ${serial}`,autores:authors,orientador:advisorName,coorientador:'',coorientadorInstituicao:'',examinadores:[{nome:'Examinador demonstrativo',instituicao:'Instituição fictícia'}],
  resumo:'Resumo público demonstrativo',palavrasChave:['Enfermagem'],dataDefesa:'2025-08-22',horaDefesa:'14:00:00',localDefesa:'Sala demonstrativa',
  isPublic:false,publishFullWork:false,publishExpandedAbstract:false,publicationState:'NOT_REQUESTED',authorizationDecision:'DENIED',attachments:[],
  provenance:{originalConsent:['Não'],publicationImportBaseline:{publicFiles:[],privateFileIds:[`private_evaluation_original_${serial}`]},administrativeDocuments:[document('AVALIACAO',`private_evaluation_original_${serial}`,'evaluation.pdf',evaluation)]},
 } as any);
 const first=historical(1,['Alice da Silva','Bruno Souza'],'Carolina Santos'),second=historical(2,['Outra Pessoa'],'Outro Orientador');
 first.provenance.administrativeDocuments.push(document('ATA','public_minutes_original_123','minutes.pdf',minutes),document('CONVITE','private_invitation_original_123','minutes.pdf',minutes));
 second.provenance.verifiedPublicationParticipants={authors:[{nome:second.autores[0],email:otherAuthor}],advisor:{nome:second.orientador,email:'other-advisor-legacy@example.invalid'},verifiedBy:master};
 await writeFile(path.join(directory,'portal-state.json'),JSON.stringify({settings:{...structuredClone(INITIAL_SETTINGS),masterEmail:master,ownerEmail:master},processes:[],memberships:[],authorizedStudents:[],legacyAcademicRecords:[first,second],signatureJobs:[],emailDeliveries:[],workflowRuns:[]}));
 const reservation=createServer();await new Promise<void>(resolve=>reservation.listen(0,'127.0.0.1',resolve));
 const port=(reservation.address() as import('node:net').AddressInfo).port;await new Promise<void>((resolve,reject)=>reservation.close(error=>error?reject(error):resolve()));
 const base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,
  NODE_ENV:'development',VERCEL:'',DISABLE_HMR:'true',HOST:'127.0.0.1',PORT:String(port),PORTAL_DATA_DIR:directory,
  PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_LOCAL_REVIEW_DATA:'true',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',
  PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_OTP_DELIVERY_MODE:'log',
  PORTAL_SESSION_SECRET:randomBytes(32).toString('hex'),PORTAL_OTP_PEPPER:randomBytes(32).toString('hex'),PORTAL_BOOTSTRAP_MASTER_EMAIL:'',
  ASTEN_INTEGRATION_ENABLED:'false',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:'',GOOGLE_OAUTH_CLIENT_ID:'',GOOGLE_OAUTH_CLIENT_SECRET:'',
 },stdio:['ignore','pipe','pipe']});
 let logs='';const codes=new Map<string,string>();
 child.stdout?.on('data',chunk=>{logs+=String(chunk);for(const match of logs.matchAll(/\[Portal OTP desenvolvimento\] ([^\s:]+): (\d{6})/g))codes.set(match[1],match[2]);});
 child.stderr?.on('data',chunk=>{logs+=String(chunk);});
 const request=(endpoint:string,email='',method='GET',body?:unknown,cookie='')=>fetch(base+endpoint,{method,headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{}),...(cookie?{cookie}:{}),...(method==='GET'?{}:{origin:base})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});
 const json=async(endpoint:string,email='',method='GET',body?:unknown,cookie='')=>{const response=await request(endpoint,email,method,body,cookie);return {status:response.status,body:await response.json(),headers:response.headers};};
 const otpSession=async(email:string)=>{
  const acknowledgement=await request('/api/auth/request-code','','POST',{email});assert.equal(acknowledgement.status,200);assert.equal((await acknowledgement.json()).sent,true);
  const challenge=acknowledgement.headers.getSetCookie().find(value=>value.startsWith('portal_otp_challenge='))?.split(';')[0];assert.ok(challenge);
  const deadline=Date.now()+2000;while(!codes.has(email)){if(Date.now()>deadline)throw Error('Código fictício não foi entregue pelo modo local.');await new Promise(resolve=>setTimeout(resolve,10));}
  const verified=await request('/api/auth/verify-code','','POST',{email,code:codes.get(email)},challenge);
  assert.equal(verified.status,200);const identity=await verified.json();assert.equal(identity.isAuthenticated,true);assert.deepEqual(identity.globalRoles,[]);assert.deepEqual(identity.memberships,[]);
  const cookie=verified.headers.getSetCookie().find(value=>value.startsWith('portal_tcc_session='))?.split(';')[0];assert.ok(cookie);return cookie;
 };
 const documents='/api/legacy-academic-records/legado-0001/evaluation-documents',contacts='/api/admin/legacy-academic-records/legado-0001/evaluation-participants',detail='/api/public/processes/legado-0001';
 try{
  const deadline=Date.now()+25000;while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{/* startup */}if(Date.now()>deadline||child.exitCode!==null)throw Error('Servidor de avaliação histórica não iniciou: '+logs.slice(-1000));await new Promise(resolve=>setTimeout(resolve,100));}
  assert.equal((await request(documents)).status,401);assert.equal((await request(documents+'/0/download')).status,401);
  assert.equal((await request(contacts)).status,401);assert.equal((await request(contacts,author)).status,403);
  assert.equal((await json('/api/auth/request-code','','POST',{email:author})).body.sent,false,'an unconfirmed historical email cannot request a code');
  const initial=await json(contacts,master);assert.equal(initial.status,200);assert.equal(initial.body.confirmed,false);
  const payload={expectedRevision:initial.body.revision,authorEmails:[author,secondAuthor],advisorEmail:advisor,reason:'Confirmação explícita dos participantes fictícios',source:'Ficha histórica demonstrativa conferida pelo Master'};
  assert.equal((await json(contacts,examiner,'PUT',payload)).status,403);
  assert.equal((await json(contacts,master,'PUT',{...payload,authorEmails:[author,author]})).status,400);
  const saved=await json(contacts,master,'PUT',payload);assert.equal(saved.status,200);assert.equal(saved.body.confirmed,true);assert.notEqual(saved.body.revision,initial.body.revision);
  assert.equal((await json(contacts,master,'PUT',payload)).status,409,'stale confirmation cannot overwrite a newer binding');
  const authorCookie=await otpSession(author),advisorCookie=await otpSession(advisor),otherCookie=await otpSession(otherAuthor);
  for(const cookie of [authorCookie,advisorCookie]){
   const me=await json('/api/me','','GET',undefined,cookie);assert.equal(me.body.isAuthenticated,true);assert.equal(me.body.authenticationMode,'EMAIL_OTP');assert.deepEqual(me.body.globalRoles,[]);assert.deepEqual(me.body.memberships,[]);assert.equal(me.body.canRegisterProcess,false);
   assert.equal((await request('/api/forms/registration-schema','','GET',undefined,cookie)).status,403,'read-only legacy access cannot register a new process');
   assert.deepEqual((await json('/api/processes','','GET',undefined,cookie)).body,[],'historical access creates no live memberships');
   assert.equal((await request('/api/processes/legado-0001/publication-choice','','GET',undefined,cookie)).status,404,'historical readers cannot edit publication');
   assert.equal((await request('/api/admin/legacy-academic-records/legado-0001/academic','','GET',undefined,cookie)).status,403);
   const publicDetail=await json(detail,'','GET',undefined,cookie);assert.equal(publicDetail.status,200);assert.equal(publicDetail.body.canAccessPrivate,false);assert.equal(publicDetail.body.canAccessLegacyEvaluation,true);
   assert.doesNotMatch(JSON.stringify(publicDetail.body),/alice-legacy|bruno-legacy|advisor-legacy|master-legacy|verifiedPublicationParticipants|private_evaluation_original/);
   assert.deepEqual(publicDetail.body.documents.map((document:any)=>document.type),['ATA']);
   const listing=await json(documents,'','GET',undefined,cookie);assert.equal(listing.status,200);assert.match(listing.headers.get('cache-control')||'',/private.*no-store/);assert.equal(listing.body.length,1);assert.equal(listing.body[0].kind,'AVALIACAO');assert.equal(listing.body[0].index,0);assert.doesNotMatch(JSON.stringify(listing.body),/private_evaluation_original|public_minutes_original|private_invitation_original/);
   const download=await request(listing.body[0].downloadUrl,'','GET',undefined,cookie);assert.equal(download.status,200);assert.match(download.headers.get('cache-control')||'',/private.*no-store/);assert.match(download.headers.get('content-type')||'',/^application\/pdf/);assert.deepEqual(Buffer.from(await download.arrayBuffer()),evaluation);
   for(const index of ['1','2','-1','99'])assert.equal((await request(documents+`/${index}/download`,'','GET',undefined,cookie)).status,404,'evaluation reader cannot use this route for another document kind');
  }
  for(const [email,cookie] of [['',''],[examiner,''],['outsider-legacy@example.invalid',''],['',otherCookie]]){
   const publicDetail=await json(detail,email,'GET',undefined,cookie);assert.equal(publicDetail.body.canAccessLegacyEvaluation,false);assert.equal(publicDetail.body.canAccessPrivate,false);
   assert.equal((await request(documents,email,'GET',undefined,cookie)).status,email||cookie?404:401);
   assert.equal((await request(documents+'/0/download',email,'GET',undefined,cookie)).status,email||cookie?404:401);
  }
  assert.equal((await json('/api/auth/request-code','','POST',{email:examiner})).body.sent,false,'an examiner name does not grant login');
  assert.equal((await request('/api/public/legacy-academic-records/legado-0001/documents/0/download')).status,404);
  assert.equal((await request('/api/public/legacy-academic-records/legado-0001/documents/2/download')).status,404);
  const publicView=await json(detail);const publicMinutes=await request(publicView.body.documents[0].url);assert.equal(publicMinutes.status,200);assert.deepEqual(Buffer.from(await publicMinutes.arrayBuffer()),minutes);
  assert.equal((await request(documents,master)).status,200,'Master keeps operational access');
  await writeFile(path.join(sourceDirectory,'evaluation.pdf'),Buffer.from('%PDF-1.4 altered fixture'));
  assert.equal((await request(documents+'/0/download','','GET',undefined,authorCookie)).status,409,'a changed private PDF is not delivered');
  await writeFile(path.join(sourceDirectory,'evaluation.pdf'),evaluation);
  const revoked=await json(contacts,master,'PUT',{expectedRevision:saved.body.revision,clear:true,reason:'Retirada de teste do vínculo de consulta',source:'Solicitação fictícia de revogação pelo Master'});assert.equal(revoked.status,200);assert.equal(revoked.body.confirmed,false);assert.notEqual(revoked.body.revision,initial.body.revision);
  assert.equal((await json(contacts,master,'PUT',payload)).status,409,'an earlier confirmation cannot revive revoked readers');
  for(const cookie of [authorCookie,advisorCookie]){
   assert.equal((await json(detail,'','GET',undefined,cookie)).body.canAccessLegacyEvaluation,false);
   assert.equal((await request(documents,'','GET',undefined,cookie)).status,404);assert.equal((await request(documents+'/0/download','','GET',undefined,cookie)).status,404);
  }
  assert.equal((await json('/api/auth/request-code','','POST',{email:author})).body.sent,false);
  const persisted=JSON.parse(await readFile(path.join(directory,'portal-state.json'),'utf8'));
  assert.deepEqual(persisted.memberships,[]);assert.deepEqual(persisted.authorizedStudents,[]);assert.deepEqual(persisted.processes,[]);assert.deepEqual(persisted.signatureJobs,[]);assert.deepEqual(persisted.emailDeliveries,[]);
  assert.equal(persisted.legacyAcademicRecords[0].provenance.verifiedPublicationParticipants,undefined);assert.equal(persisted.legacyAcademicRecords[0].provenance.evaluationAccessRevision,2);
  assert.deepEqual(persisted.legacyAcademicRecords[0].provenance.publicationImportBaseline,first.provenance.publicationImportBaseline,'contact edits preserve publication evidence');
  assert.deepEqual(persisted.legacyAcademicRecords[0].provenance.administrativeDocuments,first.provenance.administrativeDocuments,'contact edits preserve original documents');
 }finally{
  if(child.exitCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await stopped;}
  await rm(directory,{recursive:true,force:true});
 }
});
