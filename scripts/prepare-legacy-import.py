"""Prepare an offline, private-only legacy inventory; never imports or publishes."""
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit

SOURCE_URL = 'https://enfermagem.vitoria.ufes.br/pt-br/trabalhos-de-conclusao-de-curso-defendidos'


def compact(value):
    return ' '.join(value.split())


class LegacyTables(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.tables = []
        self.section = ''
        self.heading = None
        self.row = None
        self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == 'h3':
            self.heading = []
        if tag == 'table':
            self.depth += 1
            if self.depth != 1:
                raise ValueError('Nested table requires review')
            self.tables.append({'section': self.section, 'rows': []})
        if self.depth and tag == 'tr':
            self.row = []
        if self.depth and tag in ('td', 'th'):
            self.cell = {'text': [], 'links': [], 'header': tag == 'th'}
        if self.cell is not None:
            if tag == 'br':
                self.cell['text'].append(' / ')
            if tag == 'a':
                href = dict(attrs).get('href', '')
                url = urljoin(SOURCE_URL, href)
                if href and urlsplit(url).scheme in ('http', 'https'):
                    self.cell['links'].append(url)

    def handle_data(self, data):
        if self.heading is not None:
            self.heading.append(data)
        if self.cell is not None:
            self.cell['text'].append(data)

    def handle_endtag(self, tag):
        if tag == 'h3' and self.heading is not None:
            self.section = compact(''.join(self.heading)) or self.section
            self.heading = None
        if tag in ('td', 'th') and self.cell is not None:
            self.cell['text'] = compact(''.join(self.cell['text']))
            self.row.append(self.cell)
            self.cell = None
        if tag == 'tr' and self.row is not None:
            self.tables[-1]['rows'].append(self.row)
            self.row = None
        if tag == 'table':
            self.depth -= 1


def prepare(raw):
    parser = LegacyTables()
    parser.feed(raw.decode('utf-8'))
    records, issues, seen = [], [], {}
    for table in parser.tables:
        for row_index, row in enumerate(table['rows'], 1):
            if row and all(cell['header'] for cell in row):
                continue
            if not any(cell['text'] for cell in row):
                continue
            if len(row) != 4:
                raise ValueError(f"{table['section']}, row {row_index}: expected four columns")
            authors, title, advisor, raw_date = [cell['text'] for cell in row]
            ordinal = len(records) + 1
            date = None
            try:
                date = datetime.strptime(raw_date, '%d/%m/%Y').date().isoformat()
            except ValueError:
                issues.append({'legacy': f'Legado {ordinal}', 'field': 'defenseDate', 'sourceValue': raw_date})
            identity = hashlib.sha256(json.dumps([authors, title, advisor, raw_date], ensure_ascii=False).encode()).hexdigest()
            if identity in seen:
                issues.append({'legacy': f'Legado {ordinal}', 'duplicateOf': seen[identity]})
            seen[identity] = f'Legado {ordinal}'
            records.append({
                'legacyId': f'legado-{ordinal:04d}', 'displayProtocol': f'Legado {ordinal}',
                'sourceFingerprint': identity, 'sourceSection': table['section'],
                'authorsOriginal': authors, 'titleOriginal': title, 'advisorOriginal': advisor,
                'defenseDateOriginal': raw_date, 'defenseDate': date,
                'sourceLinks': list(dict.fromkeys(link for cell in row for link in cell['links'])),
                'publication': {'isPublic': False, 'publishFullWork': False,
                                'publishExpandedAbstract': False, 'publicationState': 'NOT_REQUESTED'},
                'attachments': [], 'status': 'AWAITING_COMPLETE_SPREADSHEET'
            })
    if not records:
        raise ValueError('No legacy records found; do not replace an inventory with an empty result')
    return {'schemaVersion': 1, 'sourceUrl': SOURCE_URL,
            'sourceSha256': hashlib.sha256(raw).hexdigest(),
            'capturedAt': datetime.now(timezone.utc).isoformat(),
            'scope': 'OFFLINE_STAGING_ONLY', 'count': len(records),
            'sourceLinksGrantPublication': False, 'records': records, 'issues': issues}


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('source_html', type=Path)
    cli.add_argument('output_json', type=Path)
    args = cli.parse_args()
    inventory = prepare(args.source_html.read_bytes())
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'count': inventory['count'],
                      'withSourceLink': sum(bool(r['sourceLinks']) for r in inventory['records']),
                      'withoutSourceLink': sum(not r['sourceLinks'] for r in inventory['records']),
                      'issues': inventory['issues']}, ensure_ascii=False))
