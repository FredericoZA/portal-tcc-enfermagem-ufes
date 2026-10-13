import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(name:string)=>readFileSync(new URL('../.github/workflows/'+name,import.meta.url),'utf8');
for(const name of ['production-smoke.yml','production-security-headers.yml']){
  test(name+' é exclusivamente manual e sanitiza a entrada do SHA via variável de ambiente',()=>{
    const yaml=read(name);
    assert.ok(yaml.includes('workflow_dispatch:'));
    assert.ok(!yaml.includes('push:'));
    assert.ok(yaml.includes('EXPECTED_SHA: ${{ inputs.expected_sha }}'));
    assert.ok(yaml.includes('expected="$EXPECTED_SHA"'));
    assert.ok(!yaml.includes('expected="${{ inputs.expected_sha }}"'));
    assert.ok(yaml.includes('[[ "$expected" =~ ^[0-9a-f]{40}$ ]]'));
  });
}
