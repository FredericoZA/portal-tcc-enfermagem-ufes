import test from 'node:test';
import assert from 'node:assert/strict';
import type { IntegrationStudioSettings } from '../../src/types/integrationStudio';
import type { ProcessData } from '../../src/types';
import { buildProcessVariables, compileWorkflow, executeWorkflowEvent, mergeWorkflowHtmlVariables, mergeWorkflowVariables, planWorkflowEvent } from './runtime';

const processFixture: ProcessData = {
  id: 'process-1', protocolo: 'TCC-2026-0001', titulo: 'Cuidado seguro', etapaAtual: 'CADASTRO', status: 'EM_RASCUNHO', createdByEmail: 'ana@aluno.ufes.br',
  aluno1: { nome: 'Ana Silva', matricula: '20260001', email: 'ana@aluno.ufes.br' }, aluno2: null,
  orientador: { nome: 'Prof. Bruno', email: 'bruno@ufes.br' }, coorientador: null, banca: [{ id: 'examiner-1', nome: 'Profa. Carla', email: 'carla@externa.br', funcao: 'EXAMINER_2', instituicao: 'Outra instituição' }],
  defesa: { startAt: '2026-09-01T13:00:00.000Z', endAt: '2026-09-01T14:30:00.000Z', local: 'Sala 1' },
  avaliacao: { status: 'PENDENTE' }, dataRevision: 2, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z'
};

test('historical identifiers stay in the private record and cannot enter newly rendered workflow messages',()=>{
 const process=structuredClone(processFixture);
 process.orientador.siape='HISTORICAL-SIAPE';
 process.avaliacao.answers={ALUNO_1_CPF:'HISTORICAL-CPF',EXAMINADOR_2_CIAP:'HISTORICAL-CIAP',OBSERVACAO:'Comentário acadêmico'};
 const values=buildProcessVariables({process,eventCode:'TCC_CREATED',actorEmail:process.aluno1.email,extraVariables:{ALUNO_RA:'HISTORICAL-RA'}} as any);
 const rendered=mergeWorkflowVariables('<<ALUNO_1_MATRICULA>> <<ORIENTADOR_SIAPE>> <<ALUNO_1_CPF>> <<EXAMINADOR_2_CIAP>> <<ALUNO_RA>> <<OBSERVACAO>>',values);
 assert.doesNotMatch(rendered,/20260001|HISTORICAL-/);
 assert.match(rendered,/Comentário acadêmico/);
 assert.equal(process.aluno1.matricula,'20260001');assert.equal(process.orientador.siape,'HISTORICAL-SIAPE');
});

const studioFixture = {
  schemaVersion: 2, revision: 1, savedAt: '2026-08-01T00:00:00.000Z', savedBy: 'master@ufes.br', driveModelosFolderUrl: '',
  brandKit: { institutionName: 'UFES', courseName: 'Enfermagem', universityLogoUrl: '', courseLogoUrl: '', emailBannerUrl: '', primaryColor: '#166534', secondaryColor: '#fff', accentColor: '#0f766e', textColor: '#111827', fontFamily: 'Arial', documentHeaderText: '', documentFooterText: '', emailFooterText: '' },
  documentDesigns: {}, emailDesigns: {}, formDesigns: {}, matrixColumns: [], matrixRows: [],
  docTemplates: [{ id: 'doc-convite', label: 'Convite' }],
  emailTemplates: [{ id: 'email-convite', recipient: '{{ORIENTADOR_EMAIL}}', subject: '{{TCC_CODIGO}} — {{TITULO}}', body: 'Olá {{ORIENTADOR_NOME}}' }],
  formTemplates: [{ id: 'form-local', targetRole: 'Aluno' }],
  workflowStages: [{ id: 'stage-created', stageNumber: 1, title: 'Cadastro', triggerEvent: 'TCC_CREATED', actions: [
    { id: 'make-doc', type: 'doc', refId: 'doc-convite', title: 'Criar convite' },
    { id: 'send-mail', type: 'email', refId: 'email-convite', title: 'Enviar e-mail' },
    { id: 'ask-local', type: 'form', refId: 'form-local', title: 'Confirmar local' }
  ] }], auditTrail: []
} satisfies IntegrationStudioSettings;

