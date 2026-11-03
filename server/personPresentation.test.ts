import {PDFDocument,StandardFonts} from 'pdf-lib';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_PROCESSES} from '../src/services/demoSeed';
import {academicName,personPresentationVariables} from '../src/utils/personPresentation';
import {adaptDocumentLanguage} from '../src/utils/documentLanguage';
import {registrationQuestions,registrationPayload} from '../src/utils/operationalConfig';
import {buildProcessVariables} from './workflow/runtime';
import {buildValueBoldRequests} from './integrations/googleDocsStyles';
import {presentationEditRequests} from './integrations/documentPresentation';
import {acceptRegistration} from './workflow/registration';
const fixture=()=>{const p=structuredClone(DEMO_PROCESSES[0]);p.aluno1={...p.aluno1,nome:'Maria da Silva',tratamento:'Aluna'};p.orientador={...p.orientador,nome:'Maria Oliveira',tratamento:'Professora',titulacao:'Doutora'};p.defesa.startAt='2026-10-15T14:00:00-03:00';p.avaliacao={status:'CONCLUIDO',resultadoLabel:'Aprovado',parecer:'O estudo atende aos objetivos.'};return p;};
test('academic name uses declared choices, removes duplicate prefixes and never guesses gender',()=>{
 assert.equal(academicName({nome:'Prof.ª Dr.ª Maria da Silva',tratamento:'Professora',titulacao:'Doutora'}),'Professora Doutora Maria da Silva');
 assert.equal(academicName({nome:'João da Silva',tratamento:'Professor',titulacao:'Mestre'}),'Professor Mestre João da Silva');
 assert.equal(academicName({nome:'Maria da Silva',tratamento:'Professora',titulacao:'Doutora'},'abbreviated'),'Prof.ª Dr.ª Maria da Silva');
 assert.equal(academicName({nome:'Maria da Silva'}),'Maria da Silva');
 assert.equal(academicName({nome:'Prof. Dr. Carlos Silva',titulacao:'Doutor'}),'Prof. Dr. Carlos Silva');
});
test('four document types use explicit faculty treatment and resolved author wording',()=>{
 const p=fixture();const source='do(a)(s) graduando(a)(s) Maria da Silva. o(a) Prof(ª). Dr(ª). Prof.ª Dr.ª Maria Oliveira, Orientador(a). ao(à)(s) autor(a)(es), que expôs(expuseram). Aluno(a)s. Aprovado.';
 for(const type of ['CONVITE','ATA','TERMO','DECLARACAO']){
  const out=adaptDocumentLanguage(source,p,type);assert.match(out,/da graduanda Maria/);assert.match(out,/a Prof\.ª Dr\.ª Maria Oliveira, Orientadora/);assert.match(out,/à autora, que expôs/);assert.match(out,/Aluna/);assert.match(out,/Aprovada/);assert.doesNotMatch(out,/\(a\)|\(ª\)|\(s\)|\(es\)|\(expuseram\)/);assert.equal(adaptDocumentLanguage(out,p,type),out);
 }
});
test('agreement distinguishes one woman, two women, mixed authors and unclassified legacy records',()=>{
 const p=fixture();assert.equal(personPresentationVariables(p).RESULTADO_CONCORDANTE,'Aprovada');p.aluno2={...p.aluno1,nome:'Ana Ferreira'};let vars=personPresentationVariables(p);assert.equal(vars.ALUNOS_REFERENCIA,'as graduandas');assert.equal(vars.RESULTADO_CONCORDANTE,'Aprovadas');p.aluno2.tratamento='Aluno';vars=personPresentationVariables(p);assert.equal(vars.ALUNOS_REFERENCIA,'os graduandos');assert.equal(vars.ALUNOS_VERBO_APRESENTAR,'expuseram');p.aluno2=null;p.aluno1.tratamento=undefined;assert.equal(personPresentationVariables(p).ALUNOS_REFERENCIA,'a pessoa autora');
});
test('ata closing includes defense plus one hour, removes old formula and handles midnight',()=>{
 const p=fixture(),text='Nada mais havendo a tratar, foi encerrada a sessão e lavrada a presente ata que será assinada por quem de direito.';const out=adaptDocumentLanguage(text,p,'ATA');assert.match(out,/às quinze horas/);assert.match(out,/que segue para ser assinada\./);assert.doesNotMatch(out,/por quem de direito/);assert.equal(adaptDocumentLanguage(out,p,'ATA'),out);
 p.defesa.startAt='2026-10-15T23:30:00-03:00';assert.match(adaptDocumentLanguage(text,p,'ATA'),/zero horas e trinta minutos|meia-noite e trinta minutos/);
});
test('new native fields precede names, preserve choices and validate a complete new payload',()=>{
 const questions=registrationQuestions({formTemplates:[{id:'form-reserva-aluno',questions:[{fieldKey:'ORIENTADOR_NOME',label:'Nome',fieldType:'text'}]}]} as any);for(const prefix of ['ALUNO_1','ALUNO_2','ORIENTADOR','COORIENTADOR','EXAMINADOR_2','EXAMINADOR_3'])assert.ok(questions.findIndex(q=>q.fieldKey===prefix+'_TRATAMENTO')<questions.findIndex(q=>q.fieldKey===prefix+'_NOME'));
 const p=fixture();const a:any={ALUNO_1_NOME:p.aluno1.nome,ALUNO_1_MATRICULA:'202600001',ALUNO_1_EMAIL:'aluna@edu.ufes.br',ALUNO_1_TRATAMENTO:'Aluna',TEM_ALUNO_2:'Não',TEM_COORIENTADOR:'Não',ORIENTADOR_NOME:p.orientador.nome,ORIENTADOR_EMAIL:'orientacao@ufes.br',ORIENTADOR_SIAPE:'1234567',ORIENTADOR_TRATAMENTO:'Professora',ORIENTADOR_TITULACAO:'Doutora',EXAMINADOR_2_NOME:'Ana Ferreira Lima',EXAMINADOR_2_EMAIL:'ana@ufes.br',EXAMINADOR_2_INSTITUICAO:'UFES',EXAMINADOR_2_TRATAMENTO:'Professora',EXAMINADOR_2_TITULACAO:'Mestra',EXAMINADOR_3_NOME:'Carlos Ferreira Lima',EXAMINADOR_3_EMAIL:'carlos@ufes.br',EXAMINADOR_3_INSTITUICAO:'UFES',EXAMINADOR_3_TRATAMENTO:'Professor',EXAMINADOR_3_TITULACAO:'Doutor',TITULO:'Cuidados de enfermagem',DEFESA_DATA_HORA:'2026-10-15T14:00',DEFESA_LOCAL:questions.find(q=>q.fieldKey==='DEFESA_LOCAL')!.options![0]};
 const payload=registrationPayload(a,'America/Sao_Paulo'),accepted=acceptRegistration(payload);assert.equal(accepted.aluno1.tratamento,'Aluna');assert.equal(accepted.orientador.titulacao,'Doutora');assert.equal(accepted.banca[0].titulacao,'Mestra');assert.throws(()=>acceptRegistration({...payload,registrationAnswers:{...a,ORIENTADOR_TRATAMENTO:''}}),/obrigatório/);assert.throws(()=>acceptRegistration({...payload,registrationAnswers:{...a,ORIENTADOR_TITULACAO:'Doutor(a)'}}),/opção publicada/);
});
test('formatting removes inherited underline across split runs and language edits keep table structure',()=>{
 const p=fixture();const content=[{startIndex:1,endIndex:10,paragraph:{elements:[{startIndex:1,textRun:{content:'Apro'}},{startIndex:5,textRun:{content:'vado\n'}}]}},{startIndex:10,endIndex:44,paragraph:{elements:[{startIndex:10,textRun:{content:'O estudo atende aos objetivos.\n'}}]}}];const doc={tabs:[{tabProperties:{tabId:'tab1'},documentTab:{body:{content:[{table:{tableRows:[{tableCells:[{content}]}]}}]}}}]};
 const styles=buildValueBoldRequests(doc,['Aprovado',p.avaliacao.parecer!]);assert.equal(styles.length,2);assert.ok(styles.every(s=>s.updateTextStyle.textStyle.bold&&s.updateTextStyle.textStyle.underline===false&&s.updateTextStyle.range.tabId==='tab1'));const edits=presentationEditRequests(doc,p,'ATA');assert.ok(edits.some(e=>e.insertText?.text==='Aprovada'));assert.ok(edits.every(e=>!e.deleteContentRange||e.deleteContentRange.range.endIndex-e.deleteContentRange.range.startIndex<10));
});
test('workflow derives formal names from stored participants, not extra variables',()=>{
 const p=fixture();const vars=buildProcessVariables({process:p,eventCode:'TEST',actorEmail:'master@portal.local',actorRoles:[],extraVariables:{ORIENTADOR_NOME_COMPLETO:'invasor',ALUNO_1_TRATAMENTO:'Aluno'}});assert.equal(vars.ORIENTADOR_NOME_COMPLETO,'Professora Doutora Maria Oliveira');assert.equal(vars.ORIENTADOR_TRATAMENTO,'Professora');assert.equal(vars.ALUNO_1_TRATAMENTO,'Aluna');
});

