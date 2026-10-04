import { readFileSync } from 'node:fs';

const files = [
  '../src/index.css',
  '../src/styles/portal-tokens.css',
  '../src/styles/portal-layout.css',
  '../src/styles/portal-components.css',
  '../src/styles/portal-sheet.css',
  '../src/styles/portal-pages.css',
  '../src/styles/portal-responsive.css',
] as const;

export function readPortalCss() {
  return files
    .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))
    .join('\n');
}