test('compila o fluxo e planeja apenas o evento exato', () => {
  const compiled = compileWorkflow(studioFixture);
  assert.equal(compiled.issues.length, 0);
  const plan = planWorkflowEvent(studioFixture, { process: processFixture, actorEmail: 'ana@aluno.ufes.br', actorRoles: ['STUDENT'], eventCode: 'TCC_CREATED' });
  assert.equal(plan.actions.length, 3);
  assert.equal(plan.variables.TCC_CODIGO, 'TCC-2026-0001');
  assert.equal(new Set(plan.actions.map((item) => item.idempotencyKey)).size, 3);
});

test('expõe o endereço público configurado para os modelos de e-mail', () => {
  const previous = process.env.PORTAL_PUBLIC_URL;
  process.env.PORTAL_PUBLIC_URL = 'https://portal.example.edu/';
  try {
    const plan = planWorkflowEvent(studioFixture, { process: processFixture, actorEmail: 'ana@aluno.ufes.br', actorRoles: ['STUDENT'], eventCode: 'TCC_CREATED' });
    assert.equal(plan.variables.LINK_PORTAL, 'https://portal.example.edu');
  } finally {
    if (previous === undefined) delete process.env.PORTAL_PUBLIC_URL;
    else process.env.PORTAL_PUBLIC_URL = previous;
  }
});

test('mescla variáveis sem transformar texto comum com hífen em campo', () => {
  const result = mergeWorkflowVariables('TCC: {{TCC_CODIGO}} — -CAMPO_NAO_EXISTE- — ATA DE DEFESA', { TCC_CODIGO: 'TCC-1' });
  assert.equal(result, 'TCC: TCC-1 — -CAMPO_NAO_EXISTE- — ATA DE DEFESA');
});

test('escapa valores dinâmicos sem remover a formatação HTML publicada', () => {
  assert.equal(
    mergeWorkflowHtmlVariables('<p>Olá <strong>{{ALUNO_NOME}}</strong></p>', { ALUNO_NOME: '<img src=x onerror=alert(1)>' }),
    '<p>Olá <strong>&lt;img src=x onerror=alert(1)&gt;</strong></p>'
  );
});

test('executa documento, formulário e e-mail configurados', async () => {
  const calls: string[] = [];
  const run = await executeWorkflowEvent(studioFixture, { process: processFixture, actorEmail: 'ana@aluno.ufes.br', actorRoles: ['STUDENT'], eventCode: 'TCC_CREATED', occurredAt: '2026-08-01T10:00:00.000Z' }, {
    async createDocument() { calls.push('document'); return { externalId: 'drive-1' }; },
    async createFormTask() { calls.push('form'); return { externalId: 'form-task-1' }; },
    async sendEmail(input) { calls.push(`email:${input.to[0]}:${input.subject}`); return { externalId: 'gmail-1' }; }
  });
  assert.equal(run.status, 'COMPLETED');
  assert.deepEqual(calls, ['document', 'email:bruno@ufes.br:TCC-2026-0001 — Cuidado seguro', 'form']);
});

