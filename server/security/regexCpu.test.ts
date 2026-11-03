import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {isEmailAddress} from '../../src/utils/emailAddress';
import {delimitedTextParts, replaceLegacySalutation, removeAtaLocationTime, stripDocumentScanningBlocks, stripInlineMarkup} from '../../src/utils/legacyTextProcessing';
import {studioMarkerPatterns, workflowMarkerPattern} from '../../src/utils/templateMarkerPattern';
import {mergeWorkflowVariables, mergeWorkflowHtmlVariables, parseRecipients} from '../workflow/runtime';
import {buildGoogleDocsReplacementRequests} from '../integrations/googleDocsRenderer';

const oldWorkflowMarkers = () => /\{\{\s*([^{}\n]{1,100}?)\s*\}\}|<<\s*([^<>\n]{1,100}?)\s*>>|\[\[\s*([^\[\]\n]{1,100}?)\s*\]\]|«\s*([^«»\n]{1,100}?)\s*»|-((?:CAMPO_)?[A-Z0-9_]+)-/g;
const oldStudioMarkers = () => [
  /\{\{\s*([^{}\r\n]{1,100})\s*\}\}/g, /<<\s*([^<>\r\n]{1,100})\s*>>/g,
  /\[\[\s*([^\[\]\r\n]{1,100})\s*\]\]/g, /«\s*([^«»\r\n]{1,100})\s*»/g,
  /-((?:CAMPO_)?[A-Z][A-Z0-9_]{1,80})-/g
];
const markers = (source: string, pattern: RegExp) => Array.from(source.matchAll(pattern), match => [match.index, match[0], match.slice(1).find(value => value !== undefined)?.trim()]);

function randomInputs(alphabet: string[], count = 1200): string[] {
  let seed = 169;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  return Array.from({length: count}, () => Array.from({length: next() % 45}, () => alphabet[next() % alphabet.length]).join(''));
}

test('email syntax remains equivalent, including Unicode and unusual internal dots', () => {
  const old = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const source of ['a@b.c', '李@例子.公司', 'a@..a', 'a@a..', 'a@.a.', 'a@@b.c', 'a@b.c\n', ...randomInputs(['a', '.', '@', ' ', '\n', '李'])]) {
    assert.equal(isEmailAddress(source), old.test(source), JSON.stringify(source));
  }
  assert.deepEqual(parseRecipients('<<ALUNO_EMAIL>>; other@example.invalid', {ALUNO_EMAIL: '李@例子.公司'}), ['李@例子.公司', 'other@example.invalid']);
});

test('marker boundaries and authorization retain the published syntax', () => {
  const inputs = ['{{}}', '{{ }}', '{{\n}}', '{{\n \n}}', '{{outer {{NOME}}', '{{a\rb}}', '<<a\nb>>', '-CAMPO_01-', '-1-',
    ...['{{', '<<', '[[', '«'].flatMap((opening, i) => {
      const closing = ['}}', '>>', ']]', '»'][i];
      return [1, 99, 100, 101].map(length => opening + ' \n' + 'a'.repeat(length) + ' \n' + closing);
    }), ...randomInputs(['{', '}', '<', '>', '[', ']', '«', '»', ' ', '\n', '\r', 'A', '_', '-'])];
  for (const source of inputs) {
    assert.deepEqual(markers(source, workflowMarkerPattern()), markers(source, oldWorkflowMarkers()), JSON.stringify(source));
    const previous = oldStudioMarkers();
    studioMarkerPatterns().forEach((pattern, index) => assert.deepEqual(markers(source, pattern), markers(source, previous[index]), JSON.stringify(source)));
  }
  assert.equal(mergeWorkflowVariables('{{NOME}} <<SEM_VALOR>> -SEM_VALOR-', {NOME: '<<ALUNO_EMAIL>>'}), '<<ALUNO_EMAIL>>  -SEM_VALOR-');
  assert.equal(mergeWorkflowHtmlVariables('<<NOME>>', {NOME: '<b>Nome</b>'}), '&lt;b&gt;Nome&lt;/b&gt;');
  assert.throws(() => parseRecipients('{{\n RESPOSTA_LIVRE \n}}', {RESPOSTA_LIVRE: 'a@b.c'}), /não autorizada/);
});

test('legacy salutations and markup preserve first-match and unclosed-block behavior', () => {
  const inputs = ['Prezado(a) Maria, <p>Outro</p>', 'prezada sem vírgula<br>Prezada Ana,', 'prezada sem vírgula\nPrezado João,',
    '<scripture>x</script> texto <STYLE>y</style><!--z-->', '<script>sem fechamento', '<!--->',
    '<!-- <<OCULTO>> <!-->', '<!-- antes <!--> depois -->',
    ...randomInputs(['Prezado', 'prezada(a)', ', ', '\n', '<br', '</P', '<script', '</script>', '<style', '</style>', '<!--', '-->', 'x'])];
  for (const source of inputs) {
    assert.equal(replaceLegacySalutation(source, 'Olá,', false), source.replace(/(Prezad[oa](?:\(a\))?)[^\n]*?,/i, 'Olá,'));
    assert.equal(replaceLegacySalutation(source, 'Olá,', true), source.replace(/(Prezad[oa](?:\(a\))?)(?:(?!<\/p|<br)[\s\S])*?,/i, 'Olá,'));
    assert.equal(stripDocumentScanningBlocks(source), source.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, ''));
  }
});

