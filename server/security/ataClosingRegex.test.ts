import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {DEMO_PROCESSES} from '../../src/services/demoSeed';
import {adaptDocumentLanguage} from '../../src/utils/documentLanguage';

const closing = 'Nada mais havendo a tratar, às quinze horas foi encerrada a sessão e lavrada a presente ata que segue para ser assinada.';
const prefix = 'Nada mais havendo a tratar,';
const body = 'foi encerrada a sessão e lavrada a presente ata';
const processFixture = () => {
  const process = structuredClone(DEMO_PROCESSES[0]);
  process.defesa.startAt = '2026-10-15T14:00:00-03:00';
  process.coorientador = null;
  return process;
};

/** The old expression is a bounded compatibility oracle, never a long-input path. */
function legacyReplacement(source: string): string {
  if (source.length > 1000) throw new Error('Compatibility oracle accepts at most 1000 characters.');
  return source.replace(/Nada mais havendo a tratar,\s*(?:às [^,]+?\s+)?foi encerrada a sessão e lavrada a presente ata,?\s*que (?:será assinada(?: por quem de direito)?|segue para ser assinada)\.?/gi, closing);
}

test('ata closing preserves optional time grammar, casing, punctuation and global replacement', () => {
  const process = processFixture();
  const inputs = [
    prefix + ' ' + body + ' que será assinada por quem de direito.',
    prefix + 'às  ' + body + 'que segue para ser assinada',
    prefix + 'às ' + body + 'que segue para ser assinada',
    prefix + 'às quinze horas ' + body + ' que segue para ser assinada.',
    prefix + 'às ' + body + ' incompleta ' + body + ' que será assinada.',
    prefix + 'às quinze, ' + body + ' que será assinada.',
    prefix + 'às\tquinze horas ' + body + ' que será assinada.',
    prefix + 'às \u00a0\ufeff ' + body + 'que será assinadaXYZ',
    prefix + 'às +' + ' '.repeat(80),
    prefix + 'às +' + ' '.repeat(80) + body + ' que será assinada.',
    'Texto antes. ' + prefix + ' ' + body + ' que será assinada. Texto depois.',
    [prefix + ' ' + body + ' que será assinada.', prefix + 'às seis horas ' + body + ' que segue para ser assinada'].join('\n'),
    prefix + 'às primeiro ' + prefix + ' ' + body + ' que será assinada.'
  ];
  for (const whitespace of ['', ' ', '\t', '\n', '\r\n', '\u00a0']) {
    for (const time of ['', 'às  ', 'às   ', 'às \t\n ', 'às + ', 'às quinze horas ', 'às , ']) {
      for (const tail of ['que será assinada', 'que será assinadaXYZ', 'que será assinada por quem de direito.', 'que segue para ser assinada.', 'que será assinada por quem de direito adicional', 'que será assinada.', 'que incompleta']) {
        inputs.push(prefix + whitespace + time + body + whitespace + tail);
        inputs.push(prefix + whitespace + time + body + ',' + whitespace + tail);
      }
    }
  }
  for (const input of inputs) {
    for (const source of [input, input.toUpperCase(), input.toLowerCase()]) {
      assert.equal(adaptDocumentLanguage(source, process, 'ATA'), legacyReplacement(source), JSON.stringify(source));
    }
  }
  assert.equal(adaptDocumentLanguage(prefix + ' ' + body + ' que será assinada por quem de direito.', process, 'ATA'), closing);
  assert.equal(adaptDocumentLanguage(closing, process, 'ATA'), closing);
  const otherDocument = prefix + ' ' + body + ' que será assinada por quem de direito.';
  assert.equal(adaptDocumentLanguage(otherDocument, process, 'CONVITE'), otherDocument);
});

test('ata closing handles long malformed and valid time text within a process deadline', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    import {DEMO_PROCESSES} from './src/services/demoSeed.ts';
    import {adaptDocumentLanguage} from './src/utils/documentLanguage.ts';
    const process = structuredClone(DEMO_PROCESSES[0]);
    process.defesa.startAt = '2026-10-15T14:00:00-03:00';
    process.coorientador = null;
    const prefix = 'Nada mais havendo a tratar,às +';
    const spaces = ' '.repeat(250000);
    const suffix = 'foi encerrada a sessão e lavrada a presente ata que será assinada por quem de direito.';
    const closing = ${JSON.stringify(closing)};
    for (const time of ['+' + spaces, spaces, ('a' + ' ').repeat(125000)]) {
      const source = 'Nada mais havendo a tratar,às ' + time;
      assert.equal(adaptDocumentLanguage(source, process, 'ATA'), source);
      assert.equal(adaptDocumentLanguage(source + suffix, process, 'ATA'), closing);
    }
    const malformed = prefix + spaces;
    const source = malformed + ',' + ' Texto antes. ' + closing + ' Texto depois.';
    assert.equal(adaptDocumentLanguage(source, process, 'ATA'), source);
  `], {cwd: process.cwd(), encoding: 'utf8', timeout: 8000});
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
});
