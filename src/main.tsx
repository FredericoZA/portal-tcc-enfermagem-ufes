import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PortalUiEnhancer } from './components/PortalUiEnhancer';
import { PortalSpreadsheetEnhancer } from './components/PortalSpreadsheetEnhancer';
import { PortalVersion1040Enhancer } from './components/PortalVersion1040Enhancer';
import PortalVersion1041Enhancer from './components/PortalVersion1041Enhancer';
import PortalVersion1041AdminModals from './components/PortalVersion1041AdminModals';
import './index.css';
import './portal-overrides.css';
import './portal-design-system.css';
import './portal-final-fixes.css';
import './portal-update-20.css';
import './portal-update-21.css';
import './portal-update-22.css';
import './portal-update-23.css';
import './portal-update-24.css';
import './portal-update-25.css';
import './portal-update-26.css';
import './portal-update-27.css';
import './portal-update-32.css';
import './portal-update-33.css';
import './portal-finalization.css';
import './portal-update-38.css';
import './portal-update-39.css';
import './portal-update-40.css';
import './portal-update-42.css';
import './portal-update-43.css';
import './portal-version-1040.css';
import './portal-version-1041.css';
import { loadGlobalPopupStyle, saveGlobalPopupStyle } from './utils/portalAppearanceLinks';
import { installAuthRequestResilience } from './utils/authRequestResilience';

try { saveGlobalPopupStyle(loadGlobalPopupStyle()); } catch {}
installAuthRequestResilience();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PortalUiEnhancer />
    <PortalSpreadsheetEnhancer />
    <PortalVersion1040Enhancer />
    <PortalVersion1041Enhancer />
    <PortalVersion1041AdminModals />
  </StrictMode>,
);
