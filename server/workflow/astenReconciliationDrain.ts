import type {AstenWebhookEvent} from '../../src/types/automation';

export interface AstenReconciliationDrainResult {
  checked:number;
  confirmed:number;
  pending:number;
  deferred:number;
  failed:number;
  stopped:'empty'|'limit'|'time_budget'|'persistence';
}

/** The inbox can still contain an ACK whose runtime commit already succeeded. */
export function isPendingAstenCallback(event:AstenWebhookEvent):boolean {
  return !event.duplicate&&!event.processedAt&&!event.safePayload?.processedAt;
}

/**
 * Bound the number of provider calls and stop between complete durable operations.
 * A failed claim/commit ends this invocation: another instance may own the revision.
 */
export async function drainAstenReconciliation(options:{
  events:()=>readonly AstenWebhookEvent[];
  eligible:(event:AstenWebhookEvent,now:number)=>boolean;
  claim:(event:AstenWebhookEvent)=>Promise<void>;
  reconcile:(event:AstenWebhookEvent)=>Promise<'confirmed'|'failed'|'stop'>;
  limit:number;
  timeBudgetMs:number;
  now?:()=>number;
}):Promise<AstenReconciliationDrainResult> {
  const now=options.now||Date.now;
  const startedAt=now();
  const limit=Number.isFinite(options.limit)?Math.min(100,Math.max(1,Math.floor(options.limit))):1;
  const budget=Number.isFinite(options.timeBudgetMs)?Math.min(180_000,Math.max(0,options.timeBudgetMs)):0;
  const attempted=new Set<string>();
  const result:AstenReconciliationDrainResult={checked:0,confirmed:0,pending:0,deferred:0,failed:0,stopped:'empty'};
  while(result.checked<limit){
    const at=now();
    const event=options.events()
      .filter(item=>isPendingAstenCallback(item)&&!attempted.has(item.fingerprint)&&options.eligible(item,at))
      .slice()
      .sort((a,b)=>a.receivedAt.localeCompare(b.receivedAt)||a.fingerprint.localeCompare(b.fingerprint))[0];
    if(!event)break;
    if(at-startedAt>=budget){result.stopped='time_budget';break;}
    attempted.add(event.fingerprint);
    try{await options.claim(event);}catch{result.failed++;result.stopped='persistence';break;}
    const outcome=await options.reconcile(event);
    result.checked++;
    if(outcome==='confirmed')result.confirmed++;
    else result.failed++;
    if(outcome==='stop'){result.stopped='persistence';break;}
    if(result.checked===limit)result.stopped='limit';
  }
  const at=now();
  const pending=new Map(options.events().filter(isPendingAstenCallback).map(event=>[event.fingerprint,event]));
  result.pending=pending.size;
  result.deferred=[...pending.values()].filter(event=>!options.eligible(event,at)).length;
  return result;
}
