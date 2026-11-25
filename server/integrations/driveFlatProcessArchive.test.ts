import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import type {LegacyAcademicRecord} from '../../src/types/legacyArchive';
import type {ProcessData} from '../../src/types';
import {buildDriveProcessDataMarkdown,buildDriveProcessFileName,buildDriveProcessFolderName,driveProcessAuthorLabel} from '../../src/utils/driveProcessLayout';
import {ensureProcessDriveStructure} from '../../src/services/googleDriveOrganizer';
import {deleteProcessDriveArtifacts,ensurePortalProcessDriveFolder,renamePortalProcessFolder,resolveOriginalDriveBrowserLinks,syncProcessDataMarkdown,uploadGeneratedPdfToDrive,uploadProcessFormPdf,uploadProcessSourcePdf} from './googleDriveArchive';

const folderMime='application/vnd.google-apps.folder';
const pdf=Buffer.from('%PDF-1.7\nsynthetic fixture'),sha256=createHash('sha256').update(pdf).digest('hex');
const fixture=()=>({
  root_fixture_123:{id:'root_fixture_123',name:'Portal TCC',mimeType:folderMime},
  processes_fixture_123:{id:'processes_fixture_123',name:'Processos',parents:['root_fixture_123'],mimeType:folderMime},
  process_fixture_123:{id:'process_fixture_123',name:'TCC - 00001 - Maria Luísa e Pedro Rangel',parents:['processes_fixture_123'],mimeType:folderMime,appProperties:{portalProcessId:'process-1'},properties:{portalDriveLayout:'flat-v1'}}
});

function mockDrive(t:any,initial:Record<string,any>,strongEtag=true){
  const files=structuredClone(initial),writes:Array<{method:string;metadata:any}>=[];let sequence=0;const versions=new Map(Object.keys(files).map(id=>[id,1]));
  t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
    const url=new URL(String(input)),id=url.pathname.split('/').pop()!,method=init?.method||'GET';
    if(id==='generateIds')return Response.json({ids:[`reserved_data_file_${++sequence}`]});
    if(url.pathname.endsWith('/permissions'))return Response.json({permissions:[{type:'user',role:'owner',emailAddress:'owner@example.invalid'}]});
    if(method==='DELETE'){writes.push({method,metadata:{id}});delete files[id];return new Response(null,{status:204});}
    if(method==='POST'||method==='PATCH'){
      let metadata:any;
      if(url.pathname.includes('/upload/')){
        const body=Buffer.from(init?.body as any).toString();
        metadata=JSON.parse(body.split('\r\n\r\n')[1].split('\r\n--')[0]);
      }else metadata=JSON.parse(String(init?.body));
      const match=new Headers(init?.headers).get('if-match');
      if(method==='PATCH'&&match&&match!==`"${id}-${versions.get(id)||1}"`)return new Response(null,{status:412});
      writes.push({method,metadata});
      const target=method==='POST'?metadata.id||`new_file_fixture_${++sequence}`:id;
      files[target]={...files[target],...metadata,id:target};
      if(url.pathname.includes('/upload/')&&metadata.mimeType==='text/markdown'){const text=Buffer.from(init?.body as any).toString().split('\r\n\r\n')[2].split('\r\n--')[0];files[target].sha256Checksum=createHash('sha256').update(text).digest('hex');}
      versions.set(target,(versions.get(target)||0)+1);
      return Response.json(files[target],{headers:{etag:strongEtag?`"${target}-${versions.get(target)}"`:''}});
    }
    if(id==='files'){
      const query=url.searchParams.get('q')||'',parent=/'([^']+)' in parents/.exec(query)?.[1];
      const names=[...query.matchAll(/name = '([^']+)'/g)].map(match=>match[1]);
      const props=[...query.matchAll(/key='([^']+)' and value='([^']+)'/g)].map(match=>[match[1],match[2]]);
      const indexQuery=query.includes("key='portalProcessData'");
      return Response.json({files:Object.values(files).filter((file:any)=>{
        const indexMatch=props.filter(([key])=>key==='portalProcessId').every(([,value])=>file.properties?.portalProcessId===value)&&file.properties?.portalProcessData==='flat-v1'
          ||props.filter(([key])=>key==='portalProcessId').every(([,value])=>file.appProperties?.portalProcessId===value)&&file.appProperties?.artifactType==='PROCESS_DATA'||names.includes(file.name);
        return (!parent||file.parents?.includes(parent))&&(!query.includes(`mimeType = '${folderMime}'`)||file.mimeType===folderMime)&&(indexQuery?indexMatch:(!names.length||names.includes(file.name))&&props.every(([key,value])=>file.appProperties?.[key]===value));
      })});
    }
    return files[id]?Response.json(files[id],{headers:{etag:strongEtag?`"${id}-${versions.get(id)||1}"`:''}}):new Response(null,{status:404});
  });
  return{files,writes,versions};
}

