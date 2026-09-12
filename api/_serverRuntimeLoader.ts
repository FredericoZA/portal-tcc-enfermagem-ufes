export async function loadPortalServerRuntime(): Promise<{ createPortalApp: () => Promise<unknown> }> {
  const runtime = await import('../dist/server/server.cjs');
  if (typeof runtime.createPortalApp !== 'function') {
    throw Object.assign(new Error('O bundle de produção não exportou createPortalApp.'), { code: 'PORTAL_SERVER_EXPORT_MISSING' });
  }
  return runtime as { createPortalApp: () => Promise<unknown> };
}
