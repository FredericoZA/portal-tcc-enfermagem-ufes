-- Draft-only CAS: retain the canonical aggregate and public revision, without
-- reprojecting unrelated processes, signatures, publications or audit events.
create or replace function public.portal_commit_registration_draft(
  expected_revision bigint, draft_owner text, expected_draft_revision bigint, next_draft jsonb
) returns bigint
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
  current_revision bigint;
  current_payload jsonb;
  previous_draft jsonb;
  previous_revision bigint := 0;
  next_payload jsonb;
begin
  if draft_owner is null or draft_owner <> lower(btrim(draft_owner)) or length(draft_owner) > 320
     or position('@' in draft_owner) < 2 or expected_draft_revision is null or expected_draft_revision < 0
     or next_draft is null or jsonb_typeof(next_draft) <> 'object'
     or next_draft->>'ownerEmail' is distinct from draft_owner
     or jsonb_typeof(next_draft->'answers') is distinct from 'object'
     or next_draft#>>'{answers,ALUNO_1_EMAIL}' is distinct from draft_owner
     or octet_length(next_draft::text) > 200000 then
    raise exception 'Rascunho inválido.' using errcode='22023';
  end if;
  select revision,payload into current_revision,current_payload
    from public.portal_runtime_state where id='global' for update;
  if not found or current_revision is distinct from expected_revision then
    raise exception 'Conflito de concorrência: a revisão do portal mudou.' using errcode='PT409';
  end if;
  if current_payload ? 'registrationDrafts' and jsonb_typeof(current_payload->'registrationDrafts') <> 'object' then
    raise exception 'Estado de rascunhos inválido.' using errcode='22023';
  end if;
  previous_draft := current_payload#>array['registrationDrafts',draft_owner];
  if previous_draft is not null and (previous_draft->>'expiresAt')::timestamptz > now() then
    previous_revision := (previous_draft->>'revision')::bigint;
  end if;
  if previous_revision is distinct from expected_draft_revision
     or (next_draft->>'revision')::bigint is distinct from previous_revision+1
     or (next_draft->>'schemaRevision')::bigint is distinct from coalesce((current_payload#>>'{settings,integrationStudio,revision}')::bigint,0) then
    raise exception 'Conflito de concorrência: o rascunho ou formulário mudou.' using errcode='PT409';
  end if;
  next_payload := jsonb_set(current_payload,'{registrationDrafts}',
    jsonb_set(coalesce(current_payload->'registrationDrafts','{}'::jsonb),array[draft_owner],next_draft,true),true);
  update public.portal_runtime_state set payload=next_payload,revision=current_revision+1,updated_at=now() where id='global';
  insert into public.portal_runtime_commits(revision,payload_sha256)
    values(current_revision+1,encode(digest(next_payload::text,'sha256'),'hex'));
  return current_revision+1;
end;
$$;
revoke all on function public.portal_commit_registration_draft(bigint,text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.portal_commit_registration_draft(bigint,text,bigint,jsonb) to service_role;
