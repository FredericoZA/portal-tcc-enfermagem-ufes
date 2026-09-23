import { useEffect } from 'react';

const TABLE_EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{FE0F}]/gu;

const stripTableEmoji = (value: string) => {
  const withoutEmoji = value.replace(TABLE_EMOJI_PATTERN, '');
  if (withoutEmoji === value) return value;
  return withoutEmoji.replace(/[ \t]{2,}/g, ' ');
};

const sanitizeTable = (table: HTMLTableElement) => {
  const walker = document.createTreeWalker(table, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }

  for (const node of textNodes) {
    const original = node.nodeValue || '';
    const cleaned = stripTableEmoji(original);
    if (cleaned !== original) node.nodeValue = cleaned;
  }
};

const sanitizeAllTables = () => {
  document.querySelectorAll<HTMLTableElement>('#portal-app-root table').forEach(sanitizeTable);
};

/**
 * Política transversal das planilhas do Portal.
 *
 * Os componentes históricos ainda aceitam prefixos Unicode configuráveis por coluna.
 * Esta política central garante que nenhuma tabela pública ou restrita volte a exibir
 * emojis no texto, inclusive quando uma configuração antiga estiver persistida no
 * navegador. Ícones vetoriais da interface não são afetados.
 */
export const PortalTableTextPolicy = () => {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        sanitizeAllTables();
      });
    };

    sanitizeAllTables();

    const root = document.getElementById('portal-app-root') || document.body;
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
};
