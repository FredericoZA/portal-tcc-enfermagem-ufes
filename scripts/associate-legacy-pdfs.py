"""Associate private legacy PDFs by title/authorship or matching abstract content.
Requires downloaded PDFs and a Drive DOM inventory. Never changes Drive permissions.
"""
import importlib.util
import json
import re
from pathlib import Path

root=Path('.portal-data/legacy-import')
spec=importlib.util.spec_from_file_location('consolidate',Path(__file__).with_name('consolidate-legacy-import.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def norm(s):return m.norm(s).replace(' ','')

def associate(data,evidence):
    files={f['fileName']:f for f in data['files']}; records={r['id']:r for r in data['records']}
    if set(files)!={f['fileName'] for f in evidence}:raise ValueError('Drive DOM inventory differs from downloaded ZIP')
    for r in records.values():r['attachments']=[]
    seen={};issues=[];matches=[]
    # Prefer original filenames over suffix copies without deleting any originals.
    for pdf in sorted(evidence,key=lambda f:(' (1)' in f['fileName'],f['fileName'])):
        text=norm(pdf['text']); candidates=[]
        for r in records.values():
            titles=[r['titulo']]+[p['titleOriginal'] for p in r['provenance']['pageRecords']]
            title=any(norm(t) in text for t in titles if norm(t))
            names=[norm(n) for n in re.split(r'\s+-\s+|;| / ', ' ; '.join(r['autores'])) if norm(n)]
            authors=bool(names) and all(n in text for n in names)
            abstract=norm(r['resumo']);chunks=[abstract[i:i+50] for i in range(0,min(len(abstract),2000)-49,50)]
            ratio=sum(c in text for c in chunks)/max(1,len(chunks))
            if title or authors or ratio>=0.8:candidates.append((r,'TITLE' if title else 'AUTHORSHIP' if authors else 'ABSTRACT'))
        if not candidates and 'tcc_feridas_oncologicas_-_resumo' in pdf['fileName']:
            # Reviewed against the PDF objective, method (Joanna Briggs), topic and source summary.
            r=next(r for r in records.values() if norm(r['titulo']).startswith('cuidadosdeenfermagemempessoascomlesoesoncologicas'))
            if all(norm(phrase) in text for phrase in ['lesões oncológicas','Joanna Briggs','revisão de escopo']):candidates=[(r,'REVIEWED_ABSTRACT_TOPIC_OBJECTIVE_METHOD')]
        if len(candidates)!=1:raise ValueError('Ambiguous PDF: '+pdf['fileName']+' '+str([r['id'] for r,_ in candidates]))
        r,method=candidates[0];f=files[pdf['fileName']]
        if f['candidateRecordId'] and f['candidateRecordId']!=r['id']:issues.append({'kind':'SOURCE_LINK_CONTENT_MISMATCH','fileName':f['fileName'],'sourcePageRecordId':f['candidateRecordId'],'verifiedRecordId':r['id']})
        match={'recordId':r['id'],'fileName':f['fileName'],'driveFileId':f['driveFileId'],'sha256':pdf['sha256'],'pages':pdf['pages'],'method':method,'isPublic':False}
        matches.append(match)
        if pdf['sha256'] in seen:
            if seen[pdf['sha256']]['recordId']!=r['id']:raise ValueError('Same PDF attributed to distinct works')
            match['duplicateOf']=seen[pdf['sha256']]['driveFileId'];continue
        seen[pdf['sha256']]=match
        kind='RESUMO_EXPANDIDO' if pdf['pages']<=10 else 'TRABALHO_COMPLETO'
        r['attachments'].append({'driveFileId':f['driveFileId'],'fileName':f['fileName'],'kind':kind,'sha256':pdf['sha256'],'evidence':f"PRIVATE_DRIVE_PDF_CONTENT:{method}; SHA256:{pdf['sha256']}; pages:{pdf['pages']}"})
    for r in records.values():
        r['provenance']['archiveFiles']=[x for x in matches if x['recordId']==r['id']]
        consent=set(m.norm(v) for v in r['provenance']['originalConsent'])
        r['authorizationDecision']='AUTHORIZED' if consent=={'sim'} else 'DENIED' if consent=={'nao'} else 'CONFLICT' if consent=={'sim','nao'} else 'UNSPECIFIED'
        allowed=r['authorizationDecision']=='AUTHORIZED'
        r['publishFullWork']=allowed and any(f['kind']=='TRABALHO_COMPLETO' for f in r['attachments'])
        r['publishExpandedAbstract']=allowed and any(f['kind']=='RESUMO_EXPANDIDO' for f in r['attachments'])
        r['isPublic']=r['publishFullWork'] or r['publishExpandedAbstract']
        r['publicationState']='PUBLIC' if r['isPublic'] else 'AUTHORIZED' if allowed else 'NOT_REQUESTED'
    data['publicationPolicy']='FOLLOW_EXPLICIT_SOURCE_CONSENT'
    data['attachmentReview']={'matches':matches,'issues':issues,'files':len(evidence),'uniquePdfs':len(seen),'worksWithFiles':sum(bool(r['attachments']) for r in records.values()),'worksWithoutFiles':sum(not r['attachments'] for r in records.values())}
    return data

if __name__=='__main__':
    data=json.loads((root/'consolidado-2026-11-02.json').read_text());evidence=json.loads((root/'drive-pdf-evidence.json').read_text())
    result=associate(data,evidence);(root/'importacao-conferida-2026-11-02.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result['attachmentReview'].items() if k!='matches'},ensure_ascii=False))
