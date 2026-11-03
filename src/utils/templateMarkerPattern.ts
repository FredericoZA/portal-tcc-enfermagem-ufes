/** Keep whitespace outside the bounded marker name disjoint from its ends.
 * The whitespace-only branch requires a character permitted inside the name.
 * This preserves legacy blank markers without retrying every whitespace split.
 */
export function workflowMarkerPattern(): RegExp {
  return /\{\{(\s*[^{}\n\s](?:[^{}\n]{0,98}[^{}\n\s])?\s*|(?=\s*[^\S\n])\s+)\}\}|<<(\s*[^<>\n\s](?:[^<>\n]{0,98}[^<>\n\s])?\s*|(?=\s*[^\S\n])\s+)>>|\[\[(\s*[^\[\]\n\s](?:[^\[\]\n]{0,98}[^\[\]\n\s])?\s*|(?=\s*[^\S\n])\s+)\]\]|«(\s*[^«»\n\s](?:[^«»\n]{0,98}[^«»\n\s])?\s*|(?=\s*[^\S\n])\s+)»|-((?:CAMPO_)?[A-Z0-9_]+)-/g;
}

export function studioMarkerPatterns(): RegExp[] {
  return [
    /\{\{(\s*[^{}\r\n\s](?:[^{}\r\n]{0,98}[^{}\r\n\s])?\s*|(?=\s*[^\S\r\n])\s+)\}\}/g,
    /<<(\s*[^<>\r\n\s](?:[^<>\r\n]{0,98}[^<>\r\n\s])?\s*|(?=\s*[^\S\r\n])\s+)>>/g,
    /\[\[(\s*[^\[\]\r\n\s](?:[^\[\]\r\n]{0,98}[^\[\]\r\n\s])?\s*|(?=\s*[^\S\r\n])\s+)\]\]/g,
    /«(\s*[^«»\r\n\s](?:[^«»\r\n]{0,98}[^«»\r\n\s])?\s*|(?=\s*[^\S\r\n])\s+)»/g,
    /-((?:CAMPO_)?[A-Z][A-Z0-9_]{1,80})-/g
  ];
}
