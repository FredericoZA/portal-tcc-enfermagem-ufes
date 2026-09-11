import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import png from 'pngjs';
import { comparePngFiles } from '../scripts/compare-visual.mjs';
const {PNG}=png;
test('comparação visual calcula diferenças sem aprovar automaticamente a referência',async()=>{
  const folder=await mkdtemp(path.join(tmpdir(),'portal-pixels-')),before=new PNG({width:4,height:4}),after=new PNG({width:4,height:4});before.data.fill(255);after.data.fill(255);after.data[0]=0;
  const a=path.join(folder,'a.png'),b=path.join(folder,'b.png'),diff=path.join(folder,'diff.png');await writeFile(a,PNG.sync.write(before));await writeFile(b,PNG.sync.write(after));
  const result=await comparePngFiles(a,b,diff);assert.equal(result.sizeMismatch,false);assert.ok(result.differentPixels!>0);assert.ok(result.ratio>0);
});
