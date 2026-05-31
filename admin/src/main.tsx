import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@mantine/core/styles.css';
import './theme/globals.css';
import App from './App.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function showBootError(message: string) {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,sans-serif;background:#F9FAFB;color:#111827">
      <div style="max-width:480px;text-align:center">
        <h1 style="font-size:20px;margin-bottom:12px">Nie udało się załadować panelu</h1>
        <p style="color:#6B7280;line-height:1.5;margin-bottom:16px">${message}</p>
        <button onclick="location.reload()" style="padding:10px 20px;border:none;border-radius:8px;background:#6366F1;color:#fff;font-weight:600;cursor:pointer">
          Odśwież stronę
        </button>
      </div>
    </div>`;
}

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason?.message || String(reason || '');
  if (/Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed/i.test(msg)) {
    showBootError('Wersja aplikacji na serwerze jest nieaktualna. Odśwież stronę (Ctrl+Shift+R) lub poczekaj na zakończenie deployu.');
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
