import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PortalErrorBoundary } from './components/PortalErrorBoundary';
import { PortalSpreadsheetRuntime } from './components/PortalSpreadsheetRuntime';
import './index.css';
import { installAuthRequestResilience } from './utils/authRequestResilience';

installAuthRequestResilience();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PortalErrorBoundary>
      <App />
      <PortalSpreadsheetRuntime />
    </PortalErrorBoundary>
  </StrictMode>,
);
