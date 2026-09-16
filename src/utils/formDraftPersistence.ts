const PREFIX = 'portal_tcc_form_draft_v1:';
const SENSITIVE = /(password|senha|token|secret|segredo|otp|code|codigo|código|api[-_ ]?key|authorization)/i;

type DraftField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const placeholderOf = (el: DraftField) => el instanceof HTMLSelectElement ? '' : el.placeholder;

function fieldKey(el: DraftField, index: number) {
  return el.name || el.id || el.getAttribute('aria-label') || placeholderOf(el) || `field-${index}`;
}

function formKey(form: HTMLFormElement) {
  const explicit = form.id || form.getAttribute('aria-label') || form.getAttribute('data-draft-key');
  const action = form.getAttribute('action') || '';
  return `${PREFIX}${location.pathname}:${explicit || action || Array.from(document.forms).indexOf(form)}`;
}

function eligible(el: DraftField) {
  if (el.disabled) return false;
  if (el instanceof HTMLInputElement && ['password', 'file', 'hidden', 'submit', 'button', 'reset'].includes(el.type)) return false;
  const identity = `${el.name} ${el.id} ${el.getAttribute('aria-label') || ''} ${placeholderOf(el)}`;
  return !SENSITIVE.test(identity);
}

function snapshot(form: HTMLFormElement) {
  const fields = Array.from(form.querySelectorAll<DraftField>('input,textarea,select'));
  const data: Record<string, unknown> = {};
  fields.forEach((el, index) => {
    if (!eligible(el)) return;
    const key = fieldKey(el, index);
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) data[key] = el.checked;
    else data[key] = el.value;
  });
  return data;
}

function persist(form: HTMLFormElement) {
  try {
    const data = snapshot(form);
    if (Object.keys(data).length) localStorage.setItem(formKey(form), JSON.stringify({ savedAt: Date.now(), data }));
  } catch { /* autosave nunca pode interromper o formulário */ }
}

function restore(form: HTMLFormElement) {
  try {
    const raw = localStorage.getItem(formKey(form));
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || Date.now() - Number(parsed.savedAt || 0) > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(formKey(form));
      return;
    }
    const fields = Array.from(form.querySelectorAll<DraftField>('input,textarea,select'));
    fields.forEach((el, index) => {
      if (!eligible(el)) return;
      const key = fieldKey(el, index);
      if (!(key in parsed.data)) return;
      const value = parsed.data[key];
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) el.checked = Boolean(value);
      else el.value = String(value ?? '');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  } catch { /* rascunho inválido é simplesmente ignorado */ }
}

export function installFormDraftPersistence() {
  if (typeof window === 'undefined') return () => {};
  const restored = new WeakSet<HTMLFormElement>();
  const restoreVisibleForms = () => {
    document.querySelectorAll<HTMLFormElement>('form').forEach((form) => {
      if (restored.has(form)) return;
      restored.add(form);
      restore(form);
    });
  };
  restoreVisibleForms();
  const observer = new MutationObserver(restoreVisibleForms);
  observer.observe(document.body, { childList: true, subtree: true });
  let timer = 0;
  const onEdit = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    const form = target.form;
    if (!form || !eligible(target)) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => persist(form), 350);
  };
  const onSubmit = (event: Event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form) return;
    try { localStorage.removeItem(formKey(form)); } catch {}
  };
  document.addEventListener('input', onEdit, true);
  document.addEventListener('change', onEdit, true);
  document.addEventListener('submit', onSubmit, true);
  return () => {
    observer.disconnect();
    window.clearTimeout(timer);
    document.removeEventListener('input', onEdit, true);
    document.removeEventListener('change', onEdit, true);
    document.removeEventListener('submit', onSubmit, true);
  };
}
