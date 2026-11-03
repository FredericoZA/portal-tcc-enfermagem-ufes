import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
test('COLENF logo preserves the original colored artwork and removes only the outer square',async()=>{
 const original=await sharp('server/documents/assets/colenf-original.png').extract({left:30,top:14,width:377,height:377}).ensureAlpha().raw().toBuffer();
 const output=await sharp('public/colenf-logo.png').ensureAlpha().raw().toBuffer();
 const center=(188*377+188)*4;assert.deepEqual(output.subarray(center,center+4),original.subarray(center,center+4));
 for(const [x,y]of [[0,0],[376,0],[0,376],[376,376]])assert.equal(output[(y*377+x)*4+3],0);
 const pixel=(x:number,y:number)=>output.subarray((y*377+x)*4,(y*377+x)*4+3);
 assert.notDeepEqual(pixel(80,180),pixel(290,180));
 assert.deepEqual(await readFile('public/colenf-logo.png'),await readFile('server/documents/assets/colenf-logo.png'));
});
