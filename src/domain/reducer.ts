// El reducer aplica una operación al estado. Es la ÚNICA forma de cambiar los datos.
//
// Cada manejador primero valida y después modifica: si algo falla, lanza un error antes
// de tocar nada, así el estado nunca queda a medias.
import { catalogSchema } from './catalog';
import { packetSchema } from './ai';
import { collectionSchemas, type Collection } from './schemas';
import type { Op } from './ops';
import { opSchema } from './ops';
import { COMMON, type Item, type Kit, type State } from './types';
import { euros } from './format';
import { findType, nextArticle } from './estructura';
import { ingredientExists, ingredientName, lotsFor, productOf, stockFor } from './stock';

const LOG_LIMIT = 300;
const KIT_HISTORY_LIMIT = 60;

type Entity = { id: string };

function listOf(s: State, c: Collection): Entity[] {
  if (c === 'members') return s.household.members;
  if (c === 'pets') return s.household.pets;
  return s[c] as Entity[];
}

function setList(s: State, c: Collection, list: Entity[]) {
  if (c === 'members') s.household.members = list as State['household']['members'];
  else if (c === 'pets') s.household.pets = list as State['household']['pets'];
  else (s as unknown as Record<string, Entity[]>)[c] = list;
}

const isMember = (s: State, id: string) => s.household.members.some((m) => m.id === id);

/** Comprobaciones que relacionan entidades entre sí (p. ej. que el pagador exista). */
function checkReferences(s: State, c: Collection, e: Record<string, unknown>) {
  const memberField = (field: string, value: unknown, allowCommon = false) => {
    if (value === undefined || value === null) return;
    if (typeof value !== 'string' || (!isMember(s, value) && !(allowCommon && value === COMMON)))
      throw Error(`Miembro desconocido en «${field}».`);
  };
  if (c === 'expenses') {
    memberField('payer', e.payer, true);
    for (const m of e.split as string[]) memberField('split', m);
  }
  if (c === 'settlements') {
    memberField('from', e.from);
    memberField('to', e.to);
    if (e.from === e.to) throw Error('Un pago necesita dos personas distintas.');
  }
  if (c === 'items' || c === 'shopping') memberField('owner', e.owner);
  if (c === 'kits' || c === 'campaigns') memberField('owner', e.owner);
}

const COLLECTION_NAMES: Record<Collection, string> = {
  items: 'Inventario',
  recipes: 'Receta',
  tuppers: 'Tupper',
  meals: 'Plan',
  shopping: 'Lista de la compra',
  expenses: 'Gasto',
  settlements: 'Pago entre miembros',
  kits: 'Kit',
  campaigns: 'Campaña',
  members: 'Miembro',
  pets: 'Mascota',
};

const entityName = (e: Record<string, unknown>) =>
  String(e.name ?? e.label ?? e.description ?? (e.amount !== undefined ? euros(Number(e.amount)) : ''));

function findKit(s: State, kitId: string): Kit {
  const kit = s.kits.find((k) => k.id === kitId);
  if (!kit) throw Error('Ese kit ya no existe.');
  return kit;
}

const lotsOf = lotsFor;
const available = stockFor;

/**
 * Prepara un lote antes de guardarlo: código interno y EAN.
 *  - Un lote de un artículo existente hereda su tipo, número de artículo y EAN.
 *  - Un artículo nuevo (o reclasificado) recibe el siguiente número libre de su tipo.
 *    Se calcula aquí, en el reducer, para que dos móviles sin conexión nunca den el mismo
 *    número a artículos distintos: todos aplican las operaciones en el mismo orden.
 *  - Un EAN pertenece a un solo artículo.
 */
