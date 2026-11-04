import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {institutionalLogoRequests,institutionalHeadingRequests} from './institutionalLogo';
import {institutionalDocumentLogo} from '../../src/utils/institutionalDocumentLogo';

test('national arms assets are identical, and UFES emails never select the course emblem',async()=>{
 assert.deepEqual(await readFile('public/national-arms.png'),await readFile('server/documents/assets/national-arms.png'));
 assert.equal(institutionalDocumentLogo({brandKit:{institutionName:'Universidade Federal do Espírito Santo',courseLogoUrl:'/colenf-logo.png',universityLogoUrl:'https://old.example/old.png'} as any}),'/national-arms.png');
 assert.equal(institutionalDocumentLogo({brandKit:{institutionName:'Outra instituição',universityLogoUrl:'https://other.example/crest.png'} as any}),'https://other.example/crest.png');
});

test('temporary Google Docs replace only identified Colenf images, preserving signatures and unrelated art',()=>{
 const image=(title:string)=>({inlineObjectProperties:{embeddedObject:{title,imageProperties:{}}}});
 const doc={tabs:[{documentTab:{inlineObjects:{course:image('COLENF'),signature:image('Assinatura'),diagram:image('Diagrama')}}}],inlineObjects:{course:image('COLENF')}};
 assert.deepEqual(institutionalLogoRequests(doc,'https://portal.example/national-arms.png'),[{replaceImage:{imageObjectId:'course',uri:'https://portal.example/national-arms.png',imageReplaceMethod:'CENTER_CROP'}}]);
 assert.deepEqual(institutionalLogoRequests(doc,'http://untrusted.example/logo'),[]);
 assert.deepEqual(institutionalLogoRequests({inlineObjects:{unknown:image('')}},'https://portal.example/national-arms.png'),[]);
});


test('header includes department and commission once without numbering or rewriting signatories',()=>{
 const paragraph=(start:number,text:string)=>({startIndex:start,endIndex:start+text.length,paragraph:{elements:[{textRun:{content:text}}]}});
 const course='CURSO DE GRADUAÇÃO EM ENFERMAGEM E OBSTETRÍCIA\n';
 const header=paragraph(1,course);
 assert.deepEqual(institutionalHeadingRequests({body:{content:[header]}}),[{insertText:{location:{index:course.length},text:'\nDEPARTAMENTO DE ENFERMAGEM\nCOMISSÃO DE TRABALHO DE CONCLUSÃO DE CURSO'}}]);
 const dept=paragraph(header.endIndex,'DEPARTAMENTO DE ENFERMAGEM\n'),commission=paragraph(header.endIndex+26,'COMISSÃO DE TRABALHO DE CONCLUSÃO DE CURSO\n');
 assert.deepEqual(institutionalHeadingRequests({body:{content:[header,dept,commission]}}),[]);
});
