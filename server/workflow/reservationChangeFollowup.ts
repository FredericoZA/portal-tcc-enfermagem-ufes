/** Keep the same authorized workflow alive after acknowledging its durable save.
 * The runtime lease is retained until all writes and provider calls settle. */
export function afterReservationChangeResponse(
 request:object,
 response:{once:(event:string,listener:()=>void)=>unknown;writableFinished?:boolean;destroyed?:boolean},
 run:()=>Promise<void>,
 ports:{retain:(request:object)=>()=>void;waitUntil?:(task:Promise<void>)=>void;onError:(error:unknown)=>void},
):Promise<void>{
 const settle=ports.retain(request);
 const delivered=new Promise<void>(resolve=>{
  if(response.writableFinished||response.destroyed){resolve();return;}
  response.once('finish',resolve);response.once('close',resolve);
 });
 const task=delivered.then(run).catch(ports.onError).finally(settle);
 ports.waitUntil?.(task);
 return task;
}
