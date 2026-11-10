import {PORTAL_LIVE_UPDATE_EVENT} from './portalLiveEvents';

/** A settled empty queue needs no periodic API call. Revalidate on actual remote changes or visibility. */
export function subscribeDeletionQueueRefresh(pending:boolean,refresh:()=>void,ports:{
 document:Pick<Document,'visibilityState'|'addEventListener'|'removeEventListener'>;
 window:Pick<Window,'addEventListener'|'removeEventListener'|'setInterval'|'clearInterval'>;
}):()=>void{
 const update=()=>{if(ports.document.visibilityState==='visible')refresh();};
 const timer=pending?ports.window.setInterval(update,60_000):undefined;
 ports.document.addEventListener('visibilitychange',update);
 ports.window.addEventListener(PORTAL_LIVE_UPDATE_EVENT,update);
 return()=>{if(timer!==undefined)ports.window.clearInterval(timer);ports.document.removeEventListener('visibilitychange',update);ports.window.removeEventListener(PORTAL_LIVE_UPDATE_EVENT,update);};
}
