const TRANSIENT_AUTH_STATUS = new Set([502, 503, 504]);
const RETRY_DELAY_MS = 450;

let installed = false;

function requestDetails(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof window === 'undefined') return null;
  const rawUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.href
      : input.url;
  const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  try {
    return { url: new URL(rawUrl, window.location.origin), method };
  } catch {
    return null;
  }
}

function isLoginCodeRequest(input: RequestInfo | URL, init?: RequestInit): boolean {
  const details = requestDetails(input, init);
  return Boolean(
    details &&
    details.method === 'POST' &&
    details.url.origin === window.location.origin &&
    details.url.pathname === '/api/auth/request-code'
  );
}

function publicProcessProtocol(input: RequestInfo | URL, init?: RequestInit): string | null {
  const details = requestDetails(input, init);
  if (!details || details.method !== 'GET' || details.url.origin !== window.location.origin) return null;
  const match = details.url.pathname.match(/^\/api\/processes\/([^/]+)$/);
  if (!match) return null;
  const identifier = decodeURIComponent(match[1]);
  return /^TCC[-/]/i.test(identifier) ? identifier : null;
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

async function resolvePublicProcessByProtocol(
  nativeFetch: typeof window.fetch,
  protocol: string,
): Promise<Response | null> {
  try {
    const response = await nativeFetch('/api/processes', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!Array.isArray(payload)) return null;
    const normalized = protocol.trim().toLocaleLowerCase('pt-BR');
    const match = payload.find((item) => {
      const id = String(item?.id || '').trim().toLocaleLowerCase('pt-BR');
      const protocolo = String(item?.protocolo || '').trim().toLocaleLowerCase('pt-BR');
      return id === normalized || protocolo === normalized;
    });
    if (!match) return null;
    return new Response(JSON.stringify(match), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return null;
  }
}

export function installAuthRequestResilience(): void {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const protocol = publicProcessProtocol(input, init);
    if (protocol) {
      const publicProjection = await resolvePublicProcessByProtocol(nativeFetch, protocol);
      if (publicProjection) return publicProjection;
      return nativeFetch(input, init);
    }

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
