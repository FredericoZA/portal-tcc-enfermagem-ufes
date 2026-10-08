export function isLocalDemoFrontend(): boolean {
  const env=(import.meta as any).env || {};
  return Boolean(env.DEV || env.VITE_PORTAL_LOCAL_DEMO_AUTH === 'true');
}
