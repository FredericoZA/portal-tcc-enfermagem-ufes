import { callAsten, getPersistentAstenConnection } from './asten';
import { loadIntegrationSecret, saveIntegrationSecret } from './integrationSecrets';

// Contratos oficiais: https://plataforma.astenassinatura.com.br/docapi
// getPastasDoRepositorio, getDadosPasta e inserirEnvelope: Envelope.Pasta.id.
export const ASTEN_DOCUMENT_FOLDER_TYPES = ['ATA', 'TERMO', 'DECLARACAO'] as const;
export type AstenDocumentFolderType = typeof ASTEN_DOCUMENT_FOLDER_TYPES[number];
export type AstenDocumentFolderMapping = Record<AstenDocumentFolderType, number>;
export interface AstenFolder { id: number; name: string; }
export interface AstenDocumentFoldersStatus {
  configured: boolean;
  repositoryId: number | null;
  folders: AstenFolder[];
  mapping: Partial<AstenDocumentFolderMapping>;
  missingTypes: AstenDocumentFolderType[];
  issues: string[];
  updatedAt?: string;
}

type Connection = NonNullable<Awaited<ReturnType<typeof getPersistentAstenConnection>>>;
const SECRET_PROVIDER = 'asten_document_folders';

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function positiveId(value: unknown, message: string): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value))) throw new Error(message);
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(message);
  return id;
}

function unwrapResponse(value: unknown): unknown {
  return record(value) && Object.hasOwn(value, 'response') ? value.response : value;
}

function portalOrigin(): string {
  try {
    const url = new URL(String(process.env.PORTAL_PUBLIC_URL || process.env.APP_URL || ''));
    if (url.username || url.password || !['https:', 'http:'].includes(url.protocol) ||
      ((process.env.NODE_ENV === 'production' || process.env.VERCEL) && url.protocol !== 'https:')) throw new Error();
    return url.origin;
  } catch {
    throw new Error('Configure a origem válida do Portal antes de selecionar as pastas Asten.');
  }
}

function validateConnection(connection: Connection): Connection {
  positiveId(connection.repositoryId, 'O repositório Asten conectado é inválido.');
  positiveId(connection.identifier, 'O proprietário Asten conectado é inválido.');
  return connection;
}

async function requiredConnection(): Promise<Connection> {
  const connection = await getPersistentAstenConnection();
  if (!connection) throw new Error('Conecte a conta Asten antes de selecionar as pastas de documentos.');
  return validateConnection(connection);
}

