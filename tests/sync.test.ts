// Prueba de extremo a extremo: un servidor real y dos «móviles» (almacenes en memoria).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { HouseholdStore, memoryKV, encodeInvite, decodeInvite } from '../src/app/store';
import { newHousehold, withDemoContent } from '../src/domain/seed';
import { day } from '../src/domain/dates';

let server: Server;
let url = '';
let dir = '';

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'comemos-test-'));
  process.env.DATA_DIR = dir;
  process.env.DIST_DIR = join(dir, 'no-dist');
  // @ts-expect-error módulo JavaScript sin tipos
  const { createApp } = await import('../server/index.mjs');
  server = createApp();
  await new Promise<void>((ok) => server.listen(0, ok));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

let n = 0;
const ids = () => `x${++n}`;

test('dos móviles comparten el hogar y resuelven conflictos igual', async () => {
  // Móvil de Ana: crea el hogar y lo sube al servidor.
  const ana = new HouseholdStore(memoryKV());
  const s = withDemoContent(newHousehold({ name: 'Piso', people: ['Ana', 'Leo'], pets: [] }, ids));
  const [anaId, leoId] = s.household.members.map((m) => m.id);
  ana.createLocal(s, anaId);
  ana.dispatch({ type: 'household.rename', name: 'Piso de la calle Mayor' });
  await ana.checkServer(url);
  const invite = await ana.connectNew(url);
  assert.equal(ana.getSnapshot().status, 'idle');

  // El enlace de invitación ida y vuelta.
  const code = encodeInvite(invite);
  assert.deepEqual(decodeInvite(code), invite);

  // Móvil de Leo: se une con el enlace.
  const leo = new HouseholdStore(memoryKV());
  await leo.join(decodeInvite(code));
  leo.setMe(leoId);
  assert.equal(leo.getSnapshot().state!.household.name, 'Piso de la calle Mayor');

  // Cambios en paralelo sin conexión: los dos se sirven la crema (700 g). Solo cabe uno.
  ana.dispatch({ type: 'serve', tupperId: 't1', plates: [{ person: anaId, grams: 500, extraId: '', extraAmount: 0 }], date: day(), ids: ['ca'] });
  leo.dispatch({ type: 'serve', tupperId: 't1', plates: [{ person: leoId, grams: 400, extraId: '', extraAmount: 0 }], date: day(), ids: ['cl'] });
  leo.dispatch({ type: 'upsert', collection: 'shopping', entity: { id: 'lim', name: 'Limones', quantity: '3', checked: false } });

  await ana.sync();
  await leo.sync();
  await ana.sync();

  const a = ana.getSnapshot();
  const l = leo.getSnapshot();
  assert.deepEqual(a.state, l.state, 'los dos móviles ven exactamente lo mismo');
  assert.equal(a.pending, 0);
  assert.equal(l.pending, 0);
  assert.equal(a.state!.tuppers.find((t) => t.id === 't1')!.grams, 200);
  assert.ok(a.state!.shopping.some((x) => x.id === 'lim'));
  // Leo recibe el aviso de que su plato no se pudo registrar; Ana no recibe ninguno.
  assert.equal(l.rejected.length, 1);
  assert.equal(a.rejected.length, 0);

  // Reintento tras un corte: reenviar la misma operación no la duplica.
  const op = leo.dispatch({ type: 'patch', collection: 'shopping', entityId: 'lim', fields: { checked: true } });
  const raw = await fetch(`${url}/api/households/${invite.householdId}/sync`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + invite.secret, 'Content-Type': 'application/json' },
    body: JSON.stringify({ since: 0, ops: [op] }),
  }).then((r) => r.json());
  await leo.sync();
  await ana.sync();
  assert.equal(raw.ops.filter((e: any) => e.op.id === op.id).length, 1);
  assert.deepEqual(ana.getSnapshot().state, leo.getSnapshot().state);
});

test('la estructura de clasificación se comparte por el servidor', async () => {
  const ana = new HouseholdStore(memoryKV());
  const s = newHousehold({ name: 'Casa', people: ['Ana', 'Leo'], pets: [] }, ids);
  ana.createLocal(s, s.household.members[0].id);
  const invite = await ana.connectNew(url);
  ana.setAbaco({ version: 1, importedAt: '2026-11-09T10:00:00.000Z', departments: [{ code: '01', name: 'PGC' }], rayons: [{ code: 11, name: 'Alimentacion seca', dept: '01', families: [] }] });
  await new Promise((ok) => setTimeout(ok, 50));
  const leo = new HouseholdStore(memoryKV());
  await leo.join(invite);
  assert.equal(leo.getSnapshot().abaco?.rayons[0].code, 11);
});

test('el servidor rechaza claves incorrectas y datos no válidos', async () => {
  const ana = new HouseholdStore(memoryKV());
  const s = newHousehold({ name: 'Casa', people: ['Ana'], pets: [] }, ids);
  ana.createLocal(s, s.household.members[0].id);
  const invite = await ana.connectNew(url);
  const intruder = new HouseholdStore(memoryKV());
  await assert.rejects(() => intruder.join({ ...invite, secret: 'mala' }), /Clave del hogar incorrecta/);
  const res = await fetch(`${url}/api/households/${invite.householdId}/sync`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + invite.secret },
    body: JSON.stringify({ since: 0, ops: [{ nope: true }] }),
  });
  assert.equal(res.status, 400);
  const traversal = await fetch(`${url}/../../etc/passwd`);
  assert.notEqual(traversal.status, 500);
});

test('sin conexión los cambios esperan y se envían después', async () => {
  const ana = new HouseholdStore(memoryKV());
  const s = withDemoContent(newHousehold({ name: 'Casa', people: ['Ana'], pets: [] }, ids));
  ana.createLocal(s, s.household.members[0].id);
  await ana.connectNew(url);
  // Simulamos que se cae la red.
  const offline = new HouseholdStore(memoryKV(), undefined, async () => {
    throw new TypeError('fetch failed');
  });
  offline.createLocal(s, s.household.members[0].id);
  // (un almacén local no sincroniza: comprobamos el estado «offline» con el conectado)
  const realFetch = globalThis.fetch;
  let down = true;
  const flaky = new HouseholdStore(memoryKV(), undefined, (...a) => (down ? Promise.reject(new TypeError('fetch failed')) : realFetch(...a)));
  flaky.createLocal(s, s.household.members[0].id);
  down = false;
  await flaky.connectNew(url);
  down = true;
  flaky.dispatch({ type: 'upsert', collection: 'shopping', entity: { id: 'pan', name: 'Pan', quantity: '1', checked: false } });
  await flaky.sync();
  assert.equal(flaky.getSnapshot().status, 'offline');
  assert.equal(flaky.getSnapshot().pending, 1);
  assert.ok(flaky.getSnapshot().state!.shopping.some((x) => x.id === 'pan'), 'el cambio se ve aunque no haya red');
  down = false;
  await flaky.sync();
  assert.equal(flaky.getSnapshot().status, 'idle');
  assert.equal(flaky.getSnapshot().pending, 0);
});
