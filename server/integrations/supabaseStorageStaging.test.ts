import assert from 'node:assert/strict';
import {createHash, createHmac} from 'node:crypto';
import test from 'node:test';
import {validateStagedUploadDescriptor} from './supabaseStorageStaging';
import {saveIntegrationSecret} from './integrationSecrets';

async function withDriveFixture(run:(driveFetch:(url:string,init?:RequestInit)=>Response|undefined)=>Promise<void>){
  const env={...process.env}, originalFetch=globalThis.fetch;
  const endpoint='https://quota-test.supabase.co';
  let stored:unknown;
  Object.assign(process.env,{
    NODE_ENV:'test',PORTAL_PERSISTENCE_PROVIDER:'supabase',SUPABASE_URL:endpoint,
    SUPABASE_SECRET_KEY:'dummy-test-secret',
    PORTAL_UPLOAD_BINDING_SECRET:'quota-test-binding-secret-longer-than-32-characters',
    PORTAL_SECRET_ENCRYPTION_KEY:'11'.repeat(32),
  });
  const driveFetch=(url:string,init?:RequestInit)=>{
    if(url.includes('/portal_integration_secrets')){
      if(init?.method==='POST'){stored=JSON.parse(String(init.body));return new Response(null,{status:201});}
      return Response.json([stored]);
    }
    if(url==='https://oauth2.googleapis.com/token')return Response.json({access_token:'fixture-access-token'});
    if(url.includes('/files/generateIds'))return Response.json({ids:['fixture_file_123']});
  };
  globalThis.fetch=async(url,init)=>driveFetch(String(url),init) ?? Promise.reject(new Error(`Solicitação inesperada: ${url}`));
  try{
    await saveIntegrationSecret('google_workspace','fixture-refresh-token',{});
    await run(driveFetch);
  }finally{
    globalThis.fetch=originalFetch;
    for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];
    Object.assign(process.env,env);
  }
}


const validSha = 'a'.repeat(64);

