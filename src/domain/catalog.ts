// Comparador de formatos y precios: un tipo de artículo, muchos envases y proveedores.
import { z } from 'zod';

const code = z.string().regex(/^\d+$/).optional();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const catalogSchema = z
  .object({
    version: z.literal(1),
    sections: z.array(z.object({ id: z.string().min(1), code, name: z.string().min(1) })),
    families: z.array(z.object({ id: z.string().min(1), code, sectionId: z.string(), name: z.string().min(1) })),
    types: z.array(
      z.object({
        id: z.string().min(1),
        code,
        familyId: z.string(),
        name: z.string().min(1),
        basis: z.enum(['seco', 'cocido', 'tal_como_se_vende']),
        proteinPer100: z.number().min(0).max(100).nullable(),
      }),
    ),
    providers: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })),
    offers: z.array(
      z.object({
        id: z.string().min(1),
        articleCode: code,
        ean: z.string().regex(/^(\d{8}|\d{12,14})$/).optional(),
        providerId: z.string(),
        typeId: z.string(),
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
    for (const group of [c.sections, c.families, c.types, c.providers, c.offers])
      if (new Set(group.map((x) => x.id)).size !== group.length) add('Hay códigos internos duplicados.');
    for (const f of c.families) if (!c.sections.some((s) => s.id === f.sectionId)) add('Familia con sección desconocida.');
    for (const t of c.types) if (!c.families.some((f) => f.id === t.familyId)) add('Tipo con familia desconocida.');
    for (const o of c.offers) {
      if (!c.types.some((t) => t.id === o.typeId)) add('Oferta con tipo desconocido.');
      if (!c.providers.some((p) => p.id === o.providerId)) add('Oferta con proveedor desconocido.');
    }
  });

export type Catalog = z.infer<typeof catalogSchema>;
export type Offer = Catalog['offers'][number];

/** Precio por kg, l o unidad. */
export function unitPrice(o: Offer) {
  return o.price / (o.packQty / (o.unit === 'g' || o.unit === 'ml' ? 1000 : 1));
}

export const baseUnit = (u: string) => (u === 'g' || u === 'kg' ? 'kg' : u === 'ml' || u === 'l' ? 'l' : 'ud');

/** La etiqueta del artículo prevalece; si no hay, se hereda la estimación del tipo. */
export function nutrition(c: Catalog, o: Offer) {
  return {
    value: o.proteinPer100 ?? c.types.find((t) => t.id === o.typeId)?.proteinPer100 ?? null,
    source: o.proteinPer100 !== null ? 'Etiqueta del artículo' : 'Estimación heredada del tipo',
  };
}

/** Código interno = segmentos de sección + familia + tipo + artículo (independiente del EAN). */
export function internalCode(c: Catalog, o: Offer) {
  const t = c.types.find((t) => t.id === o.typeId);
  const f = c.families.find((f) => f.id === t?.familyId);
  const s = c.sections.find((s) => s.id === f?.sectionId);
  const parts = [s?.code, f?.code, t?.code, o.articleCode];
  return parts.every((x) => x !== undefined) ? parts.join('') : null;
}

/** Datos ficticios de ejemplo: muestran que el envase más caro puede ser el más barato por kilo. */
export function exampleCatalog(date: string): Catalog {
  return {
    version: 1,
    sections: [{ id: 'DEMO-11', name: 'Alimentación seca', code: '11' }],
    families: [{ id: 'DEMO-CER', sectionId: 'DEMO-11', name: 'Arroces y cereales (ejemplo)', code: '1' }],
    types: [{ id: 'DEMO-ARROZ', familyId: 'DEMO-CER', name: 'Arroz integral seco', basis: 'seco', proteinPer100: 7.5 }],
    providers: [
      { id: 'DEMO-TIFER', name: 'TIFER' },
      { id: 'DEMO-LECLERC', name: 'E.Leclerc' },
    ],
    offers: [
      { id: 'O1', providerId: 'DEMO-LECLERC', typeId: 'DEMO-ARROZ', label: 'Paquete de arroz · 1 kg', packQty: 1, unit: 'kg', price: 2.1, proteinPer100: null, date },
      { id: 'O2', providerId: 'DEMO-TIFER', typeId: 'DEMO-ARROZ', label: 'Saco de arroz · 20 kg', packQty: 20, unit: 'kg', price: 30, proteinPer100: null, date },
      { id: 'O3', providerId: 'DEMO-LECLERC', typeId: 'DEMO-ARROZ', label: 'Formato ahorro · 5 kg', packQty: 5, unit: 'kg', price: 9.5, proteinPer100: 7.8, date },
    ],
  };
}
