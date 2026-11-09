/** Local mirrors are optional; a browser quota or privacy policy cannot stop the settings screen. */
export function readSettingsLocalMirror(key: string): string | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key); }
  catch { return null; }
}

/** Return false rather than pretending a local recovery copy was persisted. Never remove prior content. */
export function writeSettingsLocalMirror(key: string, value: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem(key) !== value) localStorage.setItem(key, value);
    return true;
  } catch { return false; }
}
