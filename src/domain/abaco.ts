// Clasificación de artículos por rayón / familia / subfamilia.
//
// La app funciona con una lista básica de rayones (DEFAULT_RAYONS). Si importas la
// estructura completa (por ejemplo, el export SQL de TablePlus de «abaco_estructura»),
// se guarda en el dispositivo y se comparte con el hogar a través del servidor.
// La estructura importada NO se guarda en el repositorio: es información interna.
import type { Place } from './types';

export type AbacoSub = { code: string; name: string };
export type AbacoFamily = { code: string; name: string; subs: AbacoSub[] };
export type AbacoRayon = { code: number; name: string; dept: string; families: AbacoFamily[] };
export type AbacoTree = {
  version: 1;
  importedAt: string;
  departments: { code: string; name: string }[];
  rayons: AbacoRayon[];
};

export type RayonInfo = { code: number; name: string; place: Place };

/** Nombres propios del hogar que sustituyen a los de la estructura (hogar vegano). */
export const RAYON_OVERRIDES: Record<number, string> = {
  21: 'Proteínas vegetales (seitán, tempeh, tofu)',
  24: 'Alternativas veganas y algas',
};

/** Rayones básicos para usar la app sin importar nada. */
export const DEFAULT_RAYONS: RayonInfo[] = [
  { code: 11, name: 'Alimentación seca', place: 'Despensa' },
  { code: 12, name: 'Líquidos', place: 'Despensa' },
  { code: 13, name: 'Congelados', place: 'Congelador' },
  { code: 14, name: 'Droguería', place: 'Hogar' },
  { code: 15, name: 'Perfumería e higiene', place: 'Hogar' },
  { code: 16, name: 'Bollería y pan envasado', place: 'Despensa' },
  { code: 20, name: 'Pastelería', place: 'Nevera' },
  { code: 21, name: RAYON_OVERRIDES[21], place: 'Nevera' },
  { code: 22, name: 'Charcutería envasada', place: 'Nevera' },
  { code: 24, name: RAYON_OVERRIDES[24], place: 'Nevera' },
  { code: 25, name: 'Frutería', place: 'Nevera' },
  { code: 27, name: 'Cremería (yogures, postres, quesos)', place: 'Nevera' },
  { code: 28, name: 'Panadería', place: 'Despensa' },
  { code: 29, name: 'Leche, bebidas vegetales y huevos', place: 'Nevera' },
  { code: 41, name: 'Menaje', place: 'Hogar' },
  { code: 42, name: 'Bazar', place: 'Hogar' },
  { code: 44, name: 'Papelería', place: 'Hogar' },
  { code: 52, name: 'Pequeño electrodoméstico', place: 'Hogar' },
  { code: 54, name: 'Imagen y sonido', place: 'Hogar' },
];

export const FROZEN_SECTION = 13;

const ACRONYMS = new Set(['LS', 'L.S.', 'PGC', 'PAE', 'P.A.E.', 'EAN', 'UHT', 'DVD', 'TV', 'BIO', 'XL', 'XXL']);

/** «ALIMENTACION SECA» → «Alimentacion seca». Mantiene siglas como LS o P.A.E. */
export function sentenceCase(raw: string): string {
  const words = raw.trim().split(/\s+/).map((w) => (ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w.toLowerCase()));
  const s = words.join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Quita tildes y pasa a minúsculas para buscar sin preocuparse de acentos. */
export const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

type Row = Record<string, string>;
const COLUMNS = ['cod_departamento', 'desc_departamento', 'cod_rayon', 'desc_rayon', 'cod_familia', 'desc_familia', 'cod_subfamilia', 'desc_subfamilia'];

/** Lee filas de un export SQL (INSERT ... VALUES), un CSV con cabecera o un JSON (array de objetos). */
export function parseAbacoRows(text: string): Row[] {
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) {
    const data = JSON.parse(trimmed);
    if (!Array.isArray(data)) throw Error('El JSON debe ser una lista de filas.');
    return data.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? '')])));
  }
  if (/INSERT\s+INTO/i.test(trimmed)) return parseSql(trimmed);
  return parseCsv(trimmed);
}

