import assert from 'node:assert/strict';
import test from 'node:test';
import {runtimeCommitJsonbText,runtimeCommitPayloadHash} from './runtimeCommitHash';

test('matches jsonb UTF-8 key order, whitespace, escaping and nested arrays',()=>{
 assert.equal(runtimeCommitJsonbText({bb:2,a:1,'é':'texto\n"',b:[true,null,{xx:1,x:false}]}),'{"a": 1, "b": [true, null, {"x": false, "xx": 1}], "bb": 2, "é": "texto\\n\\\""}');
 assert.equal(runtimeCommitPayloadHash({a:1,b:2}),runtimeCommitPayloadHash({b:2,a:1}));
 assert.notEqual(runtimeCommitPayloadHash({a:1}),runtimeCommitPayloadHash({a:2}));
});
for(const [value,expected]of [[1e21,'1000000000000000000000'],[-1.25e21,'-1250000000000000000000'],[1e-7,'0.0000001'],[-1.23e-8,'-0.0000000123'],[5e-324,'0.'+'0'.repeat(323)+'5'],[-0,'0']]as const)test(`jsonb decimal ${value}`,()=>assert.equal(runtimeCommitJsonbText(value),expected));
