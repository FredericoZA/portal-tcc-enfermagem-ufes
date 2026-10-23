import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createProfessionalPdf } from '../server/documents/simplePdf';
import { buildCanonicalSignaturePlan } from '../server/integrations/astenEventLedger';
import type { ProcessData } from '../src/types';

// Somente prepara arquivos. Não usa chave, rede, configurações ou dados do portal.
const email = process.argv[process.argv.indexOf('--email') + 1]?.trim().toLowerCase();
if (!process.argv.includes('--email') || !/^[a-z0-9._-]+@gmail\.com$/.test(email || '')) {
  throw new Error('Informe a caixa Gmail de teste em --email, sem sufixo +.');
}
const [mailbox, domain] = email.split('@');
const alias = (role: string) => `${mailbox}+${role}@${domain}`;
const directory = fileURLToPath(new URL('../.portal-data/pilots/asten-20261013/', import.meta.url));
await mkdir(directory, { recursive: true });
const plans = [];
const president = { name: 'Presidente — piloto fictício', email: alias('presidente') };
for (const number of [1, 2]) {
  const student = (index: number) => ({ nome: `Aluno ${index} — piloto ${number} fictício`, matricula: `PILOTO${number}${index}`, email: alias(`piloto${number}-aluno${index}`) });
  const p: ProcessData = {
    id: `pilot-asten-${number}`, protocolo: `PILOTO-ASTEN-${number}`, titulo: `Teste controlado de assinatura — ${number === 1 ? 'autor único' : 'dois autores'} — sem validade acadêmica`,
    etapaAtual: 'ASSINATURA', status: 'AGUARDANDO_ASSINATURA', aluno1: student(1), aluno2: number === 2 ? student(2) : null,
    orientador: { nome: 'Orientador — piloto fictício', email: alias('orientador') }, coorientador: null, banca: [],
    defesa: { startAt: `2026-10-${14 + number}T17:00:00.000Z`, endAt: `2026-10-${14 + number}T18:30:00.000Z`, local: 'Sala de testes, sem evento real' },
    avaliacao: { status: 'CONCLUIDO', notaFinal: 9, resultadoCode: 'APROVADO' },
    acervo: { publishFullWork: true, isPublic: false, publicationState: 'PENDING_SYNC', workType: 'MONOGRAFIA' },
    dataRevision: 1, createdByEmail: email, createdAt: '2026-10-13T18:00:00.000Z', updatedAt: '2026-10-13T18:00:00.000Z'
  };
  const documents = [];
  for (const type of ['ATA', 'TERMO', 'DECLARACAO'] as const) {
    const plan = buildCanonicalSignaturePlan(p, type, president);
    assert.equal(plan.required, true);
    assert.equal(plan.signers.length, type === 'TERMO' ? number + 1 : 1);
    assert.ok(plan.signers.every(s => s.order === 1 && s.email.split('@')[0].split('+')[0] === mailbox && s.email.endsWith('@' + domain)));
    assert.equal(new Set(plan.signers.map(s => s.email)).size, plan.signers.length);
    const body = [
      'DOCUMENTO FICTÍCIO PARA TESTE DE INTEGRAÇÃO. SEM VALIDADE ACADÊMICA.',
      'Esta cópia não utiliza nem substitui os modelos oficiais do portal.',
      '', p.titulo, `Autor: ${p.aluno1.nome}`, ...(p.aluno2 ? [`Coautor: ${p.aluno2.nome}`] : []),
      `Documento: ${type}`, '', 'Signatários previstos:',
      ...plan.signers.map(s => `${s.name}\n${s.email}\nPrioridade: ${s.order}`),
      '', 'Não assinado. Nenhum envelope foi criado ou enviado por este preparador.'
    ].join('\n');
    const pdf = createProfessionalPdf({title: `PILOTO — ${type}`, protocol: p.protocolo, body, institution: 'AMBIENTE DE HOMOLOGAÇÃO', course: 'Teste de integração Asten', footer: 'Fictício — não comprova defesa, publicação ou participação em banca'});
    const fileName = `${p.protocolo}-${type}.pdf`;
    await writeFile(directory + fileName, pdf, {mode: 0o600});
    documents.push({type, fileName, sha256: createHash('sha256').update(pdf).digest('hex'), plan, status: 'PREPARED_NOT_SENT'});
  }
  plans.push({process: p, documents});
}
const manifest = {generatedAt: new Date().toISOString(), destinationMailbox: email, status: 'PREPARED_NOT_SENT', externalEnvelopesCreated: 0, externalEmailsSent: 0, expectedNotificationsOnDispatch: 9, plans};
await writeFile(directory + 'manifest.json', JSON.stringify(manifest, null, 2), {mode: 0o600});
await writeFile(directory + 'LEIA-ME.md', `# Piloto Asten — preparação\n\nCaixa: ${email}\n\nDois cadastros preparados, um com autor único e outro com dois autores. Cada um possui ATA, TERMO e DECLARACAO. Os seis documentos são fictícios, sem validade acadêmica.\n\nATA: orientador. TERMO: autor(es) e orientador, todos na prioridade 1. DECLARACAO: presidente. São nove participações de assinatura previstas nos seis envelopes; o número de mensagens reais ainda depende do comportamento da Asten.\n\nEstado: PREPARADO, NÃO ENVIADO. Nenhum cadastro foi importado para o portal. Nenhum envelope foi criado. O manifest.json permite revisar todos os destinatários.\n\nPendências atuais: endereço HTTPS de retorno e segredo dedicado, método de autenticação de signatários, liberação restrita de piloto e integração Google Drive. O cadastro comum do portal também exige domínios institucionais; estes aliases Gmail devem ficar restritos ao ambiente de homologação.\n\nNão importar a massa dos 400 TCCs para um teste de envio. Não habilitar filas antigas. Não tratar assinaturas deste piloto como documentos acadêmicos oficiais.\n`, {mode: 0o600});
console.log(JSON.stringify({directory, preparedProcesses: plans.length, preparedDocuments: 6, expectedSignerParticipations: 9, envelopesCreated: 0}, null, 2));
