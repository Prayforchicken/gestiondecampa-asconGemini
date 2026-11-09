// Punto de entrada: crea el almacén del hogar y pinta la app.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { HouseholdStore, browserKV } from './app/store';
import './styles/base.css';
import './styles/app.css';

const store = new HouseholdStore(browserKV());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
);

// Modo app instalable y uso sin conexión (solo en la versión compilada y en HTTPS o localhost).
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Sin modo offline:', e));
  });
}
