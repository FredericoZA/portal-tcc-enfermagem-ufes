import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {signatureSignerNote,currentDocumentSignatureJob,frozenGovbrDownloadJob} from '../src/utils/signatureRecipientPresentation';
import {signatureDocumentRevision} from '../src/utils/documentSignatureState';
const signers:any[]=[{role:'ADVISOR',name:'Private Advisor',email:'advisor@example.invalid',signingOrder:1},{role:'EXAMINER',name:'Private Examiner',email:'examiner@example.invalid',signingOrder:1},{role:'EXAMINER',name:'Other Examiner',email:'second@example.invalid',signingOrder:1},{role:'PRESIDENT',name:'Private President',email:'president@example.invalid',signingOrder:1}];
const job=()=>({id:'frozen-job',processId:'p',documentType:'TERMO',sourceDataRevision:4,documentVersion:2,provider:'GOV_BR',status:'READY_FOR_REVIEW',driveUnsignedFileId:'private-file',signers,signerPolicySnapshot:{version:1,documentType:'TERMO',signers}} as any);
test('document note uses only unique frozen roles without names or addresses and retains legacy fallback',()=>{
 assert.equal(signatureSignerNote(job(),'Legacy'),'Orientador, Examinadores, Presidência');
 assert.doesNotMatch(signatureSignerNote(job(),'Legacy'),/Private|@/);
 assert.equal(signatureSignerNote({...job(),signerPolicySnapshot:undefined},'Legacy'),'Legacy');
 assert.equal(currentDocumentSignatureJob('p','TERMO',4,2,[job()])?.id,'frozen-job');
 assert.equal(currentDocumentSignatureJob('p','TERMO',5,2,[job()]),undefined);
});
test('extra signer download is restricted to current prepared Gov.br version with its frozen signer and artifact',()=>{
 const current=job();assert.equal(frozenGovbrDownloadJob('p','TERMO',4,2,[current],'EXAMINER@example.invalid'),current);
 for(const patch of [{provider:'ASTEN'},{status:'CANCELED'},{status:'SIGNED'},{status:'SENDING'},{driveUnsignedFileId:undefined},{removedFromLogsAt:'2026-11-10'},{sourceDataRevision:3},{documentVersion:1},{processId:'other'},{documentType:'ATA'},{signerPolicySnapshot:undefined},{signers:[]}])assert.equal(frozenGovbrDownloadJob('p','TERMO',4,2,[{...current,...patch}],'examiner@example.invalid'),undefined,JSON.stringify(patch));
 assert.equal(frozenGovbrDownloadJob('p','TERMO',4,2,[current],'unrelated@example.invalid'),undefined);
});
function renderModal(initialJob:any,downloadOnly=true,missingLoaded=false){
 const exports:any={},calls={prepare:0,download:0},buttons:any[]=[];let stateIndex=0;
 const React={createElement:(type:unknown,props:any,...children:unknown[])=>{const node={type,props:props||{},children};if(type==='button')buttons.push(node);return node;},useEffect:()=>{},useRef:(value:unknown)=>({current:value}),useState:(initial:unknown)=>{const index=stateIndex++;return[missingLoaded&&index===1?false:typeof initial==='function'?(initial as ()=>unknown)():initial,()=>{}];}};
 const modules:Record<string,unknown>={react:{...React,default:React,__esModule:true},'lucide-react':{},'../context/AuthContext':{useAuth:()=>({userEmail:'examiner@example.invalid',isMasterAdmin:true,isCommissionPresident:true})},'../utils/documentSignatureState':{signatureDocumentRevision},'../utils/runtimeEnvironment':{isLocalDemoFrontend:()=>false},'../services/apiClient':{apiClient:{signProcessDocument:async()=>{calls.prepare++;throw Error('must not prepare');},downloadGovbrPdf:async()=>{calls.download++;return{blob:new Blob(['fixture']),fileName:'fixture.pdf'};}},ApiRequestError:class extends Error{}},'../utils/formatters':{formatDateTimeWithWeekday:()=>''},'./DocumentFilePreview':{},'./PortalModalShell':{PortalModalShell:()=>null}};
 runInNewContext(ts.transpileModule(readFileSync('src/components/GovbrSignatureModal.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{exports,require:(name:string)=>modules[name]||{},URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL:()=>{}},document:{createElement:()=>({click:()=>{},remove:()=>{}}),body:{appendChild:()=>{}}},window:{setTimeout:()=>{}}});
 const tree=exports.GovbrSignatureModal({process:{id:'p',protocolo:'TCC - 00002',titulo:'Fixture',dataRevision:4,orientador:{nome:'Advisor',email:'advisor@example.invalid'}},documentType:'TERMO',canApprove:true,downloadOnly,initialJob,onChange:()=>{},onClose:()=>{}});
 const text=(node:any):string=>node==null||typeof node==='boolean'?'':Array.isArray(node)?node.map(text).join(' '):typeof node==='object'?node.children.map(text).join(' '):String(node);
 return{html:text(tree),calls,buttons,text};
}
test('actual Gov.br modal download-only renders original download and cannot prepare, return or approve',async()=>{
 const f=renderModal({...job(),govbrReview:{fileName:'review.pdf',sha256:'fixture'}},true);
 assert.match(f.html,/Baixar PDF para assinar/);assert.doesNotMatch(f.html,/Gerar e baixar PDF|Devolver PDF assinado|Substituir PDF|Conferir todos|Confirmar conferência/);
 const download=f.buttons.find(button=>f.text(button).includes('Baixar PDF para assinar'));assert.ok(download);await download.props.onClick();await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(f.calls.download,1);assert.equal(f.calls.prepare,0);
 const missing=renderModal(undefined,true,true);assert.doesNotMatch(missing.html,/Gerar e baixar PDF|Devolver PDF assinado/);assert.equal(missing.calls.prepare,0);
});
test('process page passes exact frozen job, role-only note and explicit download-only mode',()=>{
 const source=readFileSync('src/pages/ProcessoDetailPage.tsx','utf8');
 assert.ok(source.includes('signerNote={signatureSignerNote(signingJob,docInfo.signer)}'));
 assert.ok(source.includes('setGovbrDownloadOnly(!canRequestSignature)'));
 assert.ok(source.includes('downloadOnly={govbrDownloadOnly} initialJob={frozenGovbrDownloadJob('));
});
