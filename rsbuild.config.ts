import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/postcss';
import { pluginReact } from '@rsbuild/plugin-react';
import { defineConfig } from '@rsbuild/core';

const packageVersion = (() => {
  try {
    const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string };
    return String(packageJson.version || '').trim();
  } catch {
    return '';
  }
})();

function localGitCommit(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

export default defineConfig(() => {
  const appVersion = packageVersion || process.env.npm_package_version || '0.0.0';
  const gitCommit = (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.PORTAL_GIT_COMMIT ||
    localGitCommit()
  ).slice(0, 7);
  const enableUpdates = process.env.DISABLE_HMR !== 'true';
  const publicEnvironment = {
    VITE_APP_VERSION: appVersion,
    VITE_GIT_COMMIT: gitCommit,
    VITE_PORTAL_LOCAL_DEMO_AUTH: process.env.VITE_PORTAL_LOCAL_DEMO_AUTH === 'true' ? 'true' : 'false',
  };

  return {
    plugins: [pluginReact()],
    source: {
      entry: { index: './src/main.tsx' },
      define: { 'import.meta.env': JSON.stringify(publicEnvironment) },
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
    },
    html: { template: './index.html' },
    output: {
      // O bundle do servidor fica fora do diretório publicado para proteger o código da API.
      distPath: { root: 'dist/client', js: 'assets', jsAsync: 'assets', css: 'assets', cssAsync: 'assets' },
      filename: { js: '[name]-[contenthash:8].js' },
      sourceMap: { js: false, css: false },
      minify: { jsOptions: { exclude: /pdf\.worker\.min-[a-f0-9]+\.mjs$/ } },
    },
    server: { host: '127.0.0.1' },
    dev: { hmr: enableUpdates, liveReload: enableUpdates, lazyCompilation: false },
    tools: {
      postcss: { postcssOptions: { plugins: [tailwindcss()] } },
      rspack(config, { addRules }) {
        addRules({
          test: /pdf\.worker\.min\.mjs$/,
          resourceQuery: /^\?url$/,
          type: 'asset/resource',
          generator: { filename: 'assets/[name]-[contenthash:8][ext]' },
        });
        if (!enableUpdates) config.watchOptions = { ...config.watchOptions, ignored: /./ };
      },
    },
  };
});
