import test from 'node:test';
import assert from 'node:assert/strict';
import {operationalEmailLayout} from '../src/utils/operationalEmailLayout';
test('shared email envelope renders green header, configured images and exactly one link before guidance',()=>{
 const output=operationalEmailLayout({text:'Olá.\n\nConsulte https://portal.example/?tcc=p e https://portal.example/?tcc=p&secao=docs\n\nORIENTAÇÕES DO PROCESSO\n\nConfira a pendência.',subject:'Reserva',href:'https://portal.example/action',label:'Confirmar reserva',studio:{brandKit:{courseName:'Enfermagem',primaryColor:'#005830',courseLogoUrl:'https://images.example/logo.png',emailBannerUrl:'https://images.example/banner.png'} as any}});
 assert.equal((output.html.match(/<a /g)||[]).length,1);assert.equal((output.text.match(/https?:\/\/\S+/g)||[]).length,1);
 assert.match(output.html,/background:#005830/);assert.match(output.html,/national-arms.png/);assert.match(output.html,/banner.png/);assert.ok(output.html.indexOf('<a ')<output.html.indexOf('<h2 '));assert.doesNotMatch(output.html,/E-mail de acesso/);
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
