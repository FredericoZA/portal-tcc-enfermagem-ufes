const TRANSIENT_AUTH_STATUS = new Set([502, 503, 504]);
const RETRY_DELAY_MS = 450;

let installed = false;

function isLoginCodeRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (typeof window === 'undefined') return false;
  const rawUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
  const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (method !== 'POST') return false;
  try {
    const url = new URL(rawUrl, window.location.origin);
    return url.origin === window.location.origin && url.pathname === '/api/auth/request-code';
  } catch {
    return false;
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export function installAuthRequestResilience(): void {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!isLoginCodeRequest(input, init)) return nativeFetch(input, init);

    try {
      const first = await nativeFetch(input, init);
      if (!TRANSIENT_AUTH_STATUS.has(first.status)) return first;
    } catch {
      // Falhas de rede transitórias recebem exatamente uma segunda tentativa.
    }

    await wait(RETRY_DELAY_MS);
    return nativeFetch(input, init);
  };
}
