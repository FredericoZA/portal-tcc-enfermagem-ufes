import {extractAstenEnvelopeIdentity} from '../integrations/asten';

export type DeletionEnvelopeState = 'PENDING' | 'CANCELED' | 'EXPIRED' | 'PRESERVED' | 'PURGED' | 'REVIEW';

export interface DeletionEnvelope {
  id: string;
  repositoryId?: number;
  folderId?: number;
  hash?: string;
  signerCount?: number;
  hasKnownSignature?: boolean;
  state: DeletionEnvelopeState;
  reason?: string;
  cancelRequestedAt?: string;
  purgeRequired?: boolean;
  purgeRequestedAt?: string;
}

interface AstenDeletionPorts {
  repositoryId: number;
  read: (id: string) => Promise<unknown>;
  readSigners: (id: string) => Promise<unknown>;
  cancel?: (id: string) => Promise<unknown>;
  purge?: (id: string) => Promise<unknown>;
  persist: () => Promise<void>;
}

interface EnvelopeDetails {
  Envelope?: { id?: string | number; status?: string | number; hashSHA256?: string };
  status?: string | number;
  statusEnvelope?: string | number;
  Repositorio?: { id?: string | number };
  Pasta?: { id?: string | number };
  hashSHA256?: string;
}

function signaturesExplicitlyPending(response: unknown, envelope: DeletionEnvelope): boolean {
  const result = response as { data?: unknown } | null;
  const data = (result?.data ?? result) as { listaSignatariosEnvelope?: { SignatarioEnvelope?: unknown } } | null;
  const flat = Array.isArray(data);
  const listed = flat ? data : data?.listaSignatariosEnvelope?.SignatarioEnvelope;
  const signers = Array.isArray(listed) ? listed : listed ? [listed] : [];
  const seenIds = new Set<string>();
  return signers.length > 0 && signers.length === envelope.signerCount && signers.every(value => {
    if (!value || typeof value !== 'object') return false;
    const signer = value as Record<string, unknown> & { Envelope?: { id?: unknown } };
    if ((flat || signer.Envelope) && String(signer.Envelope?.id) !== envelope.id) return false;
    if (flat) {
      const id = String(signer.id ?? '');
      if (!/^[1-9][0-9]{0,23}$/.test(id) || seenIds.has(id) || !['1', '2'].includes(String(signer.status))) return false;
      seenIds.add(id);
    }
    if (signer.dataAssinatura || signer.dataHoraAssinatura || signer.dhAssinatura || signer.signedAt || signer.momentoAssinatura) return false;
    const signed = signer.assinado ?? signer.assinaturaRealizada ?? signer.signed;
    if (signed !== undefined && ![false, 'N', 'n'].includes(signed as boolean | string)) return false;
    const status = String(signer.statusAssinatura ?? signer.situacaoAssinatura ?? signer.status ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    return ['1', '2', 'pendente', 'aguardando', 'nao assinado', 'nao assinou'].includes(status) || (!status && signed === false);
  });
}

/** Reconcile the recorded envelope. A timeout can never cause a second cancel. */
export async function reconcileDeletedAstenEnvelope(envelope: DeletionEnvelope, ports: AstenDeletionPorts): Promise<void> {
  const update = (state: DeletionEnvelopeState, reason?: string) => {
    envelope.state = state;
    envelope.reason = reason;
  };
  if (envelope.state !== 'PENDING' && envelope.state !== 'REVIEW') return;
  if (!/^[1-9][0-9]{0,23}$/.test(envelope.id)) {
    update('REVIEW', 'O identificador legado do envelope não pode ser consultado pela integração.');
    return;
  }

  let status: number;
  let ownershipVerified: boolean;
  try {
    const response = await ports.read(envelope.id) as (EnvelopeDetails & {data?: EnvelopeDetails}) | null;
    const details = response?.data ?? response;
    const source = details?.Envelope;
    const providerRepositoryId = Number(details?.Repositorio?.id);
    if (providerRepositoryId !== ports.repositoryId) {
      update('REVIEW', 'A Asten não confirmou a identidade do envelope no repositório conectado.');
      return;
    }
    const identity = extractAstenEnvelopeIdentity(details);
    if (identity.id !== envelope.id) {
      update('REVIEW', 'A Asten não confirmou a identidade do envelope no repositório conectado.');
      return;
    }
    status = Number(source?.status ?? details?.statusEnvelope ?? details?.status);
    const hash = String(source?.hashSHA256 || identity.hash || '').toLowerCase();
    ownershipVerified = envelope.repositoryId === providerRepositoryId
      && Number.isSafeInteger(envelope.folderId) && envelope.folderId === Number(details?.Pasta?.id)
      && !!envelope.hash && hash === envelope.hash.toLowerCase();
  } catch {
    update('PENDING', 'A Asten não confirmou o estado do envelope. A consulta será tentada novamente.');
    return;
  }

  if (envelope.purgeRequired) {
    if (!ownershipVerified) { update('REVIEW', 'O vínculo exclusivo do envelope com o TCC não pôde ser validado.'); return; }
    if (!ports.purge) { update('REVIEW', 'O expurgo do envelope aguarda a conexão autorizada com a ASTEN.'); return; }
    if (envelope.purgeRequestedAt) {
      update('REVIEW', 'O expurgo anterior não teve confirmação persistida. Confira o resultado na ASTEN antes de outra ação.');
      return;
    }
    if (![1, 2, 3, 4, 5, 6].includes(status)) { update('REVIEW', 'A ASTEN retornou um estado sem tratamento de expurgo.'); return; }
    if (status === 2) {
      if (!ports.cancel) { update('REVIEW', 'O cancelamento prévio do envelope aguarda autorização da ASTEN.'); return; }
      if (envelope.cancelRequestedAt) { update('PENDING', 'O cancelamento anterior ainda não foi confirmado pela ASTEN.'); return; }
      envelope.cancelRequestedAt = new Date().toISOString();
      update('PENDING', 'Aguardando cancelamento para excluir o envelope na ASTEN.');
      await ports.persist();
      try { await ports.cancel(envelope.id); } catch { return; }
      // Read the provider again: cancellation alone is not deletion.
      await reconcileDeletedAstenEnvelope(envelope, ports);
      return;
    }
    envelope.purgeRequestedAt = new Date().toISOString();
    update('PENDING', 'Aguardando confirmação de exclusão definitiva pela ASTEN.');
    await ports.persist();
    try {
      // Official docapi: expurgarEnvelope({idEnvelope}); only an explicit
      // success notice proves deletion. Missing/denied reads never prove it.
      const result = await ports.purge(envelope.id) as {data?: {listaAvisos?: {aviso?: unknown}}; listaAvisos?: {aviso?: unknown}} | null;
      const listed = (result?.data ?? result)?.listaAvisos?.aviso;
      const notices = Array.isArray(listed) ? listed : listed ? [listed] : [];
      const types = notices.map(value => String((value as {tipo?: unknown})?.tipo || '').toUpperCase());
      if (!types.includes('S') || types.includes('E')) throw new Error('Unconfirmed purge');
    } catch {
      update('REVIEW', 'A exclusão definitiva do envelope não foi confirmada. Confira o resultado na ASTEN antes de outra ação.');
      return;
    }
    update('PURGED', 'A ASTEN confirmou a exclusão definitiva do envelope.');
    await ports.persist();
    return;
  }
  if (status === 3) { update('PRESERVED', 'A Asten confirmou a conclusão do envelope.'); return; }
  if (status === 4) { update('PRESERVED', 'A Asten confirmou que o envelope já está arquivado.'); return; }
  if (status === 5) { update('CANCELED'); return; }
  if (status === 6) { update('EXPIRED'); return; }
  if (status !== 2) { update('REVIEW', 'A Asten retornou um estado sem tratamento automático.'); return; }
  if (envelope.hasKnownSignature) { update('REVIEW', 'Há registro de assinatura parcial. O envelope exige conferência institucional.'); return; }
  if (!ownershipVerified) { update('REVIEW', 'O vínculo exclusivo do envelope com o TCC não pôde ser validado.'); return; }
  if (!ports.cancel) { update('REVIEW', 'O cancelamento de envelopes não está autorizado para esta instalação.'); return; }
  if (envelope.cancelRequestedAt) {
    update('PENDING', 'O cancelamento anterior ainda não foi confirmado pela Asten. O Portal só repetirá a consulta.');
    return;
  }

  try {
    if (!signaturesExplicitlyPending(await ports.readSigners(envelope.id), envelope)) {
      update('REVIEW', 'A Asten não confirmou que todos os signatários estão sem assinatura.');
      return;
    }
  } catch {
    update('PENDING', 'A Asten não confirmou o estado dos signatários. A consulta será tentada novamente.');
    return;
  }

  // Commit the attempt marker before calling the provider. A retry may only
  // read its outcome, including when the worker stopped after the POST.
  envelope.cancelRequestedAt = new Date().toISOString();
  update('PENDING', 'Aguardando a confirmação do cancelamento pela Asten.');
  await ports.persist();
  try {
    await ports.cancel(envelope.id);
  } catch {
    return;
  }
  await reconcileDeletedAstenEnvelope(envelope, ports);
}
