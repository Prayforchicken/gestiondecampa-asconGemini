// Comparador de formatos y precios. Usa la estructura de la app: cada oferta es de un tipo
// (6 dígitos) y se compara con las demás del mismo tipo por kilo, litro o unidad.
import { z } from 'zod';
import { findType, guessType, internalCode as codeOf } from './estructura';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const catalogSchema = z
  .object({
    version: z.literal(2),
    providers: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })),
    offers: z.array(
      z.object({
        id: z.string().min(1),
        providerId: z.string(),
        /** Tipo de la estructura (6 dígitos). */
        type: z.string().regex(/^\d{6}$/),
        /** Número de artículo, si ya lo tiene en casa (3 dígitos). */
        article: z.string().regex(/^\d{3}$/).optional(),
        ean: z.string().regex(/^(\d{8}|\d{12,14})$/).optional(),
        label: z.string().min(1),
        packQty: z.number().finite().positive(),
        unit: z.enum(['kg', 'g', 'l', 'ml', 'ud']),
        price: z.number().finite().nonnegative(),
        proteinPer100: z.number().min(0).max(100).nullable(),
        date: isoDate,
      }),
    ),
  })
  .superRefine((c, ctx) => {
    const add = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    for (const group of [c.providers, c.offers]) if (new Set(group.map((x) => x.id)).size !== group.length) add('Hay ids repetidos.');
    for (const o of c.offers) {
      if (!findType(o.type)) add(`Oferta «${o.label}» con un tipo que no está en la estructura (${o.type}).`);
      if (!c.providers.some((p) => p.id === o.providerId)) add(`Oferta «${o.label}» con proveedor desconocido.`);
    }
  });

export type Catalog = z.infer<typeof catalogSchema>;
export type Offer = Catalog['offers'][number];

/** Precio por kg, l o unidad. */
export function unitPrice(o: Pick<Offer, 'price' | 'packQty' | 'unit'>) {
  return o.price / (o.packQty / (o.unit === 'g' || o.unit === 'ml' ? 1000 : 1));
}

export const baseUnit = (u: string) => (u === 'g' || u === 'kg' ? 'kg' : u === 'ml' || u === 'l' ? 'l' : 'ud');

/** La etiqueta del artículo prevalece; si no hay, se usa la estimación del tipo en la estructura. */
export function nutrition(o: Offer) {
  const t = findType(o.type);
  if (o.proteinPer100 !== null) return { value: o.proteinPer100, source: 'Etiqueta del artículo' };
  return { value: t?.protein ?? null, source: t?.protein != null ? `Estimación del tipo${t.basis ? ` (${t.basis})` : ''}` : 'Sin datos' };
}

export const internalCode = (o: Offer) => codeOf(o);

/**
 * Convierte un catálogo antiguo (versión 1, con secciones/familias/tipos propios) al formato
 * actual, adivinando el tipo por su nombre. Las ofertas que no encajan se descartan.
 */
export function upgradeCatalog(raw: any): Catalog {
  if (raw?.version === 2) return raw as Catalog;
  if (raw?.version !== 1 || !Array.isArray(raw.offers)) return exampleCatalog(new Date().toISOString().slice(0, 10));
  const typeOf = new Map<string, string | undefined>((raw.types ?? []).map((t: any) => [t.id, guessType(String(t.name))?.code]));
  return {
    version: 2,
    providers: raw.providers ?? [],
    offers: raw.offers
      .filter((o: any) => typeOf.get(o.typeId))
      .map((o: any) => ({
        id: o.id,
        providerId: o.providerId,
        type: typeOf.get(o.typeId)!,
        ...(o.ean ? { ean: o.ean } : {}),
        label: o.label,
        packQty: o.packQty,
        unit: o.unit,
        price: o.price,
        proteinPer100: o.proteinPer100 ?? null,
        date: o.date,
      })),
  };
}

/** Datos ficticios de ejemplo: el envase más caro puede ser el más barato por kilo. */
export function exampleCatalog(date: string): Catalog {
  return {
    version: 2,
    providers: [
      { id: 'DEMO-TIFER', name: 'TIFER' },
      { id: 'DEMO-LECLERC', name: 'E.Leclerc' },
    ],
    offers: [
      { id: 'O1', providerId: 'DEMO-LECLERC', type: '110202', label: 'Paquete de arroz integral · 1 kg', packQty: 1, unit: 'kg', price: 2.1, proteinPer100: null, date },
      { id: 'O2', providerId: 'DEMO-TIFER', type: '110202', label: 'Saco de arroz integral · 20 kg', packQty: 20, unit: 'kg', price: 30, proteinPer100: null, date },
      { id: 'O3', providerId: 'DEMO-LECLERC', type: '110202', label: 'Formato ahorro · 5 kg', packQty: 5, unit: 'kg', price: 9.5, proteinPer100: 7.8, date },
    ],
  };
}
