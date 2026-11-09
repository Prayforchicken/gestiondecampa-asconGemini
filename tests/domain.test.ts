import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newHousehold, withDemoContent } from '../src/domain/seed';
import { applyAndLog, replay } from '../src/domain/reducer';
import type { Op, OpBody } from '../src/domain/ops';
import { addMonths, day, mondayOf } from '../src/domain/dates';
import { kitDues, kitFromTemplate, kitHealth, kitsToIcs, KIT_TEMPLATES, pendingDues, visibleKits } from '../src/domain/kits';
import { balances, settleUp } from '../src/domain/money';
import { DEPARTMENTS, TYPES, findType, formatCode, guessType, isValidEan, parseEstructura, searchTypes, withCheckDigit } from '../src/domain/estructura';
import { lotsFor, stockFor } from '../src/domain/stock';
import { duplicateCampaign, importCampaigns, newCampaign, safeUrl } from '../src/domain/campaigns';
import { migrateV1 } from '../src/domain/migrate';
import { unitPrice, nutrition, upgradeCatalog } from '../src/domain/catalog';
import { COMMON, type State } from '../src/domain/types';

let n = 0;
const ids = () => `id${++n}`;

function home(): State {
  return withDemoContent(newHousehold({ name: 'Piso', people: ['Ana', 'Leo', 'Sam'], pets: [{ name: 'Lenny', emoji: '🐈' }] }, ids));
}

function op(s: State, body: OpBody, by = s.household.members[0].id): Op {
  return { ...body, id: ids(), at: new Date().toISOString(), by, device: 'test' } as Op;
}

function apply(s: State, body: OpBody) {
  const next = structuredClone(s);
  applyAndLog(next, op(s, body));
  return next;
}

test('cocinar descuenta lotes por fecha y repartir conserva sobras', () => {
  const s = home();
  const [ana, leo] = s.household.members;
  const r = s.recipes.find((r) => r.id === 'lentils')!;
  const cooked = apply(s, { type: 'cook', recipeId: r.id, amounts: r.ingredients.map((g) => g.amount), yieldGrams: 1200, review: day(1), date: day(), tupperId: 'new-tupper' });
  assert.equal(cooked.items.find((i) => i.id === 'lentil')!.qty, 600);
  assert.equal(s.items.find((i) => i.id === 'lentil')!.qty, 1200, 'el estado original no cambia');
  const eaten = apply(cooked, {
    type: 'serve',
    tupperId: 'new-tupper',
    plates: [
      { person: ana.id, grams: 400, extraId: 'tofu', extraAmount: 50 },
      { person: leo.id, grams: 300, extraId: '', extraAmount: 0 },
    ],
    date: day(),
    ids: ['c1', 'c2'],
  });
  assert.equal(eaten.tuppers.find((t) => t.id === 'new-tupper')!.grams, 500);
  assert.equal(eaten.items.find((i) => i.id === 'tofu')!.qty, 550);
  assert.equal(eaten.consumptions.length, 2);
});

test('una operación imposible no modifica nada', () => {
  const s = home();
  const before = JSON.stringify(s);
  assert.throws(() => apply(s, { type: 'serve', tupperId: 't1', plates: [{ person: s.household.members[0].id, grams: 800, extraId: '', extraAmount: 0 }], date: day(), ids: ['x'] }));
  const tofuNeeded = { type: 'cook' as const, recipeId: 'green', amounts: [200, 9999, 0], yieldGrams: 100, review: day(1), date: day(), tupperId: 'z' };
  assert.throws(() => apply(s, tofuNeeded), /No queda suficiente/);
  assert.equal(JSON.stringify(s), before);
});

test('replay: todos los móviles llegan al mismo estado y saltan lo imposible', () => {
  const s = home();
  const [ana, leo] = s.household.members;
  // Ana y Leo se comen la crema sin conexión a la vez: solo cabe uno.
  const a = op(s, { type: 'serve', tupperId: 't1', plates: [{ person: ana.id, grams: 600, extraId: '', extraAmount: 0 }], date: day(), ids: ['a1'] }, ana.id);
  const b = op(s, { type: 'serve', tupperId: 't1', plates: [{ person: leo.id, grams: 500, extraId: '', extraAmount: 0 }], date: day(), ids: ['b1'] }, leo.id);
  const one = replay(s, [a, b]);
  const two = replay(s, [a, b]);
  assert.deepEqual(one.state, two.state);
  assert.equal(one.rejected.length, 1);
  assert.equal(one.rejected[0].op.id, b.id);
  assert.equal(one.state.tuppers.find((t) => t.id === 't1')!.grams, 100);
});

