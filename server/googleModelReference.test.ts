import test from 'node:test';
import assert from 'node:assert/strict';
import {googleModelReference} from './googleModelReference';
test('model references accept Google links/IDs and reject other hosts and query/path injection',()=>{
 const id='1AbC_def-1234567890';
 for(const value of [id,`https://docs.google.com/document/d/${id}/edit`,`https://drive.google.com/file/d/${id}/view`,`https://drive.google.com/open?id=${id}`])assert.equal(googleModelReference(value),id);
 for(const value of ['https://evil.example/d/'+id,'https://docs.google.com.evil.example/d/'+id,'http://docs.google.com/d/'+id,'https://user:pass@docs.google.com/d/'+id,'https://drive.google.com/open?id=abc%3Falt%3Dmedia','not-a-file-id?alt=media','https://127.0.0.1/'+id])assert.equal(googleModelReference(value),null,value);
});
