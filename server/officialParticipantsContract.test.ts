import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProcessData } from '../src/types';
import { officialParticipantLines, officialIdentificationLines, participantRole } from '../src/utils/officialParticipants';
import { officialInvitationEmail } from './workflow/officialInvitation';
import { invitationTemplateCorrections } from './workflow/invitationTemplate';
import { buildOfficialInvitationParagraphStyles } from './integrations/googleDocsRenderer';

const fixture={
  id:'proc-test',protocolo:'TCC-2026-0006',titulo:'Título do Trabalho',createdByEmail:'aluno@edu.ufes.br',
  aluno1:{nome:'Ana Maria',matricula:'123',email:'ana@edu.ufes.br'},
  aluno2:{nome:'Pedro Silva',matricula:'124',email:'pedro@edu.ufes.br'},
  orientador:{nome:'Maria Oliveira',email:'maria@ufes.br'},
  coorientador:{nome:'Júlio Pereira',email:'julio@ufes.br'},
  banca:[
    {id:'e2',nome:'João da Silva',email:'joao@ufes.br',funcao:'EXAMINER_2'},
    {id:'e3',nome:'Luísa Costa',email:'luisa@ufes.br',funcao:'EXAMINER_3'},
  ],
  registrationAnswers:{
    ALUNO_1_TRATAMENTO:'Aluna',ALUNO_2_TRATAMENTO:'Aluno',
    ORIENTADOR_TRATAMENTO:'Professora',ORIENTADOR_TITULACAO:'Doutora',
    EXAMINADOR_2_TRATAMENTO:'Professor',EXAMINADOR_2_TITULACAO:'Doutor',
    EXAMINADOR_3_TRATAMENTO:'Professora',EXAMINADOR_3_TITULACAO:'Doutora',
    COORIENTADOR_TRATAMENTO:'Professor',COORIENTADOR_TITULACAO:'Doutor',
  },
  defesa:{startAt:'2026-11-02T18:00:00Z',endAt:'2026-11-02T19:30:00Z',local:'Auditório do Departamento de Enfermagem'},
  avaliacao:{status:'PENDENTE'},bancaOutros:[],etapaAtual:'CONVITE',status:'AGUARDANDO_DEFESA',
  dataRevision:1,createdAt:'2026-10-10T00:00:00Z',updatedAt:'2026-10-10T00:00:00Z',
} as unknown as ProcessData;

test('padrão canônico tem título antes de cada autor, orientador, examinadores e coorientador',()=>{
  const rows=officialIdentificationLines(fixture);
  assert.deepEqual(rows,[
    'Título: Título do Trabalho',
    'Aluna autora: Ana Maria',
    'Aluno autor: Pedro Silva',
    'Orientadora: Profª. Drª. Maria Oliveira',
    'Examinador: Prof. Dr. João da Silva',
    'Examinadora: Profª. Drª. Luísa Costa',
    'Coorientador: Prof. Dr. Júlio Pereira',
  ]);
});

test('não infere gênero pelo nome e omite participantes opcionais ausentes',()=>{
  const p={...fixture,aluno2:null,coorientador:null,registrationAnswers:{}} as ProcessData;
  assert.deepEqual(officialParticipantLines(p).map(item=>item.role),[
    'Aluno autor','Orientador','Examinador','Examinador',
  ]);
});

test('assunto e conteúdo do e-mail não juntam alunos nem usam Autoria e Avaliadores da banca',()=>{
  const mail=officialInvitationEmail(fixture,'https://portal-tcc-enfermagem-ufes.vercel.app/');
  assert.match(mail.subject,/TCC-2026-0006/);
  assert.doesNotMatch(mail.subject,/Ana Maria|Pedro Silva/);
  assert.match(mail.text,/Aluna autora: Ana Maria\nAluno autor: Pedro Silva\nOrientadora:/);
  assert.match(mail.text,/Examinador: Prof\. Dr\. João da Silva\nExaminadora: Profª\. Drª\. Luísa Costa/);
  assert.doesNotMatch(mail.text,/Autoria:|Avaliadores da banca:/);
  assert.match(mail.html,/<strong>Aluna autora:<\/strong> Ana Maria/);
});

