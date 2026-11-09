// Módulo de campañas (antes «Gestor de Campañas de Hipermercado»), ahora dentro de la app.
// Es un espacio personal: cada campaña tiene dueño y solo aparece en su «Mi espacio».
import { addDays, day, isISODate, mondayOf } from './dates';
import type { Campaign, CampaignStatus, CampaignTask, CampaignType, ISODate, MemberId } from './types';
import { CAMPAIGN_STATUSES } from './types';

/** Plantilla de tarea: texto y cuándo toca respecto al inicio de la campaña. */
type TaskTemplate = { text: (name: string) => string; due: (start: ISODate) => ISODate };
const onStart = (start: ISODate) => start;
const before = (n: number) => (start: ISODate) => addDays(start, -n);

const NATIONAL: TaskTemplate[] = [
  { text: (n) => `Subir banner de ${n} a Web Corporativa (Portada)`, due: onStart },
  { text: (n) => `Subir folleto de ${n} a Web Corporativa (Folleto)`, due: onStart },
  { text: (n) => `Subir folleto de ${n} a App (Folleto)`, due: onStart },
  { text: (n) => `Añadir ${n} a Newsletter (el lunes)`, due: mondayOf },
  { text: (n) => `Subir folleto de ${n} a Steeple (2 días antes)`, due: before(2) },
  { text: (n) => `Crear archivo de importación de ${n} a Compra Online`, due: before(2) },
  { text: (n) => `Subir folleto de ${n} a Meta (1 día antes)`, due: before(1) },
  { text: (n) => `Subir folleto de ${n} a X (1 día antes)`, due: before(1) },
  { text: (n) => `Convertir folleto de ${n} a pantallas y subirlo a PiSignage`, due: onStart },
  { text: (n) => `Reel para ${n}`, due: onStart },
  { text: (n) => `Publicación especial para ${n}`, due: onStart },
];

const LOCAL: TaskTemplate[] = [
  { text: (n) => `Planificar acciones para ${n} en tienda`, due: before(7) },
  { text: (n) => `Coordinar promoción de ${n} con proveedores locales`, due: before(5) },
  { text: (n) => `Publicitar ${n} en redes sociales locales`, due: before(1) },
];

export function templateTasks(type: CampaignType, name: string, start: ISODate, ids: () => string): CampaignTask[] {
  return (type === 'Nacional' ? NATIONAL : LOCAL).map((t) => ({ id: ids(), description: t.text(name), completed: false, due: t.due(start) }));
}

export function newCampaign(
  data: { name: string; type: CampaignType; startDate: ISODate; endDate: ISODate; url?: string },
  owner: MemberId,
  ids: () => string,
): Campaign {
  return {
    id: ids(),
    owner,
    name: data.name.trim(),
    type: data.type,
    startDate: data.startDate,
    endDate: data.endDate < data.startDate ? data.startDate : data.endDate,
    tasks: templateTasks(data.type, data.name.trim(), data.startDate, ids),
    status: 'Por Empezar',
    ...(data.url ? { url: data.url.trim() } : {}),
  };
}

/** Copia con fechas +1 día y tareas sin hacer (igual que la app original). */
export function duplicateCampaign(c: Campaign, ids: () => string): Campaign {
  const startDate = addDays(c.startDate, 1);
  const endDate = addDays(c.endDate, 1) < startDate ? startDate : addDays(c.endDate, 1);
  return {
    ...c,
    id: ids(),
    name: `${c.name} (Copia)`,
    startDate,
    endDate,
    status: 'Por Empezar',
    tasks: c.tasks.map((t) => ({ ...t, id: ids(), completed: false, ...(t.due ? { due: addDays(t.due, 1) } : {}) })),
  };
}

export const nextStatus = (s: CampaignStatus): CampaignStatus => CAMPAIGN_STATUSES[(CAMPAIGN_STATUSES.indexOf(s) + 1) % CAMPAIGN_STATUSES.length];

/** Sugerencia de estado según las fechas (la app no lo cambia sola: decides tú). */
export function suggestedStatus(c: Campaign, today = day()): CampaignStatus {
  if (today < c.startDate) return 'Por Empezar';
  if (today > c.endDate) return 'Terminada';
  return 'En Curso';
}

export const progress = (c: Campaign) => (c.tasks.length ? c.tasks.filter((t) => t.completed).length / c.tasks.length : 0);

/**
 * Lee un JSON exportado por la app antigua (lista de campañas) o por esta.
 * Reasigna ids y dueño para poder importarlo sin chocar con lo que ya hay.
 */
export function importCampaigns(raw: unknown, owner: MemberId, ids: () => string): Campaign[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { campaigns?: unknown }).campaigns) ? (raw as { campaigns: unknown[] }).campaigns : null;
  if (!list) throw Error('Formato incorrecto: se esperaba una lista de campañas.');
  return list.map((c: any): Campaign => {
    const type: CampaignType = c?.type === 'Nacional' ? 'Nacional' : 'Local';
    const name = String(c?.name || 'Campaña sin nombre').slice(0, 120);
    const startDate = isISODate(c?.startDate) ? c.startDate : day();
    const endDate = isISODate(c?.endDate) && c.endDate >= startDate ? c.endDate : startDate;
    const validTasks =
      Array.isArray(c?.tasks) && c.tasks.length > 0 && c.tasks.every((t: any) => t && typeof t.description === 'string' && typeof t.completed === 'boolean');
    return {
      id: ids(),
      owner,
      name,
      type,
      startDate,
      endDate,
      status: CAMPAIGN_STATUSES.includes(c?.status) ? c.status : 'Por Empezar',
      tasks: validTasks
        ? c.tasks.map((t: any) => ({ id: ids(), description: String(t.description).slice(0, 300), completed: t.completed, ...(isISODate(t.due) ? { due: t.due } : {}) }))
        : templateTasks(type, name, startDate, ids),
      ...(typeof c?.url === 'string' && c.url ? { url: c.url.slice(0, 500) } : {}),
    };
  });
}

/** Enlace seguro: añade https:// si falta y rechaza esquemas raros (javascript:...). */
export function safeUrl(url: string): string | null {
  const u = url.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : 'https://' + u;
  try {
    const parsed = new URL(withScheme);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}
