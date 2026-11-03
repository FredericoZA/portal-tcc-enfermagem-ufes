import test from 'node:test';
import assert from 'node:assert/strict';
import {modelForRendering} from './modelPreviewSource';
test('preview uses a current snapshot without changing the published model or its file ID',()=>{
 const published={driveFileId:'model-file',contentSha256:'a'.repeat(64),driveRevisionId:'old',driveModifiedTime:'old-time',activeVersion:2};
 const source={contentSha256:'b'.repeat(64),driveRevisionId:'new',driveModifiedTime:'new-time'};
 const before=structuredClone(published);
 const preview=modelForRendering(published,'model-preview',source);
 assert.equal(preview.contentSha256,source.contentSha256);assert.equal(preview.driveFileId,published.driveFileId);assert.equal(preview.activeVersion,2);assert.deepEqual(published,before);
 assert.equal(modelForRendering(published,'process-real'),published);
 assert.throws(()=>modelForRendering(published,'process-real',source),/só pode ser usada/);
});