test('rótulos usam dois elementos por autor, preservam acentos e ordem acadêmica original',()=>{
  const authors=['Pedro Rangel dos Santos','Maria Luísa Almeida'];
  assert.equal(buildDriveProcessFolderName({protocol:'TCC - 00001',studentNames:authors}),'TCC - 00001 - Maria Luísa e Pedro Rangel');
  assert.equal(buildDriveProcessFolderName({protocol:'001 - Legado',studentNames:authors,legacy:true}),'001 - Legado - Maria Luísa e Pedro Rangel');
  assert.deepEqual(authors,['Pedro Rangel dos Santos','Maria Luísa Almeida']);
  assert.equal(driveProcessAuthorLabel(['ANA MARIA SILVA','ANA DA ROCHA']),'Ana Rocha e Ana Maria');
  assert.equal(driveProcessAuthorLabel(['NATHALY DE SOUZA DOS SANTOS']),'Nathaly Souza');
  assert.match(buildDriveProcessFileName({kind:'AVALIACAO',version:2}),/^00 - Registro de avaliação - v002\.pdf$/);
  assert.match(buildDriveProcessFileName({kind:'AVALIACAO_LEGADO'}),/^08 - /);
  assert.match(buildDriveProcessFileName({kind:'FORMULARIO_CONFIRMACAO_LOCAL',version:1}),/^01 - Comprovante de reserva - v001\.pdf$/);
  assert.match(buildDriveProcessFileName({kind:'CONVITE',version:1,lifecycle:'GERADO'}),/^02 - Carta-convite/);
  assert.equal(buildDriveProcessFileName({kind:'DADOS',protocol:'TCC - 00001',studentNames:authors,version:5}),'00 - Dados do processo.md');
});

test('Markdown contém somente os dados acadêmicos existentes, nomes completos e no máximo cinco palavras-chave',()=>{
  const record={id:'legacy-1',protocolo:'001 - Legado',titulo:'Título existente',autores:['Pedro Rangel dos Santos','Maria Luísa Almeida'],orientador:'Orientador Completo',coorientador:'',examinadores:[],dataDefesa:'',horaDefesa:'',localDefesa:'',resumo:'Resumo existente',palavrasChave:['um','dois','três','quatro','cinco','seis'],provenance:{token:'secret-fixture',email:'private@example.invalid'}} as unknown as LegacyAcademicRecord;
  const markdown=buildDriveProcessDataMarkdown(record);
  assert.match(markdown,/Pedro Rangel dos Santos; Maria Luísa Almeida/);
  assert.match(markdown,/Não cadastrado/);assert.match(markdown,/Resumo existente/);
  assert.doesNotMatch(markdown,/secret-fixture|private@example|seis/);
  assert.match(markdown,/Instituição do orientador:\*\* Não cadastrado/);
  assert.equal(markdown,buildDriveProcessDataMarkdown(record));
});

