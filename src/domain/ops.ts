// Operaciones: cada cambio del hogar es un mensaje pequeño y serializable.
//
// ¿Por qué? Para sincronizar varios móviles. Cada dispositivo envía sus operaciones al
// servidor, el servidor les da un orden y todos los móviles las aplican en ese mismo orden
// con el mismo «reducer». Resultado: todos ven lo mismo, aunque hayan estado sin conexión.
//
// Regla de oro: una operación lleva TODO lo que necesita (ids nuevos, fechas...). El reducer
// nunca genera ids aleatorios ni mira la fecha actual, porque si no cada móvil obtendría un
// resultado distinto.
import { z } from 'zod';
import type { Catalog } from './catalog';
import type { Collection } from './schemas';
import { COLLECTIONS } from './schemas';
import type { ISODate, MemberId } from './types';
import type { Packet } from './ai';

export type OpMeta = {
  /** Id único de la operación (para no aplicarla dos veces). */
  id: string;
  /** Momento en que se creó (ISO). Solo informativo. */
  at: string;
  /** Miembro que la hizo. */
  by: MemberId;
  /** Dispositivo que la creó. */
  device: string;
};

export type Plate = { person: MemberId; grams: number; extraId: string; extraAmount: number };
export type ReviewResult = { itemId: string; status: 'ok' | 'done' | 'missing'; expires?: ISODate | '' };

export type OpBody =
  | { type: 'household.rename'; name: string }
  | { type: 'upsert'; collection: Collection; entity: Record<string, unknown> }
  | { type: 'patch'; collection: Collection; entityId: string; fields: Record<string, unknown> }
  | { type: 'remove'; collection: Collection; entityId: string }
  | { type: 'stock.out'; target: 'item' | 'tupper'; entityId: string; qty: number; reason: string }
  | {
      type: 'cook';
      recipeId: string;
      amounts: number[];
      yieldGrams: number;
      review: ISODate;
      date: ISODate;
      tupperId: string;
      mealId?: string;
    }
  | { type: 'serve'; tupperId: string; plates: Plate[]; date: ISODate; ids: string[]; mealId?: string }
  | { type: 'ai.packet'; packet: Packet; ids: string[]; date: ISODate }
  | { type: 'catalog.set'; catalog: Catalog }
  | { type: 'shopping.clearChecked' }
  | { type: 'kit.item.upsert'; kitId: string; item: Record<string, unknown> }
  | { type: 'kit.item.remove'; kitId: string; itemId: string }
  | { type: 'kit.item.done'; kitId: string; itemId: string; date: ISODate; expires?: ISODate | ''; logId: string }
  | {
      type: 'kit.review';
      kitId: string;
      date: ISODate;
      results: ReviewResult[];
      /** Artículos que faltan y se añaden a la lista de la compra (con sus ids). */
      shopping: { id: string; name: string; quantity: string }[];
      logId: string;
    }
  | { type: 'campaign.task.toggle'; campaignId: string; taskId: string; completed: boolean }
  | { type: 'campaign.task.add'; campaignId: string; task: { id: string; description: string; due?: ISODate } };

export type Op = OpMeta & OpBody;

// Validación estructural de operaciones recibidas (del servidor o de una copia).
// Los detalles de cada entidad se validan dentro del reducer.
const meta = { id: z.string().min(1).max(120), at: z.string().max(40), by: z.string().min(1).max(120), device: z.string().max(120) };
const collection = z.enum(COLLECTIONS as [Collection, ...Collection[]]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const record = z.record(z.unknown());

export const opSchema = z.discriminatedUnion('type', [
  z.object({ ...meta, type: z.literal('household.rename'), name: z.string().min(1).max(60) }),
  z.object({ ...meta, type: z.literal('upsert'), collection, entity: record }),
  z.object({ ...meta, type: z.literal('patch'), collection, entityId: z.string(), fields: record }),
  z.object({ ...meta, type: z.literal('remove'), collection, entityId: z.string() }),
  z.object({ ...meta, type: z.literal('stock.out'), target: z.enum(['item', 'tupper']), entityId: z.string(), qty: z.number(), reason: z.string().max(100) }),
  z.object({
    ...meta,
    type: z.literal('cook'),
    recipeId: z.string(),
    amounts: z.array(z.number()).max(50),
    yieldGrams: z.number(),
    review: date,
    date,
    tupperId: z.string().min(1),
    mealId: z.string().optional(),
  }),
  z.object({
    ...meta,
    type: z.literal('serve'),
    tupperId: z.string(),
    plates: z.array(z.object({ person: z.string(), grams: z.number(), extraId: z.string(), extraAmount: z.number() })).max(30),
    date,
    ids: z.array(z.string().min(1)).max(30),
    mealId: z.string().optional(),
  }),
  z.object({ ...meta, type: z.literal('ai.packet'), packet: z.any(), ids: z.array(z.string().min(1)).max(30), date }),
  z.object({ ...meta, type: z.literal('catalog.set'), catalog: z.any() }),
  z.object({ ...meta, type: z.literal('shopping.clearChecked') }),
  z.object({ ...meta, type: z.literal('kit.item.upsert'), kitId: z.string(), item: record }),
  z.object({ ...meta, type: z.literal('kit.item.remove'), kitId: z.string(), itemId: z.string() }),
  z.object({
    ...meta,
    type: z.literal('kit.item.done'),
    kitId: z.string(),
    itemId: z.string(),
    date,
    expires: z.union([date, z.literal('')]).optional(),
    logId: z.string().min(1),
  }),
  z.object({
    ...meta,
    type: z.literal('kit.review'),
    kitId: z.string(),
    date,
    results: z
      .array(z.object({ itemId: z.string(), status: z.enum(['ok', 'done', 'missing']), expires: z.union([date, z.literal('')]).optional() }))
      .max(300),
    shopping: z.array(z.object({ id: z.string().min(1), name: z.string().min(1).max(100), quantity: z.string().max(60) })).max(300),
    logId: z.string().min(1),
  }),
  z.object({ ...meta, type: z.literal('campaign.task.toggle'), campaignId: z.string(), taskId: z.string(), completed: z.boolean() }),
  z.object({
    ...meta,
    type: z.literal('campaign.task.add'),
    campaignId: z.string(),
    task: z.object({ id: z.string().min(1), description: z.string().min(1).max(300), due: date.optional() }),
  }),
]);
