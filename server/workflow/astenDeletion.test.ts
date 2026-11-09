import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileDeletedAstenEnvelope, type DeletionEnvelope} from './astenDeletion';

const fixture = (): DeletionEnvelope => ({id:'123', repositoryId:42, folderId:11, hash:'fixture-hash', signerCount:2, state:'PENDING'});
const details = (status: number) => ({Envelope:{id:123,status,hashSHA256:'fixture-hash'},Repositorio:{id:42},Pasta:{id:11}});
const pendingSigners = {listaSignatariosEnvelope:{SignatarioEnvelope:[{statusAssinatura:'Pendente'},{statusAssinatura:'Não assinado'}]}};

test('exclusão consulta a identidade Asten e preserva estados assinados, cancelados ou expirados', async () => {
  for (const [status, expected] of [[3,'PRESERVED'],[4,'PRESERVED'],[5,'CANCELED'],[6,'EXPIRED']] as const) {
    const envelope=fixture();
    await reconcileDeletedAstenEnvelope(envelope, {
      repositoryId:42, read:async()=>details(status),
      readSigners:async()=>assert.fail('Estado encerrado não precisa de consulta adicional'),
      cancel:async()=>assert.fail('Envelope encerrado não pode ser cancelado'),
      persist:async()=>assert.fail('Não houve mutação no provedor'),
    });
    assert.equal(envelope.state,expected);
  }
});

test('exclusão reconhece a resposta plana da consulta institucional e preserva o assinado', async () => {
  const envelope = fixture();
  await reconcileDeletedAstenEnvelope(envelope, {
    repositoryId: 42,
    read: async () => ({id: 123, status: 3, Repositorio: {id: 42}, Pasta: {id: 11}}),
    readSigners: async () => assert.fail('Envelope concluído não precisa de consulta adicional.'),
    cancel: async () => assert.fail('Envelope concluído deve ser preservado.'),
    persist: async () => assert.fail('A consulta não altera o provedor.'),
  });
  assert.equal(envelope.state, 'PRESERVED');
});

test('exclusão bloqueia Asten sem autorização ou vínculo exclusivo confirmado', async () => {
  for (const [patch, allow, remote] of [[{},false,details(2)],[{hash:'other-hash'},true,details(2)],[{},true,{...details(2),Repositorio:{id:43}}]] as const) {
    const envelope={...fixture(),...patch};
    await reconcileDeletedAstenEnvelope(envelope, {
      repositoryId:42, read:async()=>remote,
      readSigners:async()=>assert.fail('Consulta desnecessária quando vínculo ou autorização não foi confirmada'),
      cancel:allow?async()=>assert.fail('Asten não autorizada para este envelope'):undefined,
      persist:async()=>assert.fail('Não houve mutação no provedor'),
    });
    assert.equal(envelope.state,'REVIEW');
  }
});

test('exclusão não cancela envelope parcial ou com estado dos signatários desconhecido', async () => {
  for (const signers of [
    {listaSignatariosEnvelope:{SignatarioEnvelope:[{statusAssinatura:'Assinado'},{statusAssinatura:'Pendente'}]}},
    {listaSignatariosEnvelope:{SignatarioEnvelope:[{statusAssinatura:'Pendente'}]}},
    {},
  ]) {
    const envelope=fixture();
    await reconcileDeletedAstenEnvelope(envelope, {
      repositoryId:42, read:async()=>details(2), readSigners:async()=>signers,
      cancel:async()=>assert.fail('Não há evidência de que todas as assinaturas estão pendentes'),
      persist:async()=>assert.fail('Não houve mutação no provedor'),
    });
    assert.equal(envelope.state,'REVIEW');
  }
});

test('timeout após cancelamento é reconciliado depois do reinício sem repetir mutação', async () => {
  const envelope=fixture();
  let saved:DeletionEnvelope|undefined, outcome=2, cancelCount=0;
  const ports={
    repositoryId:42, read:async()=>details(outcome), readSigners:async()=>pendingSigners,
    persist:async()=>{saved=structuredClone(envelope);},
    cancel:async()=>{cancelCount++;assert.ok(saved?.cancelRequestedAt);throw new Error('Timeout externo');},
  };
  await reconcileDeletedAstenEnvelope(envelope,ports);
  assert.ok(saved);
  assert.equal(envelope.state,'PENDING');
  const restored=structuredClone(saved);
  await reconcileDeletedAstenEnvelope(restored,ports);
  assert.equal(restored.state,'PENDING');
  assert.equal(cancelCount,1);
  outcome=5;
  await reconcileDeletedAstenEnvelope(restored,ports);
  assert.equal(restored.state,'CANCELED');
  assert.equal(cancelCount,1);
});

test('consulta indisponível mantém pendência recuperável sem revelar mensagem interna', async () => {
  const envelope=fixture();
  await reconcileDeletedAstenEnvelope(envelope, {
    repositoryId:42, read:async()=>{throw new Error('Detalhe restrito do provedor');},
    readSigners:async()=>pendingSigners,
    persist:async()=>assert.fail('Não houve mutação no provedor'),
  });
  assert.equal(envelope.state,'PENDING');
  assert.doesNotMatch(envelope.reason||'',/restrito/);
});