test('carta substitui trechos aglutinados do modelo ativo sem alterar o arquivo fonte',()=>{
  const corrections=invitationTemplateCorrections(fixture,new Date('2026-11-03T12:00:00Z'));
  const map=Object.fromEntries(corrections.map(({find,replace})=>[find,replace]));
  assert.match(map['Autoria: <<alunos>>'],/Aluna autora: Ana Maria\nAluno autor: Pedro Silva/);
  assert.match(map['Demais integrantes da comissão: <<examinador (2)>> e <<examinador (3)>>'],/Examinador:.*\nExaminadora:.*\nCoorientador:/);
  assert.match(map['Atenciosamente,'],/Vitória-ES, terça-feira, 3 de novembro de 2026/);
});

test('carta alinha data e comissão à direita, sem recuo fixo',()=>{
  const entries=[
    {startIndex:10,endIndex:90,paragraph:{elements:[{textRun:{content:'A Comissão de Trabalho de Conclusão de Curso do Curso de Enfermagem convida\n'}}]}},
    {startIndex:90,endIndex:120,paragraph:{elements:[{textRun:{content:'Vitória-ES, terça-feira, 3 de novembro de 2026.\n'}}]}},
    {startIndex:120,endIndex:150,paragraph:{elements:[{textRun:{content:'Comissão de Trabalho de Conclusão de Curso\n'}}]}},
  ];
  const requests=buildOfficialInvitationParagraphStyles({tabs:[{tabProperties:{tabId:'t.0'},documentTab:{body:{content:entries}}}]});
  const alignment=requests.flatMap((r:any)=>r.updateParagraphStyle?[r.updateParagraphStyle]:[]);
  assert.deepEqual(alignment.map(style=>style.paragraphStyle.alignment),['JUSTIFIED','END','END']);
  assert.equal(alignment[2].paragraphStyle.indentStart.magnitude,0);
  const weight=requests.flatMap((r:any)=>r.updateTextStyle?[r.updateTextStyle]:[]);
  assert.deepEqual(weight,[{range:{startIndex:10,endIndex:90,tabId:'t.0'},textStyle:{bold:false},fields:'bold'}]);
});


test('carta mantém os dados e o texto do convite em peso normal, preservando o título institucional',()=>{
  const paragraphs=['CARTA-CONVITE','Aos docentes convidados','Título: Trabalho','Aluno autor: João','Aluna autora: Maria',
    'Orientadora e Presidente: Ana','Examinador: Pedro','Examinadora: Paula','Coorientadora: Rita',
    'Data: domingo','Horário: 22:15','Local: Auditório','Agradecemos a atenção ao convite.','Atenciosamente,'];
  let startIndex=1;
  const content=paragraphs.map(text=>{
    const entry={startIndex,endIndex:startIndex+text.length+1,paragraph:{elements:[{textRun:{content:text+'\n',textStyle:{bold:true}}}]}};
    startIndex=entry.endIndex;
    return entry;
  });
  const weights=buildOfficialInvitationParagraphStyles({body:{content}}).flatMap((request:any)=>request.updateTextStyle?[request.updateTextStyle]:[]);
  assert.deepEqual(weights.map(style=>style.range.startIndex),content.slice(1,-1).map(item=>item.startIndex));
  assert.ok(weights.every(style=>style.fields==='bold'&&style.textStyle.bold===false));
});

test('tabela usa tratamento do participante mesmo sem respostas de formulário nos legados',()=>{
  assert.equal(participantRole('student',undefined,'ALUNO_1',{nome:'Nome de exemplo',tratamento:'Aluna'}),'Aluna autora');
  assert.equal(participantRole('advisor',{},'ORIENTADOR',{tratamento:'Professora'}),'Orientadora');
  assert.equal(participantRole('examiner',{},'EXAMINADOR_2',{tratamento:'Professora'}),'Examinadora');
  assert.equal(participantRole('coadvisor',{},'COORIENTADOR',{tratamento:'Professora'}),'Coorientadora');
  assert.equal(participantRole('examiner',{},'EXAMINADOR_3',{nome:'Maria',tratamento:'Professor'}),'Examinador');
});