test('condição configurada controla a ação sem alterar o código do curso', () => {
  const conditional = structuredClone(studioFixture) as IntegrationStudioSettings;
  conditional.workflowStages[0].actions[0].condition = { fieldKey: 'ACEITE_PERSONALIZADO', operator: 'IS_TRUE' };
  const withoutPublication = planWorkflowEvent(conditional, { process: processFixture, actorEmail: 'ana@aluno.ufes.br', actorRoles: ['STUDENT'], eventCode: 'TCC_CREATED', extraVariables: { ACEITE_PERSONALIZADO: false } });
  const withPublication = planWorkflowEvent(conditional, { process: processFixture, actorEmail: 'ana@aluno.ufes.br', actorRoles: ['STUDENT'], eventCode: 'TCC_CREATED', extraVariables: { ACEITE_PERSONALIZADO: true } });
  assert.equal(withoutPublication.actions.some(action => action.id === 'make-doc'), false);
  assert.equal(withPublication.actions.some(action => action.id === 'make-doc'), true);
});

test('respostas aceitas do formulário prevalecem nas variáveis do evento seguinte', () => {
  const plan = planWorkflowEvent(studioFixture, {
    process: processFixture,
    actorEmail: 'ana@aluno.ufes.br',
    actorRoles: ['STUDENT'],
    eventCode: 'TCC_CREATED',
    extraVariables: { PARECER_PERSONALIZADO: 'Parecer preenchido no formulário' }
  });
  assert.equal(plan.variables.PARECER_PERSONALIZADO, 'Parecer preenchido no formulário');
  assert.equal(plan.variables.BANCA_EMAILS, 'carla@externa.br');
  assert.equal(plan.variables.CAMPO_01, 'Ana Silva');
  assert.equal(mergeWorkflowVariables('Aluno: -CAMPO_01-', plan.variables), 'Aluno: Ana Silva');
});

test('respostas diferentes geram chaves distintas para permitir correção do formulário', () => {
  const first = planWorkflowEvent(studioFixture, { process: processFixture, actorEmail: 'ana@aluno.ufes.br', actorRoles: ['STUDENT'], eventCode: 'TCC_CREATED', extraVariables: { PARECER_PERSONALIZADO: 'Versão inicial' } });
  const corrected = planWorkflowEvent(studioFixture, { process: processFixture, actorEmail: 'ana@aluno.ufes.br', actorRoles: ['STUDENT'], eventCode: 'TCC_CREATED', extraVariables: { PARECER_PERSONALIZADO: 'Versão corrigida' } });
  assert.notEqual(first.actions[0].idempotencyKey, corrected.actions[0].idempotencyKey);
});

test('interrompe ações posteriores quando uma dependência falha', async () => {
  const calls: string[] = [];
  const run = await executeWorkflowEvent(studioFixture, { process: processFixture, actorEmail: 'ana@aluno.ufes.br', actorRoles: ['STUDENT'], eventCode: 'TCC_CREATED' }, {
    async createDocument() { calls.push('document'); throw new Error('Drive indisponível'); },
    async createFormTask() { calls.push('form'); return {}; },
    async sendEmail() { calls.push('email'); return {}; }
  });
  assert.equal(run.status, 'PARTIAL_FAILURE');
  assert.deepEqual(calls, ['document']);
  assert.equal(run.actions.length, 1);
});

test('formulário não pode sobrescrever identidade nem redirecionar destinatários', () => {
  const baseline = planWorkflowEvent(studioFixture, {
    process: processFixture,
    actorEmail: 'ana@aluno.ufes.br',
    actorRoles: ['STUDENT'],
    eventCode: 'TCC_CREATED',
    extraVariables: { NOTA_ADICIONAL: 'Texto aceito' }
  });
  const attemptedOverride = planWorkflowEvent(studioFixture, {
    process: processFixture,
    actorEmail: 'ana@aluno.ufes.br',
    actorRoles: ['STUDENT'],
    eventCode: 'TCC_CREATED',
    extraVariables: {
      NOTA_ADICIONAL: 'Texto aceito',
      ORIENTADOR_EMAIL: 'atacante@example.test',
      TCC_CODIGO: 'TCC-FALSO',
      ATOR_EMAIL: 'outra-pessoa@example.test'
    }
  });

  assert.equal(attemptedOverride.variables.ORIENTADOR_EMAIL, 'bruno@ufes.br');
  assert.equal(attemptedOverride.variables.TCC_CODIGO, 'TCC-2026-0001');
  assert.equal(attemptedOverride.variables.ATOR_EMAIL, 'ana@aluno.ufes.br');
  assert.equal(attemptedOverride.variables.NOTA_ADICIONAL, 'Texto aceito');
  assert.equal(attemptedOverride.actions[0].idempotencyKey, baseline.actions[0].idempotencyKey);
});

