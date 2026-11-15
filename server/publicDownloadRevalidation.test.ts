import test from 'node:test';
import assert from 'node:assert/strict';
import {publicPdfEtag,matchesPublicPdfEtag,PUBLIC_PDF_CACHE_CONTROL} from './publicDownloadRevalidation';
test('conditional public download reuses only a strong exact approved digest, never arbitrary or weak tags',()=>{
 const a=publicPdfEtag('a'.repeat(64))!;const b=publicPdfEtag('b'.repeat(64))!;
 assert.equal(matchesPublicPdfEtag(a,a),true);
 assert.equal(matchesPublicPdfEtag(`${b}, ${a}`,a),true);
 for(const input of ['*','W/'+a,b,'arbitrary',undefined])assert.equal(matchesPublicPdfEtag(input,a),false);
 for(const digest of ['',null,'../../secret','a'.repeat(63)])assert.equal(publicPdfEtag(digest),undefined);
 assert.equal(matchesPublicPdfEtag(a,undefined),false);
 assert.match(PUBLIC_PDF_CACHE_CONTROL,/private/);assert.match(PUBLIC_PDF_CACHE_CONTROL,/no-cache/);assert.match(PUBLIC_PDF_CACHE_CONTROL,/must-revalidate/);
});