test('upsert y patch validan datos y referencias', () => {
  const s = home();
  assert.throws(() => apply(s, { type: 'upsert', collection: 'expenses', entity: { id: 'x', label: 'Luz', amount: 50, payer: 'nadie', split: [], date: day(), category: 'Servicios' } }), /Miembro desconocido/);
  assert.throws(() => apply(s, { type: 'upsert', collection: 'items', entity: { id: 'x', name: '' } }));
  const p = apply(s, { type: 'patch', collection: 'shopping', entityId: 's1', fields: { checked: true } });
  assert.equal(p.shopping.find((x) => x.id === 's1')!.checked, true);
  assert.throws(() => apply(s, { type: 'remove', collection: 'members', entityId: s.household.members[0].id }), /desactívalos/);
});

test('gastos compartidos: saldos y pagos mínimos', () => {
  let s = newHousehold({ name: 'Piso', people: ['Ana', 'Leo', 'Sam'], pets: [] }, ids);
  const [ana, leo, sam] = s.household.members.map((m) => m.id);
  s = apply(s, { type: 'upsert', collection: 'expenses', entity: { id: 'e1', label: 'Luz', amount: 90, payer: ana, split: [ana, leo, sam], date: day(), category: 'Servicios' } });
  s = apply(s, { type: 'upsert', collection: 'expenses', entity: { id: 'e2', label: 'Compra', amount: 30, payer: leo, split: [ana, leo, sam], date: day(), category: 'Alimentación' } });
  s = apply(s, { type: 'upsert', collection: 'expenses', entity: { id: 'e3', label: 'Bote', amount: 100, payer: COMMON, split: [ana, leo, sam], date: day(), category: 'Hogar' } });
  const b = balances(s);
  assert.equal(b.get(ana), 50);
  assert.equal(b.get(leo), -10);
  assert.equal(b.get(sam), -40);
  const t = settleUp(b);
  assert.deepEqual(t, [
    { from: sam, to: ana, amount: 40 },
    { from: leo, to: ana, amount: 10 },
  ]);
  s = apply(s, { type: 'upsert', collection: 'settlements', entity: { id: 'p1', from: sam, to: ana, amount: 40, date: day(), note: '' } });
  assert.equal(balances(s).get(sam), 0);
});

test('kits: vencimientos de tareas, caducidades y revisión', () => {
  let s = home();
  const ana = s.household.members[0].id;
  const kit = kitFromTemplate(KIT_TEMPLATES[0], null, ids);
  // Pilas cambiadas hace 13 meses (tocaba a los 12) y una lata que caduca en 10 días.
  const pilas = kit.items.find((i) => i.name.startsWith('Pilas'))!;
  pilas.lastDone = addMonths(day(), -13);
  const latas = kit.items.find((i) => i.name.startsWith('Latas'))!;
  latas.expires = day(10);
  s = apply(s, { type: 'upsert', collection: 'kits', entity: kit });
  const k = s.kits[0];
  assert.equal(kitHealth(k), 'overdue');
  const dues = pendingDues(s.kits);
  assert.equal(dues[0].label, 'Cambiar pilas: Pilas de repuesto');
  assert.ok(dues.some((d) => d.kind === 'expires' && d.health === 'soon'));
  // Se cambian las pilas: el siguiente aviso es dentro de 12 meses.
  s = apply(s, { type: 'kit.item.done', kitId: k.id, itemId: pilas.id, date: day(), logId: 'l1' });
  const next = kitDues(s.kits[0]).find((d) => d.itemId === pilas.id && d.kind === 'task')!;
  assert.equal(next.date, addMonths(day(), 12));
  // Revisión: la lata se repone con otra fecha; la radio falta y va a la compra.
  const radio = k.items.find((i) => i.name.startsWith('Radio'))!;
  s = apply(s, {
    type: 'kit.review',
    kitId: k.id,
    date: day(),
    results: [
      { itemId: latas.id, status: 'done', expires: day(400) },
      { itemId: radio.id, status: 'missing' },
    ],
    shopping: [{ id: 'buy-radio', name: radio.name, quantity: '1 ud' }],
    logId: 'l2',
  });
  const reviewed = s.kits[0];
  assert.equal(reviewed.items.find((i) => i.id === latas.id)!.expires, day(400));
  assert.equal(reviewed.items.find((i) => i.id === radio.id)!.missing, true);
  assert.ok(s.shopping.some((x) => x.id === 'buy-radio'));
  assert.equal(reviewed.lastReview, day());
  assert.match(reviewed.history[0].summary, /1 falta/);
  // Kits personales: solo los ve su dueño (y los de la casa todos).
  const mine = kitFromTemplate(KIT_TEMPLATES[1], ana, ids);
  s = apply(s, { type: 'upsert', collection: 'kits', entity: mine });
  assert.equal(visibleKits(s.kits, ana).length, 2);
  assert.equal(visibleKits(s.kits, s.household.members[1].id).length, 1);
});

