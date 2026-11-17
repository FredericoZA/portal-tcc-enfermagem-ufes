import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LegacyAdministrativeDocuments} from '../src/components/LegacyAdministrativeDocuments';
import {ReservationReceiptCard} from '../src/components/ProcessDocumentCard';
import type {ProcessDocument} from '../src/types';

const render=(publicDocuments:ProcessDocument[]=[],canAccessOriginals=false)=>renderToStaticMarkup(React.createElement(LegacyAdministrativeDocuments,{processId:'legado-0999',publicDocuments,canAccessOriginals}));
const invitation=(patch:Partial<ProcessDocument>={})=>({id:'legacy-document-0',type:'CONVITE',title:'Carta-Convite da Banca',status:'DISPONIVEL',driveDownloadUrl:'/api/public/legacy-academic-records/legado-0999/documents/0/download',...patch}) as ProcessDocument;

test('historical documents omit the nonexistent reservation receipt and invitation cards',()=>{
 for(const master of [false,true]){
  const html=render([],master);
  assert.doesNotMatch(html,/Comprovante de reserva|Carta-Convite da Banca/);
  assert.match(html,/4 documento\(s\)/);
  assert.match(html,/Instrumento de avaliação/);
  assert.match(html,/>Ata</);
 }
});
test('visitor cannot open invitations or evaluation instruments supplied as public documents',()=>{
 const html=render([invitation(),invitation({type:'AVALIACAO' as any,title:'Instrumento de avaliação'})]);
 assert.doesNotMatch(html,/Carta-Convite da Banca/);assert.match(html,/4 documento\(s\)/);
 const instrument=html.match(/<article[\s\S]*?<\/article>/g)!.find(card=>card.includes('>Instrumento de avaliação<'))!;
 assert.match(instrument,/Acesso restrito/);assert.equal((instrument.match(/<button[^>]*disabled/g)||[]).length,2);
 assert.doesNotMatch(html,/Comprovante de reserva/);
});
test('current-process reservation card remains available to the normal document panel',()=>{
 const html=renderToStaticMarkup(React.createElement(ReservationReceiptCard,{protocol:'TCC - 99999',currentStatus:'CONFIRMADO'}));
 assert.match(html,/Comprovante de reserva/);
});
