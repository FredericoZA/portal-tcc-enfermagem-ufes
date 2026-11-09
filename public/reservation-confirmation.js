/* GET only displays the page. The responsible person's selected action is sent once by POST. */
(() => {
  const feedback = document.getElementById('reservation-submit-feedback');
  if (!feedback) return;
  const status = feedback.querySelector('[role="status"]');
  const progress = feedback.querySelector('progress');
  let submitting = false;
  const forms = Array.from(document.querySelectorAll('form[data-reservation-response]'));
  async function register(form) {
    if (submitting) return;
    submitting = true;
    feedback.hidden = false;
    form.setAttribute('aria-busy', 'true');
    forms.forEach(item => item.querySelectorAll('button').forEach(button => { button.disabled = true; }));
    if (progress) { progress.hidden = false; progress.style.display = 'block'; progress.removeAttribute('value'); }
    if (status) status.textContent = 'Registrando sua resposta…';
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    function showLink(href, label) {
      const result = document.getElementById('reservation-result');
      if (!result) return;
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      result.replaceChildren(link);
      result.hidden = false;
    }
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new URLSearchParams(new FormData(form)),
        credentials: 'same-origin',
        signal: controller.signal,
      });
      const recorded = response.headers.get('X-Reservation-Decision');
      const saved = recorded
        ? { decision: recorded, receiptPath: form.action + '/receipt' }
        : response.ok ? await response.json() : null;
      if (saved?.decision !== 'CONFIRMED' && saved?.decision !== 'UNAVAILABLE') {
        throw new Error('Resultado não confirmado.');
      }
      showLink(saved.receiptPath, 'Baixar comprovante');
      const message = saved.decision === 'CONFIRMED' ? 'Reserva aceita' : 'Reserva recusada';
      if (status) status.textContent = message + '.';
      const title = document.querySelector('h1');
      if (title) title.textContent = message;
      document.title = message;
    } catch {
      if (status) status.textContent = 'Consulte o resultado para verificar se a resposta foi registrada.';
      showLink(form.action, 'Consultar reserva');
    } finally {
      window.clearTimeout(timeout);
      forms.forEach(item => { item.hidden = true; });
      if (progress) { progress.hidden = true; progress.style.display = 'none'; }
      form.removeAttribute('aria-busy');
    }
  }
  forms.forEach(form => form.addEventListener('submit', event => { event.preventDefault(); void register(form); }));
  const selected = forms.find(form => form.dataset.reservationAutoSubmit === 'true');
  if (selected) requestAnimationFrame(() => { void register(selected); });
})();
