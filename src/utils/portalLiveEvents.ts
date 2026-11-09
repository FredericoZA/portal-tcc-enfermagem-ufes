/** Contrato de eventos de atualização remota entre módulos independentes. */
export const PORTAL_LIVE_UPDATE_EVENT = 'portal:remote-data-changed';
export const PORTAL_REPOSITORY_CHANGED_EVENT = 'portal:repository-changed';
export const PORTAL_LIVE_POLL_INTERVAL_MS = 30_000;
export const PORTAL_PUBLIC_POLL_INTERVAL_MS = 60_000;
export type PortalLiveUpdate = { revision:string };
