-- Somente em uma instalação vazia: todas as alterações são revertidas.
begin;
set local role service_role;
do $test$
declare
 p jsonb := '{"settings":{"masterEmail":"master@example.invalid"},"processes":[{"id":"smoke-process","protocolo":"TCC-SMOKE-2026","titulo":"Teste transacional descartável","status":"EM_RASCUNHO","createdByEmail":"aluno@example.invalid","aluno1":{"nome":"Aluno Teste","email":"aluno@example.invalid","matricula":"000000"},"orientador":{"nome":"Orientador Teste","email":"orientador@example.invalid"},"banca":[]}],"auditLogs":[{"id":"smoke-audit","action":"SMOKE_TEST","actorEmail":"master@example.invalid","entityType":"process","entityId":"smoke-process"}]}'::jsonb;
 r bigint; outcome jsonb; rejected boolean;
begin
 if exists(select 1 from public.portal_runtime_state) then raise exception 'Execute somente em banco de teste vazio.';end if;
 r:=public.portal_commit_runtime_state(0,p);
 if r<>1 or not exists(select 1 from public.portal_processes where external_id='smoke-process') then raise exception 'Processo não projetado';end if;
 if (select count(*) from public.portal_process_authors)<>1 then raise exception 'Autoria não projetada';end if;
 if not exists(select 1 from public.portal_access_entries where email='aluno@example.invalid' and active) then raise exception 'Aluno não autorizado';end if;
 if not exists(select 1 from public.portal_access_sources where process_role='ADVISOR') then raise exception 'Orientador não autorizado';end if;
 rejected:=false;
 begin perform public.portal_commit_runtime_state(0,p); exception when serialization_failure then rejected:=true; end;
 if not rejected then raise exception 'Revisão obsoleta aceita';end if;
 rejected:=false;
 begin update public.portal_audit_events set event_type='ALTERADO' where external_id='smoke-audit'; exception when raise_exception then rejected:=true;end;
 if not rejected then raise exception 'Auditoria alterável';end if;
 outcome:=public.portal_claim_asten_dispatch(repeat('a',64),'smoke-job',repeat('b',64),'smoke-claim-token-00000001',120);
 if outcome->>'outcome'<>'CLAIMED' then raise exception 'Reserva inicial falhou';end if;
 outcome:=public.portal_claim_asten_dispatch(repeat('a',64),'smoke-job',repeat('b',64),'smoke-claim-token-00000002',120);
 if outcome->>'outcome'<>'BUSY' then raise exception 'Reserva duplicada aceita';end if;
 rejected:=false;
 begin perform public.portal_update_asten_dispatch(repeat('a',64),'ENVELOPE_CREATED','smoke-claim-token-INVALID','smoke-envelope'); exception when invalid_authorization_specification then rejected:=true;end;
 if not rejected then raise exception 'Token Asten incorreto aceito';end if;
 perform public.portal_update_asten_dispatch(repeat('a',64),'ENVELOPE_CREATED','smoke-claim-token-00000001','smoke-envelope');
 perform public.portal_update_asten_dispatch(repeat('a',64),'DISPATCHED',null,'smoke-envelope');
 outcome:=public.portal_claim_asten_dispatch(repeat('a',64),'smoke-job',repeat('b',64),'smoke-claim-token-00000002',120);
 if outcome->>'outcome'<>'DISPATCHED' then raise exception 'Despacho duplicado não reconhecido';end if;
end $test$;
select 'PASS' as result,'commit, projeção de processo/autoria, autorização de participantes, conflito de revisão, auditoria imutável e idempotência Asten' as checks;
rollback;
