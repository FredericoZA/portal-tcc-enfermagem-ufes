import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeReviewedTccTitle,suggestSentenceTitle} from '../src/utils/reviewedTccTitle';

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
