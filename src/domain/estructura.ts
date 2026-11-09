// Lee la estructura de artículos (src/data/estructura.ts) y forma los códigos internos.
//
//   código de tipo     SSFFTT     6 dígitos  (sección + familia + tipo)
//   código interno     SSFFTTAAA  9 dígitos  (+ artículo)
//
// El EAN identifica el envase del fabricante; el código interno identifica qué ES el
// artículo para nosotros. Dos arroces integrales: EAN distintos, código casi igual.
import { ESTRUCTURA } from '../data/estructura';
import type { Place } from './types';

export type TypeNode = {
  code: string; // 6 dígitos
  name: string;
  synonyms: string[];
  protein: number | null;
  basis: string;
  family: FamilyNode;
};
export type FamilyNode = { code: string; full: string; name: string; place: Place; section: SectionNode; types: TypeNode[] };
export type SectionNode = { code: number; name: string; place: Place; dept: DeptNode; families: FamilyNode[] };
export type DeptNode = { code: number; name: string; sections: SectionNode[] };

const PLACES: Place[] = ['Nevera', 'Despensa', 'Congelador', 'Hogar'];

/** Sección de congelados: al planificar avisamos 12 horas antes. */
export const FROZEN_SECTION = 13;

/** Convierte el texto de la estructura en un árbol. Lanza un error claro si algo está mal. */
export function parseEstructura(text: string): DeptNode[] {
  const depts: DeptNode[] = [];
  let dept: DeptNode | undefined;
  let section: SectionNode | undefined;
  let family: FamilyNode | undefined;
  text.split('\n').forEach((raw, n) => {
    if (!raw.trim() || raw.trim().startsWith('#')) return;
    const m = raw.match(/^( *)(\d+) +(.+)$/);
    const where = `Línea ${n} de la estructura («${raw.trim()}»)`;
    if (!m) throw Error(`${where}: formato no reconocido.`);
    const level = m[1].length / 2;
    const code = m[2];
    let [name, ...extras] = m[3].split(' · ').map((s) => s.trim());
    let place: Place | undefined;
    const at = name.match(/^(.*?)\s+@(\w+)$/);
    if (at) {
      name = at[1];
      if (!PLACES.includes(at[2] as Place)) throw Error(`${where}: lugar desconocido @${at[2]}.`);
      place = at[2] as Place;
    }
    if (level === 0) {
      if (!/^\d$/.test(code)) throw Error(`${where}: el departamento lleva 1 dígito.`);
      dept = { code: Number(code), name, sections: [] };
      depts.push(dept);
    } else if (level === 1) {
      if (!dept || !/^\d\d$/.test(code) || code[0] !== String(dept.code)) throw Error(`${where}: la sección lleva 2 dígitos y empieza por su departamento.`);
      section = { code: Number(code), name, place: place ?? 'Despensa', dept, families: [] };
      dept.sections.push(section);
    } else if (level === 2) {
      if (!section || !/^\d\d$/.test(code)) throw Error(`${where}: la familia lleva 2 dígitos.`);
      family = { code, full: String(section.code) + code, name, place: place ?? section.place, section, types: [] };
      section.families.push(family);
    } else if (level === 3) {
      if (!family || !/^\d\d$/.test(code)) throw Error(`${where}: el tipo lleva 2 dígitos.`);
      let protein: number | null = null;
      let basis = '';
      const synonyms: string[] = [];
      for (const e of extras) {
        const p = e.match(/^prot +(\d+(?:[.,]\d+)?)(?: +(.+))?$/);
        if (p) {
          protein = Number(p[1].replace(',', '.'));
          basis = p[2] ?? '';
        } else synonyms.push(...e.split(',').map((s) => s.trim()).filter(Boolean));
      }
      family.types.push({ code: family.full + code, name, synonyms, protein, basis, family });
    } else throw Error(`${where}: sangría incorrecta (usa 2 espacios por nivel).`);
  });
  return depts;
}

export const DEPARTMENTS = parseEstructura(ESTRUCTURA);
export const SECTIONS = DEPARTMENTS.flatMap((d) => d.sections);
export const FAMILIES = SECTIONS.flatMap((s) => s.families);
export const TYPES = FAMILIES.flatMap((f) => f.types);
const TYPE_BY_CODE = new Map(TYPES.map((t) => [t.code, t]));