test('Markdown espelha instituições, formato e histórico de reserva sem serializar contatos ou respostas internas',()=>{
  const record={protocolo:'TCC - 00001',titulo:'Título',aluno1:{nome:'Autora Completa',email:'private@example.invalid'},aluno2:null,orientador:{nome:'Orientadora Completa',instituicao:'Instituição cadastrada'},coorientador:{nome:'Coorientador Completo',instituicao:'Outra instituição'},banca:[{nome:'Examinadora Completa',instituicao:'Instituição externa'}],status:'AGUARDANDO_DEFESA',etapaAtual:'DEFESA',defesa:{startAt:'2026-11-17T10:00:00-03:00',endAt:'2026-11-17T11:00:00-03:00',local:'Sala atual',formato:'Presencial',reservationRevision:2,localStatus:'CONFIRMADO',localConfirmedAt:'2026-11-16T12:00:00Z',departmentResponse:{decision:'CONFIRMED',respondedAt:'2026-11-16T12:00:00Z',receiptBody:'secret internal response'},reservationHistory:[{reservationRevision:1,startAt:'2026-11-15T10:00:00-03:00',local:'Sala anterior',localStatus:'NEGADO',invalidatedAt:'2026-11-16T10:00:00Z',invalidatedBy:'private@example.invalid'}]}} as unknown as ProcessData;
  const markdown=buildDriveProcessDataMarkdown(record);
  for(const expected of ['Instituição cadastrada','Outra instituição','Instituição externa','Presencial','Sala atual','Sala anterior','Confirmado','Negado','2026-11-16T12:00:00Z'])assert.ok(markdown.includes(expected));
  assert.doesNotMatch(markdown,/private@example|secret internal response/);
});

test('pasta nova é plana e um ID persistido continua válido após renomeação',async t=>{
  const {files,writes}=mockDrive(t,fixture());
  const input={accessToken:'fixture',rootFolderId:'root_fixture_123',protocol:'TCC - 00001',processId:'process-1',studentNames:['Pedro Rangel','Maria Luísa']};
  assert.equal((await ensurePortalProcessDriveFolder(input)).id,'process_fixture_123');
  files.process_fixture_123.name='Nome alterado manualmente';
  assert.equal((await ensurePortalProcessDriveFolder({...input,folderId:'process_fixture_123'})).id,'process_fixture_123');
  assert.equal(files.process_fixture_123.name,'TCC - 00001 - Maria Luísa e Pedro Rangel');
  assert.equal(writes.length,1);
  const created=await ensurePortalProcessDriveFolder({...input,protocol:'TCC - 00002',processId:'process-2'});
  assert.deepEqual(files[created.id].parents,['processes_fixture_123']);
  assert.equal(files[created.id].name,'TCC - 00002 - Maria Luísa e Pedro Rangel');
  assert.equal(writes.filter(item=>item.metadata.mimeType===folderMime).length,1);
});

test('ID de pasta fora de Processos ou de outro processo é recusado antes de escrever',async t=>{
  const {files,writes}=mockDrive(t,fixture());
  const input={accessToken:'fixture',rootFolderId:'root_fixture_123',protocol:'TCC - 00001',processId:'process-1',folderId:'process_fixture_123'};
  files.process_fixture_123.parents=['root_fixture_123'];
  await assert.rejects(ensurePortalProcessDriveFolder(input),/árvore/);
  files.process_fixture_123.parents=['processes_fixture_123'];files.process_fixture_123.appProperties.portalProcessId='foreign';
  await assert.rejects(ensurePortalProcessDriveFolder(input),/não corresponde/);assert.equal(writes.length,0);
});

test('organizador do cliente reutiliza o ID persistido e corrige o rótulo sem criar outra pasta',async t=>{
  const {files,writes}=mockDrive(t,fixture());
  const result=await ensureProcessDriveStructure('fixture','processes_fixture_123',{id:'process-1',protocolo:'TCC - 00001',driveFolderId:'process_fixture_123',aluno1:{nome:'Maria Luísa Almeida',email:'',matricula:''},aluno2:null});
  assert.equal(result.root.id,'process_fixture_123');assert.equal(result.createdCount,0);
  assert.equal(files.process_fixture_123.name,'TCC - 00001 - Maria Luísa');
  assert.deepEqual(writes.map(write=>write.method),['PATCH']);
});

test('marca de organização é compartilhada entre aplicativos, preservada e idempotente',async t=>{
  const initial=fixture();initial.process_fixture_123.properties={external:'preservada'} as any;
  const {files,writes}=mockDrive(t,initial),input={accessToken:'fixture',rootFolderId:'root_fixture_123',protocol:'TCC - 00001',processId:'process-1',folderId:'process_fixture_123'};
  await ensurePortalProcessDriveFolder(input);await ensurePortalProcessDriveFolder(input);
  assert.deepEqual(files.process_fixture_123.properties,{external:'preservada',portalDriveLayout:'flat-v1'});
  assert.equal(writes.length,1);assert.equal(writes[0].method,'PATCH');
  assert.equal(writes[0].metadata.appProperties,undefined);assert.equal(writes[0].metadata.parents,undefined);
});

