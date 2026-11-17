/// <reference types="@rsbuild/core/types" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string;
  readonly VITE_GIT_COMMIT: string;
  readonly VITE_PORTAL_LOCAL_DEMO_AUTH: 'true' | 'false';
}

declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
  const url: string;
  export default url;
}
