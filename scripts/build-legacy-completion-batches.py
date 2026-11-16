"""Prepare bounded compare-and-swap metadata patches; never embeds PDF bytes."""
import json,pathlib,hashlib,datetime,re
p=pathlib.Path('output/legacy-completion');read=lambda n:json.loads((p/n).read_text())
before={r['id']:r for r in read('current-before.private.json')['records']};incoming=read('validated.private.json')
def literal(v):
 s=json.dumps(v,ensure_ascii=False,separators=(',',':'));tag='$json_'+hashlib.sha256(s.encode()).hexdigest()[:20]+'$';assert tag not in s
 return tag+s+tag+'::jsonb'
(p/'batches').mkdir(exist_ok=True);summary=[]
for index in range(0,len(incoming),10):
 records=incoming[index:index+10];expected=[before[r['id']] for r in records];n=len(records);hash=hashlib.sha256(json.dumps(records,sort_keys=True).encode()).hexdigest()
 audit={'id':'log-legacy-completion-'+hash[:20],'actorRoles':['MASTER_ADMIN'],'action':'LEGACY_DOCUMENTARY_ENRICHMENT','entityType':'legacy_catalog','entityId':'completion-'+str(index//10+1),'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'after':{'records':[r['id'] for r in records],'pdfBinaryBytes':0,'batchSha256':hash}}
 sql="""do $batch$
declare expected_records jsonb := __EXPECTED_JSON__;
 next_records jsonb := __INCOMING_JSON__;
 audit_record jsonb := __AUDIT_JSON__;
 stored jsonb; rev bigint; patch jsonb; changed integer;
begin
 select revision,payload into rev,stored from public.portal_runtime_state where id='global' for update;
 if jsonb_array_length(next_records)<>__RECORD_COUNT__ then raise exception 'Quantidade de registros divergente.'; end if;
 if (select count(*) from jsonb_array_elements(stored->'legacyAcademicRecords') s join jsonb_array_elements(expected_records) e on s->>'id'=e->>'id' where s=e)<>__RECORD_COUNT__ then raise exception 'O acervo mudou. Reconciliar antes de gravar.'; end if;
 select jsonb_object_agg((s.ord-1)::text,n.record),count(*) into patch,changed from jsonb_array_elements(stored->'legacyAcademicRecords') with ordinality s(record,ord) join jsonb_array_elements(next_records) n(record) on s.record->>'id'=n.record->>'id';
 if changed<>__RECORD_COUNT__ then raise exception 'Vínculo incompleto dos registros existentes.'; end if;
 audit_record:=audit_record||jsonb_build_object('actorEmail',stored#>>'{settings,masterEmail}');
 perform public.portal_commit_runtime_patch_v1(rev,'{}'::jsonb,jsonb_build_object('legacyAcademicRecords',patch,'auditLogs',jsonb_build_object(jsonb_array_length(stored->'auditLogs')::text,audit_record)));
end;
$batch$;
select revision,jsonb_array_length(payload->'legacyAcademicRecords') as records,pg_database_size(current_database()) as database_bytes,octet_length((payload->'legacyAcademicRecords')::text) as catalog_bytes,(select count(*) from jsonb_array_elements(payload->'legacyAcademicRecords') r where r#>'{provenance,driveSubmissionReview}' is not null) as reviewed_records from public.portal_runtime_state where id='global';
"""
 # Replace only template markers in one pass. Never rescan inserted source data:
 # ordinary text such as "AUDITÓRIO" must remain untouched inside JSON strings.
 substitutions={'__EXPECTED_JSON__':literal(expected),'__INCOMING_JSON__':literal(records),'__AUDIT_JSON__':literal(audit),'__RECORD_COUNT__':str(n)}
 sql=re.sub(r'__(?:EXPECTED_JSON|INCOMING_JSON|AUDIT_JSON|RECORD_COUNT)__',lambda m:substitutions[m[0]],sql)
 name=f'{index//10+1:02d}.sql';(p/'batches'/name).write_text(sql);(p/'batches'/name).chmod(0o600);summary.append({'file':name,'records':n,'ids':[r['id'] for r in records],'bytes':len(sql.encode())})
(p/'batches.json').write_text(json.dumps(summary));print({'batches':len(summary),'records':sum(r['records'] for r in summary),'largestSqlBytes':max(r['bytes'] for r in summary)})
