#!/usr/bin/env node
// Massa local de revisão visual. Nunca chama serviços externos nem altera o Estúdio.
import { readFile, writeFile, mkdir, copyFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import dotenv from 'dotenv';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const env = dotenv.parse(await readFile('.env.local', 'utf8'));
if (env.NODE_ENV !== 'development' || env.PORTAL_PERSISTENCE_PROVIDER !== 'local_file' || process.env.VERCEL) {
  throw new Error('Esta massa exige desenvolvimento com armazenamento local.');
}
const listening = await new Promise(resolve => {
  const socket = net.connect({ host: '127.0.0.1', port: Number(env.PORT || 3000) });
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});
if (listening) throw new Error('Encerre o servidor local antes de aplicar a massa para evitar sobrescrita pelo runtime.');
const path = '.portal-data/portal-state.json';
const raw = await readFile(path, 'utf8');
const state = JSON.parse(raw);
const protectedKeys = Object.keys(state).filter(k => !['processes', 'memberships', 'authorizedStudents', 'signatureJobs', 'auditLogs'].includes(k));
const protectedContent = JSON.stringify(protectedKeys.map(k => [k, state[k]]));
const marker = 'visual-demo-';
const baselineDuplicates = Object.fromEntries(['processes', 'memberships', 'authorizedStudents', 'signatureJobs', 'auditLogs'].map(k => {
  const ids = (state[k] || []).map(row => row.id);
  return [k, ids.length - new Set(ids).size];
}));
const now = new Date().toISOString();
const sha = value => createHash('sha256').update(value).digest('hex');
const iso = date => date.toISOString();
const weekday = value => {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) throw new Error('Data inválida.');
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return iso(d);
};
const weekdays = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' });
const names = ['Alice', 'Bruno', 'Camila', 'Daniel', 'Elisa', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Larissa', 'Miguel', 'Natália', 'Otávio', 'Patrícia', 'Rafael', 'Sofia', 'Tiago', 'Vitória', 'Yasmin'];
const surnames = ['Almeida', 'Barbosa', 'Costa', 'Dias', 'Ferreira', 'Gomes', 'Lima', 'Martins', 'Nascimento', 'Oliveira', 'Pereira', 'Ribeiro', 'Santos', 'Teixeira', 'Vieira'];
const themes = ['Segurança do paciente', 'Saúde da mulher', 'Saúde mental', 'Atenção primária', 'Envelhecimento', 'Saúde da criança', 'Urgência e emergência', 'Educação em saúde', 'Controle de infecções', 'Cuidados paliativos', 'Saúde do trabalhador', 'Tecnologias em enfermagem'];
const methods = ['Revisão integrativa', 'Estudo qualitativo', 'Estudo transversal', 'Relato de experiência', 'Pesquisa documental', 'Revisão de escopo'];
const places = ['Auditório de Enfermagem', 'Sala 101 — CCS', 'Sala 202 — CCS', 'Laboratório de Simulação', 'Sala virtual institucional', 'Auditório do Hospital Universitário'];
const phases = [['EM_RASCUNHO', 'CADASTRO'], ['AGUARDANDO_CONFIRMACAO_LOCAL', 'CONFIRMACAO_LOCAL'], ['AGUARDANDO_DEFESA', 'DEFESA'], ['EM_AVALIACAO', 'AVALIACAO'], ['AGUARDANDO_DADOS_FINAIS', 'REPOSITORIO'], ['AGUARDANDO_ASSINATURA', 'ASSINATURA'], ['CONCLUIDO', 'CONCLUIDO']];
const jobStatuses = ['WAITING_INTEGRATION', 'QUEUED', 'READY_FOR_REVIEW', 'APPROVED', 'SENDING', 'SENT', 'PARTIALLY_SIGNED', 'SIGNED', 'DECLINED', 'EXPIRED', 'CANCELED', 'PROVIDER_ERROR', 'DRIVE_SYNC_PENDING', 'ARCHIVED'];
// Reexecutar substitui apenas registros desta massa, preservando os anteriores.
for (const k of ['processes', 'memberships', 'authorizedStudents', 'signatureJobs', 'auditLogs']) {
  state[k] = (state[k] || []).filter(row => !String(row.id).startsWith(marker));
}
let correctedDates = 0;
for (const p of state.processes) {
  if (!String(p.id).startsWith('demo-proc-') || !p.defesa?.startAt) continue;
  const original = p.defesa.startAt;
  const shifted = weekday(original);
  if (shifted !== original) {
    const duration = Date.parse(p.defesa.endAt) - Date.parse(original);
    p.defesa.startAt = shifted;
    p.defesa.endAt = iso(new Date(Date.parse(shifted) + duration));
    correctedDates++;
  }
}
const target = 400;
const count = Math.max(0, target - state.processes.length);
const advisor = i => ({ nome: `Prof. ${names[i % names.length]} ${surnames[i % surnames.length]} (fictício)`, email: `orientador${i}@example.invalid`, instituicao: 'Instituição demonstrativa' });
for (let i = 0; i < count; i++) {
  const n = i + 1;
  const id = `${marker}tcc-${String(n).padStart(4, '0')}`;
  const phase = i % phases.length;
  // Estados concluídos e pós-defesa sempre no passado; agenda futura em dias úteis.
  const base = phase >= 3 ? new Date(Date.UTC(2024 + i % 3, i % 9, 1 + i % 26, 12 + i % 8)) : new Date(Date.UTC(2026, 9 + Math.floor(i / 140), 1 + i % 28, 12 + i % 8));
  const startAt = weekday(iso(base));
  const endAt = iso(new Date(Date.parse(startAt) + (60 + i % 3 * 30) * 60000));
  const createdAt = iso(new Date(Date.parse(startAt) - (50 + i % 45) * 86400000));
  const doneAt = iso(new Date(Date.parse(endAt) + 7 * 86400000));
  const student = j => ({ nome: `${names[(i + j) % names.length]} ${surnames[(i * 3 + j) % surnames.length]} ${surnames[(i + 4) % surnames.length]} (fictício)`, matricula: `DEMO${String(n).padStart(4, '0')}${j}`, email: `aluno${n}-${j}@example.invalid` });
  const a = advisor(i % 24);
  const p = {
    id, protocolo: `SIM-${2024 + i % 3}-${String(n).padStart(4, '0')}`,
    titulo: `${themes[i % themes.length]}: ${methods[i % methods.length].toLowerCase()} ${i % 5 === 0 ? 'sobre práticas de cuidado, desafios da equipe e estratégias de melhoria no contexto da rede de atenção à saúde' : 'na assistência de enfermagem'} — cenário fictício ${n}`,
    status: phases[phase][0], etapaAtual: phases[phase][1], aluno1: student(1), aluno2: i % 3 === 0 ? student(2) : null,
    orientador: a, coorientador: i % 4 === 0 ? advisor((i + 9) % 24) : null,
    banca: [ { id: `${id}-b1`, ...a, funcao: 'ORIENTADOR', membroTipo: 'INTERNO' }, ...[2, 3].map(j => ({id: `${id}-b${j}`, nome: `Examinador ${i % 30 + j} (fictício)`, email: `examinador${i % 30 + j}@example.invalid`, instituicao: j === 2 ? 'Instituição demonstrativa' : 'Instituição externa demonstrativa', funcao: `EXAMINER_${j}`, membroTipo: j === 2 ? 'INTERNO' : 'EXTERNO', profissao: 'Enfermeiro', titulacao: i % 2 ? 'Mestre' : 'Doutor' })) ],
    defesa: { startAt, endAt, local: places[i % places.length], formato: i % 3 ? 'PRESENCIAL' : 'REMOTO', localStatus: phase > 1 ? 'CONFIRMADO' : 'PENDENTE' },
    avaliacao: phase >= 4 ? {status: 'CONCLUIDO', nota: 6 + i % 41 / 10, notaFinal: 6 + i % 41 / 10, resultadoCode: 'APROVADO', resultadoLabel: 'Aprovado', parecer: 'Parecer fictício para revisão das telas; sem validade acadêmica.', submittedBy: a.email, submittedAt: endAt, updatedAt: endAt } : {status: 'PENDENTE'},
    acervo: { palavrasChave: [themes[i % themes.length], 'Enfermagem', methods[i % methods.length]], resumoSintese: `Dados integralmente fictícios para testar tabelas, filtros e indicadores. ${themes[i % themes.length]} em diferentes serviços e populações.`, workType: ['MONOGRAFIA', 'ARTIGO', 'OUTRO'][i % 3], publishFullWork: phase >= 4 && i % 2 === 0, publishExpandedAbstract: phase >= 4 && i % 3 === 0, isPublic: false, publicationState: phase >= 4 && i % 2 === 0 ? 'PENDING_SYNC' : 'NOT_REQUESTED', ...(phase >= 4 ? { submittedAt: endAt, submittedBy: student(1).email } : {}) },
    registrationAnswers: { AREA_TEMATICA: themes[i % themes.length], TEMA_PRINCIPAL: themes[i % themes.length], TIPO_DE_ESTUDO: methods[i % methods.length], FINALIDADE_DO_TRABALHO: ['Assistência', 'Gestão', 'Educação'][i % 3] },
    dataRevision: 1, createdAt, updatedAt: phase === 6 ? doneAt : createdAt, ...(phase === 6 ? {completedAt: doneAt} : {})
  };
  p.createdByEmail = p.aluno1.email;
  state.processes.push(p);
  const participants = [[p.aluno1, 'STUDENT'], ...(p.aluno2 ? [[p.aluno2, 'STUDENT']] : []), [a, 'ADVISOR'], ...(p.coorientador ? [[p.coorientador, 'CO_ADVISOR']] : []), ...p.banca.slice(1).map(b => [b, 'EXAMINER'])];
  for (const [person, role] of participants) {
    state.memberships.push({id: `${marker}membership-${n}-${role}-${person.email}`, processId: id, email: person.email, roles: [role], active: true, createdAt, updatedAt: createdAt});
    let access = state.authorizedStudents.find(row => row.email === person.email);
    if (!access) {
      access = {id: `${marker}access-${person.email}`, nome: person.nome, email: person.email, matricula: person.matricula, active: true, processIds: [], createdAt, updatedAt: createdAt, createdBy: 'master@portal.local', accessType: role, origin: 'TCC_FORM', roles: [role]};
      state.authorizedStudents.push(access);
    }
    access.processIds.push(id);
    access.roles = [...new Set([...(access.roles || []), role])];
  }
  for (let j = 0; j < 3; j++) state.auditLogs.push({id: `${marker}log-${n}-${j}`, processId: id, actorEmail: j ? a.email : p.aluno1.email, actorRoles: [j ? 'ADVISOR' : 'STUDENT'], action: ['CRIACAO_PROCESSO', 'ATUALIZACAO_PROCESSO', 'REVISAO_DEMONSTRATIVA'][j], entityType: 'processo', entityId: id, after: {protocolo: p.protocolo, demonstrativo: true, status: p.status}, timestamp: iso(new Date(Date.parse(createdAt) + j * 86400000))});
  if (phase >= 3) {
    const status = jobStatuses[i % jobStatuses.length];
    const type = ['ATA', 'TERMO', 'DECLARACAO'][i % 3];
    state.signatureJobs.push({id: `${marker}signature-${n}`, processId: id, protocol: p.protocolo, documentType: type, documentTitle: `${type} — simulação visual sem documento real`, documentVersion: 1, sourceDataRevision: 1, fileName: `SIMULACAO_${p.protocolo}_${type}.pdf`, mimeType: 'application/pdf', contentSha256: sha(id), idempotencyKey: `${marker}${id}-${type}`, status,
      signers: [{id: `${id}-signer`, role: 'ADVISOR', name: a.nome, email: a.email, signingOrder: 1, status: ['SIGNED', 'ARCHIVED', 'DRIVE_SYNC_PENDING'].includes(status) ? 'SIGNED' : status === 'DECLINED' ? 'DECLINED' : 'WAITING'}],
      provider: 'ASTEN', createdAt: endAt, createdBy: 'master@portal.local', updatedAt: endAt,
      ...(['SIGNED', 'ARCHIVED', 'DRIVE_SYNC_PENDING'].includes(status) ? { signedAt: endAt, completedAt: endAt } : {}),
      ...(['PROVIDER_ERROR', 'WAITING_INTEGRATION', 'EXPIRED', 'DECLINED'].includes(status) ? {lastError: 'Cenário fictício para revisar a tela; nenhum envelope real foi enviado.'} : {})});
  }
}
if (JSON.stringify(protectedKeys.map(k => [k, state[k]])) !== protectedContent) throw new Error('Configuração protegida foi alterada.');
for (const k of ['processes', 'memberships', 'authorizedStudents', 'signatureJobs', 'auditLogs']) {
  const ids = state[k].map(row => row.id);
  if (ids.length - new Set(ids).size > baselineDuplicates[k]) throw new Error(`Novos IDs repetidos em ${k}.`);
}
if (state.processes.some(p => p.defesa?.startAt && ['Sat', 'Sun'].includes(weekdays.format(new Date(p.defesa.startAt))))) throw new Error('Defesa em fim de semana detectada; nada foi gravado.');
if (state.signatureJobs.some(j => String(j.id).startsWith(marker) && (j.providerEnvelopeId || j.artifactBase64 || j.driveSignedFileId))) throw new Error('A massa não pode conter artefatos reais.');
await mkdir('.portal-data/backups', {recursive: true});
const backup = `.portal-data/backups/antes-massa-visual-${now.replace(/[:.]/g, '-')}.json`;
await copyFile(path, backup);
await writeFile(`${path}.tmp`, JSON.stringify(state, null, 2), {mode: 0o600});
await rename(`${path}.tmp`, path);
console.log(JSON.stringify({backup, totalTccs: state.processes.length, novosTccs: count, acessos: state.authorizedStudents.length, assinaturas: state.signatureJobs.length, logs: state.auditLogs.length, datasDemonstrativasCorrigidas: correctedDates, duplicatasPreexistentes: baselineDuplicates, modelosEConfiguracoesPreservados: true, defesasEmFimDeSemana: 0}, null, 2));
