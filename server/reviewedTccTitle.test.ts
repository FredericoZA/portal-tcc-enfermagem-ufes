import test from 'node:test';
import assert from 'node:assert/strict';
import {hasUppercaseTitlePassage,normalizeReviewedTccTitle,suggestSentenceTitle} from '../src/utils/reviewedTccTitle';

test('reviewed titles preserve proper names, natural case and mathematical symbols',()=>{
  const title='A convivência em Vitória: Maria e João no CAPS III — cuidado + vínculo';
  assert.equal(normalizeReviewedTccTitle('  '+title+'  '),title);
  assert.equal(suggestSentenceTitle(title),title);
  assert.equal(normalizeReviewedTccTitle('Cuidado A+B - análise'), 'Cuidado A+B - análise');
});
test('capitalization suggestion preserves recognized acronyms and Roman numerals without Title Case',()=>{
  assert.equal(suggestSentenceTitle('A CONVIVÊNCIA ENTRE A PESSOA COM TRANSTORNO BIPOLAR E SEUS FAMILIARES'),'A convivência entre a pessoa com transtorno bipolar e seus familiares');
  assert.equal(suggestSentenceTitle('ESTUDO NO CAPS III E NO SUS'),'Estudo no CAPS III e no SUS');
});

test('a caixa alta em um trecho do título é identificada mesmo com subtítulo em caixa normal', () => {
  for (const value of [
    'ETARISMO NA UNIVERSIDADE: Uma revisão integrativa',
    'ETARISMO na UNIVERSIDADE: Uma revisão integrativa',
  ]) {
    assert.equal(suggestSentenceTitle(value), 'Etarismo na universidade: Uma revisão integrativa');
  }
  assert.equal(suggestSentenceTitle('ETARISMO'), 'Etarismo');
  assert.equal(suggestSentenceTitle('BOM DIA'), 'Bom dia');
  assert.equal(suggestSentenceTitle('O ACESSO AO SUS: estudo sobre HIV-1'), 'O acesso ao SUS: estudo sobre HIV-1');
  for (const value of [
    'HTLV e HIV-1 na UFES',
    'O programa ABCE na universidade',
    'Pesquisa com ABCE e PECA',
    'Cuidado com PrEP na atenção primária',
    'Fatores A, B e C no CAPS III',
    'Avaliação em UFES e PEP no SUS',
  ]) assert.equal(suggestSentenceTitle(value), value);
});

test('academic instrument acronyms retain their hyphenated variant', () => {
  for (const value of ['WHOQOL-BREF', 'Avaliação com WHOQOL-BREF', 'Aplicação do WHOQOL-OLD e do WHOQOL-100']) {
    assert.equal(hasUppercaseTitlePassage(value), false);
    assert.equal(suggestSentenceTitle(value), value);
  }
  const uppercase = 'ESTUDO DE QUALIDADE DE VIDA COM WHOQOL-BREF NO SUS';
  assert.equal(hasUppercaseTitlePassage(uppercase), true);
  assert.equal(suggestSentenceTitle(uppercase), 'Estudo de qualidade de vida com WHOQOL-BREF no SUS');
  assert.equal(hasUppercaseTitlePassage('ESTUDO-QUALITATIVO: Uma revisão'), true);
});
