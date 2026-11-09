// Utilidades de fechas. Trabajamos con fechas locales AAAA-MM-DD para evitar sorpresas de zona horaria.
import type { ISODate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export const toISODate = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Hoy (n = 0), mañana (n = 1), ayer (n = -1)... */
export function day(n = 0): ISODate {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export const parseDate = (date: ISODate) => new Date(date + 'T12:00:00');

export function addDays(date: ISODate, n: number): ISODate {
  const d = parseDate(date);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** Suma meses respetando fin de mes: 31 ene + 1 mes = 28/29 feb. */
export function addMonths(date: ISODate, months: number): ISODate {
  const d = parseDate(date);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1, 12);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return toISODate(target);
}

/** Días entre dos fechas (b - a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

/** El lunes de la semana de `date` (o el mismo día si ya es lunes). */
export function mondayOf(date: ISODate): ISODate {
  const d = parseDate(date);
  const offset = (d.getDay() + 6) % 7; // 0 = lunes
  return addDays(date, -offset);
}

export const isISODate = (s: unknown): s is ISODate => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export const fmtDate = (date: ISODate) => parseDate(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

export const fmtLongDate = (date: ISODate) =>
  parseDate(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

export function relative(date: ISODate): string {
  if (date === day()) return 'Hoy';
  if (date === day(1)) return 'Mañana';
  if (date === day(-1)) return 'Ayer';
  return fmtDate(date);
}

/** «en 3 días», «hace 2 días», «hoy». */
export function fromNow(date: ISODate, today = day()): string {
  const n = daysBetween(today, date);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  if (n > 0) return n < 60 ? `en ${n} días` : `en ${Math.round(n / 30)} meses`;
  return -n < 60 ? `hace ${-n} días` : `hace ${Math.round(-n / 30)} meses`;
}