test('exclusão não confia em tag de processo numa pasta fora da raiz acadêmica',async t=>{
  const initial:any=fixture();
  initial.foreign_process_123={id:'foreign_process_123',name:'TCC - 00999 - Autora Completa',mimeType:folderMime,parents:['foreign_processes_123'],appProperties:{portalProcessId:'foreign-1'}};
  initial.foreign_processes_123={id:'foreign_processes_123',name:'Processos',mimeType:folderMime,parents:['foreign_root_123']};
  const {writes}=mockDrive(t,initial);
  await assert.rejects(deleteProcessDriveArtifacts({accessToken:'fixture',processId:'foreign-1',protocol:'TCC - 00999',rootFolderId:'root_fixture_123',fileIds:[],protectedIds:[]}),/árvore/);
  assert.equal(writes.length,0);
});

test('uploads novos vão diretamente ao processo e repetição recupera os originais nas subpastas antigas',async t=>{
  const {files,writes}=mockDrive(t,fixture()),common={accessToken:'fixture',processFolderId:'process_fixture_123',processId:'process-1',pdf,sha256};
  const form=await uploadProcessFormPdf({...common,protocol:'TCC - 00001',studentNames:['Maria Luísa'],formType:'CONFIRMACAO_LOCAL',version:1});
  const source=await uploadProcessSourcePdf({...common,artifactType:'TRABALHO_COMPLETO',version:1,fileName:'06 - TCC.pdf'});
  const generated=await uploadGeneratedPdfToDrive({...common,rootFolderId:'root_fixture_123',protocol:'TCC - 00001',jobId:'job-1',documentType:'CONVITE',fileName:'02 - Carta-convite.pdf'});
  for(const file of [form,source,generated])assert.deepEqual(files[file.id].parents,['process_fixture_123']);
  assert.equal(writes.filter(write=>write.metadata.mimeType===folderMime).length,0);
  files.old_subfolder_123={id:'old_subfolder_123',name:'00_FORMULARIOS',mimeType:folderMime,parents:['process_fixture_123']};
  files[form.id].parents=['old_subfolder_123'];files[source.id].parents=['old_subfolder_123'];
  files.old_documents_123={id:'old_documents_123',name:'01_DOCUMENTOS',mimeType:folderMime,parents:['root_fixture_123']};files[generated.id].parents=['old_documents_123'];
  assert.equal((await uploadProcessFormPdf({...common,protocol:'TCC - 00001',studentNames:[],formType:'CONFIRMACAO_LOCAL',version:1})).id,form.id);
  assert.equal((await uploadProcessSourcePdf({...common,artifactType:'TRABALHO_COMPLETO',version:1,fileName:'06 - TCC.pdf'})).id,source.id);
  assert.equal((await uploadGeneratedPdfToDrive({...common,rootFolderId:'root_fixture_123',jobId:'job-1',documentType:'CONVITE',fileName:'02 - Carta-convite.pdf'})).id,generated.id);
  assert.equal(writes.length,3);
});

test('espelho Markdown preserva ID, não grava conteúdo igual e atualiza somente conteúdo diferente',async t=>{
  const {files,writes}=mockDrive(t,fixture()),input:any={accessToken:'fixture',processFolderId:'process_fixture_123',processId:'process-1',markdown:'# Dados reais\n',revision:1,assertCurrent:()=>true};input.bindFileId=async(id:string)=>{input.fileId=id;};
  const created=await syncProcessDataMarkdown(input);
  assert.equal((await syncProcessDataMarkdown(input)).id,created.id);assert.equal(writes.length,1);
  assert.equal((await syncProcessDataMarkdown({...input,revision:2,markdown:'# Dados corrigidos\n'})).id,created.id);
  assert.equal(writes.length,2);assert.equal(writes[1].method,'PATCH');assert.deepEqual(files[created.id].parents,['process_fixture_123']);
});

