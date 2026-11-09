import test from 'node:test';
import assert from 'node:assert/strict';
import {getIdentityWithRetry} from '../src/context/AuthContext';
import {apiClient,ApiRequestError} from '../src/services/apiClient';
const identity={userEmail:'fixture@example.invalid',globalRoles:[],memberships:[],isAuthenticated:true,canRegisterProcess:true};
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

test('identity lookup waits the actual Retry-After before contacting a busy server again',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let calls=0;
 t.mock.method(apiClient,'getMe',async()=>{if(++calls===1)throw new ApiRequestError('O Portal está ocupado.',503,'RUNTIME_BUSY',undefined,5);return identity;});
 const pending=getIdentityWithRetry();await flush();
 t.mock.timers.tick(4999);await flush();assert.equal(calls,1);
 t.mock.timers.tick(1);assert.deepEqual(await pending,identity);assert.equal(calls,2);
});

test('invalid authentication does not retry; rate limits keep a bounded number of attempts',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let calls=0;
 const denied=new ApiRequestError('Acesso não autorizado.',403);
 t.mock.method(apiClient,'getMe',async()=>{calls++;throw denied;});
 await assert.rejects(getIdentityWithRetry(),error=>error===denied);assert.equal(calls,1);
 const limited=new ApiRequestError('Aguarde.',429,'RATE_LIMIT',undefined,5);
 t.mock.method(apiClient,'getMe',async()=>{calls++;throw limited;});
 const pending=assert.rejects(getIdentityWithRetry(),error=>error===limited);await flush();
 t.mock.timers.tick(5000);await flush();t.mock.timers.tick(5000);await pending;
 assert.equal(calls,4,'one denied lookup plus at most three rate-limited attempts');
});

test('a requested wait longer than thirty seconds is not ignored by an automatic retry',async t=>{
 let calls=0;
 const limited=new ApiRequestError('Aguarde.',429,'RATE_LIMIT',undefined,60);
 t.mock.method(apiClient,'getMe',async()=>{calls++;throw limited;});
 await assert.rejects(getIdentityWithRetry(),error=>error===limited);assert.equal(calls,1);
});
