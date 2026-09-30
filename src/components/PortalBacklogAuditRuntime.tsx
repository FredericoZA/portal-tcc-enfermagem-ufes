import { useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
import { createRoot, Root } from 'react-dom/client';

const injectedRoots = new WeakMap<Element, Root>();

function navigateToNewTcc() {
  window.dispatchEvent(new CustomEvent('portal:navigate', { detail: 'novo-processo' }));
}

function ensureNewTccAction() {
  const page = document.querySelector<HTMLElement>('#meus-processos-page-container');
  if (!page) return;

  /*
   * A regra atual do produto permite que um aluno participe de múltiplos TCCs.
   * Versões anteriores condicionavam a ação principal a roleCounts.ALUNO === 0.
   * Enquanto a tela antiga ainda estiver montada, este runtime canônico garante
   * que a ação de cadastro permaneça disponível independentemente da quantidade
   * de vínculos existentes, sem duplicar o botão nativo quando ele já existe.
   */
  if (page.querySelector('#meus-processos-btn-novo')) return;

  const filterRow = page.querySelector<HTMLElement>('.portal-meus-processos-filter-row');
  const titleRow = filterRow?.previousElementSibling as HTMLElement | null;
  const toolbarHost = titleRow?.lastElementChild as HTMLElement | null;
  if (!toolbarHost || toolbarHost.querySelector('.portal-backlog-new-tcc-button-host')) return;

  const host = document.createElement('div');
  host.className = 'portal-backlog-new-tcc-button-host flex items-center shrink-0 mr-3';
  toolbarHost.prepend(host);

  const root = createRoot(host);
  injectedRoots.set(host, root);
  root.render(
    <button
      id="meus-processos-btn-novo"
      type="button"
      onClick={navigateToNewTcc}
      className="portal-backlog-new-tcc-button inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-[10px] font-black uppercase tracking-wide shadow-sm"
      title="Cadastrar novo trabalho de TCC"
    >
      <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Cadastrar TCC</span>
    </button>,
  );
}

function removeLegacyFlowLabels() {
  document.querySelectorAll<HTMLElement>('#portal-sidebar .portal-sidebar-nav-item').forEach((item) => {
    if ((item.textContent || '').trim().toLocaleLowerCase('pt-BR').includes('fluxo completo do tcc')) item.remove();
  });
}

function reconcile() {
  ensureNewTccAction();
  removeLegacyFlowLabels();
}

export function PortalBacklogAuditRuntime() {
  useEffect(() => {
    reconcile();
    let frame = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reconcile);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.querySelectorAll('.portal-backlog-new-tcc-button-host').forEach((host) => {
        injectedRoots.get(host)?.unmount();
        host.remove();
      });
    };
  }, []);

  return null;
}
