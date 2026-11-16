"""Build a private, reviewable enrichment plan. Never changes remote data or ACLs."""
import json, pathlib, zipfile, xml.etree.ElementTree as E, re, unicodedata, collections

p=pathlib.Path('output/legacy-completion')
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
old=json.loads((p/'current-before.private.json').read_text())['records']
labels=['Título Completo do Trabalho','Nome Completo do Orientador','Nome Completo do Coorientador',
 'Banca Examinadora - (Membro Interno)','Banca Examinadora - (Membro Externo)','Resumo',
 'Palavra Chave','Dia da Defesa','Hora da Defesa','Local da Defesa',
 'Termo de Autorização para Publicação (PDF)','Ata de Apresentação (PDF)',
 'Resumo Expandido do Artigo (PDF)','Trabalho de Conclusão de Curso - TCC (PDF)']
def norm(x):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',x).encode('ascii','ignore').decode().lower())
out=[]
for f in sorted((p/'submissions').glob('*.docx'),key=lambda x:int(x.stem)):
 root=E.fromstring(zipfile.ZipFile(f).read('word/document.xml'));a=[]
 for x in root.findall('.//w:p',ns):
  text=''.join(x.itertext()).strip()
  if not text:continue
  label=next((l for l in sorted(labels,key=len,reverse=True) if text.startswith(l)),None)
  if label and text!=label:a.extend([label,text[len(label):].strip()])
  else:a.append(text)
 t=a[a.index(labels[0])+1];tables=[]
 for tbl in root.findall('.//w:tbl',ns):
  tables.append([[' '.join(''.join(x.itertext()) for x in tc.findall('w:p',ns)).strip() for tc in tr.findall('w:tc',ns)] for tr in tbl.findall('w:tr',ns)])
 authors=[r[0] for r in tables[0][1:] if r and r[0]] if tables else []
 matches=[r for r in old if norm(r['titulo'])==norm(t)]
 if not matches:matches=[r for r in old if set(map(norm,authors))==set(map(norm,r['autores']))]
 out.append({'number':int(f.stem),'title':t,'authors':authors,'matches':[r['id'] for r in matches],'tables':tables,'paragraphs':a})
(p/'parsed-submissions.private.json').write_text(json.dumps(out,ensure_ascii=False));(p/'parsed-submissions.private.json').chmod(0o600)
print({'parsed':len(out),'matched':sum(len(x['matches'])==1 for x in out),'ambiguous':[(x['number'],x['matches']) for x in out if len(x['matches'])!=1],'duplicates':{k:v for k,v in collections.Counter(x['matches'][0] for x in out if len(x['matches'])==1).items() if v>1}})
