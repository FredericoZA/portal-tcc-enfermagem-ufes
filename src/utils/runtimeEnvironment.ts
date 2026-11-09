export function isLocalDemoFrontend(): boolean {
  const env=(import.meta as any).env || {};
  return env.VITE_PORTAL_LOCAL_DEMO_AUTH === 'true';
}
