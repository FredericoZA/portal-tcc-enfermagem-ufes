import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationDeclined,finalDeliveryMessage} from '../src/utils/finalDeliveryPresentation';
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
test('mensagem confirma entrega, instrui sobre termo e não oculta pendência de envio',()=>{
 const process={status:'AGUARDANDO_ASSINATURA' as const,acervo:{publishFullWork:true} as any};
 assert.match(finalDeliveryMessage(process),/conferir e assinar o Termo/);
 assert.match(finalDeliveryMessage(process),/Depois que o Termo assinado for arquivado/);
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
 const html=withProcessEmailButton(input);assert.match(html,/Acessar documentos do processo/);assert.match(html,/tcc=processo-1&amp;secao=docs/);
 assert.equal(withProcessEmailButton({...input,html}),html);
 assert.match(withProcessEmailButton({...input,templateId:'email-entrega-repositorio'}),/secao=acervo/);
 assert.match(withProcessEmailButton({...input,html:'<html><body>Texto</body></html>'}),/data-portal-process-button[\s\S]*<\/body>/);
 assert.throws(()=>withProcessEmailButton({...input,baseUrl:'javascript:alert(1)'}));
});