test('temporary Google copy receives grammar and bold corrections for all four documents',async()=>{
 const {renderGoogleDriveTemplateToPdf}=await import('./integrations/googleDocsRenderer');
 const pdf=await PDFDocument.create();const page=pdf.addPage();page.drawText('Universidade - ata de teste',{x:43,y:790,size:11,font:await pdf.embedFont(StandardFonts.Helvetica)});const pdfBytes=await pdf.save();
 for(const documentType of ['CONVITE','ATA','TERMO','DECLARACAO']){
  const p=fixture(),source='do(a)(s) graduando(a)(s) Maria da Silva. o(a) Prof(ª). Dr(ª). Maria Oliveira. Aprovado. O estudo atende aos objetivos. Nada mais havendo a tratar, foi encerrada a sessão e lavrada a presente ata que será assinada por quem de direito.';
  p.banca=[{id:'b2',nome:'Beatriz Oliveira Santos',email:'beatriz@example.invalid',tratamento:'Professora',titulacao:'Mestra',funcao:'EXAMINER_2'},{id:'b3',nome:'Rafael Almeida Lima',email:'rafael@example.invalid',tratamento:'Professor',titulacao:'Doutor',funcao:'EXAMINER_3'}];
  let text=source+'\nExaminadora Professora Mestra Beatriz Oliveira Santos\nExaminador Professor Doutor Rafael Almeida Lima\n',revision=0,deleted=false;const styles:any[]=[];
  const json=(v:any)=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});
  const fetchImpl=(async(resource:any,init:any={})=>{
   const url=String(resource),method=init.method||'GET';
   if(url.includes('/files/sourceTemplate123?fields='))return json({id:'sourceTemplate123',name:'Modelo.docx',mimeType:'application/vnd.google-apps.document',capabilities:{canCopy:true}});
   if(url.includes('/copy?'))return json({id:'temporaryCopy123'});
   if(url.includes('/documents/temporaryCopy123?'))return json({documentId:'temporaryCopy123',revisionId:String(revision),body:{content:[{startIndex:1,endIndex:text.length+1,paragraph:{elements:[{startIndex:1,textRun:{content:text}}]}}]}});
   if(url.endsWith('/documents/temporaryCopy123:batchUpdate')){
    const body=JSON.parse(init.body);assert.equal(body.writeControl.requiredRevisionId,String(revision));
    for(const request of body.requests){if(request.deleteContentRange){const r=request.deleteContentRange.range;text=text.slice(0,r.startIndex-1)+text.slice(r.endIndex-1);}else if(request.insertText){const r=request.insertText;text=text.slice(0,r.location.index-1)+r.text+text.slice(r.location.index-1);}else if(request.updateTextStyle)styles.push({...request.updateTextStyle,rendered:text.slice(request.updateTextStyle.range.startIndex-1,request.updateTextStyle.range.endIndex-1)});else if(request.updateDocumentStyle){assert.equal(documentType,'ATA');assert.equal(request.updateDocumentStyle.documentStyle.marginLeft.magnitude,42.52);}else assert.fail('Unexpected request');}
    revision++;return json({documentId:'temporaryCopy123'});
   }
   if(url.includes('/files/temporaryCopy123/export?'))return new Response(pdfBytes);
   if(url.includes('/files/temporaryCopy123?')&&method==='DELETE'){deleted=true;return new Response(null,{status:204});}
   throw Error(`Unexpected ${method} ${url}`);
  }) as typeof fetch;
  const result=await renderGoogleDriveTemplateToPdf({accessToken:'test-only',templateUrlOrId:'sourceTemplate123',replacements:{},presentation:{process:p,documentType},fetchImpl});
  assert.deepEqual(result.unresolvedMarkers,[]);assert.equal(deleted,true);assert.match(text,/da graduanda Maria da Silva/);assert.match(text,/a Prof\.ª Dr\.ª Maria Oliveira/);assert.doesNotMatch(text,/\(a\)|\(ª\)|\(s\)/);assert.ok(styles.some(style=>style.rendered==='Aprovada'));assert.ok(styles.some(style=>style.rendered===p.avaliacao.parecer));assert.ok(styles.some(style=>style.rendered===academicName(p.orientador,'abbreviated')),'complete abbreviated advisor name stays bold after grammar adaptation');assert.ok(styles.some(style=>style.rendered===p.aluno1.nome));assert.ok(styles.filter(style=>style.textStyle.bold!==false).every(style=>style.textStyle.bold===true&&style.textStyle.underline===false));if(['CONVITE','DECLARACAO'].includes(documentType)&&p.coorientador)assert.ok(styles.some(style=>style.textStyle.bold===false&&style.rendered.includes(p.coorientador!.nome)),'coadvisor identification remains normal weight');
  for(const member of p.banca){
   const complete=academicName(member,'abbreviated');
   assert.ok(styles.some(style=>style.rendered===complete),`${documentType}: prefix and entire examiner name are bold: ${complete}`);
  }
  if(documentType==='ATA'){assert.match(text,/às quinze horas/);assert.doesNotMatch(text,/por quem de direito/);}
 }
});

