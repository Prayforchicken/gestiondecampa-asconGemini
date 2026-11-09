// Varios hogares (y varios ordenadores) en el mismo dispositivo.
//
// Cada «perfil» es un hogar con su propio almacén y su propio servidor: el piso actual,
// el siguiente, la casa de tus padres... Los datos de cada perfil se guardan con un
// prefijo distinto, así nunca se mezclan. El perfil «principal» usa las claves de siempre
// (sin prefijo), para no mover los datos que ya existían.
import { KEYS, prefixedKV, type KV } from './store';

export type ProfileSummary = {
  id: string;
  name: string;
  server: string | null;
  members: string[];
  lastSync: string | null;
  empty: boolean;
};

type Registry = { active: string; list: string[] };

const REGISTRY = 'comemos-perfiles';
export const MAIN_PROFILE = 'principal';

export class Profiles {
  constructor(
    private kv: KV,
    private ids: () => string = () => crypto.randomUUID().slice(0, 8),
  ) {}

  private read(): Registry {
    try {
      const r = JSON.parse(this.kv.get(REGISTRY) ?? 'null');
      if (r && Array.isArray(r.list) && r.list.length && typeof r.active === 'string') return r;
    } catch {
      /* registro dañado: empezamos de nuevo sin borrar datos */
    }
    return { active: MAIN_PROFILE, list: [MAIN_PROFILE] };
  }

  private write(r: Registry) {
    this.kv.set(REGISTRY, JSON.stringify(r));
  }

  get active(): string {
    const r = this.read();
    return r.list.includes(r.active) ? r.active : r.list[0];
  }

  get list(): string[] {
    return this.read().list;
  }

  /** Almacén de un perfil. */
  kvFor(id: string): KV {
    return id === MAIN_PROFILE ? this.kv : prefixedKV(this.kv, `comemos-p:${id}:`);
  }

  /** Crea un perfil vacío y lo deja activo. */
  add(): string {
    const r = this.read();
    const id = this.ids();
    this.write({ active: id, list: [...r.list, id] });
    return id;
  }

  activate(id: string) {
    const r = this.read();
    if (!r.list.includes(id)) throw Error('Ese hogar ya no está en este dispositivo.');
    this.write({ ...r, active: id });
  }

  /** Quita un perfil y sus datos de este dispositivo (el servidor no se toca). */
  remove(id: string) {
    const r = this.read();
    const kv = this.kvFor(id);
    for (const key of [KEYS.data, KEYS.device]) kv.remove(key);
    let list = r.list.filter((x) => x !== id);
    if (!list.length) list = [MAIN_PROFILE];
    this.write({ active: r.active === id ? list[0] : r.active, list });
  }

  /** Resumen para la lista: nombre del hogar, servidor y personas. */
  summary(id: string): ProfileSummary {
    try {
      const p = JSON.parse(this.kvFor(id).get(KEYS.data) ?? 'null');
      const s = p?.confirmed;
      if (s?.household)
        return {
          id,
          name: s.household.name,
          server: p.sync?.server ?? null,
          members: s.household.members.filter((m: { active: boolean }) => m.active).map((m: { name: string }) => m.name),
          lastSync: p.lastSync ?? null,
          empty: false,
        };
    } catch {
      /* datos ilegibles */
    }
    return { id, name: 'Hogar sin configurar', server: null, members: [], lastSync: null, empty: true };
  }

  summaries(): ProfileSummary[] {
    return this.list.map((id) => this.summary(id));
  }
}
