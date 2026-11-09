// Punto de entrada: crea el almacén del hogar y pinta la app.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { HouseholdStore, browserKV } from './app/store';
import { Profiles } from './app/profiles';
import { isNative } from './app/native';
import './styles/base.css';
import './styles/app.css';

// Cada hogar del dispositivo tiene su propio almacén. Al cambiar de hogar se recarga la app.
const profiles = new Profiles(browserKV());
const store = new HouseholdStore(profiles.kvFor(profiles.active));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} profiles={profiles} />
  </StrictMode>,
);

// Modo app instalable y uso sin conexión (web compilada en HTTPS o localhost).
// En la app Android no hace falta: la web ya va dentro de la APK.
if (import.meta.env.PROD && !isNative() && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Sin modo offline:', e));
  });
}
