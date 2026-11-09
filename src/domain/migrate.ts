// Migración desde las versiones anteriores:
//  - «comemos» 0.1 (localStorage `comemos-demo-v1`), pensada solo para Adrián y Rali.
//  - «Gestor de campañas» (localStorage `campaigns`).
import { exampleCatalog } from './catalog';
import { day } from './dates';
import { makeMember } from './seed';
import { COMMON, type Item, type MemberId, type State } from './types';
import { importCampaigns } from './campaigns';

const SECTION_FIX: Record<number, number> = { 1: 25, 2: 21, 4: 11, 10: 14 };
const PLACE_OK = new Set(['Nevera', 'Despensa', 'Congelador', 'Hogar']);

/** Convierte el estado v1 de comemos al formato actual. Devuelve null si no lo reconoce. */
export function migrateV1(v1: any, ids: () => string): State | null {
  if (!v1 || v1.version !== 1 || !Array.isArray(v1.items) || !Array.isArray(v1.recipes)) return null;
  const adrian = makeMember('Adrián', 0, ids());
  const rali = makeMember('Rali', 1, ids());
  const byName: Record<string, MemberId> = { Adrián: adrian.id, Rali: rali.id, Conjunta: COMMON };
  const everyone = [adrian.id, rali.id];
  const person = (name: string) => byName[name] ?? adrian.id;
  return {
    version: 2,
    revision: Number(v1.revision) || 0,
    household: { name: 'Nuestro hogar', members: [adrian, rali], pets: [{ id: ids(), name: 'Lenny', emoji: '🐈' }] },
    catalog: v1.catalog ?? exampleCatalog(day()),
    items: v1.items.map(
      (i: any): Item => ({
        ...i,
        section: SECTION_FIX[i.section] ?? i.section,
        place: PLACE_OK.has(i.place) ? i.place : 'Despensa',
        expires: i.expires ?? '',
      }),
    ),
    recipes: v1.recipes,
    tuppers: v1.tuppers ?? [],
    meals: v1.meals ?? [],
    shopping: v1.shopping ?? [],
    expenses: (v1.expenses ?? []).map((e: any) => ({ ...e, payer: person(e.payer), split: everyone })),
    settlements: [],
    consumptions: (v1.consumptions ?? [])
      .filter((c: any) => c.name !== 'Día de ejemplo')
      .map((c: any) => ({ ...c, person: person(c.person) })),
    kits: [],
    campaigns: [],
    applied: v1.applied ?? [],
    log: (v1.log ?? []).slice(0, 50).map((l: any) => ({ ...l, by: adrian.id })),
  };
}

/** Añade las campañas guardadas por la app antigua (si las hay) al primer miembro. */
export function withLegacyCampaigns(s: State, raw: string | null, ids: () => string): State {
  if (!raw) return s;
  try {
    const owner = s.household.members[0]?.id;
    if (!owner) return s;
    const campaigns = importCampaigns(JSON.parse(raw), owner, ids);
    return campaigns.length ? { ...s, campaigns: [...s.campaigns, ...campaigns] } : s;
  } catch {
    return s;
  }
}
