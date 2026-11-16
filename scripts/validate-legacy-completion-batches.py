"""Validate the prepared metadata SQL against the authoritative local records.

Produces read-only readback queries. Does not connect to any remote service.
"""
import json
import pathlib
import re

p = pathlib.Path('output/legacy-completion')
summary = json.loads((p / 'batches.json').read_text())
before = {r['id']: r for r in json.loads((p / 'current-before.private.json').read_text())['records']}
desired = {r['id']: r for r in json.loads((p / 'validated.private.json').read_text())}
seen = []
readbacks = p / 'readback'
readbacks.mkdir(exist_ok=True)
for row in summary:
    sql = (p / 'batches' / row['file']).read_text()
    literals = re.findall(r'(\$json_[a-f0-9]{20}\$)(.*?)\1::jsonb', sql, re.S)
    assert len(literals) == 3, (row['file'], 'Expected exactly three JSON literals')
    expected, incoming, audit = [json.loads(value) for _, value in literals]
    assert expected == [before[r['id']] for r in incoming], (row['file'], 'CAS source changed')
    assert incoming == [desired[r['id']] for r in incoming], (row['file'], 'Planned data changed')
    assert len(incoming) == row['records']
    assert len(sql.encode()) == row['bytes']
    assert audit['after']['pdfBinaryBytes'] == 0
    assert not re.search(r'__(?:EXPECTED_JSON|INCOMING_JSON|AUDIT_JSON|RECORD_COUNT)__', sql)
    seen.extend(r['id'] for r in incoming)
    tag, value = literals[1]
    readback = """-- Read-only equality check; returns counts and IDs, never source text.
with expected as (select value as r from jsonb_array_elements(__EXPECTED__)),
actual as (select r from public.portal_runtime_state s cross join lateral jsonb_array_elements(s.payload->'legacyAcademicRecords') r where s.id='global')
select count(*) as expected_records,
 count(*) filter(where actual.r=expected.r) as exact_matches,
 coalesce(jsonb_agg(expected.r->>'id') filter(where actual.r is null or actual.r<>expected.r),'[]'::jsonb) as mismatched_ids
from expected left join actual on actual.r->>'id'=expected.r->>'id';
""".replace('__EXPECTED__', tag + value + tag + '::jsonb', 1)
    path = readbacks / row['file']
    path.write_text(readback)
    path.chmod(0o600)
assert len(seen) == 92 and len(set(seen)) == 92 and set(seen) == set(desired)
result = {'validatedBatches': len(summary), 'records': len(seen), 'jsonLiteralsValidated': 30,
          'casAndIncomingExact': True, 'readbackQueries': len(summary),
          'largestSqlBytes': max(row['bytes'] for row in summary)}
(p / 'batch-validation.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
