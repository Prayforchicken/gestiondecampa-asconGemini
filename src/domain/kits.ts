// Kits e inventarios personales: mochila de emergencia, botiquín, kit de la mascota...
// Cada artículo puede tener una caducidad y/o una tarea periódica (cambiar pilas cada 12 meses).
import { addMonths, day, daysBetween } from './dates';
import type { ISODate, Kit, KitItem, MemberId } from './types';

export type DueKind = 'expires' | 'task' | 'review' | 'missing';
export type Health = 'overdue' | 'soon' | 'ok';

export type Due = {
  kitId: string;
  kitName: string;
  kitEmoji: string;
  itemId?: string;
  kind: DueKind;
  date: ISODate;
  label: string;
  health: Health;
};

/** Fecha en la que toca la tarea periódica de un artículo. Si nunca se hizo, toca ya. */
export function taskDue(item: KitItem, today = day()): ISODate | null {
  if (!item.everyMonths) return null;
  return item.lastDone ? addMonths(item.lastDone, item.everyMonths) : today;
}

export function reviewDue(kit: Kit, today = day()): ISODate | null {
  if (!kit.reviewEveryMonths) return null;
  return kit.lastReview ? addMonths(kit.lastReview, kit.reviewEveryMonths) : today;
}

export function healthOf(date: ISODate, warnDays: number, today = day()): Health {
  const n = daysBetween(today, date);
  if (n < 0) return 'overdue';
  if (n <= warnDays) return 'soon';
  return 'ok';
}