test('exclusão interpreta a lista oficial de signatários e exige vínculo com o envelope', async () => {
  for (const [secondId, secondStatus, shouldCancel] of [['123', '2', true], ['123', '3', false], ['456', '2', false]] as const) {
    const envelope = fixture();
    let canceled = 0;
    await reconcileDeletedAstenEnvelope(envelope, {
      repositoryId: 42,
      read: async () => details(canceled ? 5 : 2),
      readSigners: async () => [
        { id: '201', Envelope: { id: '123' }, status: '1' },
        { id: '202', Envelope: { id: secondId }, status: secondStatus },
      ],
      cancel: async () => { canceled++; },
      persist: async () => {},
    });
    assert.equal(canceled, shouldCancel ? 1 : 0);
    assert.equal(envelope.state, shouldCancel ? 'CANCELED' : 'REVIEW');
  }
});

const purgeSuccess = {data:{listaAvisos:{aviso:{tipo:'S',mensagem:'Envelope expurgado com sucesso!'}}}};

test('exclusão completa expurga somente o envelope de vínculo confirmado, inclusive assinado', async()=>{
  for(const status of [1,3,4,5,6]) {
    const envelope:DeletionEnvelope={...fixture(),purgeRequired:true};
    let calls=0,persisted=false;
    const ports={repositoryId:42,read:async()=>details(status),readSigners:async()=>assert.fail('Não altera signatários'),persist:async()=>{persisted=true;},purge:async(id:string)=>{assert.equal(id,'123');assert.equal(persisted,true);assert.ok(envelope.purgeRequestedAt);calls++;return purgeSuccess;}};
    await reconcileDeletedAstenEnvelope(envelope,ports);
    assert.equal(envelope.state,'PURGED');
    await reconcileDeletedAstenEnvelope(envelope,ports);
    assert.equal(calls,1);
  }
});

test('envelope pendente exige cancelamento confirmado antes do expurgo', async()=>{
  const envelope:DeletionEnvelope={...fixture(),purgeRequired:true,hasKnownSignature:true};
  let status=2;const actions:string[]=[];
  await reconcileDeletedAstenEnvelope(envelope,{repositoryId:42,read:async()=>details(status),readSigners:async()=>assert.fail('Não precisa remover signatários'),persist:async()=>{},cancel:async()=>{actions.push('cancel');status=5;},purge:async()=>{actions.push('purge');return purgeSuccess;}});
  assert.deepEqual(actions,['cancel','purge']);assert.equal(envelope.state,'PURGED');
});

test('expurgo não usa ausência, erro, aviso ou timeout como prova e não repete resultado incerto',async()=>{
  for(const result of [{},{data:{listaAvisos:{aviso:{tipo:'I'}}}},{data:{listaAvisos:{aviso:[{tipo:'S'},{tipo:'E'}]}}},null]) {
    const envelope:DeletionEnvelope={...fixture(),purgeRequired:true};let calls=0;
    const ports={repositoryId:42,read:async()=>details(3),readSigners:async()=>({}),persist:async()=>{},purge:async()=>{calls++;if(result===null)throw Error('timeout');return result;}};
    await reconcileDeletedAstenEnvelope(envelope,ports);
    assert.equal(envelope.state,'REVIEW');
    await reconcileDeletedAstenEnvelope(envelope,ports);assert.equal(calls,1);
  }
});

test('expurgo bloqueia propriedade divergente, conexão sem permissão e persistência que falha',async()=>{
  for(const hash of ['different','fixture-hash']) {
    const envelope={...fixture(),hash,purgeRequired:true};
    await reconcileDeletedAstenEnvelope(envelope,{repositoryId:42,read:async()=>details(3),readSigners:async()=>({}),persist:async()=>{},purge:hash==='different'?async()=>assert.fail('Outro TCC não pode ser excluído'):undefined});
    assert.equal(envelope.state,'REVIEW');
  }
  const envelope:DeletionEnvelope={...fixture(),purgeRequired:true};
  await assert.rejects(reconcileDeletedAstenEnvelope(envelope,{repositoryId:42,read:async()=>details(3),readSigners:async()=>({}),persist:async()=>{throw Error('durable failure');},purge:async()=>assert.fail('Sem marcador durável não chama provedor')}),/durable failure/);
});

test('a confirmed purge is not downgraded or repeated when saving its receipt fails',async()=>{
 const envelope:DeletionEnvelope={...fixture(),purgeRequired:true};
 let purges=0;
 const ports={
  repositoryId:42,read:async()=>details(3),readSigners:async()=>({}),
  persist:async()=>{if(envelope.state==='PURGED')throw Error('durable failure');},
  purge:async()=>{purges++;return purgeSuccess;},
 };
 await assert.rejects(reconcileDeletedAstenEnvelope(envelope,ports),/durable failure/);
 assert.equal(envelope.state,'PURGED');
 await reconcileDeletedAstenEnvelope(envelope,ports);
 assert.equal(purges,1);
});
