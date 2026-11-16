"""Map the complete source inventory to existing records, retaining consent and IDs."""
import json,pathlib,copy,re,unicodedata,collections,hashlib,fitz
p=pathlib.Path('output/legacy-completion')
read=lambda f:json.loads((p/f).read_text())
old=read('current-before.private.json')['records']; parsed=read('parsed-submissions.private.json'); binary=read('binary-inventory.private.json')
source=read('source-contents.json'); destinations={r['id']:r for r in read('destination-folders.json')}
def norm(v):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',str(v)).encode('ascii','ignore').decode().lower())
def filename(v):return norm(re.sub(r'(_\d+)+(?=\.pdf$)','',v,flags=re.I))
def person(v):
 v=' '.join(v.split());prefix=r'^(?:prof(?:\.?[ªºa])?|professor[ae]?|dr(?:\.?[ªºa])?|doutor[ae]?|me|ma|mestre|mestra|enf(?:\.?[ªºa])?)[.\s]+'
 while re.match(prefix,v,re.I):v=re.sub(prefix,'',v,count=1,flags=re.I)
 return v.strip(' .-')
groups=collections.defaultdict(list);classified=[];unknown=[]
for s in parsed:groups[s['matches'][0]].append(s)
for f in binary:
 if f['mime_type']!='application/pdf':continue
 s=next(s for s in parsed if s['number']==f['number']);a=s['paragraphs'];kind=None
 # Inspect the file itself: some submissions put an evaluation sheet in the authorization slot.
 try:
  with fitz.open(f['path']) as pdf:text=' '.join(pdf[0].get_text().split())[:2400]
 except Exception:text=''
 head=norm(text[:1200]);low=norm(f['title'])
 if any(x in head[:600] for x in ['fichadeavaliacao','instrumentodeavaliacao','fichaavaliacao']):kind='AVALIACAO'
 elif any(x in head[:800] for x in ['termodeautorizacao','termod eautorizacao'.replace(' ',''),'autorizacaoparapublicacao']):kind='TERMO'
 elif any(x in head[:800] for x in ['atadeapresentacao','atadedefesa','atadesessaopublica']):kind='ATA'
 for label,k in [('Termo de Autorização para Publicação (PDF)','TERMO'),('Ata de Apresentação (PDF)','ATA'),('Resumo Expandido do Artigo (PDF)','RESUMO_EXPANDIDO'),('Trabalho de Conclusão de Curso - TCC (PDF)','TRABALHO_COMPLETO')]:
  if kind:break
  if label in a:
   i=a.index(label)
   if i+1<len(a) and filename(a[i+1])==filename(f['title']):
    existing=next(r for r in old if r['id']==s['matches'][0])
    prior=next((x['kind'] for x in existing['attachments'] if x['sha256']==f['sha256']),None)
    kind=prior if prior in ['TRABALHO_COMPLETO','RESUMO_EXPANDIDO'] and k in ['TRABALHO_COMPLETO','RESUMO_EXPANDIDO'] else k
 if not kind:
  if 'ficha' in low and 'avaliacao' in low:kind='AVALIACAO'
  elif low.startswith('ata') or 'atadeapresentacao' in low:kind='ATA'
  elif 'termo' in low or 'autorizacao' in low:kind='TERMO'
  elif 'resumo' in low and 'expandido' in low:kind='RESUMO_EXPANDIDO'
  elif low.startswith('tcc') or 'monografia' in low:kind='TRABALHO_COMPLETO'
 if not kind:unknown.append({'number':f['number'],'id':f['id'],'name':f['title'],'head':text[:350]})
 classified.append({**f,'kind':kind,'recordId':s['matches'][0]})
