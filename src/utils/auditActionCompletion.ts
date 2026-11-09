/** Refresh is only a readback; its failure must never repeat a completed operation. */
export async function finishAuditAction(input: {
  refresh?: () => Promise<void>;
  warn: (message: string) => void;
  release: () => void;
}): Promise<void> {
  try {
    await input.refresh?.();
  } catch {
    input.warn('Não foi possível atualizar este registro. O resultado da ação foi mantido; atualize a consulta antes de tentar novamente.');
  } finally {
    input.release();
  }
}
