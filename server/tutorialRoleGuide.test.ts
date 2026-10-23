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
test('presidência recebe apenas a atividade de declaração e uma imagem existente',()=>{
 const html=guide('presidente');assert.match(html,/Conferir e assinar a declaração da banca/);assert.match(html,/\/manual\/presidencia.jpg/);assert.doesNotMatch(html,/Registrar o resultado e concluir|Entregar os arquivos e escolher|Confirmar a reserva, com/);
});
test('aluno e orientação veem tarefas diferentes',()=>{
 const student=guide('aluno'),advisor=guide('orientador');assert.match(student,/Confirmar a reserva/);assert.match(student,/Entregar os arquivos/);assert.doesNotMatch(student,/Registrar o resultado e concluir/);assert.match(advisor,/Registrar o resultado e concluir/);assert.doesNotMatch(advisor,/Entregar os arquivos e escolher/);
});
test('guia de cliques fica somente em Como usar',()=>{
 const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');assert.match(read('src/pages/PortalTutorialPage.tsx'),/<PortalIllustratedGuide role=\{role\}/);assert.doesNotMatch(read('src/pages/FluxoTccPage.tsx'),/PortalIllustratedGuide/);
});
test('fichário por perfil tem imagens existentes e painéis acessíveis',()=>{
 for(const [role,count] of [['aluno',7],['orientador',5],['presidente',4],['visitante',3]] as const){
  const html=guide(role);assert.equal((html.match(/role="tab"/g)||[]).length,count);
  assert.match(html,/role="tabpanel"/);assert.match(html,/md:w-full/);
 }
});
test('ficha transmite o código da etapa ao progresso sem rótulo plural ambíguo',()=>{
 const detail=readFileSync(new URL('../src/pages/ProcessoDetailPage.tsx',import.meta.url),'utf8');assert.match(detail,/<EtapaProgressBar currentEtapa=\{process.etapaAtual\}/);
});
