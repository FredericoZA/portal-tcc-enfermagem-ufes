import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PortalUiEnhancer } from './components/PortalUiEnhancer';
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

import { loadGlobalPopupStyle, saveGlobalPopupStyle } from './utils/portalAppearanceLinks';

try { saveGlobalPopupStyle(loadGlobalPopupStyle()); } catch { /* Defaults remain usable if browser storage is unavailable. */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PortalUiEnhancer />
  </StrictMode>,
);