test('kits: calendario .ics válido', () => {
  const kit = kitFromTemplate(KIT_TEMPLATES[0], null, ids);
  kit.items[0].expires = day(30);
  const ics = kitsToIcs([kit]);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.equal(ics.split('BEGIN:VEVENT').length - 1, ics.split('END:VEVENT').length - 1);
  assert.ok(ics.includes('TRIGGER:-P7D'));
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, 'línea demasiado larga: ' + line);
});

test('estructura propia: códigos bien formados y sin repetir', () => {
  const sections = DEPARTMENTS.flatMap((d) => d.sections);
  assert.ok(TYPES.length > 200, 'estructura completa');
  for (const d of DEPARTMENTS) for (const s of d.sections) assert.equal(String(s.code)[0], String(d.code), `sección ${s.code} fuera de su departamento`);
  assert.equal(new Set(sections.map((s) => s.code)).size, sections.length, 'secciones repetidas');
  assert.equal(new Set(TYPES.map((t) => t.code)).size, TYPES.length, 'tipos repetidos');
  for (const t of TYPES) assert.match(t.code, /^\d{6}$/);
  // Números que el hogar ya conoce
  assert.equal(sections.find((s) => s.code === 13)!.name, 'Congelados');
  assert.match(sections.find((s) => s.code === 21)!.name, /Proteínas vegetales/);
  assert.match(sections.find((s) => s.code === 24)!.name, /algas/);
  assert.throws(() => parseEstructura('1 Despensa\n  21 Mal puesta'), /empieza por su departamento/);
});

test('buscar y adivinar tipos sin tildes, por sinónimo o por código', () => {
  assert.equal(guessType('Arroz integral SOS 1 kg')?.code, '110202');
  assert.equal(guessType('Lentejas pardinas cocidas bote')?.name, 'Lentejas cocidas');
  assert.equal(guessType('Pilas AAA alcalinas')?.code.slice(0, 2), '42');
  assert.equal(guessType('Tofu ahumado')?.name, 'Tofu ahumado y marinado');
  assert.equal(searchTypes('pardina')[0].name, 'Lentejas secas');
  assert.equal(searchTypes('11.02')[0].code.slice(0, 4), '1102');
  assert.equal(findType('110202')?.protein, 7.5);
  assert.equal(formatCode('110202001'), '11.02.02.001');
});

test('EAN: dígito de control', () => {
  assert.ok(isValidEan('4006381333931'));
  assert.ok(!isValidEan('4006381333932'));
  assert.equal(withCheckDigit('400638133393'), '4006381333931');
  assert.ok(isValidEan('96385074'), 'EAN-8');
  assert.ok(!isValidEan('12345'));
});

