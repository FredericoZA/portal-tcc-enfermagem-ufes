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
    if (status) status.textContent = 'Registrando sua resposta e preparando o comprovante…';
    try {
      const response = await fetch(form.action, { method: 'POST', body: new URLSearchParams(new FormData(form)), credentials: 'same-origin', redirect: 'follow' });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/pdf')) {
        throw new Error('Não foi possível concluir o comprovante. Sua resposta pode já estar registrada; tente consultar novamente.');
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error('O comprovante não foi recebido. Tente consultar novamente.');
      const url = URL.createObjectURL(blob);
      const fileName = response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/i)?.[1] || 'comprovante-de-reserva.pdf';
      const download = document.createElement('a');
      download.href = url; download.download = fileName; download.textContent = 'Baixar comprovante';
      const result = document.getElementById('reservation-result');
      if (result) { result.replaceChildren(download); result.hidden = false; }
      download.click();
      if (status) status.textContent = form.elements.namedItem('decision')?.value === 'decline' ? 'Recusa registrada. O comprovante foi preparado e os envolvidos serão avisados por e-mail.' : 'Reserva confirmada. O comprovante foi preparado e os envolvidos serão avisados por e-mail.';
      const title = document.querySelector('h1'); if (title) title.textContent = '✅ Resposta registrada';
      forms.forEach(item => { item.hidden = true; });
      if (progress) { progress.value = 100; progress.max = 100; progress.hidden = true; progress.style.display = 'none'; }
      window.addEventListener('pagehide', () => URL.revokeObjectURL(url), { once: true });
    } catch (error) {
      if (status) status.textContent = error.message || 'Não foi possível concluir. Tente novamente.';
      if (progress) { progress.hidden = true; progress.style.display = 'none'; }
      submitting = false;
      forms.forEach(item => { item.hidden = false; item.querySelectorAll('button').forEach(button => { button.disabled = false; button.textContent = 'Tentar novamente'; }); });
    } finally { form.removeAttribute('aria-busy'); }
  }
  forms.forEach(form => form.addEventListener('submit', event => { event.preventDefault(); void register(form); }));
  const selected = forms.find(form => form.dataset.reservationAutoSubmit === 'true');
  if (selected) requestAnimationFrame(() => { void register(selected); });
})();