function parseSql(text: string): Row[] {
  const rows: Row[] = [];
  // Cada sentencia: INSERT INTO "tabla" ("col1", "col2", ...) VALUES (...), (...);
  const statement = /INSERT\s+INTO\s+[^(]+\(([^)]*)\)\s*VALUES\s*/gi;
  let match: RegExpExecArray | null;
  while ((match = statement.exec(text))) {
    const columns = match[1].split(',').map((c) => c.trim().replace(/^["`[]|["`\]]$/g, ''));
    let i = statement.lastIndex;
    // Recorre las tuplas hasta el «;» final, respetando comillas simples ('' = comilla escapada).
    while (i < text.length) {
      while (i < text.length && /[\s,]/.test(text[i])) i++;
      if (text[i] !== '(') break;
      i++;
      const values: string[] = [];
      let current = '';
      let inString = false;
      for (; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
          if (ch === "'" && text[i + 1] === "'") {
            current += "'";
            i++;
          } else if (ch === "'") inString = false;
          else current += ch;
        } else if (ch === "'") inString = true;
        else if (ch === ',') {
          values.push(current.trim());
          current = '';
        } else if (ch === ')') {
          values.push(current.trim());
          i++;
          break;
        } else current += ch;
      }
      rows.push(Object.fromEntries(columns.map((c, k) => [c, values[k] === 'NULL' ? '' : values[k] ?? ''])));
    }
    statement.lastIndex = i;
  }
  return rows;
}

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw Error('No se han encontrado filas.');
  const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const split = (line: string) => line.split(sep).map((v) => v.trim().replace(/^"|"$/g, ''));
  const header = split(lines[0]);
  return lines.slice(1).map((l) => {
    const v = split(l);
    return Object.fromEntries(header.map((h, k) => [h, v[k] ?? '']));
  });
}

const isNoise = (s: string) => /anomal|no utilizar|inconnu/i.test(s);

/** Construye el árbol. `departments` limita qué departamentos se guardan (por códigos). */
export function buildAbacoTree(rows: Row[], departments?: string[], importedAt = new Date().toISOString()): AbacoTree {
  if (!rows.length) throw Error('No se han encontrado filas.');
  const missing = COLUMNS.filter((c) => !(c in rows[0]));
  if (missing.length) throw Error('Faltan columnas: ' + missing.join(', '));
  const depts = new Map<string, string>();
  const rayons = new Map<number, AbacoRayon>();
  for (const r of rows) {
    if (isNoise(r.desc_rayon) || isNoise(r.desc_departamento)) continue;
    if (departments && !departments.includes(r.cod_departamento)) continue;
    const code = Number(r.cod_rayon);
    if (!Number.isFinite(code)) continue;
    depts.set(r.cod_departamento, sentenceCase(r.desc_departamento));
    let rayon = rayons.get(code);
    if (!rayon) {
      rayon = { code, name: RAYON_OVERRIDES[code] ?? sentenceCase(r.desc_rayon), dept: r.cod_departamento, families: [] };
      rayons.set(code, rayon);
    }
    if (!r.cod_familia || isNoise(r.desc_familia)) continue;
    let family = rayon.families.find((f) => f.code === r.cod_familia);
    if (!family) {
      family = { code: r.cod_familia, name: sentenceCase(r.desc_familia), subs: [] };
      rayon.families.push(family);
    }
    if (r.cod_subfamilia && !isNoise(r.desc_subfamilia) && !family.subs.some((s) => s.code === r.cod_subfamilia))
      family.subs.push({ code: r.cod_subfamilia, name: sentenceCase(r.desc_subfamilia) });
  }
  return {
    version: 1,
    importedAt,
    departments: [...depts].map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code)),
    rayons: [...rayons.values()].sort((a, b) => a.code - b.code),
  };
}

/** Resumen de departamentos de unas filas, para elegir cuáles importar. */
export function departmentSummary(rows: Row[]) {
  const map = new Map<string, { code: string; name: string; rows: number }>();
  for (const r of rows) {
    if (isNoise(r.desc_departamento)) continue;
    const d = map.get(r.cod_departamento) ?? { code: r.cod_departamento, name: sentenceCase(r.desc_departamento), rows: 0 };
    d.rows++;
    map.set(r.cod_departamento, d);
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** Lista de rayones disponibles: los importados o los básicos. */
export function rayonList(tree: AbacoTree | null): RayonInfo[] {
  if (!tree) return DEFAULT_RAYONS;
  return tree.rayons.map((r) => ({
    code: r.code,
    name: r.name,
    place: DEFAULT_RAYONS.find((d) => d.code === r.code)?.place ?? (r.dept === '02' ? 'Nevera' : r.dept === '01' ? 'Despensa' : 'Hogar'),
  }));
}

export function rayonName(tree: AbacoTree | null, code: number | undefined): string {
  if (code === undefined) return 'Sin clasificar';
  return (
    tree?.rayons.find((r) => r.code === code)?.name ??
    DEFAULT_RAYONS.find((r) => r.code === code)?.name ??
    `Rayón ${code}`
  );
}

export type AbacoMatch = { rayon: number; family?: string; subfamily?: string; path: string; label: string };

/** Búsqueda sin tildes en rayones, familias y subfamilias. */
export function searchAbaco(tree: AbacoTree | null, query: string, limit = 30): AbacoMatch[] {
  const q = normalize(query);
  if (!q) return [];
  const out: AbacoMatch[] = [];
  const rayons = tree?.rayons ?? DEFAULT_RAYONS.map((r) => ({ ...r, dept: '', families: [] as AbacoFamily[] }));
  for (const r of rayons) {
    if (normalize(r.name).includes(q)) out.push({ rayon: r.code, path: r.name, label: r.name });
    for (const f of r.families) {
      if (normalize(f.name).includes(q)) out.push({ rayon: r.code, family: f.code, path: `${r.name} › ${f.name}`, label: f.name });
      for (const s of f.subs)
        if (normalize(s.name).includes(q))
          out.push({ rayon: r.code, family: f.code, subfamily: s.code, path: `${r.name} › ${f.name}`, label: s.name });
      if (out.length >= limit * 3) break;
    }
  }
  // Primero las coincidencias que empiezan por el texto buscado.
  return out
    .sort((a, b) => Number(!normalize(a.label).startsWith(q)) - Number(!normalize(b.label).startsWith(q)))
    .slice(0, limit);
}

/** Ruta legible de un artículo clasificado. */
export function classificationPath(tree: AbacoTree | null, rayon: number, family?: string, subfamily?: string): string {
  const r = tree?.rayons.find((x) => x.code === rayon);
  const f = r?.families.find((x) => x.code === family);
  const s = f?.subs.find((x) => x.code === subfamily);
  return [rayonName(tree, rayon), f?.name, s?.name].filter(Boolean).join(' › ');
}