test('ticket de outra sessão, processo ou finalidade não é reclamado nem apagado', async () => {
  const env={...process.env},originalFetch=globalThis.fetch;
  const bindingSecret='quota-test-binding-secret-longer-than-32-characters';
  Object.assign(process.env,{NODE_ENV:'test',PORTAL_PERSISTENCE_PROVIDER:'supabase',SUPABASE_URL:'https://quota-test.supabase.co',SUPABASE_SECRET_KEY:'dummy-test-secret',PORTAL_UPLOAD_BINDING_SECRET:bindingSecret});
  const digest=(value:string)=>createHmac('sha256',bindingSecret).update(value).digest('hex');
  try {
    const {withDriveStagedUpload}=await import('./supabaseStorageStaging');
    const validInput={uploadId:'00000000-0000-4000-8000-000000000001',purpose:'PROCESS_FULL_WORK' as const,requesterBinding:'session:owner:100',processId:'process-owner'};
    for(const change of [{requesterBinding:'session:other:100'},{processId:'process-other'},{purpose:'PROCESS_EXPANDED_ABSTRACT' as const},{verificationCode:'other-code'},{expired:true}]){
      let state='PENDING',removed=0,consumed=0;
      const row={id:validInput.uploadId,purpose:validInput.purpose,requester_hash:digest(validInput.requesterBinding),process_external_id:validInput.processId,verification_code_hash:null,object_path:'pending/owner.pdf',expires_at:new Date(Date.now()+('expired' in change?-60_000:60_000)).toISOString(),status:'PENDING'};
      globalThis.fetch=async(url,init)=>{
        if(init?.method==='DELETE'){removed++;return new Response(null,{status:204});}
        if(init?.method==='PATCH'){
          const query=new URL(String(url)).searchParams;
          if(query.get('select')==='*'){
            const expected:Record<string,string|null>={purpose:row.purpose,requester_hash:row.requester_hash,process_external_id:row.process_external_id,verification_code_hash:null};
            const matches=Object.entries(expected).every(([key,value])=>!query.has(key)||query.get(key)===(value===null?'is.null':`eq.${value}`))&&(!query.has('expires_at')||Date.parse(row.expires_at)>Date.parse(query.get('expires_at')!.slice(3)));
            if(!matches)return new Response('[]',{status:200});
            state='CONSUMING';return new Response(JSON.stringify([row]),{status:200});
          }
          state=JSON.parse(String(init.body)).status;return new Response(null,{status:204});
        }
        throw new Error('O objeto de outra sessão não pode ser consultado.');
      };
      const {expired:_,...overrides}=change as typeof change & {expired?:boolean};
      await assert.rejects(withDriveStagedUpload({...validInput,...overrides},async()=>{consumed++;}),/Upload inexistente|não pertence/);
      assert.equal(state,'PENDING');assert.equal(removed,0);assert.equal(consumed,0);
    }
  } finally {globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
});

test('ticket legado é rejeitado sem ler o binário no Supabase', async () => {
  const env={...process.env},originalFetch=globalThis.fetch;
  const bindingSecret='quota-test-binding-secret-longer-than-32-characters',input={uploadId:'00000000-0000-4000-8000-000000000002',purpose:'PROCESS_FULL_WORK' as const,requesterBinding:'session:owner:100',processId:'process-owner'};
  Object.assign(process.env,{NODE_ENV:'test',PORTAL_PERSISTENCE_PROVIDER:'supabase',SUPABASE_URL:'https://quota-test.supabase.co',SUPABASE_SECRET_KEY:'dummy-test-secret',PORTAL_UPLOAD_BINDING_SECRET:bindingSecret});
  const allowed=Buffer.from('%PDF-1.7'),statuses:string[]=[];let consumed=0;
  const row={id:input.uploadId,purpose:input.purpose,requester_hash:createHmac('sha256',bindingSecret).update(input.requesterBinding).digest('hex'),process_external_id:input.processId,verification_code_hash:null,object_path:'pending/owner.pdf',original_file_name:'tcc.pdf',mime_type:'application/pdf',expected_size:allowed.length,expected_sha256:createHash('sha256').update(allowed).digest('hex'),expires_at:new Date(Date.now()+60_000).toISOString()};
  globalThis.fetch=async(url,init)=>{
    if(init?.method==='PATCH'){
      if(new URL(String(url)).searchParams.get('select')==='*')return new Response(JSON.stringify([row]),{status:200});
      statuses.push(JSON.parse(String(init.body)).status);return new Response(null,{status:204});
    }
    throw new Error('Ticket legado não pode alcançar o armazenamento.');
  };
  try {
    const {withDriveStagedUpload}=await import('./supabaseStorageStaging');
    await assert.rejects(withDriveStagedUpload(input,async()=>{consumed++;}),/Selecione o arquivo novamente/);
    assert.equal(consumed,0);assert.deepEqual(statuses,['REJECTED']);
  } finally {globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
});

test('valida finalidade, MIME, extensão, tamanho e vínculo do staging', () => {
  assert.doesNotThrow(() => validateStagedUploadDescriptor({
    purpose: 'DOCUMENT_MODEL', requesterBinding: 'session:test', fileName: 'ata.docx',
    size: 1024, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sha256: validSha
  }));
  assert.throws(() => validateStagedUploadDescriptor({
    purpose: 'PROCESS_FULL_WORK', requesterBinding: 'session:test', fileName: 'tcc.pdf',
    size: 1024, mimeType: 'application/pdf', sha256: validSha
  }), /vinculado a um processo/i);
  assert.throws(() => validateStagedUploadDescriptor({
    purpose: 'VERIFICATION_PDF', requesterBinding: 'public:test', verificationCode: 'codigo', fileName: 'arquivo.docx',
    size: 1024, mimeType: 'application/pdf', sha256: validSha
  }), /extensão esperada/i);
});

test('depósito final limita o PDF integral e o resumo expandido a 24 MiB', () => {
  const maxSize = 24 * 1024 * 1024;
  for (const purpose of ['PROCESS_FULL_WORK', 'PROCESS_EXPANDED_ABSTRACT'] as const) {
    const input = { purpose, requesterBinding: 'session:test', processId: 'process-test',
      fileName: 'trabalho.pdf', size: maxSize, mimeType: 'application/pdf', sha256: validSha };
    assert.doesNotThrow(() => validateStagedUploadDescriptor(input));
    assert.throws(() => validateStagedUploadDescriptor({ ...input, size: maxSize + 1 }), /tamanho/i);
    assert.throws(() => validateStagedUploadDescriptor({ ...input, mimeType: 'image/png' }), /MIME incompatível/);
  }
});

test('quota do Drive é anterior ao arquivo e permanece vinculada à pessoa após renovar a sessão', async () => {
  await withDriveFixture(async driveFetch=>{
    const rows:any[]=[];
    globalThis.fetch=async(url,init)=>{
      const address=String(url);
      if(address.includes('/portal_upload_staging')){
        rows.push(JSON.parse(String(init?.body)));
        return Response.json({}, {status:429});
      }
      return driveFetch(address,init) ?? Promise.reject(new Error('A reserva negada não deve criar arquivo.'));
    };
    const {createDriveStagedUpload,StagedUploadCapacityError}=await import('./supabaseStorageStaging');
    for(const issuedAt of [100,200])await assert.rejects(createDriveStagedUpload({
      purpose:'PROCESS_FULL_WORK',requesterBinding:`session:mesma-pessoa:${issuedAt}`,processId:'processo-oficial',
      fileName:'tcc.pdf',size:1024,mimeType:'application/pdf',sha256:validSha,
    },{rootFolderId:'academic_root_123',origin:'https://portal.example.invalid'}),StagedUploadCapacityError);
    assert.equal(rows.length,2);
    assert.equal(rows[0].principal_hash,rows[1].principal_hash);
    assert.notEqual(rows[0].requester_hash,rows[1].requester_hash);
    assert.equal(rows[0].object_path,'pending/drive/fixture_file_123');
  });
});

test('limpeza mantém reservas até expirar a URL do provedor, além do prazo do aplicativo', async () => {
  const env={...process.env};const originalFetch=globalThis.fetch;let requested='';const before=Date.now();
  Object.assign(process.env,{NODE_ENV:'test',PORTAL_PERSISTENCE_PROVIDER:'supabase',SUPABASE_URL:'https://quota-test.supabase.co',SUPABASE_SECRET_KEY:'dummy-test-secret',PORTAL_UPLOAD_BINDING_SECRET:'quota-test-binding-secret-longer-than-32-characters'});
  globalThis.fetch=async(url)=>{requested=String(url);return new Response('[]',{status:200});};
  try{
    const {cleanupExpiredStagedUploads}=await import('./supabaseStorageStaging');assert.equal(await cleanupExpiredStagedUploads(),0);
    const query=new URL(requested).searchParams;const cutoff=Date.parse(query.get('created_at')!.slice(3));
    assert.ok(cutoff<=Date.now()-134*60_000);assert.ok(cutoff>=before-136*60_000);assert.ok(query.has('expires_at'));
  }finally{globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
});

test('prévia sem cota não envia bytes a nenhum armazenamento', async () => {
  await withDriveFixture(async driveFetch=>{
    const requests:string[]=[];
    globalThis.fetch=async(url,init)=>{
      const address=String(url);
      requests.push(address);
      if(address.includes('/portal_download_transfers')){
        return init?.method==='POST' ? Response.json({}, {status:429}) : Response.json([]);
      }
      return driveFetch(address,init) ?? Promise.reject(new Error('Objeto não pode ser criado sem reserva.'));
    };
    const {createDrivePreviewTransfer,StagedUploadCapacityError}=await import('./supabaseStorageStaging');
    await assert.rejects(createDrivePreviewTransfer({
      rootFolderId:'academic_root_123',bytes:Buffer.from('%PDF-1.7\n'),
      fileName:'teste.pdf',mimeType:'application/pdf',requesterBinding:'session:fixture:123',
    }),StagedUploadCapacityError);
    assert.ok(requests.every(url=>!url.includes('/storage/v1/')&&!url.includes('/upload/drive/')));
  });
});

test('staging não aceita finalidade antiga de comprovante de reserva anexado',()=>{
 const proof={purpose:'LOCATION_PROOF',requesterBinding:'session:student',processId:'process-test',fileName:'reserva.pdf',size:1024,mimeType:'application/pdf',sha256:validSha};
 assert.throws(()=>validateStagedUploadDescriptor(proof as any),/Finalidade de upload inválida/);
});

test('limpeza ainda remove objetos temporários antigos de comprovantes de reserva',async()=>{
 const env={...process.env},originalFetch=globalThis.fetch,removed:string[]=[];
 Object.assign(process.env,{NODE_ENV:'test',PORTAL_PERSISTENCE_PROVIDER:'supabase',SUPABASE_URL:'https://quota-test.supabase.co',SUPABASE_SECRET_KEY:'dummy-test-secret',PORTAL_UPLOAD_BINDING_SECRET:'quota-test-binding-secret-longer-than-32-characters'});
 globalThis.fetch=async(url,init)=>{
  if(init?.method==='DELETE'){
   removed.push(String(url));
   if(String(url).includes('/object/'))assert.deepEqual(JSON.parse(String(init.body)),{prefixes:['pending/location_proof/old-object.pdf']});
   return new Response(null,{status:204});
  }
  return new Response(JSON.stringify([{id:'old-reservation-ticket',purpose:'LOCATION_PROOF',object_path:'pending/location_proof/old-object.pdf'}]),{status:200});
 };
 try{
  const {cleanupExpiredStagedUploads}=await import('./supabaseStorageStaging');
  assert.equal(await cleanupExpiredStagedUploads(),1);
  assert.equal(removed.length,2);assert.ok(removed[1].endsWith('/portal_upload_staging?id=eq.old-reservation-ticket'));
 }finally{globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
});

test('autoriza envio no Drive, valida os bytes e limpa a transferência sem gravar no Storage', async () => {
  await withDriveFixture(async driveFetch=>{
    const { PDFDocument } = await import('pdf-lib');
    const document = await PDFDocument.create();
    document.addPage();
    const bytes=Buffer.from(await document.save());
    const sha256=createHash('sha256').update(bytes).digest('hex');
    const {createDriveStagedUpload,withDriveStagedUpload}=await import('./supabaseStorageStaging');
    const origin='https://portal.example.invalid';
    const oldFolder=process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;
    process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID='technical_root_123';
    let row:any;
    let storedFile:any;
    let completed=false;
    const driveFileId='fixture_file_123';
    const uploadUrl=`https://www.googleapis.com/upload/drive/v3/files/${driveFileId}?upload_id=fixture`;
    const requests:string[]=[];
    globalThis.fetch=async(url,init)=>{
      const address=String(url);
      requests.push(address);
      const method=init?.method||'GET';
      if(address.includes('/portal_upload_staging')){
        const data=JSON.parse(String(init?.body));
        if(method==='POST'){row=data;return new Response(null,{status:201});}
        if(method==='PATCH'){
          row={...row,...data};
          return address.includes('select=')?Response.json([row]):new Response(null,{status:204});
        }
      }
      const common=driveFetch(address,init);
      if(common)return common;
      if(address.includes('/permissions?'))return Response.json({permissions:[{type:'user',role:'owner'}]});
      if(address.includes('/files/technical_root_123?'))return Response.json({id:'technical_root_123',mimeType:'application/vnd.google-apps.folder',parents:['owner_root'],capabilities:{canAddChildren:true}});
      if(address.startsWith('https://www.googleapis.com/drive/v3/files?q='))return Response.json({files:[{id:'transfer_folder_123',name:'03_TEMPORARIOS_DOCUMENTAIS'}]});
      if(address.startsWith('https://www.googleapis.com/drive/v3/files?')&&method==='POST'){
        storedFile=JSON.parse(String(init?.body));
        assert.deepEqual(storedFile.parents,['transfer_folder_123']);
        assert.doesNotMatch(storedFile.name,/original/);
        return Response.json({id:driveFileId});
      }
      if(address.includes('uploadType=resumable')&&method==='PATCH'){
        assert.equal(new Headers(init?.headers).get('Origin'),origin);
        return new Response(null,{headers:{Location:uploadUrl}});
      }
      if(address===uploadUrl&&method==='PUT'){
        assert.equal(init?.body,bytes);
        completed=true;
        return Response.json({id:driveFileId});
      }
      if(address.includes(`/files/${driveFileId}?`)){
        if(method==='DELETE'){storedFile=undefined;return new Response(null,{status:204});}
        if(address.includes('alt=media')){
          assert.equal(completed,true);
          return new Response(bytes,{headers:{'Content-Type':'application/pdf'}});
        }
        return Response.json({...storedFile,size:String(bytes.length),trashed:false});
      }
      throw new Error(`Solicitação inesperada: ${method} ${address}`);
    };
    try{
      const owner={requesterBinding:'session:fixture:100',purpose:'PROCESS_FULL_WORK' as const,processId:'fixture_process'};
      const ticket=await createDriveStagedUpload({...owner,fileName:'original.pdf',size:bytes.length,mimeType:'application/pdf',sha256},{rootFolderId:'academic_root_123',origin});
      assert.equal(ticket.provider,'drive');
      assert.equal(ticket.uploadUrl,uploadUrl);
      await fetch(ticket.uploadUrl,{method:'PUT',body:bytes});
      const result=await withDriveStagedUpload({...owner,uploadId:ticket.uploadId},async file=>{
        assert.deepEqual(file.bytes,bytes);
        assert.equal(file.sha256,sha256);
        return file.fileName;
      });
      assert.equal(result,'original.pdf');
      assert.equal(row.status,'CONSUMED');
      assert.equal(storedFile,undefined);
      assert.equal(requests.some(url=>url.includes('/storage/v1/')),false);
    }finally{
      if(oldFolder===undefined)delete process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID;
      else process.env.PORTAL_DRIVE_TECHNICAL_FOLDER_ID=oldFolder;
    }
  });
});

test('prévia no Drive exige o vínculo atual e a mesma sessão antes de ler o binário', async () => {
  await withDriveFixture(async driveFetch=>{
    const {readDrivePreviewTransfer}=await import('./supabaseStorageStaging');
    const id='00000000-0000-4000-8000-000000000004';
    const session='session:advisor:100';
    const bytes=Buffer.from('%PDF-1.4\npreview\n');
    const row={
      id,object_path:'downloads/drive/fixture_file_123',requester_hash:createHmac('sha256',process.env.PORTAL_UPLOAD_BINDING_SECRET!).update(session).digest('hex'),
      process_external_id:'process-test',expires_at:new Date(Date.now()+60_000).toISOString(),
      file_name:'previa.pdf',mime_type:'application/pdf',size_bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),
    };
    let mediaReads=0;
    globalThis.fetch=async(url,init)=>{
      const address=String(url);
      if(address.includes('/portal_download_transfers'))return Response.json([row]);
      const common=driveFetch(address,init);
      if(common)return common;
      if(address.includes('/permissions?'))return Response.json({permissions:[{type:'user',role:'owner'}]});
      if(address.includes('alt=media')){mediaReads++;return new Response(bytes);}
      if(address.includes('/files/fixture_file_123?'))return Response.json({id:'fixture_file_123',size:String(bytes.length),mimeType:row.mime_type,trashed:false,appProperties:{portal:'portal-tcc',transferId:id}});
      throw new Error(`Solicitação inesperada: ${address}`);
    };
    assert.equal(await readDrivePreviewTransfer(id,'session:other:200',()=>true),null);
    assert.equal(await readDrivePreviewTransfer(id,session,()=>false),null);
    assert.equal(mediaReads,0);
    const file=await readDrivePreviewTransfer(id,session,processId=>processId==='process-test');
    assert.deepEqual(file?.bytes,bytes);
    assert.equal(mediaReads,1);
    row.sha256='0'.repeat(64);
    await assert.rejects(readDrivePreviewTransfer(id,session,()=>true),/integridade da prévia/);
  });
});
