import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PortalSpreadsheetRuntime } from './components/PortalSpreadsheetRuntime';
import './index.css';
import { installAuthRequestResilience } from './utils/authRequestResilience';

installAuthRequestResilience();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PortalSpreadsheetRuntime />
  </StrictMode>,
);
