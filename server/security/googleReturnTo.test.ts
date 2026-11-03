import test from 'node:test';
import assert from 'node:assert/strict';
import { safeGoogleReturnTo } from '../integrations/googleWorkspace';

test('OAuth retains local destination and normalizes dot segments',()=>{
  assert.equal(safeGoogleReturnTo('/?tcc=p&secao=docs#ata'),'/?tcc=p&secao=docs#ata');
  assert.equal(safeGoogleReturnTo('/local/../?google=connected'),'/?google=connected');
});
test('OAuth rejects external authorities, backslashes and control characters',()=>{
  for(const value of ['/\\evil.example','//evil.example','/.//evil.example','https://evil.example','/x\\evil','/\tevil','/\nevil','/\u0000evil','/'.repeat(1025)]){
    const result=safeGoogleReturnTo(value);
    assert.equal(result,'/?google=connected',JSON.stringify(value));
    assert.equal(new URL(result,'https://portal.invalid').origin,'https://portal.invalid');
    assert.equal(safeGoogleReturnTo(result), result);
  }
});