export const findType = (code: string | undefined) => (code ? TYPE_BY_CODE.get(code) : undefined);
export const findSection = (code: number | undefined) => SECTIONS.find((s) => s.code === code);

export function sectionName(code: number | undefined): string {
  if (code === undefined) return 'Sin sección';
  return findSection(code)?.name ?? `Sección ${code}`;
}

/** Lugar habitual de un tipo o de una sección. */
export const placeOf = (type?: string, section?: number): Place | undefined => findType(type)?.family.place ?? findSection(section)?.place;

/** «Alimentación seca › Arroces › Arroz integral». */
export function typePath(code: string | undefined): string {
  const t = findType(code);
  return t ? `${t.family.section.name} › ${t.family.name} › ${t.name}` : '';
}

/** 110202001 → «11.02.02.001»; 110202 → «11.02.02». */
export function formatCode(code: string | undefined | null): string {
  if (!code) return '';
  return [code.slice(0, 2), code.slice(2, 4), code.slice(4, 6), code.slice(6)].filter(Boolean).join('.');
}

/** Código interno completo de un artículo (o null si aún no está clasificado). */
export const internalCode = (i: { type?: string; article?: string }) => (i.type && i.article ? i.type + i.article : null);

/**
 * Siguiente número de artículo libre dentro de un tipo (001, 002...).
 * `exceptProduct` excluye al propio artículo cuando se reclasifica.
 */
export function nextArticle(items: { id: string; productId?: string; type?: string; article?: string }[], type: string, exceptProduct?: string): string {
  const used = items.filter((i) => i.type === type && (i.productId ?? i.id) !== exceptProduct && i.article).map((i) => Number(i.article));
  const next = Math.max(0, ...used) + 1;
  if (next > 999) throw Error('Este tipo ya tiene 999 artículos.');
  return String(next).padStart(3, '0');
}

// ---------- EAN / GTIN ----------

/** ¿El dígito de control del EAN es correcto? (EAN-8, UPC-12, EAN-13, GTIN-14) */
export function isValidEan(ean: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(ean)) return false;
  const digits = ean.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Completa un código de 7, 11, 12 o 13 dígitos con su dígito de control. */
export function withCheckDigit(body: string): string {
  const digits = body.split('').map(Number).reverse();
  const sum = digits.reduce((a, d, i) => a + d * (i % 2 === 0 ? 3 : 1), 0);
  return body + String((10 - (sum % 10)) % 10);
}

// ---------- Búsqueda ----------

/** Quita tildes y pasa a minúsculas. */
export const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'en', 'para', 'a', 'al', 'sin', 'un', 'una', 'otra', 'otro', 'marca', 'kg', 'g', 'l', 'ml', 'ud', 'pack']);
const words = (s: string) =>
  normalize(s)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w))
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));
const same = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

/** Puntuación de un tipo para unas palabras: el nombre cuenta más que los sinónimos. */
function score(t: TypeNode, query: string[]): number {
  const name = words(t.name);
  const syn = t.synonyms.flatMap(words);
  const family = words(t.family.name);
  let s = 0;
  for (const q of query) {
    if (name.some((w) => same(w, q))) s += 3;
    else if (syn.some((w) => same(w, q))) s += 2;
    else if (family.some((w) => same(w, q))) s += 1;
  }
  // Ligera preferencia por nombres cortos (más generales) con la misma puntuación.
  return s ? s - name.length * 0.01 : 0;
}

/** Busca tipos por nombre, sinónimo o código («arroz», «pardina», «110202», «11.02»). */
export function searchTypes(query: string, limit = 12): TypeNode[] {
  const digits = query.replace(/[.\s]/g, '');
  if (/^\d{2,9}$/.test(digits)) return TYPES.filter((t) => t.code.startsWith(digits.slice(0, 6))).slice(0, limit);
  const q = words(query);
  if (!q.length) return [];
  return TYPES.map((t) => ({ t, s: score(t, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.t);
}

/** Adivina el tipo de un artículo por su nombre («Arroz integral SOS 1 kg» → 11.02.02). */
export function guessType(name: string): TypeNode | undefined {
  const q = words(name);
  if (!q.length) return undefined;
  let best: { t: TypeNode; s: number } | undefined;
  for (const t of TYPES) {
    const s = score(t, q);
    if (s >= 2 && (!best || s > best.s)) best = { t, s };
  }
  return best?.t;
}
