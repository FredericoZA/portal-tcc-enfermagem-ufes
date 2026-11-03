"""Reconcile the supplied UFES page, published sheet and private Drive inventory.
No network writes, runtime import or publication. Originals are retained as provenance.
"""
import argparse
import collections
import hashlib
import html
import importlib.util
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit

spec = importlib.util.spec_from_file_location('page_inventory', Path(__file__).with_name('prepare-legacy-import.py'))
page_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(page_module)
SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQucIwgv0TbpZzsFIqGvaCh7meVsKRZtF8o17sBNh604utu_cY3m4syMp7jao69-LNIBaxZzS8IcriE/pubhtml'
FOLDER_ID = '1bkAYUyEnZ5DrrsLdQGJQ6sbhejR1WcuZ'

def clean(s):
    return ' '.join(html.unescape(html.unescape(s)).split())

def norm(s):
    return re.sub(r'[^a-z0-9]+', ' ', unicodedata.normalize('NFKD', clean(s).lower()).encode('ascii', 'ignore').decode()).strip()

def date(s):
    return datetime.strptime(s, '%d/%m/%Y').date().isoformat()

def prepare(page, sheet, drive):
    page_records = page_module.prepare(page)['records']
    p = page_module.LegacyTables(); p.feed(sheet.decode('utf-8'))
    if len(p.tables) != 1: raise ValueError('Expected one sheet table')
    rows = [[clean(c['text']) for c in r] for r in p.tables[0]['rows']]
    rows = [r for r in rows if len(r)>4 and r[2] and r[3] and r[2]!='Aluno nome']
    groups = collections.OrderedDict()
    for r in rows:
        if len(r)!=19: raise ValueError('Sheet width changed')
        key = norm(r[3])
        groups.setdefault(key, []).append(r)
    # These titles differ only by a missing preposition on the published UFES page.
    aliases = {norm(r['titleOriginal']):norm(r['titleOriginal'].replace('Mariana-MG perspectiva','Mariana-MG na perspectiva')) for r in page_records if 'Mariana-MG perspectiva' in r['titleOriginal']}
    by_page = collections.defaultdict(list)
    order=[]
    for p in page_records:
        key=aliases.get(norm(p['titleOriginal']), norm(p['titleOriginal']))
        if key not in groups: raise ValueError('Unmatched source page title: '+p['titleOriginal'])
        by_page[key].append(p)
        if key not in order: order.append(key)
    order += [key for key in groups if key not in order]
    records=[]; issues=[]
    for ordinal,key in enumerate(order,1):
        entries=groups[key]; first=entries[0]; pages=by_page[key]
        # Merging requires equal advisor AND date, never title alone.
        if len({(norm(r[4]), date(r[16])) for r in entries}) != 1: raise ValueError('Conflicting work identity: '+first[3])
        authors=list(dict.fromkeys(r[2] for r in entries))
        # The page preserves combined authorship omitted from some sheet submissions.
        source_authors=list(dict.fromkeys(clean(p['authorsOriginal']) for p in pages))
        if len(source_authors)==1: authors=source_authors
        authors=list(dict.fromkeys(clean(name) for author in authors for name in re.split(r'\s+-\s+|;',author) if clean(name)))
        fingerprint=hashlib.sha256(json.dumps([key,norm(first[4]),date(first[16])],ensure_ascii=False).encode()).hexdigest()
        rec={'id':f'legado-{ordinal:04d}','protocolo':f'Legado {ordinal:03d}', 'sourceFingerprint':fingerprint,
             'titulo':first[3], 'autores':authors,'orientador':first[4], 'coorientador':first[5],
             'coorientadorInstituicao':first[6], 'resumo':first[7],
             'examinadores':[{'nome':first[8],'instituicao':''},{'nome':first[9],'instituicao':first[10]}],
             'palavrasChave':list(dict.fromkeys(w for w in first[11:16] if w)),
             'dataDefesa':date(first[16]),'horaDefesa':first[17], 'localDefesa':first[18],
             'isPublic':False,'publishFullWork':False,'publishExpandedAbstract':False,
             'publicationState':'NOT_REQUESTED','authorizationDecision':'UNSPECIFIED','attachments':[],
             'provenance':{'sheetUrl':SHEET_URL,'pageUrl':page_module.SOURCE_URL,'pageRecords':pages,
                           'sheetRows':[{'row':int(r[0]),'values':r[1:]} for r in entries],
                           'originalConsent':[r[1] for r in entries]}}
        if len(entries)>1: issues.append({'record':rec['protocolo'],'kind':'CONSOLIDATED_ROWS','sheetRows':[int(r[0]) for r in entries],'authors':authors,'consent':rec['provenance']['originalConsent']})
        if any(p['defenseDate']!=rec['dataDefesa'] for p in pages): issues.append({'record':rec['protocolo'],'kind':'DATE_FROM_COMPLETE_SHEET','pageDates':[p['defenseDateOriginal'] for p in pages],'sheetDate':rec['dataDefesa']})
        records.append(rec)
    files=[]
    for line in drive.splitlines():
        file_id,name=line.split('\t',1)
        matches=[r for r in records if any(unquote(urlsplit(u).path.split('/')[-1])==name for p in r['provenance']['pageRecords'] for u in p['sourceLinks'])]
        if len(matches)>1: raise ValueError('Ambiguous source filename '+name)
        item={'driveFileId':file_id,'fileName':name,'folderId':FOLDER_ID,'isPublic':False,
              'candidateRecordId':matches[0]['id'] if matches else None,
              'associationEvidence':'EXACT_SOURCE_FILENAME' if matches else 'NEEDS_CONTENT_REVIEW',
              'kind':'UNCLASSIFIED'}
        files.append(item)
    return {'schemaVersion':1,'scope':'OFFLINE_STAGING_ONLY','publicationPolicy':'FOLLOW_EXPLICIT_SOURCE_CONSENT',
            'sourceHashes':{'page':hashlib.sha256(page).hexdigest(),'sheet':hashlib.sha256(sheet).hexdigest()},
            'sheetRowCount':len(rows),'count':len(records),'records':records,'files':files,'issues':issues}

if __name__=='__main__':
    cli=argparse.ArgumentParser(description=__doc__)
    for name in ['page','sheet','drive','output']:cli.add_argument(name,type=Path)
    a=cli.parse_args(); result=prepare(a.page.read_bytes(),a.sheet.read_bytes(),a.drive.read_text())
    a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'rows':result['sheetRowCount'],'works':result['count'],'files':len(result['files']),'matchedBySourceFilename':sum(bool(f['candidateRecordId']) for f in result['files']),'issues':result['issues']},ensure_ascii=False))
