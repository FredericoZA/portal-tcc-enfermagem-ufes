import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProcessData } from '../src/types';
import { officialParticipantLines, officialIdentificationLines } from '../src/utils/officialParticipants';
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

test('carta alinha data à direita, assinatura recuada e parágrafo justificado',()=>{
  const entries=[
    {startIndex:10,endIndex:90,paragraph:{elements:[{textRun:{content:'A Comissão de Trabalho de Conclusão de Curso do Curso de Enfermagem convida\n'}}]}},
    {startIndex:90,endIndex:120,paragraph:{elements:[{textRun:{content:'Vitória-ES, terça-feira, 3 de novembro de 2026.\n'}}]}},
    {startIndex:120,endIndex:150,paragraph:{elements:[{textRun:{content:'Comissão de Trabalho de Conclusão de Curso\n'}}]}},
  ];
  const requests=buildOfficialInvitationParagraphStyles({tabs:[{tabProperties:{tabId:'t.0'},documentTab:{body:{content:entries}}}]});
  assert.equal(requests.length,3);
  assert.deepEqual(requests.map((r:any)=>r.updateParagraphStyle.paragraphStyle.alignment),['JUSTIFIED','END','START']);
  assert.equal((requests[2] as any).updateParagraphStyle.paragraphStyle.indentStart.magnitude,260);
});
