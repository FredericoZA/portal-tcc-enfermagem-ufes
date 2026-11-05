import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {institutionalLogoRequests,institutionalHeadingRequests} from './institutionalLogo';
import {institutionalDocumentLogo} from '../../src/utils/institutionalDocumentLogo';

test('national arms assets are identical, and UFES emails never select the course emblem',async()=>{
 assert.deepEqual(await readFile('public/national-arms.png'),await readFile('server/documents/assets/national-arms.png'));
 assert.equal(institutionalDocumentLogo({brandKit:{institutionName:'Universidade Federal do Espírito Santo',courseLogoUrl:'/colenf-logo.png',universityLogoUrl:'https://old.example/old.png'} as any}),'/national-arms.png');
 assert.equal(institutionalDocumentLogo({brandKit:{institutionName:'Outra instituição',universityLogoUrl:'https://other.example/crest.png'} as any}),'https://other.example/crest.png');
});

test('temporary Google Docs replace only identified Colenf images, preserving signatures and unrelated art',()=>{
 const image=(title:string)=>({inlineObjectProperties:{embeddedObject:{title,imageProperties:{}}}});
 const doc={tabs:[{documentTab:{inlineObjects:{course:image('COLENF'),signature:image('Assinatura'),diagram:image('Diagrama')}}}],inlineObjects:{course:image('COLENF')}};
 assert.deepEqual(institutionalLogoRequests(doc,'https://portal.example/national-arms.png'),[{replaceImage:{imageObjectId:'course',uri:'https://portal.example/national-arms.png',imageReplaceMethod:'CENTER_CROP'}}]);
 assert.deepEqual(institutionalLogoRequests(doc,'http://untrusted.example/logo'),[]);
 assert.deepEqual(institutionalLogoRequests({inlineObjects:{unknown:image('')}},'https://portal.example/national-arms.png'),[]);
});


test('letterhead keeps three institutional lines and removes the issuing unit only below the course',()=>{
 const paragraph=(start:number,text:string)=>({startIndex:start,endIndex:start+text.length,paragraph:{elements:[{textRun:{content:text}}]}});
 const course='CURSO DE GRADUAÇÃO EM ENFERMAGEM E OBSTETRÍCIA\n';
 const header=paragraph(1,course);
 assert.equal((institutionalHeadingRequests({body:{content:[header]}})[0] as any).updateParagraphStyle.paragraphStyle.alignment,'CENTER');
 const dept=paragraph(header.endIndex,'DEPARTAMENTO DE ENFERMAGEM\n'),commission=paragraph(dept.endIndex,'COMISSÃO DE TRABALHO DE CONCLUSÃO DE CURSO\n');
 const title=paragraph(commission.endIndex,'CARTA-CONVITE\n'),bodyFooter=paragraph(title.endIndex,'Comissão de Trabalho de Conclusão de Curso\n');
 const requests=institutionalHeadingRequests({body:{content:[header,dept,commission,title,bodyFooter]}}) as any[];
 assert.deepEqual(requests.filter(request=>request.deleteContentRange),[
  {deleteContentRange:{range:{startIndex:commission.startIndex,endIndex:commission.endIndex}}},
  {deleteContentRange:{range:{startIndex:dept.startIndex,endIndex:dept.endIndex}}}
 ]);
 assert.equal(requests.filter(request=>request.updateParagraphStyle).length,1);
});

test('temporary letterhead is uppercase and centered without changing title, body or closing text',()=>{
 const lines=['Universidade Federal do Espírito Santo\n','Centro de Ciências da Saúde\n','Curso de Graduação em Enfermagem e Obstetrícia\n','CARTA-CONVITE\n','Título: Cuidados na Saúde da Mulher\n','Comissão de Trabalho de Conclusão de Curso\n','Departamento de Enfermagem\n','Curso de Enfermagem e Obstetrícia — CCS/UFES\n'];
 let index=1;
 const rows=lines.map(text=>{
  const startIndex=index;index+=text.length;
  return {startIndex,endIndex:index,paragraph:{elements:[{startIndex,textRun:{content:text,textStyle:{bold:true,fontSize:{magnitude:12,unit:'PT'},weightedFontFamily:{fontFamily:'Arial'}}}}]}};
 });
 const document={body:{content:rows}},before=structuredClone(document);
 const requests=institutionalHeadingRequests(document) as any[];
 assert.deepEqual(document,before);
 let result='\n'+lines.join('');
 for(const request of requests){
  if(request.deleteContentRange){const {startIndex,endIndex}=request.deleteContentRange.range;result=result.slice(0,startIndex)+result.slice(endIndex);}
  if(request.insertText){const {location,text}=request.insertText;result=result.slice(0,location.index)+text+result.slice(location.index);}
 }
 assert.equal(result,'\n'+lines.map((text,i)=>i<3?text.toLocaleUpperCase('pt-BR'):text).join(''));
 const paragraphs=requests.filter(request=>request.updateParagraphStyle).map(request=>request.updateParagraphStyle);
 assert.equal(paragraphs.length,3);
 assert.deepEqual(paragraphs.map(item=>item.range.startIndex),rows.slice(0,3).reverse().map(row=>row.startIndex));
 for(const item of paragraphs){assert.equal(item.paragraphStyle.alignment,'CENTER');assert.equal(item.paragraphStyle.indentStart.magnitude,0);assert.equal(item.paragraphStyle.indentEnd.magnitude,0);assert.equal(item.paragraphStyle.indentFirstLine.magnitude,0);}
 assert.equal(requests.filter(request=>request.updateTextStyle?.textStyle.fontSize.magnitude===12).length,3);
 assert.deepEqual(institutionalHeadingRequests({body:{content:rows.slice(3)}}),[]);
});

