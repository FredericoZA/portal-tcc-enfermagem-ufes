import test from 'node:test';
import assert from 'node:assert/strict';
import {localReviewData} from './localReviewData';
import {processWorkflowSection} from '../src/utils/processLink';
const env={NODE_ENV:'development',PORTAL_PERSISTENCE_PROVIDER:'local_file',PORTAL_LOCAL_REVIEW_DATA:'true',PORTAL_ALLOW_INSECURE_DEMO_AUTH:'true',PORTAL_TEST_DOCUMENT_RENDERER:'true'};
test('base local vazia recebe exemplos no mês atual, em dias úteis e com vínculos dos perfis',()=>{
 const state={processes:[],memberships:[]};const result=localReviewData(state,env,new Date('2026-10-22T12:00:00Z'))!;
 assert.ok(result.processes.length>=7);assert.ok(result.memberships.some(m=>m.email==='ana.santos@ufes.br'));
 assert.ok(result.processes.every(p=>p.titulo.startsWith('[Demonstração]')));
 assert.ok(result.processes.every(p=>p.defesa.startAt.startsWith('2026-10-')&&![0,6].includes(new Date(p.defesa.startAt).getUTCDay())));
 assert.deepEqual(state,{processes:[],memberships:[]});
 assert.equal(localReviewData(result,env),null);
});
test('não semeia produção, Vercel, provedor remoto nem ambiente sem simulação explícita',()=>{
 for(const patch of [{NODE_ENV:'production'},{VERCEL:'1'},{PORTAL_PERSISTENCE_PROVIDER:'supabase'},{PORTAL_LOCAL_REVIEW_DATA:'false'},{PORTAL_ALLOW_INSECURE_DEMO_AUTH:'false'},{PORTAL_TEST_DOCUMENT_RENDERER:'false'},{PORTAL_DATA_DIR:'/tmp/unrelated-fixture'}])assert.equal(localReviewData({processes:[]},{...env,...patch}),null);
});
test('processo concluído abre documentos mesmo se a etapa antiga ainda indicar repositório',()=>{
 assert.equal(processWorkflowSection({status:'CONCLUIDO',etapaAtual:'REPOSITORIO'} as any),'docs');
 assert.equal(processWorkflowSection({status:'AGUARDANDO_DADOS_FINAIS',etapaAtual:'REPOSITORIO'} as any),'acervo');
});
