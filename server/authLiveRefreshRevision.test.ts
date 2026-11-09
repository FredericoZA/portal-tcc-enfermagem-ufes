import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const source=readFileSync('src/context/AuthContext.tsx','utf8');
const begin=source.indexOf('    let active=true;\n    let updateSequence=0;');
const end=source.indexOf('  },[isAuthenticated]);',begin);
assert.ok(begin>0&&end>begin);
function fixture(authenticated=true){
 let handler!:()=>void;
 const settings:Array<(value:unknown)=>void>=[],identities:Array<(value:unknown)=>void>=[];
 const appliedSettings:unknown[]=[],appliedIdentities:unknown[]=[];
 const identityRevision={current:1};
 const context={identityRevision,identityReadSequence:{current:0},isAuthenticated:authenticated,apiClient:{getSettings:()=>new Promise(resolve=>settings.push(resolve)),getMe:()=>new Promise(resolve=>identities.push(resolve))},applyPublicSettings:(value:unknown)=>appliedSettings.push(value),applyIdentity:(value:unknown)=>appliedIdentities.push(value),PORTAL_LIVE_UPDATE_EVENT:'changed',window:{addEventListener:(_name:string,fn:()=>void)=>{handler=fn;},removeEventListener:()=>{}}};
 const cleanup=runInNewContext(ts.transpileModule(`(function(){${source.slice(begin,end)}})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {update:()=>handler(),cleanup,identityRevision,settings,identities,appliedSettings,appliedIdentities};
}
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('live identity/settings finishing after session revision changes are discarded before effect cleanup',async()=>{
 const f=fixture();f.update();f.identityRevision.current++;
 f.settings[0]({footer:'old'});f.identities[0]({globalRoles:['MASTER_ADMIN']});await flush();
 assert.deepEqual(f.appliedSettings,[]);assert.deepEqual(f.appliedIdentities,[]);f.cleanup();
});
test('out of order live reads cannot replace a newer confirmed identity or public settings',async()=>{
 const f=fixture();f.update();f.update();
 const currentSettings={footer:'current'},currentIdentity={globalRoles:[]};
 f.settings[1](currentSettings);f.identities[1](currentIdentity);await flush();
 f.settings[0]({footer:'old'});f.identities[0]({globalRoles:['MASTER_ADMIN']});await flush();
 assert.deepEqual(f.appliedSettings,[currentSettings]);assert.deepEqual(f.appliedIdentities,[currentIdentity]);f.cleanup();
});
test('public live update never fetches private identity and disposal ignores all pending results',async()=>{
 const f=fixture(false);f.update();assert.equal(f.identities.length,0);f.cleanup();f.settings[0]({footer:'late'});await flush();assert.deepEqual(f.appliedSettings,[]);
});
