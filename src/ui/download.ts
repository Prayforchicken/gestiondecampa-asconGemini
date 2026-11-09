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