function prepareItem(s: State, input: Item, previous?: Item): Item {
  const e: Item = { ...input };
  const product = productOf(e);
  if (product !== e.id) {
    const root = s.items.find((i) => i.id === product) ?? s.items.find((i) => productOf(i) === product && i.id !== e.id);
    if (root) {
      e.type = root.type;
      e.article = root.article;
      if (root.ean) e.ean = root.ean;
      if (!e.type) delete e.type;
      if (!e.article) delete e.article;
    }
  }
  if (e.type) {
    if (!findType(e.type)) throw Error('Tipo de artículo desconocido: ' + e.type);
    e.section = Number(e.type.slice(0, 2));
    if (previous && previous.type !== e.type && product === e.id) delete e.article;
    const taken = s.items.some((i) => i.type === e.type && i.article === e.article && productOf(i) !== product);
    if (!e.article || taken) e.article = nextArticle(s.items, e.type, product);
  } else delete e.article;
  if (e.ean) {
    const other = s.items.find((i) => i.ean === e.ean && productOf(i) !== product);
    if (other) throw Error(`Ese EAN ya es de «${other.name}». Añádelo como un lote nuevo de ese artículo.`);
  }
  return e;
}

/** Si se cambia el código de un artículo, sus otros lotes lo siguen. */
function propagateCode(s: State, root: Item) {
  if (productOf(root) !== root.id) return;
  for (const lot of s.items) {
    if (lot.productId !== root.id || lot.id === root.id) continue;
    lot.section = root.section;
    if (root.type) lot.type = root.type;
    else delete lot.type;
    if (root.article) lot.article = root.article;
    else delete lot.article;
    if (root.ean) lot.ean = root.ean;
  }
}

