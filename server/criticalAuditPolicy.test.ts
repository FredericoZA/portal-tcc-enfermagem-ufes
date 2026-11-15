import {test} from 'node:test';
import assert from 'node:assert/strict';
import {retainPortalAudit, visibleCriticalAudit, criticalEmailDelivery} from './criticalAuditPolicy';
import {buildPagedAuditFeed} from './auditFeed';
import type {AuditLog} from '../src/types';
import type {EmailDeliveryRecord} from '../src/types/automation';

test('critical history preserves recovery markers without exposing routine events',()=>{
  for(const action of ['EXCLUSAO_PROCESSO_TCC','RESTAURACAO_VERSAO_ESTUDIO','IMPORTACAO_ALUNOS','CONCLUSAO_AVALIACAO','ACAO_NOVA_NAO_CLASSIFICADA'])assert.equal(retainPortalAudit({action}),true);
  assert.equal(retainPortalAudit({action:'BACKUP_CIFRADO_AUTOMATICO'}),true);
  assert.equal(visibleCriticalAudit({action:'BACKUP_CIFRADO_AUTOMATICO'}),false);
  assert.equal(retainPortalAudit({action:'EMAIL_CODIGO_ACESSO_ACEITO_GMAIL'}),false);
  for(const action of ['SALVAMENTO_AUTOMATICO_ESTUDIO','ALTERACAO_IMAGEM_ESTUDIO','PADRAO_PLANILHA_ATUALIZADO'])assert.equal(retainPortalAudit({action}),false);
  assert.equal(retainPortalAudit({action:'PUBLICACAO_ESTUDIO_INTEGRADO'}),true);
});

test('uncertain expired dispatch remains recoverable even with an earlier Gmail acceptance',()=>{
  const record={status:'ACCEPTED_BY_GMAIL',dispatchState:'SENDING',dispatchLeaseUntil:'2020-01-01T00:00:00Z'} as EmailDeliveryRecord;
  assert.equal(criticalEmailDelivery(record),true);
  assert.equal(criticalEmailDelivery({...record,dispatchLeaseUntil:'2099-01-01T00:00:00Z'}),false);
  assert.equal(criticalEmailDelivery({...record,dispatchState:'UNCERTAIN'}),true);
});

test('critical pagination does not count routine historical rows or mutate the archive',()=>{
  const logs=['EMAIL_CODIGO_ACESSO_ACEITO_GMAIL','EXCLUSAO_PROCESSO_TCC','BACKUP_CIFRADO_AUTOMATICO'].map((action,i)=>({id:String(i),action,timestamp:'2026-11-15T12:00:00Z',actorEmail:'system',actorRoles:[],entityType:'processo',entityId:'test'})) as AuditLog[];
  const page=buildPagedAuditFeed({criticalOnly:true,logs,deliveries:[],processes:[]},{search:'',kind:'',start:'',end:'',focusId:''});
  assert.equal(page.total,1);assert.equal(page.items[0].action,'EXCLUSAO_PROCESSO_TCC');
  assert.equal(logs.length,3);
});
