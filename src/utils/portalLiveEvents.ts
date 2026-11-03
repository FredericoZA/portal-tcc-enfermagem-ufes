/** Contrato de eventos de atualização remota entre módulos independentes. */
export const PORTAL_LIVE_UPDATE_EVENT = 'portal:remote-data-changed';
export const PORTAL_LIVE_POLL_INTERVAL_MS = 15_000;
export type PortalLiveUpdate = { revision:string };