(p/'classification.private.json').write_text(json.dumps(classified,ensure_ascii=False))
(p/'classification-unknown.private.json').write_text(json.dumps(unknown,ensure_ascii=False))
print({'pdfs':len(classified),'classes':dict(collections.Counter(x['kind'] for x in classified)),'unknown':len(unknown)})
out=[];moves=[];duplicates=[];conflicts=[];review=[]
for id,submissions in groups.items():
 original=next(r for r in old if r['id']==id);r=copy.deepcopy(original)
 # First batch is already imported and moved: leave it intact.
 if r['provenance'].get('driveSubmissionReview'):continue
 files=[f for f in classified if f['recordId']==id]
 if any(not f['kind'] for f in files):continue
 docs=copy.deepcopy(r['provenance'].get('administrativeDocuments',[]));academic=copy.deepcopy(r['attachments']);extra=[]
 used={}
 for f in sorted(files,key=lambda f:(f['number'],f['title'])):
  kind=f['kind'];sha=f['sha256'];key=(kind,sha)
  if key in used:
   duplicates.append({'id':f['id'],'canonicalId':used[key],'recordId':id,'sha256':sha,'sourceFolder':f['sourceFolder'],'reason':'IDENTICAL_SUBMISSION_PDF'});continue
  oldDoc=next((x for x in docs if x['kind']==kind and x['sha256']==sha),None)
  if oldDoc:
   used[key]=oldDoc['driveFileId']
   if f['id']!=oldDoc['driveFileId']:duplicates.append({'id':f['id'],'canonicalId':oldDoc['driveFileId'],'recordId':id,'sha256':sha,'sourceFolder':f['sourceFolder'],'reason':'IDENTICAL_EXISTING_ADMIN_PDF'})
   moves.append({'id':oldDoc['driveFileId'],'kind':kind,'recordId':id,'sha256':sha,'sourceFolder':None})
   continue
  oldAcademic=next((x for x in academic if x['kind']==kind),None)
  if kind in ['TRABALHO_COMPLETO','RESUMO_EXPANDIDO']:
   if oldAcademic and oldAcademic['sha256']==sha:
    used[key]=oldAcademic['driveFileId']
    if f['id']!=oldAcademic['driveFileId']:duplicates.append({'id':f['id'],'canonicalId':oldAcademic['driveFileId'],'recordId':id,'sha256':sha,'sourceFolder':f['sourceFolder'],'reason':'IDENTICAL_EXISTING_ACADEMIC_PDF'})
    moves.append({'id':oldAcademic['driveFileId'],'kind':kind,'recordId':id,'sha256':sha,'sourceFolder':None})
    continue
   if oldAcademic:
    # A different revision must not inherit the old public consent. Preserve it privately as a source.
    extra.append({'driveFileId':f['id'],'fileName':f['title'],'kind':kind,'sha256':sha,'isPublic':False,'sourceSubmission':f['number']})
    conflicts.append({'id':id,'source':f['number'],'kind':kind,'reason':'DIFFERENT_ACADEMIC_VERSION_RETAINED_PRIVATE'})
   else:
    academic.append({'driveFileId':f['id'],'fileName':f['title'],'sourceFileName':f['title'],'kind':kind,'sha256':sha,'evidence':'Original da submissão '+str(f['number'])+'; título vinculado ao catálogo e SHA-256 conferido.'})
    # Enrichment never grants publication to a newly introduced kind.
    if kind=='TRABALHO_COMPLETO':r['publishFullWork']=False
    else:r['publishExpandedAbstract']=False
  else:
   docs.append({'driveFileId':f['id'],'folderId':f['sourceFolder'],'fileName':f['title'],'sourceFileName':f['title'],'sha256':sha,'kind':kind,'visibility':'PRIVATE_ADMINISTRATIVE_DOCUMENT'})
  used[key]=f['id'];moves.append({'id':f['id'],'kind':kind,'recordId':id,'sha256':sha,'sourceFolder':f['sourceFolder']})
 # Preserve the established catalog in source conflicts; fill confirmed omissions only.
 newest=max(submissions,key=lambda s:s['number']);a=newest['paragraphs'];board=[]
 for table in newest['tables']:
  if table and table[0] in [['Nome Completo'],['Nome Completo','Instituição']]:
   board += [{'nome':person(row[0]),'instituicao':row[1] if len(row)>1 else ''} for row in table[1:] if row and row[0]]
 if not newest['tables']:
  for label in ['Banca Examinadora - (Membro Interno)','Banca Examinadora - (Membro Externo)']:
   if label in a:
    i=a.index(label);j=next((j for j in range(i+1,len(a)) if a[j] in ['Banca Examinadora - (Membro Externo)','Resumo']),len(a))
    values=[x for x in a[i+1:j] if x not in ['Nome Completo','Instituição']]
    if values:board.append({'nome':person(values[0]),'instituicao':values[1] if len(values)>1 else ''})
 if board:r['examinadores']=board
 if not r.get('resumo') and 'Resumo' in a and 'Palavra Chave' in a:r['resumo']='\n'.join(a[a.index('Resumo')+1:a.index('Palavra Chave')])
 if not r.get('palavrasChave'):
  table=next((t for t in newest['tables'] if t and any('Palavra' in c for c in t[0]) and len(t)>1),None)
  if table:r['palavrasChave']=[w for w in table[1] if w.strip()]
 r['attachments']=academic;r['provenance']['administrativeDocuments']=docs
 r['provenance']['publicationImportBaseline']={'publicFiles':[{'kind':f['kind'],'sha256':f['sha256']} for f in original['attachments'] if original.get('publishFullWork' if f['kind']=='TRABALHO_COMPLETO' else 'publishExpandedAbstract',False)],'source':'Existing verified Portal publication before documentary enrichment','capturedAt':'2026-11-16'}
 if extra:r['provenance']['additionalAcademicSources']=extra
 sources=[{'submissionNumber':s['number'],'folderId':next(x['folder']['id'] for x in source if int(x['folder']['title'])==s['number']),'submissionFileId':next(f['id'] for x in source if int(x['folder']['title'])==s['number'] for f in x['files'] if f['mime_type'] in ['application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),'submissionSha256':hashlib.sha256((p/'submissions'/f"{s['number']}.docx").read_bytes()).hexdigest()} for s in submissions]
 r['provenance']['driveSubmissionReview']={'sources':sources,'dataVerified':['title','board','documentHashes'],'excludedSourceFields':['IP','matricula','receiptEmails'],'publicationPreserved':True}
 out.append(r);review.append({'id':id,'sources':[s['number'] for s in submissions],'adminFiles':len(docs),'academicFiles':len(academic),'privateSourceVersions':len(extra)})
for name,data in [('proposed.private.json',out),('movements.private.json',moves),('duplicates.private.json',duplicates),('conflicts.json',conflicts),('review.json',review)]:
 (p/name).write_text(json.dumps(data,ensure_ascii=False));(p/name).chmod(0o600)
print({'records':len(out),'moves':len(moves),'duplicates':len(duplicates),'versionConflicts':len(conflicts),'adminFiles':sum(r['adminFiles'] for r in review)})
