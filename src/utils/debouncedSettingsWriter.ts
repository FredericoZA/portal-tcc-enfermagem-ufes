/** Coalesce edits per contact and serialize PATCH requests across contacts. */
export function createDebouncedSettingsWriter<Key extends string,Value>(persist:(key:Key,value:Value)=>Promise<void>,delay=900){
 const pending=new Map<Key,Value>();const timers=new Map<Key,ReturnType<typeof setTimeout>>();let tail=Promise.resolve();
 const flush=(key:Key)=>{
  const timer=timers.get(key);if(timer)clearTimeout(timer);timers.delete(key);
  if(!pending.has(key))return tail;
  const value=pending.get(key)!;pending.delete(key);
  const result=tail.then(()=>persist(key,value));tail=result.catch(()=>{});return result;
 };
 return {
  schedule(key:Key,value:Value){pending.set(key,value);const timer=timers.get(key);if(timer)clearTimeout(timer);timers.set(key,setTimeout(()=>{void flush(key).catch(()=>{});},delay));},
  flush,
  flushAll(){return Promise.all([...pending.keys()].map(flush));},
 };
}