/** Todo lo que vence en un kit, ordenado por fecha. */
export function kitDues(kit: Kit, today = day()): Due[] {
  const base = { kitId: kit.id, kitName: kit.name, kitEmoji: kit.emoji };
  const out: Due[] = [];
  for (const item of kit.items) {
    if (item.missing) out.push({ ...base, itemId: item.id, kind: 'missing', date: today, label: `Falta: ${item.name}`, health: 'overdue' });
    if (item.expires)
      out.push({
        ...base,
        itemId: item.id,
        kind: 'expires',
        date: item.expires,
        label: `${item.name} ${daysBetween(today, item.expires) < 0 ? 'caducó' : 'caduca'}`,
        health: healthOf(item.expires, kit.warnDays, today),
      });
    const t = taskDue(item, today);
    if (t)
      out.push({
        ...base,
        itemId: item.id,
        kind: 'task',
        date: t,
        label: `${item.task || 'Revisar'}: ${item.name}`,
        health: healthOf(t, kit.warnDays, today),
      });
  }
  const r = reviewDue(kit, today);
  if (r) out.push({ ...base, kind: 'review', date: r, label: `Revisión general de ${kit.name}`, health: healthOf(r, kit.warnDays, today) });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

const rank: Record<Health, number> = { overdue: 0, soon: 1, ok: 2 };

export function kitHealth(kit: Kit, today = day()): Health {
  return kitDues(kit, today).reduce<Health>((worst, d) => (rank[d.health] < rank[worst] ? d.health : worst), 'ok');
}

/** Estado de un artículo concreto (para pintar su fila). */
export function itemHealth(kit: Kit, item: KitItem, today = day()): Health {
  return kitDues(kit, today)
    .filter((d) => d.itemId === item.id)
    .reduce<Health>((worst, d) => (rank[d.health] < rank[worst] ? d.health : worst), 'ok');
}

/** Avisos pendientes (vencidos o próximos) de todos los kits visibles para alguien. */
export function pendingDues(kits: Kit[], today = day()): Due[] {
  return kits
    .flatMap((k) => kitDues(k, today))
    .filter((d) => d.health !== 'ok')
    .sort((a, b) => rank[a.health] - rank[b.health] || a.date.localeCompare(b.date));
}

export const visibleKits = (kits: Kit[], me: MemberId) => kits.filter((k) => k.owner === null || k.owner === me);

// ---------- Plantillas ----------

type TemplateItem = Partial<KitItem> & { name: string };
export type KitTemplate = {
  key: string;
  name: string;
  emoji: string;
  description: string;
  place: string;
  reviewEveryMonths: number;
  items: TemplateItem[];
};

// Sugerencias habituales para autonomía de 72 horas (recomendación de protección civil
// y de la Unión Europea). Son orientativas y editables: adáptalas a vuestra casa.
export const KIT_TEMPLATES: KitTemplate[] = [
  {
    key: 'emergencia',
    name: 'Mochila de emergencia',
    emoji: '🎒',
    description: 'Autonomía de 72 horas: agua, comida, luz, información y botiquín.',
    place: 'Armario de la entrada',
    reviewEveryMonths: 6,
    items: [
      { name: 'Agua embotellada', qty: 9, unit: 'l', notes: 'Unos 3 litros por persona y día: ajusta a cuántos sois. Apunta la fecha de consumo preferente.' },
      { name: 'Latas de comida (legumbres, verduras)', qty: 6, unit: 'latas', notes: 'Que se puedan comer sin cocinar. Apunta la fecha de la lata que caduque antes.' },
      { name: 'Barritas o frutos secos', qty: 6, unit: 'ud', notes: 'Apunta la fecha de consumo preferente.' },
      { name: 'Abrelatas manual', qty: 1, unit: 'ud' },
      { name: 'Linterna', qty: 1, unit: 'ud', task: 'Comprobar que funciona', everyMonths: 3 },
      { name: 'Pilas de repuesto', qty: 8, unit: 'ud', task: 'Cambiar pilas', everyMonths: 12, notes: 'Revisa también el tamaño (AA, AAA) que usan linterna y radio.' },
      { name: 'Radio a pilas o de dinamo', qty: 1, unit: 'ud', task: 'Comprobar que sintoniza', everyMonths: 6 },
      { name: 'Batería externa (powerbank)', qty: 1, unit: 'ud', task: 'Recargar', everyMonths: 3, notes: 'Las baterías de litio se descargan solas con el tiempo.' },
      { name: 'Cable de carga del móvil', qty: 1, unit: 'ud' },
      { name: 'Botiquín básico', qty: 1, unit: 'ud', task: 'Revisar caducidades', everyMonths: 6 },
      { name: 'Medicación habitual', qty: 1, unit: 'caja', notes: 'Para unos días. Rota con la de casa.' },
      { name: 'Copias de documentos (DNI, tarjeta sanitaria)', qty: 1, unit: 'sobre', task: 'Comprobar que están al día', everyMonths: 12 },
      { name: 'Dinero en efectivo', qty: 1, unit: 'sobre', notes: 'Billetes pequeños y monedas.' },
      { name: 'Manta térmica', qty: 2, unit: 'ud' },
      { name: 'Silbato', qty: 1, unit: 'ud' },
      { name: 'Navaja multiusos', qty: 1, unit: 'ud' },
      { name: 'Mechero o cerillas', qty: 1, unit: 'ud' },
      { name: 'Mascarillas', qty: 4, unit: 'ud' },
      { name: 'Higiene: gel, papel, compresas', qty: 1, unit: 'neceser' },
      { name: 'Ropa de abrigo y calcetines', qty: 1, unit: 'muda', task: 'Cambiar según la estación', everyMonths: 6 },
      { name: 'Llaves de repuesto', qty: 1, unit: 'juego' },
      { name: 'Lista de teléfonos en papel', qty: 1, unit: 'hoja', task: 'Actualizar', everyMonths: 12 },
    ],
  },
  {
    key: 'botiquin',
    name: 'Botiquín de casa',
    emoji: '🩹',
    description: 'Lo básico para curas y malestares, con caducidades a la vista.',
    place: 'Baño',
    reviewEveryMonths: 6,
    items: [
      { name: 'Tiritas', qty: 1, unit: 'caja' },
      { name: 'Gasas estériles', qty: 1, unit: 'paquete' },
      { name: 'Esparadrapo', qty: 1, unit: 'rollo' },
      { name: 'Antiséptico (clorhexidina o povidona)', qty: 1, unit: 'bote' },
      { name: 'Suero fisiológico', qty: 5, unit: 'monodosis' },
      { name: 'Termómetro', qty: 1, unit: 'ud', task: 'Comprobar pila', everyMonths: 12 },
      { name: 'Paracetamol', qty: 1, unit: 'caja', notes: 'Apunta la caducidad de la caja.' },
      { name: 'Ibuprofeno', qty: 1, unit: 'caja', notes: 'Apunta la caducidad de la caja.' },
      { name: 'Antihistamínico', qty: 1, unit: 'caja', notes: 'Apunta la caducidad de la caja.' },
      { name: 'Tijeras y pinzas', qty: 1, unit: 'ud' },
      { name: 'Guantes desechables', qty: 4, unit: 'pares' },
    ],
  },
  {
    key: 'mascota',
    name: 'Kit de la mascota',
    emoji: '🐈',
    description: 'Para salir rápido con vuestro gato: transportín, comida y papeles.',
    place: 'Junto al transportín',
    reviewEveryMonths: 6,
    items: [
      { name: 'Transportín', qty: 1, unit: 'ud', task: 'Comprobar cierres', everyMonths: 6 },
      { name: 'Comida (latas o pienso)', qty: 3, unit: 'días', notes: 'Apunta la fecha de consumo preferente.' },
      { name: 'Agua', qty: 1, unit: 'l' },
      { name: 'Cuenco plegable', qty: 1, unit: 'ud' },
      { name: 'Arena y bolsas', qty: 1, unit: 'kit' },
      { name: 'Cartilla veterinaria (copia)', qty: 1, unit: 'ud', task: 'Comprobar vacunas al día', everyMonths: 12 },
      { name: 'Medicación de la mascota', qty: 1, unit: 'ud' },
      { name: 'Foto reciente de la mascota', qty: 1, unit: 'ud', task: 'Actualizar', everyMonths: 12 },
    ],
  },
  {
    key: 'blanco',
    name: 'Inventario en blanco',
    emoji: '📦',
    description: 'Empieza desde cero: herramientas, material de un hobby, viaje...',
    place: '',
    reviewEveryMonths: 0,
    items: [],
  },
];

/** Crea un kit a partir de una plantilla. `ids` genera ids nuevos (inyectable para tests). */
export function kitFromTemplate(t: KitTemplate, owner: MemberId | null, ids: () => string, petName?: string): Kit {
  return {
    id: ids(),
    name: t.key === 'mascota' && petName ? `Kit de ${petName}` : t.name,
    emoji: t.emoji,
    owner,
    place: t.place,
    notes: '',
    reviewEveryMonths: t.reviewEveryMonths,
    lastReview: '',
    warnDays: 30,
    items: t.items.map((i) => ({
      id: ids(),
      name: i.name,
      qty: i.qty ?? 1,
      unit: i.unit ?? 'ud',
      expires: i.expires ?? '',
      task: i.task ?? '',
      everyMonths: i.everyMonths ?? 0,
      // Al crear el kit damos por hecha la tarea hoy: el primer aviso llega cuando toque.
      lastDone: i.everyMonths ? day() : '',
      notes: i.notes ?? '',
      missing: false,
    })),
    history: [],
  };
}

// ---------- Calendario (.ics) ----------
// Las notificaciones con la app cerrada las da el calendario del móvil: exportamos los
// vencimientos como eventos con alarma y se importan en Google Calendar, Apple, etc.

const icsDate = (d: ISODate) => d.replaceAll('-', '');
const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** Corta líneas largas como pide el estándar (75 octetos). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 74) {
    let cut = 74;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

export function kitsToIcs(kits: Kit[], today = day(), stamp = new Date()): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//comemos//kits//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Revisiones del hogar'];
  for (const kit of kits) {
    for (const d of kitDues(kit, today)) {
      if (d.kind === 'missing') continue;
      // Lo vencido se apunta para hoy, para que salte ya.
      const date = d.date < today ? today : d.date;
      const next = new Date(date + 'T12:00:00');
      next.setDate(next.getDate() + 1);
      const end = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${kit.id}-${d.itemId ?? 'kit'}-${d.kind}-${icsDate(d.date)}@comemos`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${icsDate(date)}`,
        `DTEND;VALUE=DATE:${end}`,
        fold(`SUMMARY:${icsEscape(`${kit.emoji} ${d.label}`)}`),
        fold(`DESCRIPTION:${icsEscape(`${kit.name}${kit.place ? ' · ' + kit.place : ''}. Márcalo como hecho en la app para calcular el siguiente aviso.`)}`),
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'TRIGGER:-P7D',
        fold(`DESCRIPTION:${icsEscape('Dentro de una semana: ' + d.label)}`),
        'END:VALARM',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'TRIGGER:PT9H',
        fold(`DESCRIPTION:${icsEscape('Hoy: ' + d.label)}`),
        'END:VALARM',
        'END:VEVENT',
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
