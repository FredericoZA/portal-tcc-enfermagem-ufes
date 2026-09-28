import fs from 'node:fs';

function patch(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) return false;
  fs.writeFileSync(path, after);
  console.log(`patched ${path}`);
  return true;
}

patch('server.ts', (source) => source.replace(
  "    if(processesStore.some(p=>[p.aluno1.email,p.aluno2?.email].includes(email)))return res.status(409).json({error:'Você já tem um TCC. Continue pelo processo existente.'});\n",
  ''
));

patch('src/components/AuthorizedStudentsPanel.tsx', (source) => {
  let next = source.replace(/\n  X,\n/, '\n');
  next = next.replace(
    "function CompactModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {\n  if (typeof document === 'undefined') return null;",
    "function CompactModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {\n  useEffect(() => {\n    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };\n    window.addEventListener('keydown', closeOnEscape);\n    return () => window.removeEventListener('keydown', closeOnEscape);\n  }, [onClose]);\n  if (typeof document === 'undefined') return null;"
  );
  next = next.replace(
    "        <div className=\"flex items-center justify-between border-b-[16px] border-white px-3 py-2 text-white\" style={{ backgroundColor: 'var(--portal-green-header)' }}>\n          <h3 className=\"text-xs font-black uppercase tracking-wide\">{title}</h3>\n          <button type=\"button\" onClick={onClose} className=\"rounded-md border border-white bg-white p-1 text-slate-900 hover:bg-slate-100\" aria-label=\"Fechar\"><X className=\"h-4 w-4\" /></button>\n        </div>",
    "        <div className=\"border-b-[16px] border-white px-3 py-2 text-white\" style={{ backgroundColor: 'var(--portal-green-header)' }}>\n          <h3 className=\"text-xs font-black uppercase tracking-wide\">{title}</h3>\n        </div>"
  );
  return next;
});

patch('src/components/IntegrationStudioPanel.tsx', (source) => {
  const effective = "emailTemplates.map((email) => email.id === 'email-reserva' ? { ...email, recipient: '{{DEPARTAMENTO_EMAIL}}', subject: operationalConfig.reservation.emailSubject || email.subject, body: operationalConfig.reservation.emailBody || email.body } : email)";
  return source
    .replace(
      'emailTemplates: emailTemplates as unknown as Array<Record<string, unknown>>,',
      `emailTemplates: ${effective} as unknown as Array<Record<string, unknown>>,`
    )
    .replace(
      'emailTemplates: emailTemplates as unknown as Array<Record<string, unknown>>,',
      `emailTemplates: ${effective} as unknown as Array<Record<string, unknown>>,`
    );
});
