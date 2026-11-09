// Validación de cada entidad. Protege los datos que llegan de otros móviles o de una IA.
import { z } from 'zod';

const id = z.string().min(1).max(120);
const text = (max: number) => z.string().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalDate = z.union([isoDate, z.literal('')]);
const qty = z.number().finite().nonnegative().max(1_000_000);
const money = z.number().finite().nonnegative().max(1_000_000);

export const memberSchema = z.object({
  id,
  name: text(40).min(1),
  color: z.enum(['peach', 'purple', 'mint', 'sky', 'rose', 'sand']),
  proteinTarget: z.number().finite().min(0).max(500).nullable(),
  active: z.boolean(),
});

export const petSchema = z.object({ id, name: text(40).min(1), emoji: text(8) });

export const itemSchema = z.object({
  id,
  productId: id.optional(),
  name: text(100).min(1),
  qty,
  unit: z.enum(['g', 'ml', 'ud']),
  section: z.number().int().min(0).max(9999),
  family: text(20).optional(),
  subfamily: text(20).optional(),
  place: z.enum(['Nevera', 'Despensa', 'Congelador', 'Hogar']),
  expires: optionalDate,
  price: money,
  emoji: text(16),
  protein: z.number().finite().min(0).max(100),
  owner: id.optional(),
});

export const recipeSchema = z.object({
  id,
  name: text(100).min(2),
  description: text(300),
  minutes: z.number().finite().positive().max(1440),
  emoji: text(16),
  servings: z.number().finite().positive().max(100),
  ingredients: z.array(z.object({ itemId: id, amount: z.number().finite().positive().max(100_000), optional: z.boolean() })).min(1).max(50),
  steps: z.array(text(500).min(1)).min(1).max(30),
});

export const tupperSchema = z.object({
  id,
  name: text(100).min(1),
  grams: qty,
  created: isoDate,
  review: isoDate,
  place: z.enum(['Nevera', 'Congelador']),
  emoji: text(16),
  proteinPer100: z.number().finite().min(0).max(100),
});

export const mealSchema = z.object({
  id,
  recipeId: id.optional(),
  tupperId: id.optional(),
  name: text(100).min(1),
  date: isoDate,
  time: z.string().regex(/^\d{2}:\d{2}$/),
  kind: text(30),
  done: z.boolean(),
  thawed: z.boolean(),
  diners: z.array(id).max(30).optional(),
});

export const shoppingSchema = z.object({
  id,
  name: text(100).min(1),
  quantity: text(60),
  checked: z.boolean(),
  section: z.number().int().min(0).max(9999).optional(),
  owner: id.optional(),
});

export const expenseSchema = z.object({
  id,
  label: text(100).min(1),
  amount: money.positive(),
  payer: id,
  split: z.array(id).max(30),
  date: isoDate,
  category: text(40),
});

export const settlementSchema = z.object({
  id,
  from: id,
  to: id,
  amount: money.positive(),
  date: isoDate,
  note: text(100),
});

export const kitItemSchema = z.object({
  id,
  name: text(100).min(1),
  qty: qty,
  unit: text(20),
  expires: optionalDate,
  task: text(80),
  everyMonths: z.number().int().min(0).max(120),
  lastDone: optionalDate,
  notes: text(300),
  missing: z.boolean(),
});

export const kitSchema = z.object({
  id,
  name: text(80).min(1),
  emoji: text(16),
  owner: id.nullable(),
  place: text(80),
  notes: text(500),
  reviewEveryMonths: z.number().int().min(0).max(120),
  lastReview: optionalDate,
  warnDays: z.number().int().min(0).max(365),
  items: z.array(kitItemSchema).max(300),
  history: z.array(z.object({ id, date: isoDate, by: id, summary: text(300) })).max(100),
});

export const campaignTaskSchema = z.object({
  id,
  description: text(300).min(1),
  completed: z.boolean(),
  due: isoDate.optional(),
});

export const campaignSchema = z.object({
  id,
  owner: id,
  name: text(120).min(1),
  type: z.enum(['Nacional', 'Local']),
  startDate: isoDate,
  endDate: isoDate,
  tasks: z.array(campaignTaskSchema).max(200),
  status: z.enum(['Por Empezar', 'En Curso', 'Terminada']),
  url: text(500).optional(),
});

export const collectionSchemas = {
  items: itemSchema,
  recipes: recipeSchema,
  tuppers: tupperSchema,
  meals: mealSchema,
  shopping: shoppingSchema,
  expenses: expenseSchema,
  settlements: settlementSchema,
  kits: kitSchema,
  campaigns: campaignSchema,
  members: memberSchema,
  pets: petSchema,
} as const;

export type Collection = keyof typeof collectionSchemas;
export const COLLECTIONS = Object.keys(collectionSchemas) as Collection[];

/** Mensaje de error legible a partir de un error de zod. */
export function zodMessage(e: unknown): string {
  if (e instanceof z.ZodError) {
    const first = e.issues[0];
    return `Dato no válido en «${first.path.join('.') || 'raíz'}»: ${first.message}`;
  }
  return e instanceof Error ? e.message : 'Dato no válido.';
}
