import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import { buildProcessArchiveFileName, buildSupersededAppProperties, downloadDrivePdf, isUnsafePrivateContainerPermission, listDriveFilePermissions } from './googleDriveArchive';

test('paginação ACL repetida não produz validação parcial nem consulta infinita',async t=>{
  let requests=0;
  t.mock.method(globalThis,'fetch',async()=>{
    requests++;return new Response(JSON.stringify({permissions:[{type:'user',role:'owner'}],nextPageToken:'repeated'}));
  });
  await assert.rejects(listDriveFilePermissions('test-token','file-test-id-123'),/concluir a conferência/);
  assert.equal(requests,2);
});

test('download privado confere todas as páginas ACL antes de buscar o conteúdo',async t=>{
  let media=0;
  t.mock.method(globalThis,'fetch',async(input:unknown)=>{
    const url=new URL(String(input));
    if(url.pathname.endsWith('/permissions'))return new Response(JSON.stringify(url.searchParams.has('pageToken')?{permissions:[{type:'anyone',role:'reader'}]}:{permissions:[{type:'user',role:'owner'}],nextPageToken:'second'}));
    media++;throw new Error('Nenhum conteúdo pode ser lido de um arquivo amplamente compartilhado.');
  });
  await assert.rejects(downloadDrivePdf('test-token','file-test-id-123'),/compartilhamento público/);
  assert.equal(media,0);
});

test('download do Drive cancela resposta acima do limite antes de carregar o PDF',async t=>{
  let cancelled=false;
  t.mock.method(globalThis,'fetch',async(input:unknown)=>{
    const url=String(input);
    if(url.includes('/permissions?'))return new Response(JSON.stringify({permissions:[{type:'user',role:'owner'}]}));
    if(!url.includes('alt=media'))return new Response(JSON.stringify({name:'ata.pdf',mimeType:'application/pdf'}));
    return new Response(new ReadableStream<Uint8Array>({start(controller){controller.enqueue(Buffer.from('%PDF-1.7'));},pull(controller){controller.close();},cancel(){cancelled=true;}}),{headers:{'content-length':String(50*1024*1024+1)}});
  });
  await assert.rejects(downloadDrivePdf('test-token','file-test-id-123'),/limite seguro de 50 MB/);
  assert.equal(cancelled,true);
});

test('download do Drive preserva os bytes e valida vínculo e hash registrados',async t=>{
  const pdf=Buffer.from('%PDF-1.7\nconteudo-assinado'),sha256=createHash('sha256').update(pdf).digest('hex');
  t.mock.method(globalThis,'fetch',async(input:unknown,init?:RequestInit)=>{
    assert.ok(init?.signal instanceof AbortSignal);
    assert.equal(init.signal.aborted,false);
    const url=String(input);
    if(url.includes('/permissions?'))return new Response(JSON.stringify({permissions:[{type:'user',role:'owner'}]}));
    if(!url.includes('alt=media'))return new Response(JSON.stringify({name:'ata.pdf',mimeType:'application/pdf',appProperties:{portal:'portal-tcc',portalProcessId:'process-owner',artifactType:'ATA',sha256}}));
    return new Response(pdf,{headers:{'content-length':String(pdf.length)}});
  });
  const result=await downloadDrivePdf('test-token','file-test-id-123',{processId:'process-owner',artifactType:'ATA'});
  assert.deepEqual(result.pdf,pdf);assert.equal(result.fileName,'ata.pdf');
  await assert.rejects(downloadDrivePdf('test-token','file-test-id-123',{processId:'process-other'}),/não pertence a este processo/);
});

test('nome de formulário contém código, alunos, tipo e versão', () => {
  assert.equal(
    buildProcessArchiveFileName({
      protocol: 'TCC-2026-0042',
      studentNames: ['Ana Vitória', 'João D’Ávila'],
      artifactLabel: 'FORMULARIO_DADOS_FINAIS',
      version: 2
    }),
    'TCC_2026_0042__ANA_E_JOAO__FORMULARIO_DADOS_FINAIS__v002.pdf'
  );
});

test('nome de arquivo remove caracteres impróprios do Drive', () => {
  const fileName = buildProcessArchiveFileName({
    protocol: 'TCC/2026:*0001',
    studentNames: ['Aluno <Teste>'],
    artifactLabel: 'Cadastro inicial',
    version: 1,
    extension: '.p$d$f'
  });
  assert.match(fileName, /^TCC_2026_0001__ALUNO__CADASTRO_INICIAL__v001\.pdf$/);
});


test('pasta privada aceita usuários nominais e bloqueia compartilhamento amplo', () => {
  assert.equal(isUnsafePrivateContainerPermission({type:'user',role:'writer',emailAddress:'secretaria@ufes.br'}), false);
  assert.equal(isUnsafePrivateContainerPermission({type:'user',role:'reader',emailAddress:'docente@ufes.br'}), false);
  assert.equal(isUnsafePrivateContainerPermission({type:'anyone',role:'reader'}), true);
  assert.equal(isUnsafePrivateContainerPermission({type:'domain',role:'reader',domain:'ufes.br'}), true);
  assert.equal(isUnsafePrivateContainerPermission({type:'group',role:'reader'}), true);
});


test('preserva metadados do arquivo substituído', () => {
  const result=buildSupersededAppProperties({portal:'portal-tcc',sha256:'abc',artifactType:'TRABALHO_COMPLETO'},'novo-id','2026-09-12T20:00:00.000Z');
  assert.deepEqual(result,{portal:'portal-tcc',sha256:'abc',artifactType:'TRABALHO_COMPLETO',lifecycle:'SUPERSEDED',supersededBy:'novo-id',supersededAt:'2026-09-12T20:00:00.000Z'});
});
