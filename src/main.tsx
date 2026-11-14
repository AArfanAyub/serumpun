import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './state/AppContext';
import './styles/global.css';

const container: HTMLElement | null = document.getElementById('root');
if (!container) {
  throw new Error('Serumpun could not start: #root element is missing from index.html.');
}

createRoot(container).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>
);

/**
 * Register the hand-written service worker for offline app-shell support.
 * Best-effort only: the bundled sample data already guarantees a full offline
 * recommendation, so a failed or unavailable registration never breaks the app.
 * Scoped to production to avoid stale caches during development.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    void navigator.serviceWorker.register(swUrl).catch(() => {
      // Intentionally silent: offline works without the worker via bundled samples.
    });
  });
}
