import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DEMO_PROCESSES,INITIAL_SETTINGS} from '../src/services/demoSeed';
import type {ProcessData} from '../src/types';
import {canonicalLegacyRecord,legacyCatalogRevision} from './legacyArchive';

const record={id:'legado-0001',protocolo:'Legado 001',sourceFingerprint:'a'.repeat(64),titulo:'Histórico',autores:['Autora'],orientador:'Orientador',coorientador:'',coorientadorInstituicao:'',examinadores:[],resumo:'Privado',palavrasChave:[],dataDefesa:'2023-06-01',horaDefesa:'',localDefesa:'Sala',isPublic:false,publishFullWork:false,publishExpandedAbstract:false,publicationState:'NOT_REQUESTED',authorizationDecision:'DENIED',attachments:[{driveFileId:'private_file_123456',fileName:'tcc.pdf',kind:'TRABALHO_COMPLETO',sha256:'b'.repeat(64),evidence:'Conferido'}],provenance:{originalConsent:['Não']}};
test('HTTP legacy import is Master-only, persists separately and never dispatches live workflows',{timeout:45000},async(t)=>{
  const dir=await mkdtemp(path.join(tmpdir(),'portal-legacy-'));
  const master='master@portal.local';
  const participant='participant-repository@example.invalid';
  const current=(serial:number,changes:Partial<ProcessData>):ProcessData=>{
    const process=structuredClone(DEMO_PROCESSES[0]);
    return {...process,id:`repository-private-id-${serial}`,protocolo:`TCC - ${String(serial).padStart(5,'0')}`,
      createdByEmail:participant,aluno1:{...process.aluno1,email:participant,matricula:'private-enrollment-marker'},
      orientador:{...process.orientador,email:'private-advisor@example.invalid',siape:'private-staff-marker'},
      banca:process.banca.map(member=>({...member,email:'private-panel@example.invalid'})),
      avaliacao:{status:'PENDENTE'},acervo:undefined,...changes};
  };
  const confirmedDefense:ProcessData['defesa']={startAt:'2030-11-18T13:00:00Z',endAt:'2030-11-18T14:30:00Z',local:'Sala de Teste',localStatus:'CONFIRMADO'};
  const processes=[
    current(1,{status:'AGUARDANDO_CONFIRMACAO_LOCAL',etapaAtual:'CONFIRMACAO_LOCAL',defesa:{startAt:'',endAt:'',local:'',localStatus:'PENDENTE'}}),
    current(2,{status:'AGUARDANDO_DEFESA',etapaAtual:'DEFESA',defesa:confirmedDefense}),
    current(3,{status:'CONCLUIDO',etapaAtual:'CONCLUIDO',defesa:confirmedDefense,avaliacao:{status:'CONCLUIDO'},acervo:{publicationState:'PENDING_SYNC',trabalhoCompletoFileId:'private-active-drive-id'}}),
    current(4,{status:'EM_RASCUNHO',etapaAtual:'CADASTRO',defesa:confirmedDefense}),
  ];
  const memberships=[{id:'repository-test-membership',processId:processes[0].id,email:participant,roles:['STUDENT'],active:true,createdAt:processes[0].createdAt,updatedAt:processes[0].updatedAt}];
  await writeFile(path.join(dir,'portal-state.json'),JSON.stringify({settings:{...INITIAL_SETTINGS,masterEmail:master,ownerEmail:master},processes,memberships,signatureJobs:[],emailDeliveries:[],workflowRuns:[]}));
  const pdf=Buffer.concat([Buffer.from('%PDF-1.4\nlegacy test\n'),Buffer.alloc(5*1024*1024,0x20),Buffer.from('\n%%EOF')]);
  await mkdir(path.join(dir,'legacy-import','drive-pdfs'),{recursive:true});
  await writeFile(path.join(dir,'legacy-import','drive-pdfs','tcc.pdf'),pdf);
  await writeFile(path.join(dir,'legacy-import','drive-pdfs','admin.pdf'),pdf);
  const privateDocument={driveFileId:'private_admin_123456',fileName:'instrumento.pdf',sourceFileName:'admin.pdf',folderId:'private_folder_12345',kind:'AVALIACAO',sha256:createHash('sha256').update(pdf).digest('hex'),visibility:'PRIVATE_ADMINISTRATIVE_DOCUMENT'};
  const importedRecord={...record,attachments:[{...record.attachments[0],sha256:createHash('sha256').update(pdf).digest('hex')}],provenance:{...record.provenance,administrativeDocuments:[privateDocument]}};
  const port=43000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'development',PORT:String(port),PORTAL_DATA_DIR:dir,PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_ALLOW_LOCAL_SECRET_STORE:'true',PORTAL_ALLOW_LOCAL_OTP_STORE:'true',PORTAL_SESSION_SECRET:'test-legacy-session-secret-123456789',PORTAL_OTP_PEPPER:'test-legacy-otp-pepper-123456789',SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',SUPABASE_SECRET_KEY:'',VERCEL:'',PORTAL_TEST_DOCUMENT_RENDERER:'true',PORTAL_LOCAL_REVIEW_DATA:'true',ASTEN_INTEGRATION_ENABLED:'false'},stdio:'ignore'});
  const request=async(url:string,email='',body?:unknown)=>{const res=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(email?{'x-demo-user-email':email}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:res.status,body:await res.json()};};
  try{
    const until=Date.now()+25000;
    while(true){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(Date.now()>until||child.exitCode!==null)throw new Error('Servidor não iniciou');await new Promise(r=>setTimeout(r,200));}
    const route='/api/admin/legacy-academic-records/import',payload={expectedRevision:legacyCatalogRevision([]),records:[importedRecord]};
    assert.equal((await request(route,'',payload)).status,401);
    assert.equal((await request(route,'student@example.invalid',payload)).status,403);
    assert.equal((await request('/api/admin/legacy-academic-records')).status,401);
    assert.equal((await request(route,master,{...payload,expectedRevision:'stale'})).status,409);
    assert.equal((await request(route,master,payload)).body.imported,1);
    const publicRows=await request('/api/legacy-academic-records');assert.equal(publicRows.body.length,1);assert.ok(!JSON.stringify(publicRows.body).includes('private_file_123456'));assert.equal(publicRows.body[0].resumo,record.resumo);assert.deepEqual(publicRows.body[0].publicFiles,[]);
    const privateRows=await request('/api/admin/legacy-academic-records',master);assert.equal(privateRows.body.records[0].attachments[0].driveFileId,'private_file_123456');
    assert.equal((await request(route,master,{...payload,expectedRevision:privateRows.body.revision})).body.imported,0);
    const repository=await request('/api/public/repository');
    const legacyRow=repository.body.find((row:ProcessData)=>row.protocolo==='001 - Legado');
    assert.equal(legacyRow.acervo.resumoSintese,record.resumo);
    assert.equal(legacyRow.orientador.instituicao,'Universidade Federal do Espírito Santo');
    assert.deepEqual(legacyRow.acervo.palavrasChave,record.palavrasChave);
    assert.deepEqual(legacyRow.banca.map((member: {nome: string}) => member.nome), record.examinadores.map(member => member.nome));
    assert.equal(legacyRow.acervo.trabalhoCompletoFileUrl,undefined);
    await t.test('Repositório público inclui submetidos sem local, com reserva, concluídos e legados',async()=>{
      const privateValues=/participant-repository|private-(?:advisor|panel|staff|enrollment|active-drive)|private_file_123456/;
      assert.equal(repository.status,200);
      assert.deepEqual(repository.body.map((row:ProcessData)=>[row.protocolo,row.etapaAtual]),[
        ['TCC - 00001','CONFIRMACAO_LOCAL'],['TCC - 00002','DEFESA'],['TCC - 00003','CONCLUIDO'],['001 - Legado','CONCLUIDO'],
      ]);
      assert.doesNotMatch(JSON.stringify(repository.body),privateValues);
      assert.doesNotMatch(JSON.stringify(repository.body),/repository-private-id/);
      assert.equal((await request(`/api/processes/${processes[0].id}`,participant)).status,200);
      assert.deepEqual((await request('/api/public/repository',participant)).body,repository.body);
      const calendar=await request('/api/public/calendar');
      assert.equal(calendar.status,200);
      assert.deepEqual(calendar.body.map((row:ProcessData)=>row.protocolo),['TCC - 00002']);
      assert.doesNotMatch(JSON.stringify(calendar.body),privateValues);
      assert.doesNotMatch(JSON.stringify(calendar.body),/repository-private-id/);
      const calendarExport=await fetch(`${base}/api/public/calendar.ics`);
      assert.equal(calendarExport.status,200);
      assert.match(calendarExport.headers.get('content-type')||'',/^text\/calendar/);
      const ics=await calendarExport.text();
      assert.match(ics,/BEGIN:VEVENT/);
      assert.match(ics,/TCC - 00002/);
      assert.doesNotMatch(ics,privateValues);
      assert.doesNotMatch(ics,/TCC - 00004/,'O calendário público não exporta rascunhos');
      const indicators=await request('/api/public/indicators');
      assert.equal(indicators.status,200);
      assert.equal(indicators.body.totals.registered,4);
      assert.doesNotMatch(JSON.stringify(indicators.body),privateValues);
    });
    const detail=await request('/api/public/processes/legado-0001');
    assert.equal(detail.status,200);assert.equal(detail.body.legacyRecord,true);
    assert.equal(detail.body.canAccessPrivate,false);assert.deepEqual(detail.body.documents,[]);
    assert.equal(detail.body.acervo.resumoSintese,record.resumo);
    assert.equal(detail.body.orientador.instituicao,'Universidade Federal do Espírito Santo');
    assert.equal(detail.body.aluno1.email,'');assert.equal(detail.body.avaliacao.status,'PENDENTE');
    assert.ok(!JSON.stringify(detail.body).includes('private_file_123456'));
    assert.ok(!JSON.stringify(detail.body).includes('instrumento.pdf'));
    const academicRoute='/api/admin/legacy-academic-records/legado-0001/academic';
    assert.equal((await request(academicRoute)).status,401);
    for(const email of ['student@example.invalid','presidente@portal.local'])assert.equal((await request(academicRoute,email)).status,403);
    const academic=await request(academicRoute,master);
    assert.equal(academic.status,200);assert.equal(academic.body.resumo,'Privado');
    assert.equal(academic.body.files.length,1);assert.equal(academic.body.files[0].isPublic,false);
    assert.ok(!JSON.stringify(academic.body).includes('private_file_123456'));
    assert.ok(!JSON.stringify(academic.body).includes('originalConsent'));
    const privateAcademicDownload=academic.body.files[0].downloadUrl;
    assert.equal((await request(privateAcademicDownload)).status,401);
    assert.equal((await request(privateAcademicDownload,'student@example.invalid')).status,403);
    const privateAcademicPdf=await fetch(base+privateAcademicDownload,{headers:{'x-demo-user-email':master}});
    assert.equal(privateAcademicPdf.status,200);assert.match(privateAcademicPdf.headers.get('cache-control')||'',/private.*no-store/);
    assert.deepEqual(Buffer.from(await privateAcademicPdf.arrayBuffer()),pdf);
    assert.equal((await request('/api/admin/legacy-academic-records/legado-0001/files/1/download',master)).status,404);
    assert.equal((await request('/api/admin/legacy-academic-records/legado-0001/files/-1/download',master)).status,404);
    assert.equal((await request('/api/admin/legacy-academic-records/legado-0999/academic',master)).status,404);
    assert.equal((await request('/api/legacy-academic-records/legado-0001/files/0/download',master)).status,404);
    const privateDocs='/api/admin/legacy-academic-records/legado-0001/documents';
    assert.equal((await request(privateDocs)).status,401);
    assert.equal((await request(privateDocs,'student@example.invalid')).status,403);
    const listing=await request(privateDocs,master);
    assert.equal(listing.status,200);assert.equal(listing.body[0].kind,'AVALIACAO');
    assert.ok(!JSON.stringify(listing.body).includes('private_admin_123456'));
    assert.equal((await request(privateDocs+'/0/download')).status,401);
    assert.equal((await request(privateDocs+'/0/download','student@example.invalid')).status,403);
    const original=await fetch(base+listing.body[0].downloadUrl,{headers:{'x-demo-user-email':master}});
    assert.equal(original.status,200);assert.match(original.headers.get('cache-control')||'',/no-store/);
    assert.deepEqual(Buffer.from(await original.arrayBuffer()),pdf);
    assert.equal((await request(privateDocs+'/1/download',master)).status,404);
    assert.equal((await request(privateDocs+'/-1/download',master)).status,404);
    await writeFile(path.join(dir,'legacy-import','drive-pdfs','admin.pdf'),Buffer.from('%PDF-changed'));
    assert.equal((await request(privateDocs+'/0/download',master)).status,409);

    const deniedDownload=await request('/api/legacy-academic-records/legado-0001/files/0/download');
    assert.equal(deniedDownload.status,404);
    const authorized=canonicalLegacyRecord({...record,id:'legado-0002',sourceFingerprint:'c'.repeat(64),attachments:[{...record.attachments[0],kind:'RESUMO_EXPANDIDO',sha256:createHash('sha256').update(pdf).digest('hex')}],provenance:{originalConsent:['Sim']}} as any);
    assert.equal((await request(route,master,{expectedRevision:privateRows.body.revision,records:[authorized]})).body.imported,1);
    const download=await fetch(base+'/api/legacy-academic-records/legado-0002/files/0/download');
    assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/pdf');
    assert.equal(download.headers.get('transfer-encoding'),'chunked');
    assert.deepEqual(Buffer.from(await download.arrayBuffer()),pdf);
    assert.equal((await request('/api/legacy-academic-records/legado-0002/files/1/download')).status,404);
    await writeFile(path.join(dir,'legacy-import','drive-pdfs','tcc.pdf'),Buffer.from('%PDF-tampered'));
    assert.equal((await request('/api/legacy-academic-records/legado-0002/files/0/download')).status,409);
    assert.equal((await request(privateAcademicDownload,master)).status,409);
    const state=JSON.parse(await readFile(path.join(dir,'portal-state.json'),'utf8'));
    assert.equal(state.legacyAcademicRecords.length,2);assert.deepEqual(state.processes.map((process:ProcessData)=>process.id),processes.map(process=>process.id));assert.deepEqual(state.signatureJobs,[]);assert.deepEqual(state.emailDeliveries,[]);assert.deepEqual(state.workflowRuns,[]);
  }finally{child.kill('SIGTERM');await new Promise<void>(r=>{if(child.exitCode!==null||child.signalCode!==null)return r();child.once('exit',()=>r());});await rm(dir,{recursive:true,force:true});}
});
