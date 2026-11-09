// Varios hogares (y ordenadores) en el mismo dispositivo: datos separados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HouseholdStore, memoryKV, KEYS } from '../src/app/store';
import { Profiles, MAIN_PROFILE } from '../src/app/profiles';
import { normalizeServer } from '../src/app/native';
import { newHousehold } from '../src/domain/seed';

let n = 0;
const ids = () => `p${++n}`;

test('cada hogar guarda sus datos aparte y se puede cambiar o quitar', () => {
  const kv = memoryKV();
  const profiles = new Profiles(kv, ids);
  assert.equal(profiles.active, MAIN_PROFILE);

  // Hogar 1 (el de siempre, sin prefijo: no se mueven los datos existentes)
  const s1 = newHousehold({ name: 'Piso actual', people: ['Adrián', 'Rali'], pets: [] }, ids);
  new HouseholdStore(profiles.kvFor(profiles.active)).createLocal(s1, s1.household.members[0].id);
  assert.ok(kv.data[KEYS.data], 'el principal usa las claves de siempre');

  // Hogar 2, con otro ordenador
  const second = profiles.add();
  assert.equal(profiles.active, second);
  const store2 = new HouseholdStore(profiles.kvFor(second));
  assert.equal(store2.getSnapshot().state, null, 'empieza vacío: no ve el otro hogar');
  const s2 = newHousehold({ name: 'Casa de mis padres', people: ['Adrián', 'Mamá'], pets: [] }, ids);
  store2.createLocal(s2, s2.household.members[0].id);

  assert.deepEqual(profiles.summaries().map((p) => p.name), ['Piso actual', 'Casa de mis padres']);
  profiles.activate(MAIN_PROFILE);
  assert.equal(new HouseholdStore(profiles.kvFor(profiles.active)).getSnapshot().state?.household.name, 'Piso actual');

  profiles.remove(second);
  assert.deepEqual(profiles.list, [MAIN_PROFILE]);
  assert.ok(!Object.keys(kv.data).some((k) => k.startsWith(`comemos-p:${second}:`)), 'sus datos se borran');
});

test('direcciones de servidor escritas a mano', () => {
  assert.equal(normalizeServer('192.168.1.20:8787'), 'http://192.168.1.20:8787');
  assert.equal(normalizeServer('https://casa.tu-red.ts.net/'), 'https://casa.tu-red.ts.net');
  assert.equal(normalizeServer('  http://portatil:8787// '), 'http://portatil:8787');
});

test('identificadores también en páginas no seguras (http://IP de casa)', async () => {
  const { uid } = await import('../src/domain/format');
  const original = crypto.randomUUID;
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  try {
    const a = uid();
    assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(a, uid());
  } finally {
    Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
  }
});