test('códigos internos: dos arroces con EAN distintos, código casi igual', () => {
  let s = newHousehold({ name: 'Piso', people: ['Ana'], pets: [] }, ids);
  const a = { id: 'a1', name: 'Arroz integral SOS', qty: 1000, unit: 'g', section: 11, type: '110202', ean: withCheckDigit('841000000001'), place: 'Despensa', expires: '', price: 0, emoji: '🍚', protein: 7.5 };
  const b = { ...a, id: 'b1', name: 'Arroz integral marca blanca', ean: withCheckDigit('848000000002') };
  s = apply(s, { type: 'upsert', collection: 'items', entity: a });
  s = apply(s, { type: 'upsert', collection: 'items', entity: b });
  const [x, y] = s.items;
  assert.equal(`${x.type}${x.article}`, '110202001');
  assert.equal(`${y.type}${y.article}`, '110202002');
  assert.notEqual(x.ean, y.ean);
  // Un lote nuevo del mismo artículo hereda código y EAN.
  s = apply(s, { type: 'upsert', collection: 'items', entity: { ...a, id: 'a2', productId: 'a1', ean: undefined, article: undefined, qty: 500 } });
  const lot = s.items.find((i) => i.id === 'a2')!;
  assert.equal(lot.article, '001');
  assert.equal(lot.ean, x.ean);
  // El mismo EAN no puede ser de dos artículos distintos.
  assert.throws(() => apply(s, { type: 'upsert', collection: 'items', entity: { ...a, id: 'c1', name: 'Otro' } }), /ya es de/);
  // Reclasificar un artículo le da número nuevo en su tipo y sus lotes lo siguen.
  s = apply(s, { type: 'patch', collection: 'items', entityId: 'a1', fields: { type: '110201' } });
  assert.equal(s.items.find((i) => i.id === 'a1')!.type, '110201');
  assert.equal(s.items.find((i) => i.id === 'a2')!.type, '110201');
  assert.equal(s.items.find((i) => i.id === 'a1')!.section, 11);
});

test('códigos internos: dos móviles sin conexión nunca repiten número', () => {
  const s = newHousehold({ name: 'Piso', people: ['Ana', 'Leo'], pets: [] }, ids);
  const base = { qty: 1, unit: 'g', section: 11, type: '110401', place: 'Despensa', expires: '', price: 0, emoji: '🫘', protein: 24 };
  // Los dos crean «su» artículo 001 a la vez (sin ver el del otro).
  const oa = op(s, { type: 'upsert', collection: 'items', entity: { ...base, id: 'pardina', name: 'Lenteja pardina', article: '001' } });
  const ob = op(s, { type: 'upsert', collection: 'items', entity: { ...base, id: 'roja', name: 'Lenteja roja', article: '001' } });
  const r = replay(s, [oa, ob]);
  assert.deepEqual(r.state.items.map((i) => i.article), ['001', '002']);
  assert.deepEqual(replay(s, [oa, ob]).state, r.state, 'mismo resultado en todos los móviles');
});

test('recetas por tipo: gastan cualquier marca, primero la que caduca antes', () => {
  const s = home();
  const rice = (st: State) => st.items.filter((i) => i.type === '110202');
  assert.equal(stockFor(s, 'tipo:110202'), 6000);
  assert.equal(lotsFor(s, 'tipo:110202')[0].id, 'rice', 'caduca antes');
  const r = s.recipes.find((x) => x.id === 'rice-tofu')!;
  const amounts = r.ingredients.map((g) => (g.itemId === 'tipo:110202' ? 1100 : g.amount));
  const cooked = apply(s, { type: 'cook', recipeId: r.id, amounts, yieldGrams: 900, review: day(1), date: day(), tupperId: 'tt' });
  assert.equal(rice(cooked).find((i) => i.id === 'rice')!.qty, 0);
  assert.equal(rice(cooked).find((i) => i.id === 'rice-5kg')!.qty, 4900);
});

test('campañas: plantillas con fechas, duplicado e importación de la app antigua', () => {
  const owner = 'me';
  const start = '2026-11-12'; // jueves
  const c = newCampaign({ name: 'Navidad', type: 'Nacional', startDate: start, endDate: '2026-11-30' }, owner, ids);
  assert.equal(c.tasks.length, 11);
  assert.equal(c.tasks.find((t) => t.description.includes('Steeple'))!.due, '2026-11-10');
  assert.equal(c.tasks.find((t) => t.description.includes('Newsletter'))!.due, mondayOf(start));
  assert.equal(mondayOf(start), '2026-11-09');
  const copy = duplicateCampaign({ ...c, tasks: c.tasks.map((t) => ({ ...t, completed: true })) }, ids);
  assert.equal(copy.startDate, '2026-11-13');
  assert.ok(copy.tasks.every((t) => !t.completed));
  const legacy = [{ id: 'x', name: 'Vuelta al cole', type: 'Local', startDate: '2026-09-01', endDate: '2026-09-15', tasks: [], status: 'En Curso', url: 'example.com' }];
  const imported = importCampaigns(legacy, owner, ids);
  assert.equal(imported[0].tasks.length, 3, 'sin tareas → se crean las de la plantilla');
  assert.equal(imported[0].status, 'En Curso');
  assert.equal(safeUrl('example.com'), 'https://example.com/');
  assert.equal(safeUrl('javascript:alert(1)'), null);
});

