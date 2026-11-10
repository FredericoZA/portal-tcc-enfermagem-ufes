/** Hydrate old drafts without hiding the effective reservation address. */
export function reservationRecipientField(value:unknown, fallback:unknown):string {
  const current=String(value||'');
  return !current.trim()||/^\s*(?:\{\{|<<)\s*DEPARTAMENTO_EMAIL\s*(?:\}\}|>>)\s*$/i.test(current)
    ?String(fallback||'').trim().toLowerCase():current;
}
