// Almacén del hogar en este dispositivo.
//
// Funciona primero en local (sin conexión) y, si el hogar está conectado a un servidor,
// sincroniza las operaciones con los demás móviles:
//
//   confirmed  = estado tras las operaciones que el servidor ya ha ordenado (seq)
//   pending    = operaciones hechas aquí que aún no ha confirmado el servidor
//   state      = confirmed + pending  (lo que ves en pantalla)
//
// Este archivo no depende de React: se puede probar con Node.
import type { AbacoTree } from '../domain/abaco';
import { opSchema, type Op, type OpBody } from '../domain/ops';
import { zodMessage } from '../domain/schemas';
import { applyAndLog, replay } from '../domain/reducer';
import type { MemberId, State } from '../domain/types';
import { migrateV1, withLegacyCampaigns } from '../domain/migrate';

export type SyncConfig = { server: string; householdId: string; secret: string };
export type RejectedNotice = { id: string; label: string; reason: string; at: string };
export type SyncStatus = 'local' | 'idle' | 'syncing' | 'offline' | 'error';

type Persisted = {
  schema: 2;
  confirmed: State;
  pending: Op[];
  seq: number;
  sync: SyncConfig | null;
  rejected: RejectedNotice[];
  lastSync: string | null;
};

export type Snapshot = {
  state: State | null;
  me: MemberId | null;
  deviceId: string;
  status: SyncStatus;
  pending: number;
  lastSync: string | null;
  lastError: string;
  sync: SyncConfig | null;
  rejected: RejectedNotice[];
  abaco: AbacoTree | null;
};

export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const KEYS = { data: 'comemos-v2', device: 'comemos-device', abaco: 'comemos-abaco', legacy: 'comemos-demo-v1', legacyCampaigns: 'campaigns' };

/** Datos de invitación que se comparten por enlace o QR. */
export type Invite = { server: string; householdId: string; secret: string; name: string };

