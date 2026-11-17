import { createRsbuild } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export async function startFrontendFixture(directory) {
  const builder = await createRsbuild({
    cwd: directory,
    config: {
      plugins: [pluginReact()],
      source: { entry: { index: './fixture.tsx' } },
      html: { template: './index.html' },
      server: { host: '127.0.0.1', port: 0, publicDir: false, printUrls: false },
      dev: { hmr: false, liveReload: false, lazyCompilation: false },
    },
  });
  const { urls, server } = await builder.startDevServer();
  return { url: urls[0], close: () => server.close() };
}
