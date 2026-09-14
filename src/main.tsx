import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './portal-overrides.css';
import './portal-design-system.css';

import { loadGlobalPopupStyle, saveGlobalPopupStyle } from './utils/portalAppearanceLinks';

try { saveGlobalPopupStyle(loadGlobalPopupStyle()); } catch { /* Defaults remain usable if browser storage is unavailable. */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
