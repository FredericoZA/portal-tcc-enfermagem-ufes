import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMarkerBoldRequests,buildAtaOpeningNormalRequests} from './googleDocsStyles';
import {renderGoogleDriveTemplateToPdf} from './googleDocsRenderer';
test('bold marker ranges cover split runs, tabs, headers and tables without styling fixed text',()=>{
 const entry=(text:string,startIndex:number)=>({paragraph:{elements:[{startIndex,textRun:{content:text}}]}});
 const doc={tabs:[{tabProperties:{tabId:'main'},documentTab:{body:{content:[{paragraph:{elements:[{startIndex:1,textRun:{content:'Texto fixo <<NOME_'}},{startIndex:19,textRun:{content:'ALUNO>> fim'}}]}},{table:{tableRows:[{tableCells:[{content:[entry('{{DATA}}',40)]}]}]}}]},headers:{header:{content:[entry('[[LOCAL]]',1)]}}}}]};
 const requests=buildMarkerBoldRequests(doc,['NOME_ALUNO','DATA','LOCAL']);
 assert.equal(requests.length,3);
 assert.ok(requests.every(r=>r.updateTextStyle.textStyle.bold&&r.updateTextStyle.textStyle.underline===false));
 assert.equal(requests[0].updateTextStyle.range.startIndex,12);
 assert.equal(requests[0].updateTextStyle.range.tabId,'main');
 assert.equal(requests[2].updateTextStyle.range.segmentId,'header');
});
for(const type of ['CONVITE','ATA','TERMO','DECLARACAO'])test(`${type}: every merged variable is bold even without configured bold rules`,async()=>{
 const source='Texto fixo: <<nome completo aluno (1)>>, {{ORIENTADOR_NOME}}, [[EXAMINADOR_2_NOME]], «DATA», -LOCAL-.';
 const styles:any[]=[];let merged=false;
 const json=(value:any)=>new Response(JSON.stringify(value));
 const fetchImpl=(async(resource:any,init:any={})=>{
  const url=String(resource);
  if(url.includes('/files/sourceTemplate123?fields='))return json({id:'sourceTemplate123',mimeType:'application/vnd.google-apps.document',name:type,capabilities:{canCopy:true}});
  if(url.includes('/copy?'))return json({id:'temporaryCopy123'});
  if(url.includes('/documents/temporaryCopy123?'))return json({documentId:'temporaryCopy123',body:{content:[{startIndex:1,endIndex:source.length+1,paragraph:{elements:[{startIndex:1,textRun:{content:merged?'Documento preenchido':source}}]}}]}});
  if(url.endsWith(':batchUpdate')){const body=JSON.parse(init.body);for(const r of body.requests){if(r.updateTextStyle)styles.push(source.slice(r.updateTextStyle.range.startIndex-1,r.updateTextStyle.range.endIndex-1));if(r.replaceAllText)merged=true;}return json({documentId:'temporaryCopy123'});}
  if(url.includes('/export?'))return new Response(Buffer.from('%PDF-1.4\nmock'));
  if(init.method==='DELETE')return new Response(null,{status:204});
  throw Error('Unexpected request');
 }) as typeof fetch;
 await renderGoogleDriveTemplateToPdf({accessToken:'test-only',templateUrlOrId:'sourceTemplate123',replacements:{'nome completo aluno (1)':'Ana',ORIENTADOR_NOME:'Prof.ª Dr.ª Maria Silva',EXAMINADOR_2_NOME:'Prof. Dr. Rafael Lima',DATA:'15 de outubro',LOCAL:'Auditório'},fetchImpl});
 assert.deepEqual(styles,['<<nome completo aluno (1)>>','{{ORIENTADOR_NOME}}','[[EXAMINADOR_2_NOME]]','«DATA»','-LOCAL-']);
});

test('ata opening resets inherited bold before restoring only its variable markers',()=>{
 const prefix='Ata da Sessão de Defesa Final de Trabalho de Conclusão de Curso de ',name='<<ALUNOS>>',suffix=', do curso de Graduação em Enfermagem e Obstetrícia da Universidade Federal do Espírito Santo.\n';
 const doc={tabs:[{tabProperties:{tabId:'main'},documentTab:{body:{content:[{paragraph:{elements:[{startIndex:1,textRun:{content:prefix,textStyle:{bold:true}}},{startIndex:1+prefix.length,textRun:{content:name+suffix,textStyle:{bold:true}}}]}}]}}}]};
 const normal=buildAtaOpeningNormalRequests(doc),bold=buildMarkerBoldRequests(doc,['ALUNOS']);
 assert.equal(normal.length,1);assert.equal(normal[0].updateTextStyle.textStyle.bold,false);
 assert.deepEqual(normal[0].updateTextStyle.range,{tabId:'main',startIndex:1,endIndex:1+prefix.length+name.length+suffix.length});
 assert.equal(bold.length,1);assert.equal(bold[0].updateTextStyle.range.startIndex,1+prefix.length);
 assert.equal(bold[0].updateTextStyle.range.endIndex,1+prefix.length+name.length);
 assert.equal(bold[0].updateTextStyle.textStyle.bold,true);
 assert.deepEqual(buildAtaOpeningNormalRequests({body:{content:[{paragraph:{elements:[{startIndex:1,textRun:{content:'UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO'}}]}}]}}),[]);
});
