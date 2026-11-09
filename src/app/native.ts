// ¿Estamos dentro de la app Android (Capacitor) o en el navegador?
// Capacitor inyecta `window.Capacitor`; así no hace falta cargar su código en la web.
export function isNative(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/**
 * Dirección del servidor tal como la escribe una persona → URL usable.
 * «192.168.1.20:8787» → «http://192.168.1.20:8787»; quita la barra final.
 */
export function normalizeServer(input: string): string {
  const s = input.trim().replace(/\/+$/, '');
  if (!s) return s;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `http://${s}`;
}
