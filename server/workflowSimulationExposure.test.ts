import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('a rota de simulação não executa o simulador na produção e preserva seu uso local', async () => {
  const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const start = server.indexOf("  app.post('/api/admin/workflow/simulate'");
  const end = server.indexOf("\n", start);
  assert.ok(start >= 0 && end > start);
  const source = ts.transpileModule(server.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const productionRuntime of [true, false]) {
    const auth = () => {};
    const master = () => {};
    let handler: (req: unknown, res: unknown) => Promise<unknown>;
    let calls = 0;
    const context = {
      productionRuntime,
      requireAuthenticated: auth,
      requireAdministrator: master,
      currentSettings: { integrationStudio: {} },
      app: {
        post: (path: string, ...handlers: unknown[]) => {
          assert.equal(path, '/api/admin/workflow/simulate');
          assert.equal(handlers[0], auth);
          assert.equal(handlers[1], master);
          handler = handlers[2] as typeof handler;
        },
      },
      simulateWorkflow: async () => { calls += 1; return { simulated: true, externalEffects: false }; },
    };
    runInNewContext(source, context);
    let status = 200;
    let body: any;
    const headers = new Map();
    const res = {
      setHeader: (key: string, value: string) => headers.set(key, value),
      status: (value: number) => { status = value; return res; },
      json: (value: unknown) => { body = value; return res; },
    };
    await handler!({ body: { studio: { revision: 999 }, scenario: { locationConfirmed: true } } }, res);
    assert.equal(headers.get('Cache-Control'), 'private, no-store');
    assert.equal(status, productionRuntime ? 410 : 200);
    assert.equal(calls, productionRuntime ? 0 : 1);
    if (productionRuntime) assert.equal(body.code, 'WORKFLOW_SIMULATION_DISABLED');
    else assert.equal(body.externalEffects, false);
  }
});
