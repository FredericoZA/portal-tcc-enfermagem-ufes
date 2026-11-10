import test from 'node:test';
import assert from 'node:assert/strict';
import type {ProcessData,SignatureJob} from '../../src/types';
import {ataStatusCheckDue,ATA_STATUS_CHECK_INTERVAL_MS} from './astenAtaStatus';

test('conferência de ata espera intervalo por envelope e respeita revisão e arquivamento',()=>{
  const now=Date.parse('2026-11-06T15:00:00Z');
  const process={id:'tcc-3',dataRevision:9,avaliacao:{status:'CONCLUIDO',documentRevision:7}} as ProcessData;
  const sent={id:'ata-v1',processId:process.id,documentType:'ATA',provider:'ASTEN',status:'SENT',
    providerEnvelopeId:'123',sourceDataRevision:7,updatedAt:new Date(now-ATA_STATUS_CHECK_INTERVAL_MS).toISOString()} as SignatureJob;
  assert.equal(ataStatusCheckDue(process,sent,[sent],now-1),false);
  assert.equal(ataStatusCheckDue(process,sent,[sent],now),true);
  assert.equal(ataStatusCheckDue(process,{...sent,providerStatusCheckedAt:new Date(now-1).toISOString()},[sent],now),false);
  for(const change of [{sourceDataRevision:6},{provider:'GOV_BR'},{status:'CANCELED'},{providerDispatchState:'SENDING'},{providerEnvelopeId:undefined},{removedFromLogsAt:sent.updatedAt}] as Partial<SignatureJob>[]){
    assert.equal(ataStatusCheckDue(process,{...sent,...change},[sent],now),false);
  }
  const archived={...sent,id:'ata-v2',status:'ARCHIVED' as const,driveSignedFileId:'signed-file',
    signers:['ADVISOR','EXAMINER','EXAMINER'].map((role,index)=>({
      id:String(index),role:role as 'ADVISOR'|'EXAMINER',name:'Pessoa fictícia',
      email:`assinante${index}@example.invalid`,signingOrder:1,status:'SIGNED' as const,
    })),
  };
  assert.equal(ataStatusCheckDue(process,sent,[sent,archived],now),false);
});

import {astenStatusCheckDue,ASTEN_STATUS_CHECK_INTERVAL_MS} from './astenAtaStatus';

function completedAta(processId:string):SignatureJob{
  return {id:'archived-ata',processId,documentType:'ATA',provider:'ASTEN',sourceDataRevision:7,status:'ARCHIVED',driveSignedFileId:'private-ata',
    signers:['ADVISOR','EXAMINER','EXAMINER'].map((role,index)=>({id:String(index),role,name:'Titular fictício',email:`signer${index}@example.invalid`,signingOrder:1,status:'SIGNED'})),
  } as SignatureJob;
}
function finalProcess():ProcessData{
  return {id:'final',protocolo:'TCC - 00999',dataRevision:9,avaliacao:{status:'CONCLUIDO',documentRevision:7},
    acervo:{submittedAt:'2026-11-07',publishFullWork:true,authorizationConfirmedAt:'2026-11-07',
      palavrasChave:['a','b','c','d','e'],resumoSintese:'Resumo fictício.',trabalhoCompletoFileUrl:'https://drive.google.com/private'},
  } as ProcessData;
}
function pending(process:ProcessData,type:'TERMO'|'DECLARACAO',now:number):SignatureJob{
 return {id:`pending-${type}`,processId:process.id,documentType:type,provider:'ASTEN',status:'SENT',providerDispatchState:'SENT',
  sourceDataRevision:9,providerEnvelopeId:'existing-envelope',updatedAt:new Date(now-ASTEN_STATUS_CHECK_INTERVAL_MS).toISOString(),signers:[],
 } as SignatureJob;
}

test('termo e declaração já enviados também se atualizam sem callback e sem dispensar requisitos',()=>{
 const now=Date.parse('2026-11-07T15:00:00Z'),process=finalProcess(),ata=completedAta(process.id),term=pending(process,'TERMO',now);
 assert.equal(astenStatusCheckDue(process,term,[ata,term],now),true);
 assert.equal(ataStatusCheckDue(process,term,[ata,term],now),false,'alias histórico continua restrito à ata');
 assert.equal(astenStatusCheckDue(process,term,[term],now),false,'sem ata arquivada não se retoma termo');
 assert.equal(astenStatusCheckDue({...process,acervo:{...process.acervo,submittedAt:undefined}},term,[ata,term],now),false,'sem entrega confirmada não se retoma termo');
 assert.equal(astenStatusCheckDue(process,term,[ata,term],now-1),false);
 assert.equal(astenStatusCheckDue({...process,acervo:{...process.acervo,authorizationConfirmedAt:undefined}},term,[ata,term],now),false);
 assert.equal(astenStatusCheckDue({...process,acervo:{...process.acervo,publishFullWork:false}},term,[ata,term],now),false);
 assert.equal(astenStatusCheckDue({...process,acervo:{...process.acervo,palavrasChave:[]}},term,[ata,term],now),false);
 const declaration=pending(process,'DECLARACAO',now);
 assert.equal(astenStatusCheckDue(process,declaration,[ata,term,declaration],now),false,'termo não assinado não libera declaração');
 const archivedTerm={...term,status:'ARCHIVED' as const,driveSignedFileId:'private-term'};
 assert.equal(astenStatusCheckDue(process,declaration,[ata,archivedTerm,declaration],now),true);
 assert.equal(astenStatusCheckDue(process,declaration,[archivedTerm,declaration],now),false,'ata arquivada é obrigatória');
 const noPublication={...process,acervo:{...process.acervo,publishFullWork:false}};
 assert.equal(astenStatusCheckDue(noPublication,declaration,[ata,declaration],now),true,'sem pedido de publicação não se inventa termo');
});

test('fallback de termo/declaração ignora remoção, versão antiga, provedor alternativo e arquivo concorrente',()=>{
 const now=Date.parse('2026-11-07T15:00:00Z'),process=finalProcess(),ata=completedAta(process.id);
 const term={...pending(process,'TERMO',now),status:'ARCHIVED' as const,driveSignedFileId:'term'};
 for(const type of ['TERMO','DECLARACAO'] as const){
  const job=pending(process,type,now),jobs=[ata,term,job];
  for(const change of [{sourceDataRevision:8},{processId:'other'},{removedFromLogsAt:'2026-11-07'},{provider:'GOV_BR'},
    {status:'CANCELED'},{status:'QUEUED'},{status:'PROVIDER_ERROR'},{providerEnvelopeId:undefined},{providerDispatchState:'SENDING'},
    {updatedAt:new Date(now).toISOString()},{providerStatusCheckedAt:new Date(now).toISOString()}] as Partial<SignatureJob>[]){
    assert.equal(astenStatusCheckDue(process,{...job,...change},jobs,now),false,`${type}: ${JSON.stringify(change)}`);
  }
  const competing={...job,id:'another',status:'ARCHIVED' as const,driveSignedFileId:'signed'};
  assert.equal(astenStatusCheckDue(process,job,[...jobs,competing],now),false);
 }
});