test('Markdown criado por outro aplicativo é descoberto por propriedades públicas sem criar cópia',async t=>{
  const initial:any=fixture(),markdown='# Registro existente\n',contentSha=createHash('sha256').update(markdown).digest('hex');
  initial.cross_app_data_123={id:'cross_app_data_123',name:'00 - Dados do processo.md',mimeType:'text/markdown',parents:['process_fixture_123'],sha256Checksum:contentSha,properties:{portalProcessData:'flat-v1',portalProcessId:'process-1',portalProcessDataSha256:contentSha,portalProcessDataRevision:'1',external:'preservada'}};
  const {files,writes}=mockDrive(t,initial),input:any={accessToken:'fixture',processFolderId:'process_fixture_123',processId:'process-1',markdown,revision:1,assertCurrent:()=>true};input.bindFileId=async(id:string)=>{input.fileId=id;};
  assert.equal((await syncProcessDataMarkdown(input)).id,'cross_app_data_123');assert.equal(writes.length,0);
  assert.equal((await syncProcessDataMarkdown({...input,revision:2,markdown:'# Registro corrigido\n'})).id,'cross_app_data_123');
  assert.deepEqual(writes.map(write=>write.method),['PATCH']);assert.equal(files.cross_app_data_123.properties.external,'preservada');
  assert.equal(Object.values(files).filter((file:any)=>file.name==='00 - Dados do processo.md').length,1);
});
test('Markdown update refuses a newer revision, a missing strong ETag and a concurrent Drive change',async t=>{
  const id='versioned_data_file_123',old='# Revisão antiga\n',oldSha=createHash('sha256').update(old).digest('hex');
  for(const scenario of ['newer','no-etag','concurrent','stale-portal']){
    const initial:any=fixture();initial[id]={id,name:'00 - Dados do processo.md',mimeType:'text/markdown',parents:['process_fixture_123'],sha256Checksum:oldSha,properties:{portalProcessData:'flat-v1',portalProcessId:'process-1',portalProcessDataSha256:oldSha,portalProcessDataRevision:scenario==='newer'?'8':'1'}};
    const {files,writes,versions}=mockDrive(t,initial,scenario!=='no-etag');let checks=0;
    const input={accessToken:'fixture',processFolderId:'process_fixture_123',processId:'process-1',fileId:id,revision:2,markdown:'# Revisão nova\n',assertCurrent:()=>{
      checks++;
      if(checks===3&&scenario==='concurrent'){versions.set(id,2);files[id].properties.portalProcessDataRevision='3';files[id].sha256Checksum='f'.repeat(64);}
      return !(checks===3&&scenario==='stale-portal');
    }};
    await assert.rejects(syncProcessDataMarkdown(input),scenario==='newer'?/mais recente/:scenario==='no-etag'?/condição segura/:/mudaram|mudou/);
    assert.equal(writes.length,0,scenario+' must not overwrite the original');
    assert.equal(files[id].sha256Checksum,scenario==='concurrent'?'f'.repeat(64):oldSha);
  }
});

test('renomeação valida ancestralidade e preserva ID e vínculo do processo',async t=>{
  const {files,writes}=mockDrive(t,fixture());
  await renamePortalProcessFolder({accessToken:'fixture',rootFolderId:'root_fixture_123',fileId:'process_fixture_123',processId:'process-1',previousProtocol:'TCC - 00001',protocol:'TCC - 00002',studentNames:['Maria Luísa Almeida']});
  assert.equal(files.process_fixture_123.name,'TCC - 00002 - Maria Luísa');
  assert.equal(files.process_fixture_123.appProperties.portalProcessId,'process-1');assert.equal(writes.length,1);
});

