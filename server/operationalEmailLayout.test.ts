import test from 'node:test';
import assert from 'node:assert/strict';
import {operationalEmailLayout} from '../src/utils/operationalEmailLayout';
test('shared email envelope renders green header, configured images and exactly one link before guidance',()=>{
 const output=operationalEmailLayout({text:'Olá.\n\nConsulte https://portal.example/?tcc=p e https://portal.example/?tcc=p&secao=docs\n\nORIENTAÇÕES DO PROCESSO\n\nConfira a pendência.',subject:'Reserva',href:'https://portal.example/action',label:'Confirmar reserva',studio:{brandKit:{courseName:'Enfermagem',primaryColor:'#005830',courseLogoUrl:'https://images.example/logo.png',emailBannerUrl:'https://images.example/banner.png'} as any}});
 assert.equal((output.html.match(/<a /g)||[]).length,1);assert.equal((output.text.match(/https?:\/\/\S+/g)||[]).length,1);
 assert.match(output.html,/background:#005830/);assert.match(output.html,/national-arms.png/);assert.match(output.html,/banner.png/);assert.ok(output.html.indexOf('<a ')<output.html.indexOf('<h2 '));assert.doesNotMatch(output.html,/E-mail de acesso/);
 assert.match(output.html,/UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO<br>CENTRO DE CIÊNCIAS DA SAÚDE<br>ENFERMAGEM<\/div>/);assert.match(output.text,/Olá\./);
});

import {processEmailGuidance} from '../src/utils/processEmailGuidance';
test('every workflow notification has one destination and no generic login paragraph',()=>{
 for(const [event,template] of [['TCC_CREATED','email-instrucoes-cadastro'],['LOCATION_CONFIRMED','email-confirmacao'],['INVITATION_SENT','email-convite'],['EVALUATION_SUBMITTED','email-avaliacao'],['SIGNATURE_REQUESTED','email-assinatura'],['SIGNATURE_COMPLETED','email-assinatura-finalizada'],['REPOSITORY_SUBMITTED','email-entrega'],['PUBLICATION_CLEARED','email-declaracao'],['PROCESS_COMPLETED','email-conclusao']]){
  const instructions=processEmailGuidance({id:'p',protocolo:'TCC-2026-0001',etapaAtual:'CADASTRO'},'https://portal.example',event,template);
  const output=operationalEmailLayout({text:'Mensagem da etapa.\n\n'+instructions,subject:event,href:'https://portal.example/?tcc=p',label:'TCC-2026-0001'});
  assert.match(output.html,/bgcolor="#fffbeb"/,event);assert.equal((output.html.match(/<a /g)||[]).length,1,event);assert.equal((output.text.match(/https?:\/\/\S+/g)||[]).length,1,event);assert.doesNotMatch(output.text,/E-mail de acesso:|Clique em Entrar|O acesso ao TCC/);assert.ok(instructions.length<650,event);
 }
});

test('UFES email uses the original institutional crest despite a saved course logo',()=>{
 const key='a'.repeat(64);
 const output=operationalEmailLayout({text:'Prezado departamento.',subject:'Reserva',href:'https://portal.example/tcc',label:'TCC',studio:{emailDesigns:{'email-reserva':{logoUrl:`https://portal.example/api/public/runtime-assets/${key}`} as any},brandKit:{primaryColor:'#005830'} as any},templateId:'email-reserva'});
 assert.match(output.html,/national-arms.png/);assert.doesNotMatch(output.html,new RegExp(key));
 assert.match(output.html,/border:0;background-color:#ffffff;border-radius:50%/);
 assert.doesNotMatch(output.html,/background(?:-color)?:\s*(?:black|#000(?:000)?)[;\"]/);
});

test('observations and instructions use pale yellow, outside the main text and signature',()=>{
 const output=operationalEmailLayout({text:'Prezados autores,\n\nDados do trabalho.\n\nObservação: local alternativo informado.\n\nORIENTAÇÕES DO PROCESSO\n\nAutores: confiram o termo.\n\n• Asten: assinem pelo e-mail.\n• Gov.br: devolvam o PDF.\n\nAtenciosamente,\nComissão de TCC',subject:'Teste',href:'https://portal.example/tcc',label:'TCC'});
 assert.equal((output.html.match(/bgcolor="#fffbeb"/g)||[]).length,2);
 assert.match(output.html,/<td bgcolor="#fffbeb"[^>]*>[\s\S]*?Observação: local alternativo informado/);
 assert.match(output.html,/<h2[^>]*>ORIENTAÇÕES DO PROCESSO<\/h2>[\s\S]*?Autores:[\s\S]*?<ul/);
 assert.match(output.html,/<\/td><\/tr><\/table><p[^>]*>Atenciosamente/);
 assert.ok(output.html.indexOf('<a ')<output.html.indexOf('<h2'));
 assert.doesNotMatch(output.text,/<table|bgcolor/);
});


test('modelos antigos de e-mail exibem o nome completo da comissão na emissão',()=>{
 const output=operationalEmailLayout({text:'Prezados,\n\nAtenciosamente,\nComissão de TCC',subject:'Reserva',href:'https://portal.example/tcc',label:'TCC'});
 assert.match(output.text,/Comissão de Trabalho de Conclusão de Curso/);
 assert.match(output.html,/Comissão de Trabalho de Conclusão de Curso/);
 assert.doesNotMatch(output.text,/Comissão de TCC/);
 assert.doesNotMatch(output.html,/Comissão de TCC/);
});


test('UFES emails add all three heading lines and merge the duplicated saved closing',()=>{
 const closing='Atenciosamente,\nComissão de Trabalho de Conclusão de Curso\nDepartamento de Enfermagem\nCurso de Enfermagem e Obstetrícia — CCS/UFES\nCurso de Graduação em Enfermagem e Obstetrícia';
 const output=operationalEmailLayout({text:'Prezados,\n\n'+closing,subject:'Reserva',href:'https://portal.example/tcc',label:'TCC',templateId:'email-confirmacao',studio:{brandKit:{institutionName:'Universidade Federal do Espírito Santo',courseName:'Curso de Graduação em Enfermagem e Obstetrícia',primaryColor:'#005a3c'} as any,emailDesigns:{'email-confirmacao':{headerText:'CURSO DE GRADUAÇÃO EM ENFERMAGEM E OBSTETRÍCIA'} as any}}});
 assert.match(output.html,/UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO<br>CENTRO DE CIÊNCIAS DA SAÚDE<br>CURSO DE GRADUAÇÃO EM ENFERMAGEM E OBSTETRÍCIA<\/div>/);
 assert.match(output.html,/bgcolor="#005a3c"/);
 assert.match(output.text,/Atenciosamente,\nComissão de Trabalho de Conclusão de Curso\nDepartamento de Enfermagem\nCurso de Graduação em Enfermagem e Obstetrícia - CCS\/UFES$/);
 assert.equal((output.html.match(/Curso de Graduação em Enfermagem e Obstetrícia - CCS\/UFES/g)||[]).length,1);
 assert.doesNotMatch(output.html,/Curso de Enfermagem e Obstetrícia — CCS\/UFES/);
});

test('email closing keeps custom contacts and missing closing gets the same institutional signature',()=>{
 const output=operationalEmailLayout({text:'Mensagem.\n\nAtenciosamente,\nComissão de TCC\nContato: Secretaria',subject:'Aviso',href:'https://portal.example',label:'Portal'});
 assert.match(output.text,/Curso de Graduação em Enfermagem e Obstetrícia - CCS\/UFES\nContato: Secretaria$/);
 const fallback=operationalEmailLayout({text:'Mensagem.',subject:'Aviso',href:'https://portal.example',label:'Portal'});
 assert.match(fallback.html,/Atenciosamente,<br>Comissão de Trabalho de Conclusão de Curso<br>Departamento de Enfermagem<br>Curso de Graduação em Enfermagem e Obstetrícia - CCS\/UFES/);
 const replica=operationalEmailLayout({text:'Mensagem.',subject:'Aviso',href:'https://portal.example',label:'Portal',studio:{brandKit:{institutionName:'Outra Universidade',courseName:'Outro Curso'} as any,emailDesigns:{}}});
 assert.match(replica.html,/>OUTRO CURSO<\/div>/);
 assert.doesNotMatch(replica.html,/UNIVERSIDADE FEDERAL DO ESPÍRITO SANTO<br>/);
});


test('explicit custom email headings remain editable and HTML escaped',()=>{
 const output=operationalEmailLayout({text:'Aviso.',subject:'Aviso',href:'https://portal.example',label:'Portal',templateId:'custom',studio:{emailDesigns:{custom:{headerText:'Cabeçalho <personalizado>'} as any}}});
 assert.match(output.html,/CABEÇALHO &lt;PERSONALIZADO&gt;<\/div>/);
});


test('saved single-line institutional footer expands without a duplicate department suffix',()=>{
 const output=operationalEmailLayout({text:'Mensagem.\n\nAtenciosamente,\nComissão de Trabalho de Conclusão de Curso do Departamento de Enfermagem • UFES',subject:'Aviso',href:'https://portal.example',label:'Portal'});
 assert.match(output.text,/Atenciosamente,\nComissão de Trabalho de Conclusão de Curso\nDepartamento de Enfermagem\nCurso de Graduação em Enfermagem e Obstetrícia - CCS\/UFES$/);
 assert.doesNotMatch(output.text,/ • UFES|do Departamento/);
});
