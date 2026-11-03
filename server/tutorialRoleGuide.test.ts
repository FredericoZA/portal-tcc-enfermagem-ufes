import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PortalIllustratedGuide} from '../src/components/PortalIllustratedGuide';
import {readFileSync} from 'node:fs';
const guide=(role:string)=>renderToStaticMarkup(React.createElement(PortalIllustratedGuide,{role}));
test('visitante recebe consulta pública sem instruções de acesso a processo privado',()=>{
 const html=guide('visitante');assert.match(html,/Calendário/);assert.match(html,/Repositório/);assert.doesNotMatch(html,/Registrar o resultado|Confirmar a reserva|seis dígitos|\/manual\/ficha/);
});
test('Como usar tem apenas aluno, orientador e visitante; presidência conserva área operacional separada',()=>{
 assert.equal(guide('presidente'),'');
 const source=readFileSync(new URL('../src/pages/PortalTutorialPage.tsx',import.meta.url),'utf8');assert.doesNotMatch(source,/presidente:|Presidente da Comissão/);
});
test('aluno e orientador veem tarefas diferentes',()=>{
 const student=guide('aluno'),advisor=guide('orientador');assert.match(student,/Acompanhar a confirmação da reserva/);assert.match(student,/Entregar os arquivos/);assert.doesNotMatch(student,/Registrar o conceito e conferir/);assert.match(advisor,/Registrar o conceito e conferir/);assert.doesNotMatch(advisor,/Entregar os arquivos e escolher/);
});
test('guia de cliques fica somente em Como usar',()=>{
 const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');assert.match(read('src/pages/PortalTutorialPage.tsx'),/<PortalIllustratedGuide role=\{role\}/);assert.doesNotMatch(read('src/pages/FluxoTccPage.tsx'),/PortalIllustratedGuide/);
});
test('fichário por perfil tem imagens existentes e painéis acessíveis',()=>{
 for(const [role,count] of [['aluno',7],['orientador',5],['visitante',4]] as const){
  const html=guide(role);assert.equal((html.match(/role="tab"/g)||[]).length,count);
  assert.match(html,/role="tabpanel"/);assert.match(html,role==='visitante'?/md:w-full/:/w-1\/4 md:w-1\/2/);assert.match(html,/Abrir imagem em tamanho maior/);
 }
});
test('ficha transmite o código da etapa ao progresso sem rótulo plural ambíguo',()=>{
 const detail=readFileSync(new URL('../src/pages/ProcessoDetailPage.tsx',import.meta.url),'utf8');assert.match(detail,/<EtapaProgressBar currentEtapa=\{process.etapaAtual\}/);
});
