// Intercambio con una IA externa: la app prepara un contexto, la IA responde un JSON
// con acciones y la app las valida antes de aplicarlas. Nada se envía automáticamente.
import { z } from 'zod';
import type { MemberId, State } from './types';
import { COMMON } from './types';
import { day } from './dates';

const num = z.number().finite().positive();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ingredient = z.object({ itemId: z.string().min(1), amount: num.max(100_000), optional: z.boolean() });

export const actionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_recipe'),
    recipe: z.object({
      name: z.string().min(2).max(100),
      description: z.string().max(300),
      minutes: num.max(1440),
      servings: num.max(100),
      ingredients: z.array(ingredient).min(1).max(50),
      steps: z.array(z.string().min(1).max(500)).min(1).max(30),
    }),
  }),
  z.object({ type: z.literal('add_shopping'), name: z.string().min(1).max(100), quantity: z.string().min(1).max(60) }),
  z.object({
    type: z.literal('record_purchase'),
    itemId: z.string(),
    quantity: num.max(100_000),
    total: z.number().finite().nonnegative().max(100_000),
    provider: z.string().min(1).max(100),
    payer: z.string().min(1).max(120),
    expires: z.union([isoDate, z.literal('')]),
  }),
  z.object({
    type: z.literal('add_kit_item'),
    kitId: z.string().min(1),
    name: z.string().min(1).max(100),
    qty: num.max(10_000),
    unit: z.string().max(20),
    expires: z.union([isoDate, z.literal('')]).default(''),
    task: z.string().max(80).default(''),
    everyMonths: z.number().int().min(0).max(120).default(0),
  }),
]);

export const packetSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1).max(100),
  baseRevision: z.number().int().nonnegative(),
  actions: z.array(actionSchema).min(1).max(30),
});

export type Packet = z.infer<typeof packetSchema>;
export type PacketAction = Packet['actions'][number];

/** Texto para copiar en el chat de IA. */
export function aiContext(state: State, me: MemberId, includeNutrition: boolean): string {
  const members = state.household.members.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name }));
  const meName = state.household.members.find((m) => m.id === me)?.name ?? me;
  const context = {
    version: 1,
    baseRevision: state.revision,
    date: day(),
    household: state.household.name,
    members,
    whoIsAsking: meName,
    pets: state.household.pets.map((p) => p.name),
    items: state.items
      .filter((i) => i.qty > 0)
      .map(({ protein, price, ...i }) => (includeNutrition ? { ...i, protein } : i)),
    tuppers: state.tuppers
      .filter((t) => t.grams > 0)
      .map(({ proteinPer100, ...t }) => (includeNutrition ? { ...t, proteinPer100 } : t)),
    recipes: state.recipes,
    plannedMeals: state.meals.filter((m) => !m.done),
    shopping: state.shopping.filter((s) => !s.checked).map((s) => ({ name: s.name, quantity: s.quantity })),
    kits: state.kits.map((k) => ({
      id: k.id,
      name: k.name,
      items: k.items.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit, expires: i.expires, task: i.task, everyMonths: i.everyMonths })),
    })),
  };
  return `Eres el ayudante de nuestro hogar. Lee el contexto y pregúntame qué quiero hacer. Conversa conmigo antes de generar operaciones. No inventes cantidades disponibles ni pautas nutricionales. Nunca afirmes que has cambiado la app.
Cuando lo acordemos, responde SOLO un JSON válido con version:1, un id único, baseRevision:${state.revision} y actions. Acciones admitidas:
create_recipe: {type:'create_recipe',recipe:{name,description,minutes,servings,ingredients:[{itemId,amount,optional}],steps:[texto]}}
add_shopping: {type:'add_shopping',name,quantity}
record_purchase: {type:'record_purchase',itemId,quantity,total,provider,payer:'${COMMON}'|id de miembro,expires:'AAAA-MM-DD' o ''}
add_kit_item: {type:'add_kit_item',kitId,name,qty,unit,expires:'AAAA-MM-DD' o '',task:'Cambiar pilas' o '',everyMonths:número}
Usa las unidades y los itemId del contexto. Cada artículo tiene type (6 dígitos: sección, familia y tipo) y article: los del mismo type son el mismo producto de marcas o formatos distintos. En las recetas puedes pedir cualquier artículo de un tipo con itemId:'tipo:<type>' (ej. 'tipo:110202' = cualquier arroz integral). Las compras crean un lote nuevo y un gasto repartido entre todos los miembros activos. Prioriza tuppers y lotes próximos a caducar. Sección 13: congelados, avisar 12 horas antes. No generes código ejecutable.${includeNutrition ? ' Los valores nutricionales son orientativos.' : ''}
CONTEXTO:
${JSON.stringify(context, null, 2)}`;
}

/** Descripción legible de una acción, para la vista previa. */
export function describeAction(state: State, a: PacketAction): string {
  switch (a.type) {
    case 'create_recipe':
      return `Crear receta: ${a.recipe.name} (${a.recipe.servings} raciones)`;
    case 'add_shopping':
      return `Añadir a la compra: ${a.name} · ${a.quantity}`;
    case 'record_purchase': {
      const item = state.items.find((x) => x.id === a.itemId)?.name ?? a.itemId;
      const payer = a.payer === COMMON ? 'cuenta común' : state.household.members.find((m) => m.id === a.payer)?.name ?? a.payer;
      return `Registrar compra: ${item} · ${a.quantity} · ${a.total.toFixed(2)} € (paga ${payer})`;
    }
    case 'add_kit_item':
      return `Añadir a ${state.kits.find((k) => k.id === a.kitId)?.name ?? 'un kit'}: ${a.name}${a.task ? ` · ${a.task} cada ${a.everyMonths} meses` : ''}`;
  }
}
