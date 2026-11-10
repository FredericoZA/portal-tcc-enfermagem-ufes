import test from 'node:test';
import assert from 'node:assert/strict';
import {apiClient,fetchApiRequest,invalidateIdentityRequests,PORTAL_SESSION_EXPIRED_EVENT} from '../src/services/apiClient';
function setup(t:any){
 invalidateIdentityRequests();const previous=(globalThis as any).window;const events:string[]=[];
 (globalThis as any).window={dispatchEvent:(event:Event)=>{events.push(event.type);return true;}};
 t.after(()=>{if(previous===undefined)delete (globalThis as any).window;else (globalThis as any).window=previous;});return events;
}
const denied=()=>Response.json({code:'AUTHENTICATION_REQUIRED',error:'session expired'},{status:401});
test('401 from the same cookie generation still expires the session even after another successful read',async t=>{
 const events=setup(t);let release!:(response:Response)=>void;
 t.mock.method(globalThis,'fetch',async(url:any)=>String(url).includes('old')?new Promise<Response>(resolve=>{release=resolve;}):Response.json({isAuthenticated:true}));
 const old=assert.rejects(fetchApiRequest('/api/old'),/session expired/);
 await fetchApiRequest('/api/me');release(denied());await old;
 assert.deepEqual(events,[PORTAL_SESSION_EXPIRED_EVENT],'a newer GET does not authorize ignoring a real current-session denial');
});
test('successful OTP renewal prevents previous-cookie denial from expiring the new session',async t=>{
 const events=setup(t);let release!:(response:Response)=>void;
 t.mock.method(globalThis,'fetch',async(url:any)=>String(url).includes('old')?new Promise<Response>(resolve=>{release=resolve;}):String(url).includes('verify-code')?Response.json({verified:true}):denied());
 const old=assert.rejects(fetchApiRequest('/api/old'),/session expired/);
 assert.deepEqual(await apiClient.verifyLoginCode('fixture@example.invalid','fixture-only'),{verified:true});
 release(denied());await old;assert.deepEqual(events,[]);
 await assert.rejects(fetchApiRequest('/api/current'),/session expired/);
 assert.deepEqual(events,[PORTAL_SESSION_EXPIRED_EVENT],'a denial issued after OTP renewal remains effective');
});
test('failed OTP does not invalidate applicable expiry notifications',async t=>{
 const events=setup(t);let release!:(response:Response)=>void;
 t.mock.method(globalThis,'fetch',async(url:any)=>String(url).includes('old')?new Promise<Response>(resolve=>{release=resolve;}):Response.json({error:'invalid OTP'},{status:400}));
 const old=assert.rejects(fetchApiRequest('/api/old'),/session expired/);
 await assert.rejects(apiClient.verifyLoginCode('fixture@example.invalid','fixture-only'),/invalid OTP/);
 release(denied());await old;assert.deepEqual(events,[PORTAL_SESSION_EXPIRED_EVENT]);
});
