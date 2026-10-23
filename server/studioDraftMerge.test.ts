import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeStudioDraft} from '../src/utils/studioDraftMerge';
import {applyStudioImage} from './studioImages';
import {normalizeStudioSettings} from '../src/services/integrationStudioService';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
test('image patch merges unrelated revisions but refuses a concurrent change to the same image',()=>{
 const studio=normalizeStudioSettings({revision:4,emailTemplates:[{id:'a'}],emailDesigns:{a:{templateId:'a',logoUrl:'old'}}} as any) as any;
 const input={kind:'email',templateId:'a',field:'logoUrl',value:png,expectedRevision:2,expectedImageValue:'old'};
 const result=applyStudioImage(studio,input,'master@example.org');
 assert.equal(result.revision,5);assert.equal(result.emailDesigns.a.logoUrl,png);
 assert.deepEqual(result.emailTemplates,studio.emailTemplates);
 assert.throws(()=>applyStudioImage({...studio,emailDesigns:{a:{logoUrl:'concurrent'}}},input,'master@example.org'),/STUDIO_REVISION_CONFLICT/);
 assert.throws(()=>applyStudioImage(studio,{...input,expectedRevision:99},'master@example.org'),/STUDIO_REVISION_CONFLICT/);
});
test('three-way rebase preserves local text, remote image and unrelated remote settings',()=>{
 const base={revision:1,emailDesigns:{a:{logoUrl:'old',headerText:'base'}},brandKit:{color:'green'}};
 const local=structuredClone(base);local.emailDesigns.a.headerText='my draft';
 const remote=structuredClone(base);remote.revision=3;remote.emailDesigns.a.logoUrl='new';remote.brandKit.color='navy';
 const merged=mergeStudioDraft(base,local,remote);
 assert.equal(merged.emailDesigns.a.headerText,'my draft');assert.equal(merged.emailDesigns.a.logoUrl,'new');assert.equal(merged.brandKit.color,'navy');assert.equal(merged.revision,3);
 remote.emailDesigns.a.headerText='other draft';assert.throws(()=>mergeStudioDraft(base,local,remote),/emailDesigns.a.headerText/);
 assert.equal(local.emailDesigns.a.headerText,'my draft');
});