test('ata removes only the matching legacy date time, preserving city/state and line breaks', () => {
  const old = (source: string) => source.replace(/((?:^|\n)[\p{L} .’'-]+(?:\s*[-–]\s*[A-Z]{2})?[, -]+\d{1,2} de [\p{L}]+ de \d{4})[ \t]+às[ \t]+\d{1,2}:\d{2}(?::\d{2})?/gu, '$1');
  for (const prefix of ['Vitória, ', 'Vitória - ES, ', 'Vitória\n-\nES, ', ' -,', '李, ', 'Porto – RS, ', 'x\nVitória, ', '',
    ...randomInputs(['A', 'E', 'S', 'a', ' ', '-', '–', ',', '.', '\n', '\r', '\t', '’', '𐐀'])]) {
    const source = prefix + '15 de outubro de 2026 às 15:00:01\nVitória, 16 de outubro de 2026 às 12:00';
    assert.equal(removeAtaLocationTime(source), old(source), JSON.stringify(prefix));
  }
});

test('document scanning preserves lazy delimiter pairing and inline markup stripping', () => {
  const pairs: Array<[string, string, RegExp]> = [['<<', '>>', /<<([\s\S]*?)>>/g], ['{{', '}}', /\{\{([\s\S]*?)\}\}/g], ['[[', ']]', /\[\[([\s\S]*?)\]\]/g], ['«', '»', /«([\s\S]*?)»/g]];
  for (const source of ['<<NOME>> {{TITULO}} [[INSTITUIÇÃO]] «DATA»', '<<outer <<inner>> rest>>', '<<>>', '<span>Nome</span>', '<<sem fechamento',
    ...randomInputs(['<<', '>>', '{{', '}}', '[[', ']]', '«', '»', '<p>', '</p>', '<', '>', 'Nome', ' '])]) {
    for (const [opening, closing, pattern] of pairs) assert.deepEqual(Array.from(delimitedTextParts(source, opening, closing)), Array.from(source.matchAll(pattern), match => match[1]));
    assert.equal(stripInlineMarkup(source), source.replace(/<[^>]*>/g, ''));
  }
});

test('Google Docs variable delimiters retain accepted names and reject malformed keys', () => {
  for (const key of ['NOME', '<< NOME >>', '{{ NOME }}', '[[ NOME ]]', '« NOME »', '-NOME-', '<< {{ NOME }} >>', '<< NOME']) {
    const requests = buildGoogleDocsReplacementRequests({[key]: '李 & Maria'});
    assert.ok(requests.length > 0);
    assert.ok(requests.every(request => request.replaceAllText.replaceText === '李 & Maria'));
  }
  assert.throws(() => buildGoogleDocsReplacementRequests({'NOME << RESTO': 'valor'}), /inválida/);
});

test('adversarial inputs finish through public boundaries within a process deadline', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    import {isEmailAddress} from './src/utils/emailAddress.ts';
    import {delimitedTextParts, replaceLegacySalutation, removeAtaLocationTime, stripDocumentScanningBlocks, stripInlineMarkup} from './src/utils/legacyTextProcessing.ts';
    import {studioMarkerPatterns} from './src/utils/templateMarkerPattern.ts';
    import {mergeWorkflowVariables, parseRecipients} from './server/workflow/runtime.ts';
    import {buildGoogleDocsReplacementRequests} from './server/integrations/googleDocsRenderer.ts';
    const spaces = ' '.repeat(250000);
    assert.equal(isEmailAddress('!@!.' + '!.'.repeat(125000) + '@'), false);
    assert.deepEqual(parseRecipients('!@!.' + '!.'.repeat(125000) + '@', {}), []);
    for (const [opening, closing] of [['{{','}}'], ['<<','>>'], ['[[',']]'], ['«','»']]) {
      for (const bad of [opening + 'z' + spaces, opening + spaces + 'x', opening + spaces]) {
        assert.equal(mergeWorkflowVariables(bad, {}), bad);
        for (const pattern of studioMarkerPatterns()) Array.from(bad.matchAll(pattern));
      }
      assert.equal(mergeWorkflowVariables(opening + spaces + closing, {}), '');
    }
    const salutation = 'prezada(a)'.repeat(25000);
    assert.equal(replaceLegacySalutation(salutation, 'Olá,', true), salutation);
    const scripts = '<script'.repeat(25000);
    assert.equal(stripDocumentScanningBlocks(scripts), scripts);
    for (const [opening, closing] of [['<<','>>'], ['{{','}}'], ['[[',']]'], ['«','»']]) {
      const unclosed = opening.repeat(125000);
      assert.deepEqual(Array.from(delimitedTextParts(unclosed, opening, closing)), []);
    }
    assert.equal(stripInlineMarkup('<'.repeat(250000)), '<'.repeat(250000));
    assert.equal(removeAtaLocationTime(spaces), spaces);
    assert.equal(removeAtaLocationTime('Vitória' + spaces + '-ES, 15 de outubro de 2026 às 15:00'), 'Vitória' + spaces + '-ES, 15 de outubro de 2026');
    assert.throws(() => buildGoogleDocsReplacementRequests({['a' + spaces + 'x']: 'valor'}), /inválida/);
  `], {cwd: process.cwd(), encoding: 'utf8', timeout: 8000});
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});