test('authorization preview resolves the exact legacy constructions for five author variants',()=>{
 const variants=[['Aluna',null,'aluna','matriculada','INDIVIDUAL_FEMININO'],['Aluno',null,'aluno','matriculado','INDIVIDUAL_MASCULINO'],['Aluna','Aluna','alunas','matriculadas','DUPLA_FEMININA'],['Aluno','Aluno','alunos','matriculados','DUPLA_MASCULINA'],['Aluna','Aluno','alunos','matriculados','DUPLA_MISTA']] as const;
 for(const[first,second,label,enrolled,variant]of variants){
  const p=fixture();p.aluno1.tratamento=first;p.aluno2=second?{...p.aluno1,nome:'Ana Pereira',email:'ana@example.invalid',tratamento:second}:null;
  p.orientador.nome='Profa. Dra. Maria Oliveira';
  const names=[p.aluno1.nome,p.aluno2?.nome].filter(Boolean).join(' e ');
  const source=`Eu (nós), ${names}, aluno(s) do Curso, matriculado(s) na disciplina, após cumprir todos os requisitos, e o(a) Prof(ª). Dr(ª). orientador(a) Prof.ª Dr.ª Maria Oliveira, AUTORIZO(amos) a postagem.\nProf(ª). Dr(ª). Prof.ª Dr.ª Maria Oliveira\nOrientador(a)\nAluno(a)s`;
  const out=adaptDocumentLanguage(source,p,'TERMO');
  assert.ok(out.startsWith(`${second?'Nós':'Eu'}, ${names}, ${label} do Curso, ${enrolled}`),out);assert.match(out,/e a orientadora e Presidente Prof\.ª Dr\.ª Maria Oliveira, AUTORIZAMOS/);assert.match(out,new RegExp(`após ${second?'cumprirmos':'cumprir'} todos`));assert.doesNotMatch(out,/\((?:a|ª|s|nós|amos)\)/);assert.doesNotMatch(out,/Dr.ª Prof.ª/);assert.equal(adaptDocumentLanguage(out,p,'TERMO'),out);assert.equal(personPresentationVariables(p).AUTORIA_VARIANTE,variant);
  assert.equal(personPresentationVariables(p).AUTORIA_VERBO_AUTORIZAR,second?'autorizamos':'autorizo');
 }
});
test('author ordering changes document names, never canonical identity or signing membership',()=>{
 const p=fixture();p.aluno2={...p.aluno1,nome:'Ana Pereira',email:'ana@example.invalid'};p.authorOrder='ALUNO_2_FIRST';
 const vars=personPresentationVariables(p);assert.equal(vars.AUTORIA_APRESENTACAO,'as alunas Ana Pereira e Maria da Silva');assert.equal(vars.AUTORIA_NOMES,'Ana Pereira e Maria da Silva');assert.equal(vars.AUTORIA_PRIMEIRO_NOME,'Ana Pereira');assert.equal(vars.ALUNO_1_NOME_COMPLETO,'Maria da Silva');
 const processVars=buildProcessVariables({process:p,eventCode:'TEST',actorEmail:'master@portal.local',actorRoles:[],extraVariables:{AUTORIA_APRESENTACAO:'spoof'}});assert.equal(processVars.CAMPO_01,'Ana Pereira e Maria da Silva');assert.equal(processVars.ALUNO_1_EMAIL,p.aluno1.email);assert.equal(processVars.AUTORIA_APRESENTACAO,vars.AUTORIA_APRESENTACAO);
 const questions=registrationQuestions();assert.equal(questions.some(q=>q.fieldKey==='AUTORIA_ORDEM'),false);
 const payload=registrationPayload({DEFESA_DATA_HORA:'2026-10-15T14:00',TEM_ALUNO_2:'Sim',AUTORIA_ORDEM:'Segundo autor, depois primeiro autor'},'America/Sao_Paulo');assert.equal(payload.authorOrder,'ALUNO_1_FIRST');
 assert.equal(registrationPayload({DEFESA_DATA_HORA:'2026-10-15T14:00',TEM_ALUNO_2:'Não',AUTORIA_ORDEM:'Segundo autor, depois primeiro autor'},'America/Sao_Paulo').authorOrder,'ALUNO_1_FIRST');
});