test('ação interna sem porta explícita falha fechada', async () => {
  const value = structuredClone(studioFixture) as IntegrationStudioSettings;
  value.workflowStages[0].actions = [{ id: 'unsafe-action', type: 'action', title: 'Ação sem executor' }];
  const run = await executeWorkflowEvent(value, {
    process: processFixture,
    actorEmail: 'ana@aluno.ufes.br',
    actorRoles: ['STUDENT'],
    eventCode: 'TCC_CREATED'
  }, {
    async createDocument() { return {}; },
    async createFormTask() { return {}; },
    async sendEmail() { return {}; }
  });

  assert.equal(run.status, 'PARTIAL_FAILURE');
  assert.equal(run.actions[0].status, 'FAILED');
  assert.match(run.actions[0].error || '', /não possui executor seguro/i);
});

test('preserva o identificador de uma entrega parcial para permitir retentativa', async () => {
  const emailOnly = structuredClone(studioFixture) as IntegrationStudioSettings;
  emailOnly.workflowStages[0].actions = [{ id: 'send-mail', type: 'email', refId: 'email-convite', title: 'Enviar e-mail' }];
  const run = await executeWorkflowEvent(emailOnly, {
    process: processFixture,
    actorEmail: 'ana@aluno.ufes.br',
    actorRoles: ['STUDENT'],
    eventCode: 'TCC_CREATED'
  }, {
    async createDocument() { return {}; },
    async createFormTask() { return {}; },
    async sendEmail() {
      const error = new Error('Gmail temporariamente indisponível') as Error & { externalId: string };
      error.externalId = 'mail_delivery_123';
      throw error;
    }
  });

  assert.equal(run.status, 'PARTIAL_FAILURE');
  assert.equal(run.actions[0].externalId, 'mail_delivery_123');
});


test('marcadores legíveis são mesclados uma vez e seus valores HTML são escapados', () => {
  const values = { 'Data da defesa': '08/09/2026', TITULO: '-CAMPO_01-', CAMPO_01: '<script>segredo</script>' };
  assert.equal(mergeWorkflowVariables('<<Data da defesa>> · [[TITULO]] · «Data da defesa»', values), '08/09/2026 · -CAMPO_01- · 08/09/2026');
  assert.equal(mergeWorkflowHtmlVariables('<b>{{TITULO}}</b><p><<CAMPO_01>></p>', values), '<b>-CAMPO_01-</b><p>&lt;script&gt;segredo&lt;/script&gt;</p>');
});

test('nenhum formato de marcador permite encaminhar anexos por resposta livre', async () => {
  for (const marker of ['{{OUTRO_EMAIL}}', '<<OUTRO_EMAIL>>', '[[OUTRO_EMAIL]]', '«OUTRO_EMAIL»', '-OUTRO_EMAIL-']) {
    const value = structuredClone(studioFixture) as IntegrationStudioSettings;
    value.emailTemplates[0].recipient = marker;
    let sent = false;
    const run = await executeWorkflowEvent(value, { process: processFixture, eventCode: 'TCC_CREATED', actorEmail: 'ana@aluno.ufes.br', actorRoles: [], extraVariables: { OUTRO_EMAIL: 'atacante@example.invalid' } }, {
      async createDocument() { return { externalId: 'fake' }; }, async createFormTask() { return { externalId: 'fake' }; }, async sendEmail() { sent = true; return { externalId: 'fake' }; }
    });
    assert.equal(sent, false, marker);
    assert.equal(run.status, 'PARTIAL_FAILURE');
  }
});

