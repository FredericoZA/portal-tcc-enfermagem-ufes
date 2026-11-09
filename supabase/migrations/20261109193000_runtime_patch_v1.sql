begin;

create function public.portal_commit_runtime_patch_v1(
  expected_revision bigint, changed_sections jsonb, changed_items jsonb
) returns bigint
language plpgsql
security invoker
set search_path = ''
set statement_timeout = '12s'
as $$
declare
  saved_revision bigint;
  saved_payload jsonb;
  section text;
  item record;
begin
  select revision, payload into saved_revision, saved_payload
    from public.portal_runtime_state where id = 'global' for update;
  if saved_revision is null or saved_revision is distinct from expected_revision then
    raise exception 'Conflito de concorrência na revisão do Portal.' using errcode = '40001';
  end if;
  if jsonb_typeof(changed_sections) is distinct from 'object'
      or jsonb_typeof(changed_items) is distinct from 'object' then
    raise exception 'Alterações do Portal inválidas.' using errcode = '22023';
  end if;
  saved_payload := saved_payload || changed_sections;
  for section in select jsonb_object_keys(changed_items) loop
    if jsonb_typeof(saved_payload->section) is distinct from 'array'
        or jsonb_typeof(changed_items->section) is distinct from 'object' then
      raise exception 'Coleção do Portal inválida.' using errcode = '22023';
    end if;
    for item in select key, value from jsonb_each(changed_items->section) order by key::integer loop
      if item.key::integer < 0 or item.key::integer > jsonb_array_length(saved_payload->section) then
        raise exception 'Índice da coleção inválido.' using errcode = '22023';
      end if;
      saved_payload := jsonb_set(saved_payload, array[section, item.key], item.value, true);
    end loop;
  end loop;
  return public.portal_commit_runtime_state(expected_revision, saved_payload);
end;
$$;

revoke all on function public.portal_commit_runtime_patch_v1(bigint,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.portal_commit_runtime_patch_v1(bigint,jsonb,jsonb)
  to service_role;
notify pgrst, 'reload schema';
commit;