test('legacy registration keeps treatment and degree next to the corresponding name section',async()=>{
 const {registrationQuestions}=await import('../src/utils/operationalConfig');
 const fields=registrationQuestions({formTemplates:[{id:'form-reserva-aluno',questions:[{id:'custom-advisor',fieldKey:'ORIENTADOR_NOME',label:'Nome docente',fieldType:'text',required:true,section:'Dados da orientação'}]}] as any});
 const name=fields.findIndex(field=>field.fieldKey==='ORIENTADOR_NOME');
 assert.equal(fields[name-2].fieldKey,'ORIENTADOR_TRATAMENTO');assert.equal(fields[name-1].fieldKey,'ORIENTADOR_TITULACAO');
 assert.equal(fields[name-2].section,'Dados da orientação');assert.equal(fields[name-1].section,'Dados da orientação');
 assert.equal(fields[name-2].required,true);assert.equal(fields[name-1].required,true);
 assert.ok(fields.some(field=>field.fieldKey==='AUTORIA_REFERENCIA'));assert.ok(!fields.some(field=>field.fieldKey==='ALUNO_1_TRATAMENTO'));
 assert.ok(!fields.some(field=>field.fieldKey==='AUTORIA_ORDEM'));
});

test('ata screenshot: date alone, abbreviated names, no numbered members and no comma before colon',()=>{
 const p=fixture();p.banca=[{id:'b2',nome:'Beatriz Santos',email:'b@example.invalid',tratamento:'Professora',titulacao:'Mestra',funcao:'EXAMINER_2'},{id:'b3',nome:'Rafael Lima',email:'r@example.invalid',tratamento:'Professor',titulacao:'Doutor',funcao:'EXAMINER_3'}];
 const source='Professora Doutora Maria Oliveira, apresentando os demais examinadores, : Professora Mestra Beatriz Santos e Professor Doutor Rafael Lima.\nVitória - ES, 15 de outubro de 2026 às 15:00.\n2º Examinador(a)\n3º Integrante da banca';
 const out=adaptDocumentLanguage(source,p,'ATA');
 assert.match(out,/Prof\.ª Dr\.ª Maria Oliveira/);assert.match(out,/examinadores: Prof\.ª Ma\. Beatriz Santos e Prof\. Dr\. Rafael Lima/);
 assert.match(out,/Vitória - ES, 15 de outubro de 2026\./);assert.doesNotMatch(out,/às 15:00|[23]º|,\s*:/);
 assert.match(out,/Examinadora/);assert.match(out,/Examinador/);assert.doesNotMatch(out,/Integrante da banca/);
});

test('only an absent second author removes its signature paragraph and one adjacent blank',async()=>{
 const {optionalAuthorBlockRequests}=await import('./integrations/documentPresentation');
 const p=fixture();
 const doc={body:{content:[{startIndex:1,endIndex:6,paragraph:{elements:[{textRun:{content:'Ana\n'}}]}},{startIndex:6,endIndex:7,paragraph:{elements:[{textRun:{content:'\n'}}]}},{startIndex:7,endIndex:40,paragraph:{elements:[{textRun:{content:'<<nome completo aluno (2)>>\n'}}]}},{startIndex:40,endIndex:47,paragraph:{elements:[{textRun:{content:'Aluna\n'}}]}}]}};
 assert.deepEqual(optionalAuthorBlockRequests(doc,p),[{deleteContentRange:{range:{startIndex:6,endIndex:40}}}]);
 p.aluno2={...p.aluno1,nome:'Ana Pereira'};assert.deepEqual(optionalAuthorBlockRequests(doc,p),[]);
});