/** Aplica la operación sobre `s` (lo modifica) y devuelve una etiqueta para el historial. */
export function applyOp(s: State, op: Op): string {
  switch (op.type) {
    case 'household.rename': {
      s.household.name = op.name.trim();
      return 'Hogar renombrado: ' + s.household.name;
    }

    case 'upsert': {
      let entity = collectionSchemas[op.collection].parse(op.entity) as unknown as Record<string, unknown> & Entity;
      checkReferences(s, op.collection, entity);
      const list = listOf(s, op.collection);
      const index = list.findIndex((x) => x.id === entity.id);
      if (op.collection === 'items') entity = prepareItem(s, entity as unknown as Item, list[index] as Item | undefined) as unknown as typeof entity;
      if (index >= 0) list[index] = entity;
      else list.push(entity);
      if (op.collection === 'items') propagateCode(s, entity as unknown as Item);
      return `${COLLECTION_NAMES[op.collection]} ${index >= 0 ? 'actualizado' : 'añadido'}: ${entityName(entity)}`;
    }

    case 'patch': {
      const list = listOf(s, op.collection);
      const index = list.findIndex((x) => x.id === op.entityId);
      if (index < 0) throw Error('Ese elemento ya no existe.');
      let merged = collectionSchemas[op.collection].parse({ ...list[index], ...op.fields, id: op.entityId }) as unknown as Record<string, unknown> & Entity;
      checkReferences(s, op.collection, merged);
      if (op.collection === 'items') merged = prepareItem(s, merged as unknown as Item, list[index] as Item) as unknown as typeof merged;
      list[index] = merged;
      if (op.collection === 'items') propagateCode(s, merged as unknown as Item);
      return `${COLLECTION_NAMES[op.collection]} actualizado: ${entityName(merged)}`;
    }

    case 'remove': {
      if (op.collection === 'members') throw Error('Los miembros no se borran: desactívalos para conservar su historial.');
      const list = listOf(s, op.collection);
      const old = list.find((x) => x.id === op.entityId) as (Entity & Record<string, unknown>) | undefined;
      if (!old) throw Error('Ese elemento ya no existe.');
      setList(s, op.collection, list.filter((x) => x.id !== op.entityId));
      return `${COLLECTION_NAMES[op.collection]} eliminado: ${entityName(old)}`;
    }

    case 'stock.out': {
      if (!Number.isFinite(op.qty) || op.qty <= 0) throw Error('Cantidad no válida.');
      if (op.target === 'item') {
        const item = s.items.find((i) => i.id === op.entityId);
        if (!item) throw Error('Ese lote ya no existe.');
        if (op.qty > item.qty + 1e-9) throw Error('No puedes sacar más de lo que hay.');
        item.qty = Math.max(0, item.qty - op.qty);
        return `Salida: ${item.name} · ${op.reason}`;
      }
      const t = s.tuppers.find((t) => t.id === op.entityId);
      if (!t) throw Error('Esa preparación ya no existe.');
      if (op.qty > t.grams + 1e-9) throw Error('No puedes sacar más de lo que hay.');
      t.grams = Math.max(0, t.grams - op.qty);
      return `Salida: ${t.name} · ${op.reason}`;
    }

    case 'cook': {
      const r = s.recipes.find((r) => r.id === op.recipeId);
      if (!r) throw Error('Esa receta ya no existe.');
      if (!Number.isFinite(op.yieldGrams) || op.yieldGrams <= 0) throw Error('Indica el peso final de la preparación.');
      if (op.amounts.length !== r.ingredients.length) throw Error('Cantidades incompletas.');
      if (s.tuppers.some((t) => t.id === op.tupperId)) throw Error('Esta preparación ya está registrada.');
      // 1) Validar: cantidades correctas y existencias suficientes (sumando ingredientes repetidos).
      const needed = new Map<string, number>();
      r.ingredients.forEach((g, k) => {
        const q = op.amounts[k];
        if (!Number.isFinite(q) || q < 0 || (!g.optional && q <= 0)) throw Error('Revisa las cantidades de los ingredientes.');
        needed.set(g.itemId, (needed.get(g.itemId) ?? 0) + q);
      });
      for (const [productId, q] of needed) {
        if (q > 0 && available(s, productId) + 1e-9 < q) throw Error('No queda suficiente ' + ingredientName(s, productId) + '.');
      }
      const meal = op.mealId ? s.meals.find((m) => m.id === op.mealId) : undefined;
      if (meal?.done) throw Error('Esta comida ya está registrada.');
      // 2) Aplicar: gastar lotes por orden de fecha y calcular la proteína total.
      let protein = 0;
      for (const [productId, q] of needed) {
        let remaining = q;
        for (const lot of lotsOf(s, productId)) {
          if (remaining <= 0) break;
          const used = Math.min(remaining, lot.qty);
          lot.qty -= used;
          remaining -= used;
          protein += (lot.protein * used) / 100;
        }
      }
      s.tuppers.unshift({
        id: op.tupperId,
        name: r.name,
        grams: op.yieldGrams,
        created: op.date,
        review: op.review,
        place: 'Nevera',
        emoji: r.emoji,
        proteinPer100: (protein / op.yieldGrams) * 100,
      });
      if (meal) meal.done = true;
      return 'Preparado: ' + r.name;
    }

    case 'serve': {
      const t = s.tuppers.find((t) => t.id === op.tupperId);
      if (!t) throw Error('Esa preparación ya no existe.');
      if (op.ids.length < op.plates.length) throw Error('Faltan identificadores de los platos.');
      const valid = op.plates.every(
        (p) => isMember(s, p.person) && Number.isFinite(p.grams) && p.grams >= 0 && Number.isFinite(p.extraAmount) && p.extraAmount >= 0,
      );
      const total = op.plates.reduce((a, p) => a + p.grams, 0);
      if (!valid || total <= 0 || total > t.grams + 1e-9) throw Error('Revisa las cantidades: no pueden superar lo que queda.');
      const extras = new Map<string, number>();
      for (const p of op.plates) if (p.extraId && p.extraAmount > 0) extras.set(p.extraId, (extras.get(p.extraId) ?? 0) + p.extraAmount);
      for (const [extraId, amount] of extras) {
        const e = s.items.find((i) => i.id === extraId);
        if (!e || e.qty + 1e-9 < amount) throw Error('No queda suficiente para los extras.');
      }
      const meal = op.mealId ? s.meals.find((m) => m.id === op.mealId) : undefined;
      if (meal?.done) throw Error('Esta comida ya está registrada.');
      op.plates.forEach((p, k) => {
        let protein = (t.proteinPer100 * p.grams) / 100;
        if (p.extraId && p.extraAmount > 0) {
          const e = s.items.find((i) => i.id === p.extraId)!;
          e.qty -= p.extraAmount;
          protein += (e.protein * p.extraAmount) / 100;
        }
        if (p.grams > 0 || p.extraAmount > 0) s.consumptions.push({ id: op.ids[k], person: p.person, name: t.name, grams: p.grams, protein, date: op.date });
      });
      t.grams = Math.max(0, t.grams - total);
      if (meal) meal.done = true;
      return 'Comida registrada: ' + t.name;
    }

    case 'ai.packet': {
      const p = packetSchema.parse(op.packet);
      if (s.applied.includes(p.id)) throw Error('Este JSON ya se ha aplicado.');
      if (op.ids.length < p.actions.length) throw Error('Faltan identificadores.');
      // Trabajamos sobre una copia: si una acción falla, no se aplica ninguna.
      const d = structuredClone(s);
      const everyone = d.household.members.filter((m) => m.active).map((m) => m.id);
      p.actions.forEach((a, k) => {
        const id = op.ids[k];
        if (a.type === 'create_recipe') {
          if (a.recipe.ingredients.some((g) => !ingredientExists(d, g.itemId)))
            throw Error('La receta «' + a.recipe.name + '» contiene un artículo desconocido.');
          d.recipes.push({ ...a.recipe, id, emoji: '🥗' });
        } else if (a.type === 'add_shopping') {
          d.shopping.push({ id, name: a.name, quantity: a.quantity, checked: false });
        } else if (a.type === 'record_purchase') {
          const base = d.items.find((i) => i.id === a.itemId);
          if (!base) throw Error('Artículo desconocido: ' + a.itemId);
          if (a.payer !== COMMON && !isMember(d, a.payer)) throw Error('Pagador desconocido: ' + a.payer);
          d.items.push({ ...base, productId: productOf(base), id, qty: a.quantity, expires: a.expires, price: a.quantity ? a.total / a.quantity : 0 });
          if (a.total > 0)
            d.expenses.unshift({ id: id + ':gasto', label: a.provider + ' · ' + base.name, amount: a.total, payer: a.payer, split: everyone, date: op.date, category: 'Alimentación' });
        } else if (a.type === 'add_kit_item') {
          const kit = d.kits.find((k) => k.id === a.kitId);
          if (!kit) throw Error('Kit desconocido: ' + a.kitId);
          kit.items.push({ id, name: a.name, qty: a.qty, unit: a.unit, expires: a.expires, task: a.task, everyMonths: a.everyMonths, lastDone: '', notes: '', missing: false });
        }
      });
      d.applied.push(p.id);
      Object.assign(s, d);
      return `Propuesta de IA aplicada (${p.actions.length} cambio${p.actions.length === 1 ? '' : 's'})`;
    }

    case 'catalog.set': {
      s.catalog = catalogSchema.parse(op.catalog);
      return 'Catálogo de precios actualizado';
    }

    case 'shopping.clearChecked': {
      const n = s.shopping.filter((x) => x.checked).length;
      s.shopping = s.shopping.filter((x) => !x.checked);
      return `Lista de la compra: ${n} comprado${n === 1 ? '' : 's'} retirado${n === 1 ? '' : 's'}`;
    }

    case 'kit.item.upsert': {
      const kit = findKit(s, op.kitId);
      const item = collectionSchemas.kits.shape.items.element.parse(op.item);
      const index = kit.items.findIndex((i) => i.id === item.id);
      if (index >= 0) kit.items[index] = item;
      else kit.items.push(item);
      return `${kit.name}: ${index >= 0 ? 'actualizado' : 'añadido'} ${item.name}`;
    }

    case 'kit.item.remove': {
      const kit = findKit(s, op.kitId);
      const item = kit.items.find((i) => i.id === op.itemId);
      if (!item) throw Error('Ese artículo ya no existe.');
      kit.items = kit.items.filter((i) => i.id !== op.itemId);
      return `${kit.name}: retirado ${item.name}`;
    }

    case 'kit.item.done': {
      const kit = findKit(s, op.kitId);
      const item = kit.items.find((i) => i.id === op.itemId);
      if (!item) throw Error('Ese artículo ya no existe.');
      item.lastDone = op.date;
      item.missing = false;
      if (op.expires !== undefined) item.expires = op.expires;
      const what = item.task || 'Repuesto';
      kit.history.unshift({ id: op.logId, date: op.date, by: op.by, summary: `${what}: ${item.name}` });
      kit.history = kit.history.slice(0, KIT_HISTORY_LIMIT);
      return `${kit.name}: ${what.toLowerCase()} · ${item.name}`;
    }

    case 'kit.review': {
      const kit = findKit(s, op.kitId);
      for (const r of op.results) if (!kit.items.some((i) => i.id === r.itemId)) throw Error('La revisión incluye un artículo que ya no está en el kit.');
      if (s.shopping.some((x) => op.shopping.some((n) => n.id === x.id))) throw Error('Esta revisión ya está registrada.');
      const count = { ok: 0, done: 0, missing: 0 };
      for (const r of op.results) {
        const item = kit.items.find((i) => i.id === r.itemId)!;
        count[r.status]++;
        if (r.status === 'missing') item.missing = true;
        else {
          item.missing = false;
          if (r.status === 'done') {
            item.lastDone = op.date;
            if (r.expires !== undefined) item.expires = r.expires;
          }
        }
      }
      for (const n of op.shopping) s.shopping.push({ id: n.id, name: n.name, quantity: n.quantity, checked: false });
      kit.lastReview = op.date;
      const summary = `Revisión: ${count.ok} bien, ${count.done} repuesto${count.done === 1 ? '' : 's'} o hecho${count.done === 1 ? '' : 's'}, ${count.missing} falta${count.missing === 1 ? '' : 'n'}`;
      kit.history.unshift({ id: op.logId, date: op.date, by: op.by, summary });
      kit.history = kit.history.slice(0, KIT_HISTORY_LIMIT);
      return `${kit.name} · ${summary.toLowerCase()}`;
    }

    case 'campaign.task.toggle': {
      const c = s.campaigns.find((c) => c.id === op.campaignId);
      const t = c?.tasks.find((t) => t.id === op.taskId);
      if (!c || !t) throw Error('Esa tarea ya no existe.');
      t.completed = op.completed;
      return `${c.name}: ${op.completed ? 'hecho' : 'pendiente'} · ${t.description}`;
    }

    case 'campaign.task.add': {
      const c = s.campaigns.find((c) => c.id === op.campaignId);
      if (!c) throw Error('Esa campaña ya no existe.');
      if (c.tasks.some((t) => t.id === op.task.id)) throw Error('Tarea repetida.');
      c.tasks.push({ id: op.task.id, description: op.task.description.trim(), completed: false, ...(op.task.due ? { due: op.task.due } : {}) });
      return `${c.name}: nueva tarea · ${op.task.description}`;
    }
  }
}

/** Aplica una operación y la anota en el historial. Lanza error si no se puede aplicar. */
export function applyAndLog(s: State, op: Op) {
  const label = applyOp(s, op);
  s.revision++;
  s.log.unshift({ id: op.id, label, at: op.at, by: op.by });
  if (s.log.length > LOG_LIMIT) s.log.length = LOG_LIMIT;
}

export type Rejected = { op: Op; reason: string };

/**
 * Aplica una lista de operaciones sobre una COPIA del estado.
 * Las que fallan se saltan (así lo hacen todos los móviles) y se devuelven en `rejected`.
 */
export function replay(state: State, ops: Op[]): { state: State; rejected: Rejected[] } {
  const s = structuredClone(state);
  const rejected: Rejected[] = [];
  for (const raw of ops) {
    const parsed = opSchema.safeParse(raw);
    if (!parsed.success) {
      rejected.push({ op: raw, reason: 'Operación con formato desconocido.' });
      continue;
    }
    try {
      applyAndLog(s, parsed.data as Op);
    } catch (e) {
      rejected.push({ op: raw, reason: e instanceof Error ? e.message : 'Error desconocido.' });
    }
  }
  return { state: s, rejected };
}
