import {withPortalOperation} from '../services/portalOperations';
import {downloadApiFileRequest} from '../services/apiClient';
export async function fetchPortalDocument(url: string, signal?: AbortSignal) {
  const target = new URL(url, window.location.origin);
  const endpoint = /^\/api\/(public\/)?processes\/[^/]+\/documents\/[^/]+\/download$/;
  if (target.origin !== window.location.origin || !endpoint.test(target.pathname)) {
    throw new Error('Use o endereço do documento no Portal.');
  }
  return downloadApiFileRequest(target.pathname, {signal});
}

export function savePortalDocument({blob, fileName}: {blob: Blob; fileName: string}) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function downloadPortalDocument(url: string): Promise<void> {
  await withPortalOperation('Preparando o documento para download…', async () => {
    savePortalDocument(await fetchPortalDocument(url));
  });
}