test('form task receives configured participant roles; invalid audience does not create a task',async()=>{
 const studio=structuredClone(studioFixture) as any;
 studio.formTemplates[0].recipientRoles=['AUTHORS','COADVISOR'];
 const tasks:any[]=[];
 const ports={async createDocument(){return{};},async createFormTask(input:any){tasks.push(input);return{};},async sendEmail(){return{};}};
 const context={process:processFixture,actorEmail:processFixture.aluno1.email,actorRoles:['STUDENT'] as any,eventCode:'TCC_CREATED' as any,occurredAt:'2026-08-01T10:00:00.000Z'};
 const run=await executeWorkflowEvent(studio,context,ports);
 assert.equal(run.status,'COMPLETED');assert.equal(tasks.length,1);
 assert.deepEqual(tasks[0].recipientRoles,['AUTHORS','COADVISOR']);
 assert.deepEqual(run.actions.find(action=>action.kind==='FORM')?.formRecipientRoles,['AUTHORS','COADVISOR']);
 assert.equal(run.actions.filter(action=>action.kind!=='FORM').some(action=>action.formRecipientRoles!==undefined),false);
 studio.formTemplates[0].recipientRoles=['RESERVATION_RESPONSIBLE'];tasks.length=0;
 const rejected=await executeWorkflowEvent(studio,context,ports);
 assert.equal(rejected.status,'PARTIAL_FAILURE');assert.equal(tasks.length,0);
});


test('activity system trigger executes only at its event and preserves other stage activities and prerequisites',()=>{
 const value=structuredClone(studioFixture) as IntegrationStudioSettings;
 const actions=value.workflowStages[0].actions as any[];
 actions[1].executionEvent='SIGNATURE_COMPLETED';
 actions[1].condition={fieldKey:'ACEITE_CUSTOM',operator:'IS_TRUE'};
 const context={process:processFixture,actorEmail:processFixture.aluno1.email,actorRoles:[]};
 const created=planWorkflowEvent(value,{...context,eventCode:'TCC_CREATED'});
 assert.deepEqual(created.actions.map(a=>a.id),['make-doc','ask-local']);
 assert.equal(planWorkflowEvent(value,{...context,eventCode:'SIGNATURE_COMPLETED',extraVariables:{ACEITE_CUSTOM:false}}).actions.length,0);
 const signed=planWorkflowEvent(value,{...context,eventCode:'SIGNATURE_COMPLETED',extraVariables:{ACEITE_CUSTOM:true}});
 assert.deepEqual(signed.actions.map(a=>a.id),['send-mail']);
 assert.equal(signed.actions[0].stageId,'stage-created');
 assert.equal(planWorkflowEvent(value,{...context,eventCode:'LOCATION_CONFIRMED'}).actions.length,0);
 delete actions[1].executionEvent;
 assert.equal(planWorkflowEvent(value,{...context,eventCode:'TCC_CREATED',extraVariables:{ACEITE_CUSTOM:true}}).actions.length,3);
});
test('unsupported activity trigger fails compilation and cannot dispatch an external action',async()=>{
 const value=structuredClone(studioFixture) as IntegrationStudioSettings;
 (value.workflowStages[0].actions as any[])[1].executionEvent='MANUAL_BYPASS';
 const calls:string[]=[];
 const result=await executeWorkflowEvent(value,{process:processFixture,actorEmail:processFixture.aluno1.email,actorRoles:[],eventCode:'TCC_CREATED'}, {
  async createDocument(){calls.push('doc');return{};},async createFormTask(){calls.push('form');return{};},async sendEmail(){calls.push('email');return{};}
 });
 assert.ok(compileWorkflow(value).issues.some(issue=>issue.path.endsWith('.executionEvent')));
 assert.deepEqual(calls,[]);
});
