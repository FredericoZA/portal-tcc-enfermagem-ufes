import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const panel = readFileSync('src/components/InfrastructureIntegrationsPanel.tsx', 'utf8');
test('recovery is the fifth process tab, restricted to Master and mounted only when selected',()=>{
  assert.doesNotMatch(panel,/WorkflowRecoveryPanel|Andamento e retomada dos processos/);
  const detail=readFileSync('src/pages/ProcessoDetailPage.tsx','utf8');
  assert.match(detail,/id:'docs'.*id:'andamento',label:'Andamento e retomada do processo',icon:RefreshCw,show:isMasterAdmin&&!readOnly/);
  assert.match(detail,/isMasterAdmin&&!readOnly&&isTabVisible\('andamento'\).*WorkflowRecoveryPanel processId={process.id}/);
  assert.match(detail,/activeTab==='andamento'&&\(!isMasterAdmin\|\|readOnly\)/);
  assert.match(detail,/activeTab!=='andamento'/);
});

test('slow archive and recovery POSTs use the long timeout without automatic replay', () => {
  const source = readFileSync('src/services/apiClient.ts', 'utf8');
  const archive = source.slice(source.indexOf('retryFormArchive:'), source.indexOf('\n', source.indexOf('retryFormArchive:')));
  const recovery = source.slice(source.indexOf('retryWorkflowOperation:'), source.indexOf('submitFinalData:', source.indexOf('retryWorkflowOperation:')));
  for (const method of [archive, recovery]) {
    assert.match(method, /method:'POST',timeoutMs:LONG_REQUEST_TIMEOUT_MS/);
    assert.equal((method.match(/fetchApi</g) || []).length, 1);
  }
  const recoveryPanel = readFileSync('src/components/WorkflowRecoveryPanel.tsx', 'utf8');
  assert.match(recoveryPanel, /useEffect\(\(\)=>\{if\(open\|\|historyOnly\)void load\(\);\}/);
  assert.match(recoveryPanel, /if\(!\(await portalConfirm\(warning\)\)\)return/);
});


test('central audit keeps its focus on process records',()=>{
 const logs=readFileSync('src/pages/AuditLogsPage.tsx','utf8');
 assert.doesNotMatch(logs,/WorkflowRecoveryPanel historyOnly|Prazos e histórico de lembretes/);
 const source=readFileSync('src/components/WorkflowRecoveryPanel.tsx','utf8');
 assert.match(source,/historyOnly&&<><details/);assert.doesNotMatch(source,/runWorkflowMaintenance|Executar lembretes vencidos/);
 assert.match(source,/getWorkflowOperations\(processId,historyOnly\?'reminders':'recovery'\)/);
});


test('Master process recovery mirrors the central audit page with a server process filter',()=>{
 const detail=readFileSync('src/pages/ProcessoDetailPage.tsx','utf8');
 assert.match(detail,/<AuditLogsPage embedded processId={process.id}[^>]*processRecovery=/);
 const logs=readFileSync('src/pages/AuditLogsPage.tsx','utf8');
 assert.match(logs,/before, focusId,processId}, controller.signal/);
 assert.match(logs,/!processId\s*&&\s*<button type="button" onClick={\(\) => void downloadBackup\(\)}/);
});
