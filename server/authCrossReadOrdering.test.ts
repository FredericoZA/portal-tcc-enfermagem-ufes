import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {ApiRequestError} from '../src/services/apiClient';
const source=readFileSync('src/context/AuthContext.tsx','utf8');
const compile=(text:string)=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const body=(begin:string,end:string)=>{const start=source.indexOf(begin);const finish=source.indexOf(end,start);assert.ok(start>0&&finish>start);return source.slice(start,finish);};
const live=body('    let active=true;\n    let updateSequence=0;','  },[isAuthenticated]);');
const touch=body('    let lastTouchAt = 0;','    const activityEvents:');
const refresh=body('  const refreshAuth=async()=>{','\n  useEffect(() => {\n    void refreshAuth();');
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
function fixture(){
 const requests:Array<{resolve:(value:unknown)=>void;reject:(error:unknown)=>void}>=[];
 const applied:unknown[]=[],settings:unknown[]=[],loading:boolean[]=[];let clears=0,listener!:()=>void;
 const read=()=>new Promise((resolve,reject)=>requests.push({resolve,reject}));
 const context:any={identityRevision:{current:1},identityReadSequence:{current:0},isAuthenticated:true,SESSION_ACTIVITY_TOUCH_INTERVAL_MS:60000,Date,ApiRequestError,console,apiClient:{getMe:read,getSettings:async()=>({footer:'current'})},getIdentityWithRetry:read,getPublicSettingsWithRetry:async()=>({footer:'current'}),applyIdentity:(value:unknown)=>applied.push(value),applyPublicSettings:(value:unknown)=>settings.push(value),clearIdentity:()=>{clears++;},readCachedIdentity:()=>({userEmail:'old',memberships:['old']}),setIsLoading:(value:boolean)=>loading.push(value),setUserEmailState:()=>{throw Error('obsolete cache restored');},setIsAuthenticated:()=>{},setCanRegisterProcess:()=>{},setGlobalRoles:()=>{},setMemberships:()=>{},syncPortalFavicon:()=>{},loadSiteLayoutConfig:()=>({}),PORTAL_LIVE_UPDATE_EVENT:'changed',window:{addEventListener:(_event:string,fn:()=>void)=>{listener=fn;},removeEventListener:()=>{}}};
 runInNewContext(compile(`(function(){${live}})()`),context);
 const startTouch=runInNewContext(compile(`(function(){${touch};return touchSession;})()`),context);
 const startRefresh=runInNewContext(compile(`(function(){${refresh};return refreshAuth;})()`),context);
 return {live:()=>listener(),touch:startTouch,refresh:startRefresh,requests,applied,settings,loading,clears:()=>clears};
}
for(const [older,newer] of [['touch','live'],['live','touch'],['refresh','live'],['refresh','touch'],['touch','refresh'],['live','refresh']] as const)test(`${older} result cannot replace newer ${newer} identity`,async()=>{
 const f=fixture();const olderPending=f[older]();const newerPending=f[newer]();
 assert.equal(f.requests.length,2);f.requests[1].resolve({memberships:['current']});await flush();f.requests[0].resolve({memberships:['old']});await Promise.all([olderPending,newerPending]);await flush();
 assert.deepEqual(f.applied,[{memberships:['current']}]);
 if(older==='refresh'||newer==='refresh'){assert.deepEqual(f.loading,[true,false]);assert.ok(f.settings.length>=1,'identity ordering does not suppress public settings');}
});
test('obsolete touch 401 cannot clear newer live identity',async()=>{
 const f=fixture();f.touch();f.live();f.requests[1].resolve({memberships:['current']});await flush();f.requests[0].reject(new ApiRequestError('old denial',401));await flush();assert.equal(f.clears(),0);assert.equal(f.applied.length,1);
});
test('obsolete failed refresh cannot restore cached identity over newer live result',async()=>{
 const f=fixture();const pending=f.refresh();f.live();f.requests[1].resolve({memberships:['current']});await flush();f.requests[0].reject(new ApiRequestError('old failure',503));await pending;assert.equal(f.clears(),0);assert.equal(f.applied.length,1);assert.deepEqual(f.loading,[true,false]);
});
