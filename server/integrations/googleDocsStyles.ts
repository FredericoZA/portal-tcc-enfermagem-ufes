/** Locate markers in paragraph text, including markers split across styled runs.
 * Style the marker before replacement so Docs retains its character formatting.
 */
export function buildMarkerBoldRequests(document: any, markers: string[]): any[] {
  const requests: any[] = [];
  const walk = (node: any, scope: { tabId?: string; segmentId?: string } = {}) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(item => walk(item, scope)); return; }
    const current = node.tabProperties?.tabId ? { ...scope, tabId: node.tabProperties.tabId } : scope;
    if (node.paragraph?.elements) {
      const runs = node.paragraph.elements.filter((e: any) => typeof e.textRun?.content === 'string');
      const text = runs.map((e: any) => e.textRun.content).join('');
      const positions: number[] = runs.flatMap((e: any) => Array.from({ length: e.textRun.content.length }, (_, i) => e.startIndex + i));
      for (const marker of markers) {
        const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`<<${escaped}>>|\\{\\{${escaped}\\}\\}|\\[\\[${escaped}\\]\\]|«${escaped}»|-${escaped}-`, 'gi');
        for (const match of text.matchAll(regex)) {
          const start = match.index!, end = start + match[0].length;
          if (positions[start] === undefined || positions[end - 1] === undefined) continue;
          requests.push({ updateTextStyle: { range: { ...current, startIndex: positions[start], endIndex: positions[end - 1] + 1 }, textStyle: { bold: true }, fields: 'bold' } });
        }
      }
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'headers' || key === 'footers') for (const [segmentId, content] of Object.entries(value || {})) walk(content, { ...current, segmentId });
      else if (!['paragraph', 'textRun'].includes(key)) walk(value, current);
    }
  };
  walk(document);
  return requests;
}
