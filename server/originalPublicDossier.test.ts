import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {runInNewContext} from 'node:vm';import ts from 'typescript';import JSZip from 'jszip';
import {downloadDrivePdf} from './integrations/googleDriveArchive';
test('institutional dossier retains a published original PDF while private document checks remain in the reader',async t=>{
 const pdf=Buffer.from('%PDF-1.7\nOriginal in institutional dossier'),sha=createHash('sha256').update(pdf).digest('hex');
 t.mock.method(globalThis,'fetch',async(input:any)=>{const u=new URL(String(input));if(u.pathname.endsWith('/permissions'))return Response.json({permissions:[{type:'anyone',role:'reader'}]});if(u.searchParams.get('alt')==='media')return new Response(pdf);return Response.json({name:'work.pdf',mimeType:'application/pdf',appProperties:{portal:'portal-tcc',portalProcessId:'process-1',artifactType:'TRABALHO_COMPLETO',sha256:sha}});});
 const source=await readFile('server.ts','utf8'),start=source.indexOf('async function createInstitutionalDossier('),end=source.indexOf('\nconst emailDeliveryJournal=',start);
 const context:any={JSZip,Buffer,Date,createHash,auditLogsStore:[],formArchiveJobsStore:[],signatureJobsStore:[],getGoogleWorkspaceAccessToken:async()=>'fixture',downloadDrivePdf,publicFileAuthorized:()=>true,currentSettings:{},resolveInstallationProfile:()=>({installationId:'fixture',institutionName:'Fixture',courseName:'Fixture'})};
 runInNewContext(ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 const result=await context.createInstitutionalDossier({id:'process-1',protocolo:'TCC-TEST',defesa:{},acervo:{trabalhoCompletoFileId:'original_pdf_123',trabalhoCompletoSha256:sha}},'master@example.invalid');
 const zip=await JSZip.loadAsync(result.zip);assert.deepEqual(await zip.file('01_TRABALHO_COMPLETO/trabalho-completo.pdf')!.async('nodebuffer'),pdf);assert.equal(result.missing.length,0);
});
