// Descargar un archivo generado en el navegador (copias JSON, calendario .ics...).
export function download(name: string, data: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lee un archivo elegido por el usuario como texto. */
export function readFile(file: File): Promise<string> {
  return new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result ?? ''));
    r.onerror = () => ko(Error('No se pudo leer el archivo.'));
    r.readAsText(file);
  });
}

/**
 * Copia texto al portapapeles. En páginas no seguras (http://IP de casa) no existe
 * `navigator.clipboard`: usamos el método antiguo con un cuadro de texto temporal.
 */
export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((ok, ko) => {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const done = document.execCommand('copy');
    area.remove();
    if (done) ok();
    else ko(Error('No se pudo copiar'));
  });
}
