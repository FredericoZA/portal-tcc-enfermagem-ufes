"""Read-only publication compatibility check for legacy documentary enrichment.

No network access, writes to the Portal, ACL changes or publication inference.
An existing public kind/hash is the maximum allowed publication scope.
"""
import argparse
import hashlib
import importlib.util
import json
import re
import unicodedata
from pathlib import Path


def norm(value):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', str(value)).encode('ascii', 'ignore').decode().lower())


def negative(value):
    value = norm(value)
    return value == 'nao' or 'naoautorizo' in value


def file_hash(file):
    match = re.search(r'SHA256:([a-f0-9]{64})', file.get('evidence', ''))
    return file.get('sha256') or (match[1] if match else '')


def public_files(record):
    flags = {'TRABALHO_COMPLETO': 'publishFullWork', 'RESUMO_EXPANDIDO': 'publishExpandedAbstract'}
    return {(f['kind'], file_hash(f)) for f in record.get('attachments', []) if record.get(flags.get(f['kind'], ''), False)}


def reconcile(baseline, current, page_fingerprints=None, sheet_consent=None):
    previous = {r['id']: r for r in baseline}
    if len(previous) != len(baseline) or len({r['id'] for r in current}) != len(current):
        raise ValueError('Duplicate record IDs require manual reconciliation')
    rows = []
    for record in current:
        old = previous.get(record['id'])
        provenance = record.get('provenance', record)
        old_provenance = (old or {}).get('provenance', {})
        pages = provenance.get('pageRecords') or []
        consents = list(provenance.get('originalConsent') or [])
        consents += list(old_provenance.get('originalConsent') or [])
        for source in (old_provenance.get('submissionWorkbook') or {}).get('rows', []):
            consents.append(source.get('consentOriginal', ''))
        if sheet_consent is not None:
            titles = {norm(record.get('titulo', '')), norm((old or {}).get('titulo', ''))}
            titles.update(norm(p.get('titleOriginal', '')) for p in pages)
            for title in titles:
                consents += sheet_consent.get(title, [])
        issues = []
        active = public_files(record)
        allowed = public_files(old or {})
        if active - allowed:
            issues.append('NEW_PUBLIC_KIND_OR_CONTENT')
        if record.get('isPublic') and not (old or {}).get('isPublic'):
            issues.append('NEW_PUBLIC_RECORD')
        if active or record.get('isPublic'):
            if any(negative(v) for v in consents):
                issues.append('NEGATIVE_CONSENT')
            if provenance.get('withdrawn') or (provenance.get('publicationWithdrawal') or {}).get('withdrawnAt'):
                issues.append('PUBLICATION_WITHDRAWN')
            if not pages or any(not p.get('sourceLinks') for p in pages):
                issues.append('MISSING_OR_NEGATIVE_PAGE_LINK')
            if page_fingerprints is not None and any(p.get('sourceFingerprint') not in page_fingerprints for p in pages):
                issues.append('ORIGINAL_PAGE_ROW_NOT_CONFIRMED')
            if any(not re.fullmatch(r'[a-f0-9]{64}', sha) for _, sha in active):
                issues.append('UNVERIFIED_PUBLIC_FILE_HASH')
        rows.append({'id': record['id'], 'title': record.get('titulo', ''),
                     'previousPublic': bool((old or {}).get('isPublic')), 'currentPublic': bool(record.get('isPublic')),
                     'previousFiles': len(allowed), 'currentFiles': len(active),
                     'sourceLinked': bool(pages) and all(p.get('sourceLinks') for p in pages), 'issues': issues})
    return {'recordsChecked': len(rows), 'previousPublic': sum(bool(r.get('isPublic')) for r in baseline),
            'currentPublic': sum(r['currentPublic'] for r in rows),
            'newPublicRecords': [r['id'] for r in rows if r['currentPublic'] and not r['previousPublic']],
            'withdrawnRecords': [r['id'] for r in rows if r['previousPublic'] and not r['currentPublic']],
            'incompatibleRecords': [r for r in rows if r['issues']], 'records': rows}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', required=True, type=Path)
    parser.add_argument('--current', required=True, type=Path)
    parser.add_argument('--page', required=True, type=Path)
    parser.add_argument('--sheet', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('legacy_page', Path(__file__).with_name('prepare-legacy-import.py'))
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    page = module.prepare(args.page.read_bytes())
    sheet = module.LegacyTables(); sheet.feed(args.sheet.read_text())
    consent = {}
    for table in sheet.tables:
        for row in table['rows']:
            if len(row) == 19:
                consent.setdefault(norm(row[3]['text']), []).append(row[1]['text'])
    if not consent:
        raise ValueError('Original spreadsheet not recognized')
    baseline = json.loads(args.baseline.read_text())
    if isinstance(baseline, dict): baseline = baseline['records']
    current = json.loads(args.current.read_text())['records']
    result = reconcile(baseline, current, {r['sourceFingerprint'] for r in page['records'] if r['sourceLinks']}, consent)
    result['sources'] = {key: {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                         for key, path in [('baseline', args.baseline), ('page', args.page), ('sheet', args.sheet)]}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ('records', 'sources')}, ensure_ascii=False))
    raise SystemExit(1 if result['incompatibleRecords'] else 0)
