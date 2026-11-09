/** Contrato de eventos de atualização remota entre módulos independentes. */
export const PORTAL_LIVE_UPDATE_EVENT = 'portal:remote-data-changed';
export const PORTAL_LIVE_POLL_INTERVAL_MS = 30_000;
export const PORTAL_LIVE_IDLE_POLL_MAX_MS = 60_000;
export type PortalLiveUpdate = { revision:string };
