import test from 'node:test';
import assert from 'node:assert/strict';
import {administrativeDocumentAvailability,publicationDeclined,finalDeliveryMessage} from '../src/utils/finalDeliveryPresentation';
import {publicProcessDetail} from '../src/utils/publicProcessDetail';
import {withDeclarationAfterTerm} from '../src/utils/declarationWorkflow';
import {ataClosingTime} from '../src/utils/ataClosingTime';
import {withProcessEmailButton} from './workflow/processEmailButton';
import type {IntegrationStudioSettings} from '../src/types/integrationStudio';

test('termo distingue recusa de publicação de entrega ainda pendente e publicação retirada',()=>{
 assert.equal(publicationDeclined({acervo:undefined}),false);
 const acervo={submittedAt:'2026-10-22T12:00:00Z',publishFullWork:false,publishExpandedAbstract:false} as any;
 assert.equal(publicationDeclined({acervo}),true);
 assert.equal(publicationDeclined({acervo:{...acervo,publishExpandedAbstract:true}}),false);
 assert.equal(publicationDeclined({acervo:{...acervo,publicationWithdrawnAt:'2026-10-23'}}),false);
});
test('documento administrativo assinado listado pela API pública não depende da publicação dos PDFs acadêmicos',()=>{
 const data={id:'TCC-2026-0042',protocolo:'TCC-2026-0042',aluno1:{nome:'Autora de exemplo'},orientador:{nome:'Docente de exemplo'},banca:[],acervo:{submittedAt:'2026-11-04T12:00:00Z',publishFullWork:false,publishExpandedAbstract:false},documents:[{id:'term-public',type:'TERMO',status:'ASSINADO',version:1,url:'/api/public/processes/TCC-2026-0042/documents/term-public/download'}]};
 const {process,documents}=publicProcessDetail(data),term=documents.find(document=>document.type==='TERMO')!;
 assert.equal(publicationDeclined(process),true,'a projeção dos arquivos acadêmicos não representa a emissão do termo');
 assert.deepEqual(administrativeDocumentAvailability(process,term,true),{publicationDeclined:false,available:true});
 assert.equal(term.driveDownloadUrl,data.documents[0].url);
 assert.equal(process.acervo?.publishFullWork,false);assert.equal(process.acervo?.publishExpandedAbstract,false);
 assert.equal(administrativeDocumentAvailability(process,documents.find(document=>document.type==='ATA')!,true).available,false,'documento ausente da lista pública continua indisponível');
 assert.deepEqual(administrativeDocumentAvailability(process,term,false),{publicationDeclined:true,available:false},'a regra da entrega privada permanece inalterada');
});
test('mensagem confirma entrega, instrui sobre termo e não oculta pendência de envio',()=>{
 const process={status:'AGUARDANDO_ASSINATURA' as const,acervo:{publishFullWork:true} as any};
 assert.match(finalDeliveryMessage(process),/conferir e assinar o Termo/);
 assert.match(finalDeliveryMessage({...process,signatureProviderPreferences:{TERMO:'GOV_BR'}}),/abra Gov.br.*baixar o PDF.*orientador deve devolver.*todas as assinaturas/);
 const pending=finalDeliveryMessage({...process,workflowPending:true});assert.match(pending,/comissão precisa resolver/);assert.doesNotMatch(pending,/DECLARACAO|O fluxo/);
 assert.match(finalDeliveryMessage({...process,acervo:{publishFullWork:false} as any}),/sem necessidade de assinatura/);
 assert.match(finalDeliveryMessage({...process,status:'CONCLUIDO'}),/processo está concluído/);
});
test('declaração migra para depois do termo e continua obrigatória sem divulgação pública',()=>{
 const old={docTemplates:[{id:'decl',type:'DECLARACAO'}],workflowStages:[{id:'repo',triggerEvent:'REPOSITORY_SUBMITTED',actions:[{id:'decl-action',type:'doc',refId:'decl',condition:{fieldKey:'PUBLICAR_TRABALHO',operator:'IS_TRUE'}}]}]} as unknown as IntegrationStudioSettings;
 const fixed=withDeclarationAfterTerm(old);
 assert.equal((fixed.workflowStages[0].actions as any[]).length,0);
 const stage=fixed.workflowStages.find(stage=>stage.triggerEvent==='PUBLICATION_CLEARED')!;
 assert.equal((stage.actions as any[])[0].refId,'decl');assert.equal((stage.actions as any[])[0].condition,undefined);
 assert.deepEqual(withDeclarationAfterTerm(fixed),fixed);assert.equal((old.workflowStages[0].actions as any[]).length,1);
});
test('encerramento da ata é uma hora após o início, inclusive na virada de data',()=>{
 assert.match(ataClosingTime('2026-10-15T13:00:00-03:00').label,/15 de outubro de 2026 às 14:00/);
 assert.equal(ataClosingTime('2026-10-15T13:00:00').iso,'2026-10-15T17:00:00.000Z');
 assert.match(ataClosingTime('2026-10-15T23:30:00-03:00').label,/16 de outubro de 2026 às 00:30/);
 assert.throws(()=>ataClosingTime('inválida'));
});
test('todos os e-mails do processo recebem botão autenticado e preservam CTA existente',()=>{
 const input={process:{id:'processo-1'},baseUrl:'https://portal.example/',text:'Orientações',templateId:'email-convite'};
 const html=withProcessEmailButton(input);assert.match(html,/Acessar TCC/);assert.match(html,/tcc=processo-1&amp;secao=docs/);
 assert.equal(withProcessEmailButton({...input,html}),html);
 assert.match(withProcessEmailButton({...input,templateId:'email-entrega-repositorio'}),/secao=acervo/);
 assert.match(withProcessEmailButton({...input,html:'<html><body>Texto</body></html>'}),/data-portal-process-button[\s\S]*<\/body>/);
 assert.throws(()=>withProcessEmailButton({...input,baseUrl:'javascript:alert(1)'}));
});
