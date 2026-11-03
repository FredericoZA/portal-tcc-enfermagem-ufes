"""Reconcile extracted UFES submissions with the existing private legacy catalog.

Reads JSON extracted from the supplied workbook. Writes a private import payload,
never a new workbook, and never modifies remote records or publication settings.
"""
import argparse
import collections
import copy
import hashlib
import html
import json
import re
import unicodedata
from pathlib import Path


def clean(value):
    return ' '.join(html.unescape(str(value or '')).split())


def person(value):
    name = clean(value)
    # The legacy schema stores a name separately from academic qualifications.
    # Older submissions sometimes join "Profª.Dra." directly to the name.
    prefix = r'^(?:prof(?:\.?[ªºa])?|professor[ae]?|dr(?:\.?[ªºa])?|doutor[ae]?|me|ma|mestre|mestra|enf(?:\.?[ªºa])?)[.\s]+'
    while re.match(prefix, name, re.IGNORECASE):
        name = re.sub(prefix, '', name, count=1, flags=re.IGNORECASE)
    return name.strip(' .-')


def norm(value):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', clean(value)).encode('ascii', 'ignore').decode().lower())


def consent(value):
    text = norm(value)
    if 'naoautorizo' in text:
        return 'Não'
    if 'autorizoadisponibilizacao' in text:
        return 'Sim'
    raise ValueError('Unrecognized consent; do not infer publication')


def reconcile(existing, rows, source_hash):
    result = copy.deepcopy(existing)
    records = result['records']
    index = {norm(r['titulo']): r for r in records}
    groups = collections.OrderedDict()
    for number, row in enumerate(rows, 4):
        if len(row) != 37 or not row[10] or not row[12] or str(row[5]) != '0':
            raise ValueError(f'Incomplete or draft submission at source row {number}')
        groups.setdefault(norm(row[12]), []).append((number, row))
    for title, entries in groups.items():
        first = entries[0][1]
        record = index.get(title)
        identities = collections.Counter((norm(row[13]), str(row[25])[:10]) for _, row in entries)
        if len(identities) > 1:
            verified = (norm(record['orientador']), record['dataDefesa']) if record else None
            authors_match = record and all(norm(row[10]) in {norm(n) for n in record['autores']} for _, row in entries)
            if not authors_match or verified not in identities or identities[verified] <= len(entries) / 2:
                raise ValueError('Conflicting defense identity; manual review required')
            # A repeated submission's isolated year typo must not replace the
            # date already verified against the page and archived documents.
            first = next(row for _, row in entries if (norm(row[13]), str(row[25])[:10]) == verified)
            issue = {'record': record['id'], 'kind': 'SUBMISSION_DATE_TYPO',
                'sourceRows': [n for n, _ in entries], 'verifiedDate': record['dataDefesa']}
            if issue not in result.setdefault('issues', []):
                result['issues'].append(issue)
        is_new = record is None
        if record is None:
            ordinal = max(int(r['id'][7:]) for r in records) + 1
            record = {'id': f'legado-{ordinal:04d}',
                      'sourceFingerprint': hashlib.sha256(json.dumps([title, norm(first[13]), str(first[25])[:10]], ensure_ascii=False).encode()).hexdigest(),
                      'autores': [], 'attachments': [], 'provenance': {}}
            records.append(record)
            index[title] = record
        # Preserve the verified combined authorship from the published page.
        authors = list(record['autores'])
        if is_new:
            for _, row in entries:
                for name in re.split(r'\s+-\s+|;', clean(row[10])):
                    if name and norm(name) not in {norm(n) for n in authors}:
                        authors.append(name)
        record.update(protocolo=f"{int(record['id'][7:]):03d} - Legado", titulo=clean(first[12]), autores=authors,
                      orientador=person(first[13]), coorientador=person(first[14]), coorientadorInstituicao=clean(first[15]),
                      examinadores=[{'nome': person(first[16]), 'instituicao': ''}, {'nome': person(first[17]), 'instituicao': clean(first[18])}],
                      resumo=clean(first[19]), palavrasChave=list(dict.fromkeys(clean(w) for w in first[20:25] if clean(w))),
                      dataDefesa=str(first[25])[:10], horaDefesa=clean(first[26]), localDefesa=clean(first[27]))
        prior = record['provenance'].get('originalConsent', [])
        values = list(dict.fromkeys(prior + [consent(row[9]) for _, row in entries]))
        decision = 'CONFLICT' if 'Sim' in values and 'Não' in values else 'AUTHORIZED' if values == ['Sim'] else 'DENIED'
        # Do not retain IPs, UIDs or account names. These are not repository data.
        record['provenance'].update(originalConsent=values, submissionWorkbook={
            'fileName': 'envio_de_trabalho_de_conclusao_de_curso.xlsx', 'sha256': source_hash,
            'rows': [{'row': number, 'submissionId': clean(row[1]), 'submittedAt': clean(row[2]),
                      'authorsOriginal': clean(row[10]), 'registrationOriginal': clean(row[11]),
                      'peopleOriginal': {'orientador': clean(row[13]), 'coorientador': clean(row[14]),
                                         'examinadorInterno': clean(row[16]), 'examinadorExterno': clean(row[17])},
                      'consentOriginal': clean(row[9]), 'receiptEmailsOriginal': clean(row[28]),
                      'files': [{'kind': kind, 'sourceUrl': clean(row[col])} for col, kind in
                                [(29, 'TERMO'), (31, 'ATA'), (33, 'RESUMO_EXPANDIDO'), (35, 'TRABALHO_COMPLETO')] if row[col]]}
                     for number, row in entries]})
        available = {f['kind'] for f in record['attachments'] if re.fullmatch('[a-f0-9]{64}', f.get('sha256', ''))}
        full = decision == 'AUTHORIZED' and 'TRABALHO_COMPLETO' in available
        summary = decision == 'AUTHORIZED' and 'RESUMO_EXPANDIDO' in available
        record.update(authorizationDecision=decision, publishFullWork=full, publishExpandedAbstract=summary,
                      isPublic=full or summary, publicationState='PUBLIC' if full or summary else 'AUTHORIZED' if decision == 'AUTHORIZED' else 'NOT_REQUESTED')
    if len(records) != len(groups):
        raise ValueError('Source rows do not cover the entire existing catalog')
    result.update(count=len(records), sheetRowCount=len(rows))
    result['sourceHashes']['submissionWorkbook'] = source_hash
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['existing', 'rows', 'workbook', 'output']:
        parser.add_argument(name, type=Path)
    args = parser.parse_args()
    data = reconcile(json.loads(args.existing.read_text()), json.loads(args.rows.read_text()), hashlib.sha256(args.workbook.read_bytes()).hexdigest())
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'submissions': data['sheetRowCount'], 'works': data['count'],
                      'authorization': dict(collections.Counter(r['authorizationDecision'] for r in data['records']))}))
