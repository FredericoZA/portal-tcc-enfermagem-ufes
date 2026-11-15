/** Bounded, worker-local counters. No identifiers, queries, headers or payloads. */
const counters=new Map<string,{requests:number;bytes:number;errors:number;milliseconds:number}>();
const startedAt=new Date().toISOString();
function category(url:string){
 let path:string;try{path=new URL(url,'https://metrics.invalid').pathname;}catch{return 'other';}
 if(path.endsWith('/portal_runtime_state'))return 'runtime-state';
 if(path.endsWith('/portal_read_runtime_projection_v1'))return 'conditional-read';
 if(path.endsWith('/portal_read_critical_audit_page_v1'))return 'audit-page';
 if(path.includes('/rpc/portal_read_runtime'))return 'runtime-read';
 return 'other';
}
export function measuredSupabaseResponse(url:string,response:Response,milliseconds:number):Response{
 const key=category(url);let row=counters.get(key);
 if(!row){row={requests:0,bytes:0,errors:0,milliseconds:0};counters.set(key,row);}
 row.requests++;row.errors+=response.ok?0:1;row.milliseconds+=Math.max(0,milliseconds);
 if(!response.body)return response;
 const counter=row;
 const stream=response.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){counter.bytes+=chunk.byteLength;controller.enqueue(chunk);}}));
 return new Response(stream,{status:response.status,statusText:response.statusText,headers:response.headers});
}
export function resourceUsageSnapshot(){return{scope:'CURRENT_WORKER',startedAt,measuredAt:new Date().toISOString(),unit:'decoded-response-bytes',operations:Object.fromEntries([...counters].map(([key,row])=>[key,{...row,milliseconds:Math.round(row.milliseconds)}]))};}

/** All counters have a fixed category set and stay in memory; no telemetry writes. */
export async function measuredSupabaseFetch(url:string,init?:RequestInit):Promise<Response>{
 const began=performance.now();
 try{return measuredSupabaseResponse(url,await globalThis.fetch(url,init),performance.now()-began);}
 catch(error){const key=category(url);const row=counters.get(key)||{requests:0,bytes:0,errors:0,milliseconds:0};row.requests++;row.errors++;row.milliseconds+=performance.now()-began;counters.set(key,row);throw error;}
}