export function encodeInvite(i: Invite): string {
  const json = JSON.stringify([i.server, i.householdId, i.secret, i.name]);
  return btoa(String.fromCharCode(...new TextEncoder().encode(json))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function decodeInvite(code: string): Invite {
  try {
    const b64 = code.trim().replaceAll('-', '+').replaceAll('_', '/');
    const bytes = Uint8Array.from(atob(b64 + '==='.slice((b64.length + 3) % 4)), (c) => c.charCodeAt(0));
    const [server, householdId, secret, name] = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof householdId !== 'string' || typeof secret !== 'string') throw Error();
    return { server: String(server ?? ''), householdId, secret, name: String(name ?? 'Hogar') };
  } catch {
    throw Error('El enlace de invitación no es válido o está incompleto.');
  }
}

const SYNC_INTERVAL = 15_000;

export class HouseholdStore {
  private data: Persisted | null = null;
  private device: { id: string; me: MemberId | null };
  private abaco: AbacoTree | null = null;
  private view: State | null = null;
  private status: SyncStatus = 'local';
  private lastError = '';
  private syncing: Promise<void> | null = null;
  private again = false;
  private listeners = new Set<() => void>();
  private snapshot!: Snapshot;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private kv: KV,
    private ids: () => string = () => crypto.randomUUID(),
    private fetcher: typeof fetch = (...a) => fetch(...a),
  ) {
    this.device = this.loadDevice();
    this.data = this.loadData();
    this.abaco = this.loadAbaco();
    this.status = this.data?.sync ? 'idle' : 'local';
    this.recompute();
  }

  // ---------- Suscripción (para React) ----------

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snapshot;

  private emit() {
    this.snapshot = {
      state: this.view,
      me: this.device.me,
      deviceId: this.device.id,
      status: this.status,
      pending: this.data?.pending.length ?? 0,
      lastSync: this.data?.lastSync ?? null,
      lastError: this.lastError,
      sync: this.data?.sync ?? null,
      rejected: this.data?.rejected ?? [],
      abaco: this.abaco,
    };
    for (const fn of this.listeners) fn();
  }

  // ---------- Carga y guardado ----------

  private loadDevice() {
    try {
      const d = JSON.parse(this.kv.get(KEYS.device) ?? 'null');
      if (d && typeof d.id === 'string') return { id: d.id as string, me: (d.me ?? null) as MemberId | null };
    } catch {
      /* dispositivo nuevo */
    }
    const d = { id: this.ids(), me: null };
    this.kv.set(KEYS.device, JSON.stringify(d));
    return d;
  }

  private loadData(): Persisted | null {
    try {
      const raw = this.kv.get(KEYS.data);
      if (raw) {
        const p = JSON.parse(raw) as Persisted;
        if (p.schema === 2 && p.confirmed?.version === 2) return { ...p, rejected: p.rejected ?? [], lastSync: p.lastSync ?? null };
      }
      // ¿Hay datos de la versión anterior de comemos?
      const legacy = this.kv.get(KEYS.legacy);
      if (legacy) {
        const migrated = migrateV1(JSON.parse(legacy), this.ids);
        if (migrated) {
          const s = withLegacyCampaigns(migrated, this.kv.get(KEYS.legacyCampaigns), this.ids);
          const p: Persisted = { schema: 2, confirmed: s, pending: [], seq: 0, sync: null, rejected: [], lastSync: null };
          this.kv.set(KEYS.data, JSON.stringify(p));
          if (!this.device.me) this.setMe(s.household.members[0].id, false);
          return p;
        }
      }
    } catch (e) {
      console.error('No se pudieron leer los datos guardados', e);
    }
    return null;
  }

  private loadAbaco(): AbacoTree | null {
    try {
      const t = JSON.parse(this.kv.get(KEYS.abaco) ?? 'null');
      return t && t.version === 1 && Array.isArray(t.rayons) ? t : null;
    } catch {
      return null;
    }
  }

  private persist() {
    if (this.data) this.kv.set(KEYS.data, JSON.stringify(this.data));
  }

  private recompute() {
    if (!this.data) {
      this.view = null;
    } else if (!this.data.pending.length) {
      this.view = this.data.confirmed;
    } else {
      this.view = replay(this.data.confirmed, this.data.pending).state;
    }
    this.emit();
  }

  // ---------- Quién soy en este dispositivo ----------

  setMe(memberId: MemberId, notify = true) {
    this.device.me = memberId;
    this.kv.set(KEYS.device, JSON.stringify(this.device));
    if (notify) this.emit();
  }

  // ---------- Cambios ----------

  /** Crea una operación, la aplica y la guarda. Lanza un error legible si no es posible. */
  dispatch(body: OpBody): Op {
    if (!this.data || !this.view) throw Error('Todavía no hay un hogar creado.');
    const candidate = { ...body, id: this.ids(), at: new Date().toISOString(), by: this.device.me ?? 'desconocido', device: this.device.id };
    const parsed = opSchema.safeParse(candidate);
    if (!parsed.success) throw Error(zodMessage(parsed.error));
    const op = parsed.data as Op;
    const next = structuredClone(this.view);
    applyAndLog(next, op); // lanza si no es válida: no se guarda nada
    if (this.data.sync) {
      this.data.pending.push(op);
      this.view = next;
      this.persist();
      this.emit();
      this.scheduleSync(400);
    } else {
      this.data.confirmed = next;
      this.view = next;
      this.persist();
      this.emit();
    }
    return op;
  }

  /** Empieza un hogar nuevo en este dispositivo (sin servidor). */
  createLocal(state: State, me: MemberId) {
    this.data = { schema: 2, confirmed: state, pending: [], seq: 0, sync: null, rejected: [], lastSync: null };
    this.status = 'local';
    this.persist();
    this.setMe(me, false);
    this.recompute();
  }

  /** Sustituye todos los datos (restaurar copia). Si hay servidor, se desconecta. */
  restore(state: State) {
    this.data = { schema: 2, confirmed: state, pending: [], seq: 0, sync: null, rejected: [], lastSync: null };
    this.status = 'local';
    this.persist();
    if (!state.household.members.some((m) => m.id === this.device.me)) this.setMe(state.household.members[0].id, false);
    this.recompute();
  }

  /** Borra los datos del hogar de este dispositivo (no toca el servidor). */
  reset() {
    this.data = null;
    this.kv.remove(KEYS.data);
    this.status = 'local';
    this.recompute();
  }

  dismissRejected() {
    if (!this.data) return;
    this.data.rejected = [];
    this.persist();
    this.emit();
  }

  // ---------- Estructura de clasificación ----------

  setAbaco(tree: AbacoTree | null) {
    this.abaco = tree;
    if (tree) this.kv.set(KEYS.abaco, JSON.stringify(tree));
    else this.kv.remove(KEYS.abaco);
    this.emit();
    if (tree && this.data?.sync) void this.pushAbaco().catch(() => {});
  }

  private async pushAbaco() {
    const cfg = this.data?.sync;
    if (!cfg || !this.abaco) return;
    await this.request(cfg, `/abaco`, { method: 'PUT', body: JSON.stringify(this.abaco) });
  }

  private async syncAbaco(remoteVersion: string | null) {
    const local = this.abaco?.importedAt ?? null;
    if (remoteVersion === local) return;
    if (local && (!remoteVersion || local > remoteVersion)) return this.pushAbaco();
    const cfg = this.data!.sync!;
    const tree = (await this.request(cfg, '/abaco')) as AbacoTree;
    if (tree?.version === 1) {
      this.abaco = tree;
      this.kv.set(KEYS.abaco, JSON.stringify(tree));
    }
  }

  // ---------- Servidor ----------

  private base(cfg: { server: string }) {
    return cfg.server.replace(/\/+$/, '') + '/api/households';
  }

  private async request(cfg: SyncConfig, path: string, init: RequestInit = {}) {
    const res = await this.fetcher(this.base(cfg) + '/' + cfg.householdId + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.secret, ...(init.headers ?? {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(Error(body.error || `Error del servidor (${res.status})`), { status: res.status });
    return body;
  }

  /** Comprueba que hay un servidor del hogar en esa dirección. */
  async checkServer(server: string): Promise<{ createNeedsToken: boolean }> {
    let res: Response;
    try {
      res = await this.fetcher(server.replace(/\/+$/, '') + '/api/health');
    } catch {
      throw Error('No se puede conectar con ese servidor. ¿Está encendido y la dirección es correcta?');
    }
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.app !== 'comemos') throw Error('En esa dirección no hay un servidor de comemos.');
    return { createNeedsToken: Boolean(body.createNeedsToken) };
  }

  /** Sube el hogar de este dispositivo a un servidor y devuelve la invitación para los demás. */
  async connectNew(server: string, createToken = ''): Promise<Invite> {
    if (!this.data || !this.view) throw Error('Todavía no hay un hogar creado.');
    if (this.data.sync) throw Error('Este hogar ya está conectado.');
    const genesis = this.view;
    const res = await this.fetcher(this.base({ server }), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(createToken ? { 'X-Create-Token': createToken } : {}) },
      body: JSON.stringify({ name: genesis.household.name, genesis }),
    }).catch(() => {
      throw Error('No se puede conectar con el servidor.');
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Error(body.error || `Error del servidor (${res.status})`);
    this.data = { ...this.data, confirmed: genesis, pending: [], seq: 0, sync: { server, householdId: body.id, secret: body.secret }, lastSync: new Date().toISOString() };
    this.status = 'idle';
    this.persist();
    this.recompute();
    if (this.abaco) await this.pushAbaco().catch(() => {});
    return this.invite()!;
  }

  /** Se une a un hogar existente. Sustituye los datos de este dispositivo. */
  async join(invite: Invite) {
    const cfg: SyncConfig = { server: invite.server, householdId: invite.householdId, secret: invite.secret };
    let body: { genesis: State; ops: { seq: number; op: Op }[]; seq: number; abacoVersion: string | null };
    try {
      body = await this.request(cfg, '');
    } catch (e) {
      if (e instanceof TypeError) throw Error('No se puede conectar con el servidor del hogar.');
      throw e;
    }
    const { state } = replay(body.genesis, body.ops.map((e) => e.op));
    this.data = { schema: 2, confirmed: state, pending: [], seq: body.seq, sync: cfg, rejected: [], lastSync: new Date().toISOString() };
    if (!state.household.members.some((m) => m.id === this.device.me)) this.device.me = null;
    this.kv.set(KEYS.device, JSON.stringify(this.device));
    this.status = 'idle';
    this.persist();
    await this.syncAbaco(body.abacoVersion).catch(() => {});
    this.recompute();
  }

  /** Deja de sincronizar. Los datos se quedan en este dispositivo. */
  disconnect() {
    if (!this.data) return;
    if (this.data.pending.length) this.data.confirmed = this.view!;
    this.data.pending = [];
    this.data.sync = null;
    this.data.seq = 0;
    this.status = 'local';
    this.persist();
    this.recompute();
  }

  invite(): Invite | null {
    const cfg = this.data?.sync;
    if (!cfg || !this.view) return null;
    return { ...cfg, name: this.view.household.name };
  }

  /** Envía lo pendiente y recibe lo nuevo. Si ya hay una sincronización en marcha, la encadena. */
  sync(): Promise<void> {
    if (!this.data?.sync) return Promise.resolve();
    if (this.syncing) {
      this.again = true;
      return this.syncing;
    }
    this.syncing = this.doSync().finally(() => {
      this.syncing = null;
      if (this.again) {
        this.again = false;
        void this.sync();
      }
    });
    return this.syncing;
  }

  private async doSync() {
    const data = this.data!;
    const cfg = data.sync!;
    const sending = data.pending.slice(0, 500);
    this.status = 'syncing';
    this.emit();
    try {
      const body = (await this.request(cfg, '/sync', { method: 'POST', body: JSON.stringify({ since: data.seq, ops: sending }) })) as {
        seq: number;
        ops: { seq: number; op: Op }[];
        abacoVersion: string | null;
      };
      if (this.data !== data || data.sync !== cfg) return; // el usuario cambió de hogar mientras tanto
      const fresh = body.ops.filter((e) => e.seq > data.seq).map((e) => e.op);
      const { state, rejected } = replay(data.confirmed, fresh);
      const received = new Set(fresh.map((o) => o.id));
      data.confirmed = state;
      data.seq = body.seq;
      data.pending = data.pending.filter((o) => !received.has(o.id));
      // Avisamos solo de los cambios de este dispositivo que no se pudieron aplicar.
      for (const r of rejected)
        if (r.op.device === this.device.id)
          data.rejected.unshift({ id: r.op.id, label: describeOp(r.op), reason: r.reason, at: r.op.at });
      data.rejected = data.rejected.slice(0, 20);
      data.lastSync = new Date().toISOString();
      this.status = 'idle';
      this.lastError = '';
      this.persist();
      await this.syncAbaco(body.abacoVersion).catch(() => {});
      this.recompute();
      if (data.pending.length) this.scheduleSync(200);
    } catch (e) {
      const status = (e as { status?: number }).status;
      this.status = status ? 'error' : 'offline';
      this.lastError =
        status === 401
          ? 'La clave del hogar ya no es válida. Pide un enlace nuevo.'
          : status === 404
            ? 'El servidor no conoce este hogar.'
            : status
              ? (e as Error).message
              : 'Sin conexión con el servidor. Los cambios se guardan aquí y se enviarán después.';
      this.emit();
    }
  }

  private scheduleSync(ms: number) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.sync();
    }, ms);
  }

  /** Sincroniza cada poco mientras la app está visible, y al volver a ella. */
  startAutoSync() {
    if (typeof window === 'undefined') return () => {};
    const tick = () => {
      if (document.visibilityState === 'visible') void this.sync();
    };
    const interval = setInterval(tick, SYNC_INTERVAL);
    window.addEventListener('online', tick);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    tick();
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', tick);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }
}

/** Texto corto para avisar de una operación rechazada. */
function describeOp(op: Op): string {
  switch (op.type) {
    case 'serve':
      return 'Registrar una comida';
    case 'cook':
      return 'Registrar una preparación';
    case 'stock.out':
      return 'Registrar una salida';
    case 'upsert':
    case 'patch':
      return 'Guardar un cambio';
    case 'remove':
      return 'Eliminar un elemento';
    default:
      return 'Un cambio';
  }
}

export function browserKV(): KV {
  return {
    get: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch (e) {
        console.error('No se pudo guardar en este navegador', e);
        throw Error('No se pudo guardar en este dispositivo (¿almacenamiento lleno o modo privado?).');
      }
    },
    remove: (k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* nada */
      }
    },
  };
}

export function memoryKV(initial: Record<string, string> = {}): KV & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, get: (k) => data[k] ?? null, set: (k, v) => void (data[k] = v), remove: (k) => void delete data[k] };
}