test('links originais legados usam somente GET e exigem hash, origem e ACL já concedida',async t=>{
  const fileId='legacy_file_fixture_123',parentId='legacy_folder_fixture_123',links={view:`https://drive.google.com/file/d/${fileId}/view`,download:`https://drive.usercontent.google.com/download?id=${fileId}`};
  let publicRead=true,hash=sha256,parent=parentId,scans=0,extraEditor=false,publicWriter=false;
  t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
    const url=new URL(String(input));assert.equal(init?.method||'GET','GET');assert.equal(url.searchParams.has('alt'),false);
    if(url.pathname.endsWith('/permissions'))return Response.json({permissions:url.pathname.includes(fileId)&&publicRead?[{type:'anyone',role:publicWriter?'writer':'reader'},...(extraEditor?[{type:'user',role:'writer',emailAddress:'institution@example.invalid'}]:[])]:[{type:'user',role:'owner',emailAddress:'owner@example.invalid'}]});
    return Response.json({id:fileId,mimeType:'application/pdf',parents:[parent],sha256Checksum:hash,webViewLink:links.view,webContentLink:links.download});
  });
  const input={accessToken:'fixture',fileId,expectedSha256:sha256,expectedFolderId:parentId,publicRead:true,validatePublicContent:async()=>{scans++;}};
  assert.deepEqual(await resolveOriginalDriveBrowserLinks(input),links);assert.equal(scans,1);
  hash='a'.repeat(64);assert.equal(await resolveOriginalDriveBrowserLinks(input),null);assert.equal(scans,1);
  hash=sha256;publicRead=false;assert.equal(await resolveOriginalDriveBrowserLinks(input),null);
  assert.deepEqual(await resolveOriginalDriveBrowserLinks({...input,publicRead:false,email:'owner@example.invalid'}),links);
  publicRead=true;extraEditor=true;assert.deepEqual(await resolveOriginalDriveBrowserLinks(input),links);extraEditor=false;
  publicWriter=true;assert.equal(await resolveOriginalDriveBrowserLinks(input),null);publicWriter=false;
  assert.equal(await resolveOriginalDriveBrowserLinks({...input,validatePublicContent:async()=>{hash='b'.repeat(64);}}),null);hash=sha256;publicRead=false;
  parent='foreign_folder_fixture_123';assert.equal(await resolveOriginalDriveBrowserLinks({...input,publicRead:false,email:'owner@example.invalid'}),null);
});

test('a Drive response without a v3 ETag updates the same file using the matching v2 ETag', async t=>{
  const id='linked_process_data_123', parent='process_fixture_123';
  let revision='1', providerVersion='8', tokenVersion='8', writes=0, conflict=false;
  const input={accessToken:'fixture',processFolderId:parent,processId:'process-1',fileId:id,revision:2,markdown:'# Nova revisão\n',assertCurrent:()=>true};
  const file=()=>({id,name:'00 - Dados do processo.md',mimeType:'text/markdown',parents:[parent],version:providerVersion,
    properties:{portalProcessData:'flat-v1',portalProcessId:'process-1',portalProcessDataRevision:revision,
      portalProcessDataSha256:revision==='2'?createHash('sha256').update(input.markdown).digest('hex'):'a'.repeat(64)}});
  t.mock.method(globalThis,'fetch',async(url:unknown,options?:RequestInit)=>{
    const path=new URL(String(url)).pathname;
    if(path.endsWith('/permissions'))return Response.json({permissions:[]});
    if(path==='/drive/v3/files')return Response.json({files:[file()]});
    if(path===`/drive/v3/files/${id}`)return Response.json(file());
    if(path===`/drive/v2/files/${id}`)return Response.json({id,version:tokenVersion,etag:'"drive-token"'});
    assert.equal(path,`/upload/drive/v2/files/${id}`);
    assert.equal(options?.method,'PUT');
    assert.equal(new Headers(options?.headers).get('if-match'),'"drive-token"');
    if(conflict) return new Response(null,{status:412});
    const payload=Buffer.from(options?.body as Uint8Array).toString().split('\r\n\r\n')[1].split('\r\n--')[0];
    const metadata=JSON.parse(payload);
    assert.equal(metadata.title,'00 - Dados do processo.md');
    assert.ok(metadata.properties.some((p:Record<string,string>)=>p.key==='portalProcessDataRevision'&&p.value==='2'&&p.visibility==='PUBLIC'));
    writes++;
    revision='2';
    return Response.json({id});
  });
  tokenVersion='9';
  await assert.rejects(syncProcessDataMarkdown(input),/mudou no Drive/);
  assert.equal(writes,0);
  tokenVersion='8';
  conflict=true;
  await assert.rejects(syncProcessDataMarkdown(input),/mudou no Drive/);
  assert.equal(writes,0);
  conflict=false;
  assert.equal((await syncProcessDataMarkdown(input)).id,id);
  assert.equal(writes,1);
});
