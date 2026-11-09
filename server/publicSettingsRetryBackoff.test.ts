import test from 'node:test';
import assert from 'node:assert/strict';
import {getPublicSettingsWithRetry} from '../src/context/AuthContext';
import {apiClient,ApiRequestError} from '../src/services/apiClient';
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const settings={footerText:'fixture public settings'} as any;
for(const status of [0,429,502,503,504])test(`public settings recovers once from ${status}, honoring bounded Retry-After`,async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0;
 t.mock.method(apiClient,'getSettings',async()=>{if(++calls===1)throw new ApiRequestError('temporary',status,'STARTUP_UNAVAILABLE',undefined,2);return settings;});
 const pending=getPublicSettingsWithRetry();await flush();
 t.mock.timers.tick(1999);await flush();assert.equal(calls,1);
 t.mock.timers.tick(1);assert.deepEqual(await pending,settings);assert.equal(calls,2);
});
test('public settings recovery is bounded to one retry and default wait',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0;const error=new ApiRequestError('temporary',503);
 t.mock.method(apiClient,'getSettings',async()=>{calls++;throw error;});
 const pending=assert.rejects(getPublicSettingsWithRetry(),err=>err===error);await flush();
 t.mock.timers.tick(499);await flush();assert.equal(calls,1);
 t.mock.timers.tick(1);await pending;assert.equal(calls,2);
});
for(const error of [new ApiRequestError('denied',403),new ApiRequestError('missing',404),new ApiRequestError('invalid',400),new SyntaxError('invalid JSON'),new ApiRequestError('cancelled',0,'REQUEST_CANCELED'),new ApiRequestError('busy already recovered',503,'RUNTIME_BUSY',undefined,1),new ApiRequestError('long wait',429,undefined,undefined,31)])test(`public settings does not repeat permanent, malformed, cancelled or already recovered error: ${error.message}`,async t=>{
 let calls=0;t.mock.method(apiClient,'getSettings',async()=>{calls++;throw error;});
 await assert.rejects(getPublicSettingsWithRetry(),err=>err===error);assert.equal(calls,1);
});
test('identity revision invalidation during wait prevents an obsolete settings retry',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0,current=true;
 const error=new ApiRequestError('temporary',503);
 t.mock.method(apiClient,'getSettings',async()=>{calls++;throw error;});
 const pending=assert.rejects(getPublicSettingsWithRetry(()=>current),err=>err===error);await flush();
 current=false;t.mock.timers.tick(500);await pending;assert.equal(calls,1);
});