test('propuesta de IA: atómica, idempotente y con pagador del hogar', () => {
  const s = home();
  const leo = s.household.members[1].id;
  const packet = { version: 1, id: 'p1', baseRevision: 0, actions: [{ type: 'add_shopping', name: 'Limones', quantity: '2 ud' }, { type: 'record_purchase', itemId: 'lentil', quantity: 700, total: 3, provider: 'Tienda', payer: leo, expires: day(5) }] };
  const next = apply(s, { type: 'ai.packet', packet: packet as any, ids: ['a', 'b'], date: day() });
  assert.equal(next.shopping.length, s.shopping.length + 1);
  assert.equal(next.items.find((i) => i.id === 'b')!.productId, 'lentil');
  assert.equal(next.expenses[0].payer, leo);
  assert.throws(() => apply(next, { type: 'ai.packet', packet: packet as any, ids: ['c', 'd'], date: day() }), /ya se ha aplicado/);
  const bad = { ...packet, id: 'p2', actions: [...packet.actions, { type: 'record_purchase', itemId: 'nope', quantity: 1, total: 1, provider: 'X', payer: COMMON, expires: '' }] };
  assert.throws(() => apply(s, { type: 'ai.packet', packet: bad as any, ids: ['e', 'f', 'g'], date: day() }), /desconocido/);
});

test('migración desde comemos 0.1', () => {
  const v1 = {
    version: 1,
    revision: 3,
    items: [{ id: 'tofu', name: 'Tofu', qty: 100, unit: 'g', section: 2, place: 'Nevera', expires: '', price: 0, emoji: '◻️', protein: 13 }],
    recipes: [],
    expenses: [{ id: 'e', label: 'Luz', amount: 20, payer: 'Rali', date: day(), category: 'Servicios' }],
    consumptions: [{ id: 'c', person: 'Adrián', name: 'Día de ejemplo', grams: 0, protein: 100, date: day() }],
    applied: [],
    log: [],
  };
  const s = migrateV1(v1, ids)!;
  const [adrian, rali] = s.household.members;
  assert.equal(adrian.name, 'Adrián');
  assert.equal(s.expenses[0].payer, rali.id);
  assert.deepEqual(s.expenses[0].split, [adrian.id, rali.id]);
  assert.equal(s.items[0].section, 21, 'sección 2 (tofu) pasa a la 21');
  assert.equal(s.items[0].type, '210101', 'se clasifica por su nombre');
  assert.equal(s.items[0].article, '001');
  assert.equal(s.consumptions.length, 0, 'se quitan los datos ficticios');
});

test('comparador: el saco de 20 kg es más caro por envase y más barato por kilo', () => {
  const c = home().catalog;
  assert.ok(c.offers[1].price > c.offers[0].price);
  assert.ok(unitPrice(c.offers[1]) < unitPrice(c.offers[0]));
  assert.equal(nutrition(c.offers[0]).value, 7.5, 'estimación del tipo en la estructura');
  assert.equal(nutrition(c.offers[2]).value, 7.8, 'la etiqueta prevalece');
  // Un catálogo antiguo (v1) se convierte adivinando el tipo por su nombre.
  const old = { version: 1, sections: [], families: [], types: [{ id: 'T', familyId: 'F', name: 'Arroz integral seco', basis: 'seco', proteinPer100: 7.5 }], providers: [{ id: 'P', name: 'X' }], offers: [{ id: 'o', providerId: 'P', typeId: 'T', label: 'Arroz', packQty: 1, unit: 'kg', price: 2, proteinPer100: null, date: day() }] };
  assert.equal(upgradeCatalog(old).offers[0].type, '110202');
});
