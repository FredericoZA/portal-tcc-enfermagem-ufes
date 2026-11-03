/** Find the first salutation with a comma before its paragraph boundary.
 * A failed candidate does not rescan the remainder for every "Prezado".
 */
export function replaceLegacySalutation(source: string, replacement: string, html: boolean): string {
  const tokens = html ? /Prezad[oa](?:\(a\))?|,|<\/p|<br/gi : /Prezad[oa](?:\(a\))?|,|\n/gi;
  let start = -1;
  for (const match of source.matchAll(tokens)) {
    if (/^prezad/i.test(match[0])) {
      if (start < 0) start = match.index;
    } else if (match[0] === ',') {
      if (start >= 0) return source.slice(0, start) + replacement + source.slice(match.index + 1);
    } else start = -1;
  }
  return source;
}

function removeClosedBlocks(source: string, openings: RegExp, closings: RegExp): string {
  const pieces: string[] = [];
  let copiedUntil = 0, opening: RegExpExecArray | null;
  while ((opening = openings.exec(source)) !== null) {
    // An inner opening can overlap the first closing (for example <!-->).
    // Search closings independently, starting after the outer opening only.
    closings.lastIndex = opening.index + opening[0].length;
    const closing = closings.exec(source);
    if (!closing) break;
    pieces.push(source.slice(copiedUntil, opening.index));
    copiedUntil = closing.index + closing[0].length;
    openings.lastIndex = copiedUntil;
  }
  pieces.push(source.slice(copiedUntil));
  return pieces.join('');
}

/** Preserve the historical script -> style -> comment removal order. */
export function stripDocumentScanningBlocks(source: string): string {
  return removeClosedBlocks(removeClosedBlocks(removeClosedBlocks(source,
    /<script/gi, /<\/script>/gi), /<style/gi, /<\/style>/gi), /<!--/g, /-->/g);
}

/** Each opening is paired with the first closing after it, without retrying
 * nested openings when a closing is absent. This matches the legacy lazy scan.
 */
export function* delimitedTextParts(source: string, opening: string, closing: string): Generator<string> {
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(opening, cursor);
    if (start < 0) return;
    const end = source.indexOf(closing, start + opening.length);
    if (end < 0) return;
    yield source.slice(start + opening.length, end);
    cursor = end + closing.length;
  }
}

export function stripInlineMarkup(source: string): string {
  return removeClosedBlocks(source, /</g, />/g);
}

/** Remove only a time attached to the legacy city/state/date line of an ata.
 * The prefix is the finite-state language C+ (W* DASH W* U U)? D+.
 * Tracking its states avoids ambiguous overlaps between spaces and hyphens.
 */
export function removeAtaLocationTime(source: string): string {
  const CITY = 1, BEFORE_DASH = 2, AFTER_DASH = 4, STATE_FIRST = 8, STATE_DONE = 16, DELIMITER = 32;
  let states = 0, canStart = true, scanned = 0, copiedUntil = 0;
  const pieces: string[] = [];
  const advance = (until: number) => {
    while (scanned < until) {
      const character = String.fromCodePoint(source.codePointAt(scanned)!);
      const city = /^[\p{L} .’'-]$/u.test(character), whitespace = /\s/.test(character);
      const dash = character === '-' || character === '–', upper = /^[A-Z]$/.test(character);
      const delimiter = character === ',' || character === ' ' || character === '-';
      let next = canStart && city ? CITY : 0;
      if (states & CITY) {
        if (city) next |= CITY;
        if (whitespace) next |= BEFORE_DASH;
        if (dash) next |= AFTER_DASH;
        if (delimiter) next |= DELIMITER;
      }
      if (states & BEFORE_DASH) {
        if (whitespace) next |= BEFORE_DASH;
        if (dash) next |= AFTER_DASH;
      }
      if (states & AFTER_DASH) {
        if (whitespace) next |= AFTER_DASH;
        if (upper) next |= STATE_FIRST;
      }
      if ((states & STATE_FIRST) && upper) next |= STATE_DONE;
      if ((states & (STATE_DONE | DELIMITER)) && delimiter) next |= DELIMITER;
      states = next;
      canStart = character === '\n';
      scanned += character.length;
    }
  };
  const dates = /(\d{1,2} de [\p{L}]+ de \d{4})[ \t]+às[ \t]+\d{1,2}:\d{2}(?::\d{2})?/gu;
  for (const match of source.matchAll(dates)) {
    advance(match.index);
    if (!(states & DELIMITER)) continue;
    pieces.push(source.slice(copiedUntil, match.index + match[1].length));
    copiedUntil = match.index + match[0].length;
    scanned = copiedUntil;
    states = 0;
    canStart = false;
  }
  pieces.push(source.slice(copiedUntil));
  return pieces.join('');
}
