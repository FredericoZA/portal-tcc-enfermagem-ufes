import test from 'node:test';
import assert from 'node:assert/strict';
import { getFilterChipProps } from '../src/utils/tableFormatters';
import { getPortalToneStyle } from '../src/utils/portalSemanticTokens';

test('Todos/Todas mantém superfície branca em ambos os estados e não herda preenchimento personalizado', () => {
  for (const key of ['all', 'todos', 'todas']) {
    for (const selected of [true, false]) {
      const chip = getFilterChipProps(key, selected, { filterItemsConfig: {
        [key]: { key, label: key, bgColor: '#123456' },
      } });
      assert.equal(chip.buttonStyle.backgroundColor, 'var(--portal-surface-inner)');
      assert.equal(chip.buttonStyle.borderColor, getPortalToneStyle('neutral').borderColor);
    }
  }
});

test('a seleção por papel e situação conserva sua cor semântica', () => {
  for (const [key, tone] of [['student', 'student'], ['board', 'board'], ['upcoming', 'upcoming'], ['defended', 'defended']] as const) {
    assert.equal(getFilterChipProps(key, true).buttonStyle.backgroundColor, getPortalToneStyle(tone).backgroundColor);
  }
});
