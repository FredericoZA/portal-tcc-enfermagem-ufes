import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GitBranch } from 'lucide-react';
import { FluxoTccPage } from '../pages/FluxoTccPage';

const MODE_KEY = 'portal_public_guide_mode_v1';

export function PublicGuideNavigationEnhancer() {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [mainTarget, setMainTarget] = useState<HTMLElement | null>(null);
  const [tutorialPresent, setTutorialPresent] = useState(false);
  const [flowMode, setFlowMode] = useState(false);

  useEffect(() => {
    let frame = 0;

    const setGuideMode = () => {
      sessionStorage.removeItem(MODE_KEY);
      document.documentElement.dataset.portalGuideMode = 'guide';
      setFlowMode(false);
    };

    const sync = () => {
      const nav = document.getElementById('sidebar-nav');
      const replicateButton = document.getElementById('nav-item-replicar');
      let mount = document.getElementById('portal-flow-nav-slot');
      if (nav && replicateButton && !mount) {
        mount = document.createElement('div');
        mount.id = 'portal-flow-nav-slot';
        nav.insertBefore(mount, replicateButton);
      }
      setSlot(mount);
      setMainTarget(document.querySelector('main'));
      setTutorialPresent(Boolean(document.getElementById('portal-tutorial-page')));

      const tutorialButton = document.getElementById('nav-item-tutorial');
      if (tutorialButton && tutorialButton.dataset.portalFlowReset !== 'true') {
        tutorialButton.dataset.portalFlowReset = 'true';
        tutorialButton.addEventListener('click', setGuideMode);
      }

      document.querySelectorAll<HTMLElement>('#sidebar-nav button[id^="nav-item-"]').forEach((button) => {
        if (button.id === 'nav-item-tutorial' || button.dataset.portalFlowResetAll === 'true') return;
        button.dataset.portalFlowResetAll = 'true';
        button.addEventListener('click', setGuideMode);
      });
    };

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      document.getElementById('portal-flow-nav-slot')?.remove();
      delete document.documentElement.dataset.portalGuideMode;
    };
  }, []);

  const openFlow = () => {
    sessionStorage.setItem(MODE_KEY, 'flow');
    document.documentElement.dataset.portalGuideMode = 'flow';
    setFlowMode(true);
    window.dispatchEvent(new CustomEvent('portal:navigate', { detail: 'tutorial' }));
  };

  const active = flowMode && tutorialPresent;

  return (
    <>
      {slot && createPortal(
        <button
          id="nav-item-fluxo-tcc"
          type="button"
          onClick={openFlow}
          className={`portal-flow-nav-button ${active ? 'is-active' : ''}`}
          aria-current={active ? 'page' : undefined}
        >
          <span className="text-base shrink-0 leading-none" aria-hidden="true">🔀</span>
          <span>Fluxo completo do TCC</span>
        </button>,
        slot,
      )}

      {active && mainTarget && createPortal(
        <div id="portal-flow-page-portal" className="w-full">
          <FluxoTccPage />
        </div>,
        mainTarget,
      )}
    </>
  );
}
