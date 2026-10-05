import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PortalStructuralRuntime } from './components/PortalStructuralRuntime';
import { PortalSpreadsheetRuntime } from './components/PortalSpreadsheetRuntime';
import './index.css';
import { installAuthRequestResilience } from './utils/authRequestResilience';

installAuthRequestResilience();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PortalStructuralRuntime />
    <PortalSpreadsheetRuntime />
  </StrictMode>,
);