test('heading edits preserve tab and header segments, ignore footers and support split text runs',()=>{
 const text='Curso de Graduação em Enfermagem e Obstetrícia\n';
 const header={startIndex:0,endIndex:text.length,paragraph:{elements:[{startIndex:0,textRun:{content:'Curso de Graduação ',textStyle:{bold:true}}},{startIndex:19,textRun:{content:'em Enfermagem e Obstetrícia\n',textStyle:{italic:false}}}]}};
 const footer=structuredClone(header);
 const document={tabs:[{tabProperties:{tabId:'tab-1'},documentTab:{headers:{'header-1':{content:[header]}},footers:{'footer-1':{content:[footer]}}}}]};
 const requests=institutionalHeadingRequests(document) as any[];
 assert.equal(requests.filter(request=>request.insertText).map(request=>request.insertText.text).reverse().join(''),text.trimEnd().toLocaleUpperCase('pt-BR'));
 for(const request of requests){const scope=request.updateParagraphStyle?.range||request.deleteContentRange?.range||request.insertText?.location||request.updateTextStyle?.range;assert.equal(scope.tabId,'tab-1');assert.equal(scope.segmentId,'header-1');}
});

test('national arms paragraph is centered in the letterhead without moving signatures or unrelated images',()=>{
 const image=(title:string)=>({inlineObjectProperties:{embeddedObject:{title,imageProperties:{}}}});
 const imageParagraph=(start:number,id:string)=>({startIndex:start,endIndex:start+2,paragraph:{elements:[{startIndex:start,inlineObjectElement:{inlineObjectId:id}},{startIndex:start+1,textRun:{content:'\n'}}]}});
 const university='Universidade Federal do Espírito Santo\n';
 const heading={startIndex:2,endIndex:2+university.length,paragraph:{elements:[{textRun:{content:university}}]}};
 const document={tabs:[{tabProperties:{tabId:'tab-1'},documentTab:{inlineObjects:{arms:image('Armas Nacionais'),signature:image('Assinatura'),diagram:image('Diagrama')},headers:{'header-1':{content:[imageParagraph(0,'arms'),heading]}},body:{content:[imageParagraph(1,'signature'),imageParagraph(3,'diagram')]},footers:{'footer-1':{content:[imageParagraph(0,'arms'),heading]}}}}]};
 const before=structuredClone(document),requests=institutionalLogoRequests(document,'https://portal.example/national-arms.png') as any[];
 assert.deepEqual(document,before);
 assert.equal(requests.filter(request=>request.replaceImage).length,1);
 const centered=requests.filter(request=>request.updateParagraphStyle);
 assert.equal(centered.length,1);
 assert.deepEqual(centered[0].updateParagraphStyle.range,{startIndex:0,endIndex:2,tabId:'tab-1',segmentId:'header-1'});
 assert.equal(centered[0].updateParagraphStyle.paragraphStyle.alignment,'CENTER');
});

test('tab content takes precedence over legacy aliases so heading removals are not duplicated',()=>{
 let index=1;
 const content=['CURSO DE GRADUAÇÃO EM ENFERMAGEM E OBSTETRÍCIA\n','DEPARTAMENTO DE ENFERMAGEM\n','COMISSÃO DE TRABALHO DE CONCLUSÃO DE CURSO\n','ATA DA DEFESA\n'].map(text=>{
  const startIndex=index;index+=text.length;return {startIndex,endIndex:index,paragraph:{elements:[{textRun:{content:text}}]}};
 });
 const document={body:{content},tabs:[{tabProperties:{tabId:'tab-1'},documentTab:{body:{content:structuredClone(content)}}}]};
 const requests=institutionalHeadingRequests(document) as any[];
 assert.equal(requests.filter(request=>request.deleteContentRange).length,2);
 for(const request of requests)assert.equal((request.deleteContentRange?.range||request.updateParagraphStyle?.range).tabId,'tab-1');
});
