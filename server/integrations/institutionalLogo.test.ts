import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {institutionalLogoRequests} from './institutionalLogo';
import {institutionalDocumentLogo} from '../../src/utils/institutionalDocumentLogo';

test('institutional crest assets are identical, and UFES emails never select the course emblem',async()=>{
 assert.deepEqual(await readFile('public/ufes-crest.png'),await readFile('server/documents/assets/ufes-crest.png'));
 assert.equal(institutionalDocumentLogo({brandKit:{institutionName:'Universidade Federal do Espírito Santo',courseLogoUrl:'/colenf-logo.png',universityLogoUrl:'https://old.example/old.png'} as any}),'/ufes-crest.png');
 assert.equal(institutionalDocumentLogo({brandKit:{institutionName:'Outra instituição',universityLogoUrl:'https://other.example/crest.png'} as any}),'https://other.example/crest.png');
});

test('temporary Google Docs replace only identified Colenf images, preserving signatures and unrelated art',()=>{
 const image=(title:string)=>({inlineObjectProperties:{embeddedObject:{title,imageProperties:{}}}});
 const doc={tabs:[{documentTab:{inlineObjects:{course:image('COLENF'),signature:image('Assinatura'),diagram:image('Diagrama')}}}],inlineObjects:{course:image('COLENF')}};
 assert.deepEqual(institutionalLogoRequests(doc,'https://portal.example/ufes-crest.png'),[{replaceImage:{imageObjectId:'course',uri:'https://portal.example/ufes-crest.png',imageReplaceMethod:'CENTER_CROP'}}]);
 assert.deepEqual(institutionalLogoRequests(doc,'http://untrusted.example/logo'),[]);
 assert.deepEqual(institutionalLogoRequests({inlineObjects:{unknown:image('')}},'https://portal.example/ufes-crest.png'),[]);
});
