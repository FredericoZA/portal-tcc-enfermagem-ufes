/** Read-only by default. --apply archives/verifies bytes and adds metadata only. */
import { createHash } from 'node:crypto';
import { buildSupabaseAdminHeaders, loadRuntimeImage, persistStudioRuntimeImage } from '../server/integrations/supabase';

const apply = process.argv.includes('--apply');
if (process.argv.slice(2).some(arg => arg !== '--apply')) throw new Error('Use sem opções para conferir ou --apply para arquivar sem apagar o legado.');
const database = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(database)) throw new Error('Informe a conexão Supabase revisada no ambiente de execução.');
if (!(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('Credencial privada ausente.');
const headers = buildSupabaseAdminHeaders();
const endpoint = database + '/rest/v1/portal_runtime_assets';
const response = await fetch(endpoint + '?select=asset_key,mime_type,byte_length&order=asset_key&limit=1000', { headers, signal: AbortSignal.timeout(15_000) });
if (!response.ok) throw new Error('Não foi possível listar os metadados das imagens.');
const inventory = await response.json() as Array<{ asset_key: string; mime_type: string; byte_length: number }>;
if (inventory.length >= 1000) throw new Error('A lista atingiu o limite de revisão; implemente paginação antes de prosseguir.');
console.log(JSON.stringify({ mode: apply ? 'archive-and-verify-preserve-legacy' : 'dry-run', assets: inventory.length, bytes: inventory.reduce((sum, item) => sum + Number(item.byte_length), 0) }));
for (const item of inventory) {
  if (!/^[a-f0-9]{64}$/.test(item.asset_key)) throw new Error('Chave de imagem inválida no inventário.');
  if (!apply) { console.log(JSON.stringify(item)); continue; }
  const row = await fetch(endpoint + `?asset_key=eq.${item.asset_key}&select=*&limit=1`, { headers, signal: AbortSignal.timeout(15_000) });
  if (!row.ok) throw new Error('Falha ao conferir a imagem antes da migração.');
  const current = (await row.json() as Array<{ data_url?: string | null; drive_file_id?: string | null }>)[0];
  if (!current) throw new Error('A imagem desapareceu durante a conferência.');
  if (!current.drive_file_id) {
    if (!current.data_url || createHash('sha256').update(current.data_url).digest('hex') !== item.asset_key) throw new Error('A origem da imagem não corresponde à chave preservada.');
    await persistStudioRuntimeImage(current.data_url);
  }
  const verified = await loadRuntimeImage(item.asset_key);
  if (!verified || verified.bytes.length !== Number(item.byte_length) || verified.mimeType !== item.mime_type) throw new Error('A releitura do Drive não confirmou a imagem.');
  console.log(JSON.stringify({ asset_key: item.asset_key, mime_type: verified.mimeType, byte_length: verified.bytes.length, content_sha256: createHash('sha256').update(verified.bytes).digest('hex'), driveVerified: true, legacyBytesPreserved: true }));
}