export function parseAstenFolders(response: unknown, repositoryId: number): AstenFolder[] {
  const expectedRepository = positiveId(repositoryId, 'Repositório Asten inválido.');
  const rows = unwrapResponse(response);
  if (!Array.isArray(rows) || rows.length > 5000) throw new Error('A Asten não retornou uma lista de pastas válida.');
  const ids = new Set<number>();
  return rows.map((row) => {
    if (!record(row) || !record(row.Repositorio)) throw new Error('A Asten retornou uma pasta sem repositório válido.');
    const id = positiveId(row.id, 'A Asten retornou um ID de pasta inválido.');
    if (positiveId(row.Repositorio.id, 'A Asten retornou um repositório de pasta inválido.') !== expectedRepository) throw new Error('A Asten retornou uma pasta de outro repositório.');
    if (ids.has(id)) throw new Error('A Asten retornou IDs de pasta duplicados.');
    ids.add(id);
    const name = typeof row.nome === 'string' ? row.nome.trim() : '';
    if (!name || name.length > 300 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error('A Asten retornou um nome de pasta inválido.');
    return { id, name };
  });
}

function parseMapping(input: unknown): AstenDocumentFolderMapping {
  if (!record(input) || Object.keys(input).length !== ASTEN_DOCUMENT_FOLDER_TYPES.length ||
    Object.keys(input).some((key) => !(ASTEN_DOCUMENT_FOLDER_TYPES as readonly string[]).includes(key))) throw new Error('Selecione uma pasta para ata, termo e declaração de banca.');
  const mapping = Object.fromEntries(ASTEN_DOCUMENT_FOLDER_TYPES.map((type) => [type, positiveId(input[type], `Selecione uma pasta Asten válida para ${type}.`)])) as AstenDocumentFolderMapping;
  if (new Set(Object.values(mapping)).size !== ASTEN_DOCUMENT_FOLDER_TYPES.length) throw new Error('Selecione uma pasta Asten diferente para cada tipo de documento.');
  return mapping;
}

async function listFolders(connection: Connection): Promise<AstenFolder[]> {
  return parseAstenFolders(await callAsten('getPastasDoRepositorio', { idRepositorio: connection.repositoryId }, connection.token), connection.repositoryId);
}

async function validateFolder(connection: Connection, folderId: number): Promise<void> {
  const expectedFolder = positiveId(folderId, 'A pasta Asten informada é inválida.');
  const data = unwrapResponse(await callAsten('getDadosPasta', { idPasta: expectedFolder }, connection.token));
  if (!record(data) || !record(data.Repositorio) || !record(data.Repositorio.Usuario) ||
    positiveId(data.id, 'A Asten não confirmou o ID da pasta.') !== expectedFolder ||
    positiveId(data.Repositorio.id, 'A Asten não confirmou o repositório da pasta.') !== connection.repositoryId ||
    positiveId(data.Repositorio.Usuario.id, 'A Asten não confirmou o proprietário da pasta.') !== Number(connection.identifier)) {
    throw new Error('A pasta Asten não pertence ao repositório e ao proprietário conectados.');
  }
}

async function loadMapping(connection: Connection): Promise<{ mapping: AstenDocumentFolderMapping; updatedAt?: string } | null> {
  const stored = await loadIntegrationSecret(SECRET_PROVIDER);
  if (!stored) return null;
  const origin = portalOrigin();
  let data: unknown;
  try { data = JSON.parse(stored.value); } catch { throw new Error('A configuração das pastas Asten é inválida.'); }
  if (!record(data) || data.version !== 1 || stored.metadata.validatedContractVersion !== 1 ||
    data.portalOrigin !== origin || stored.metadata.portalOrigin !== origin ||
    data.repositoryId !== connection.repositoryId || stored.metadata.repositoryId !== connection.repositoryId ||
    data.identifier !== connection.identifier || stored.metadata.identifier !== connection.identifier) {
    throw new Error('As pastas Asten pertencem a outra instalação, conta ou repositório. Selecione os destinos novamente.');
  }
  return { mapping: parseMapping(data.mapping), updatedAt: stored.updatedAt };
}

export async function getAstenDocumentFolders(): Promise<AstenDocumentFoldersStatus> {
  const connection = await getPersistentAstenConnection();
  const base: AstenDocumentFoldersStatus = { configured: false, repositoryId: null, folders: [], mapping: {}, missingTypes: [...ASTEN_DOCUMENT_FOLDER_TYPES], issues: [] };
  if (!connection) return { ...base, issues: ['Conecte a conta Asten para selecionar as pastas de documentos.'] };
  validateConnection(connection);
  const folders = await listFolders(connection);
  try {
    const stored = await loadMapping(connection);
    if (!stored) return { ...base, repositoryId: connection.repositoryId, folders, issues: ['Selecione as pastas Asten para ata, termo e declaração de banca.'] };
    const missingTypes = ASTEN_DOCUMENT_FOLDER_TYPES.filter((type) => !folders.some((folder) => folder.id === stored.mapping[type]));
    return { configured: missingTypes.length === 0, repositoryId: connection.repositoryId, folders, mapping: stored.mapping, missingTypes, issues: missingTypes.length ? ['Uma pasta Asten selecionada não está mais disponível no repositório. Selecione os destinos novamente.'] : [], updatedAt: stored.updatedAt };
  } catch (error) {
    return { ...base, repositoryId: connection.repositoryId, folders, issues: [error instanceof Error ? error.message : 'Não foi possível validar as pastas Asten.'] };
  }
}

export async function saveAstenDocumentFolders(input: unknown): Promise<AstenDocumentFoldersStatus> {
  const mapping = parseMapping(input);
  const connection = await requiredConnection();
  const origin = portalOrigin();
  const folders = await listFolders(connection);
  if (Object.values(mapping).some((id) => !folders.some((folder) => folder.id === id))) throw new Error('Escolha somente pastas disponíveis no repositório Asten conectado.');
  await Promise.all(Object.values(mapping).map((id) => validateFolder(connection, id)));
  const updatedAt = new Date().toISOString();
  await saveIntegrationSecret(SECRET_PROVIDER, JSON.stringify({ version: 1, portalOrigin: origin, repositoryId: connection.repositoryId, identifier: connection.identifier, mapping }), {
    validatedContractVersion: 1, portalOrigin: origin, repositoryId: connection.repositoryId, identifier: connection.identifier, updatedAt
  });
  return { configured: true, repositoryId: connection.repositoryId, folders, mapping, missingTypes: [], issues: [], updatedAt };
}

// Jobs existentes conservam o destino que foi fixado na criação, mesmo após
// o Master escolher novas pastas para os próximos envelopes.
export async function validateAstenDocumentFolder(folderId: number, repositoryId: number): Promise<void> {
  const connection = await requiredConnection();
  if (positiveId(repositoryId, 'O repositório Asten do documento é inválido.') !== connection.repositoryId) throw new Error('O documento pertence a outro repositório Asten.');
  await validateFolder(connection, folderId);
}

export async function resolveAstenDocumentFolder(type: AstenDocumentFolderType): Promise<number> {
  if (!(ASTEN_DOCUMENT_FOLDER_TYPES as readonly string[]).includes(type)) throw new Error('Tipo de documento sem destino Asten de assinatura.');
  const connection = await requiredConnection();
  const stored = await loadMapping(connection);
  if (!stored) throw new Error('Selecione as pastas Asten de ata, termo e declaração antes de enviar documentos.');
  const folderId = stored.mapping[type];
  if (!(await listFolders(connection)).some((folder) => folder.id === folderId)) throw new Error('A pasta Asten deste documento não está mais disponível no repositório.');
  await validateFolder(connection, folderId);
  return folderId;
}
