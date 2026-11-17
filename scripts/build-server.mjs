import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const common = {
  absWorkingDir: root,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  packages: 'external',
};

await build({
  ...common,
  entryPoints: ['server.ts'],
  outfile: 'dist/server/server.cjs',
  // A função publicada serve arquivos prontos e não empacota o compilador local.
  define: { __PORTAL_COMPILED_SERVER__: 'true' },
});
await build({
  ...common,
  entryPoints: ['index', 'runtime-asset', 'replication-model', 'public-indicators'].map(
    (name) => path.join('server/vercel', name + '.ts'),
  ),
  outdir: 'dist/server/vercel',
  outExtension: { '.js': '.cjs' },
  // The main app remains a separate, lazy bundle loaded after request admission.
  external: ['../server.cjs'],
});
