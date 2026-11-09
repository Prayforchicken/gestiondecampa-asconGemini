// Estado inicial de un hogar nuevo y contenido de ejemplo opcional.
import { exampleCatalog } from './catalog';
import { day } from './dates';
import { COMMON, type AvatarColor, type Member, type State } from './types';

export const AVATAR_COLORS: AvatarColor[] = ['peach', 'purple', 'mint', 'sky', 'rose', 'sand'];

export function makeMember(name: string, index: number, id: string): Member {
  return { id, name: name.trim(), color: AVATAR_COLORS[index % AVATAR_COLORS.length], proteinTarget: null, active: true };
}

export function newHousehold(
  opts: { name: string; people: string[]; pets: { name: string; emoji: string }[] },
  ids: () => string,
): State {
  const members = opts.people.filter((p) => p.trim()).map((p, i) => makeMember(p, i, ids()));
  if (!members.length) throw Error('Añade al menos una persona.');
  return {
    version: 2,
    revision: 0,
    household: {
      name: opts.name.trim() || 'Nuestro hogar',
      members,
      pets: opts.pets.filter((p) => p.name.trim()).map((p) => ({ id: ids(), name: p.name.trim(), emoji: p.emoji || '🐾' })),
    },
    catalog: exampleCatalog(day()),
    items: [],
    recipes: [],
    tuppers: [],
    meals: [],
    shopping: [],
    expenses: [],
    settlements: [],
    consumptions: [],
    kits: [],
    campaigns: [],
    applied: [],
    log: [],
  };
}

/** Añade inventario, recetas y tuppers de ejemplo para probar la app. Se pueden borrar. */
export function withDemoContent(s: State): State {
  const d = structuredClone(s);
  const pet = d.household.pets[0]?.name ?? 'la mascota';
  const all = d.household.members.filter((m) => m.active).map((m) => m.id);
  const first = all[0];
  d.items.push(
    { id: 'lentil', name: 'Lentejas cocidas', qty: 1200, unit: 'g', section: 11, place: 'Despensa', expires: day(180), price: 0.003, emoji: '🫘', protein: 7 },
    { id: 'zucchini', name: 'Calabacín', qty: 650, unit: 'g', section: 25, place: 'Nevera', expires: day(1), price: 0.002, emoji: '🥒', protein: 1.2 },
    { id: 'carrot', name: 'Zanahoria', qty: 500, unit: 'g', section: 25, place: 'Nevera', expires: day(5), price: 0.0015, emoji: '🥕', protein: 0.9 },
    { id: 'rice', name: 'Arroz integral', qty: 1000, unit: 'g', section: 11, place: 'Despensa', expires: day(180), price: 0.002, emoji: '🍚', protein: 7.5 },
    { id: 'tofu', name: 'Tofu firme', qty: 600, unit: 'g', section: 21, place: 'Nevera', expires: day(3), price: 0.007, emoji: '◻️', protein: 13 },
    { id: 'peas', name: 'Guisantes congelados', qty: 800, unit: 'g', section: 13, place: 'Congelador', expires: day(120), price: 0.003, emoji: '🫛', protein: 5 },
    { id: 'spinach', name: 'Espinacas', qty: 200, unit: 'g', section: 25, place: 'Nevera', expires: day(2), price: 0.006, emoji: '🥬', protein: 2.9 },
    { id: 'oil', name: 'Aceite de oliva', qty: 750, unit: 'ml', section: 11, place: 'Despensa', expires: day(240), price: 0.008, emoji: '🫒', protein: 0 },
    { id: 'paper', name: 'Papel higiénico', qty: 4, unit: 'ud', section: 14, place: 'Hogar', expires: '', price: 0.45, emoji: '🧻', protein: 0 },
    { id: 'petfood', name: `Comida de ${pet}`, qty: 6, unit: 'ud', section: 11, place: 'Despensa', expires: day(200), price: 1.25, emoji: '🐈', protein: 0 },
  );
  d.recipes.push(
    {
      id: 'lentils',
      name: 'Lentejas de la huerta',
      description: 'Una olla para hoy. Y un poco de tranquilidad para mañana.',
      minutes: 30,
      emoji: '🥘',
      servings: 4,
      ingredients: [
        { itemId: 'lentil', amount: 600, optional: false },
        { itemId: 'zucchini', amount: 300, optional: false },
        { itemId: 'carrot', amount: 200, optional: false },
        { itemId: 'oil', amount: 20, optional: true },
      ],
      steps: ['Corta las verduras en dados pequeños.', 'Sofríe las verduras con el aceite durante 8 minutos.', 'Añade las lentejas, un poco de agua y cocina a fuego suave.', 'Ajusta la textura y reparte la preparación.'],
    },
    {
      id: 'rice-tofu',
      name: 'Arroz con tofu y guisantes',
      description: 'Dorado, sencillo y listo en media hora.',
      minutes: 25,
      emoji: '🍛',
      servings: 2,
      ingredients: [
        { itemId: 'rice', amount: 150, optional: false },
        { itemId: 'tofu', amount: 250, optional: false },
        { itemId: 'peas', amount: 150, optional: false },
      ],
      steps: ['Cuece el arroz siguiendo su envase.', 'Dora el tofu cortado en dados.', 'Cocina los guisantes según su envase y mezcla.'],
    },
    {
      id: 'green',
      name: 'Salteado verde con tofu',
      description: 'Aprovecha las espinacas y termina con un toque de aceite.',
      minutes: 15,
      emoji: '🥗',
      servings: 2,
      ingredients: [
        { itemId: 'spinach', amount: 200, optional: false },
        { itemId: 'tofu', amount: 200, optional: false },
        { itemId: 'oil', amount: 10, optional: true },
      ],
      steps: ['Lava y prepara las espinacas.', 'Dora el tofu y añade las espinacas hasta que estén cocinadas.'],
    },
  );
  d.tuppers.push(
    { id: 't1', name: 'Crema de calabaza', grams: 700, created: day(-2), review: day(), place: 'Nevera', emoji: '🥣', proteinPer100: 1.4 },
    { id: 't2', name: 'Garbanzos con verduras', grams: 800, created: day(-1), review: day(1), place: 'Nevera', emoji: '🥘', proteinPer100: 5.5 },
    { id: 't3', name: 'Boloñesa de lentejas', grams: 500, created: day(-4), review: day(20), place: 'Congelador', emoji: '🍅', proteinPer100: 6 },
  );
  d.meals.push(
    { id: 'm1', tupperId: 't1', name: 'Crema de calabaza', date: day(), time: '14:30', kind: 'Comida', done: false, thawed: false },
    { id: 'm2', recipeId: 'rice-tofu', name: 'Arroz con tofu y guisantes', date: day(), time: '21:00', kind: 'Cena', done: false, thawed: false },
  );
  d.shopping.push(
    { id: 's1', name: 'Tomates', quantity: '500 g', checked: false, section: 25 },
    { id: 's2', name: 'Yogur de soja', quantity: '4 unidades', checked: false, section: 27 },
    { id: 's3', name: 'Detergente', quantity: '1 botella', checked: false, section: 14 },
  );
  d.expenses.push(
    { id: 'e1', label: 'Compra semanal · E.Leclerc', amount: 42.85, payer: COMMON, split: all, date: day(-2), category: 'Alimentación' },
    { id: 'e2', label: 'Frutería del barrio', amount: 8.4, payer: all[1] ?? first, split: all, date: day(-1), category: 'Alimentación' },
    { id: 'e3', label: 'Internet', amount: 29.9, payer: first, split: all, date: day(-5), category: 'Servicios' },
  );
  return d;
}
