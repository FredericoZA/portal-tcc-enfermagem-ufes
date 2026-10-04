import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PortalUiEnhancer } from './components/PortalUiEnhancer';
import { PortalVersion1040Enhancer } from './components/PortalVersion1040Enhancer';
import { PortalStructuralRuntime } from './components/PortalStructuralRuntime';
import { PortalTableTextPolicy } from './components/PortalTableTextPolicy';
import { PortalSpreadsheetRuntime } from './components/PortalSpreadsheetRuntime';
import { PortalSettingsRuntime } from './components/PortalSettingsRuntime';
import './index.css';
import { loadGlobalPopupStyle, saveGlobalPopupStyle } from './utils/portalAppearanceLinks';
import { installAuthRequestResilience } from './utils/authRequestResilience';

try { saveGlobalPopupStyle(loadGlobalPopupStyle()); } catch {}
installAuthRequestResilience();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PortalUiEnhancer />
    <PortalVersion1040Enhancer />
    <PortalStructuralRuntime />
    <PortalTableTextPolicy />
    <PortalSpreadsheetRuntime />
    <PortalSettingsRuntime />
  </StrictMode>,
);
