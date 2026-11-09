// Existencias. Un ingrediente puede pedir un artículo concreto (su id) o cualquier artículo
// de un tipo de la estructura («tipo:110202» = cualquier arroz integral, de la marca que sea).
import type { Item, State } from './types';
import { findType, formatCode } from './estructura';

export const TYPE_PREFIX = 'tipo:';
export const productOf = (i: Pick<Item, 'id' | 'productId'>) => i.productId ?? i.id;
export const isTypeKey = (key: string) => key.startsWith(TYPE_PREFIX);
export const typeKey = (code: string) => TYPE_PREFIX + code;

/** Lotes que sirven para un ingrediente, primero los que caducan antes (sin fecha, al final). */
export function lotsFor(s: Pick<State, 'items'>, key: string): Item[] {
  const match = isTypeKey(key) ? (i: Item) => i.type === key.slice(TYPE_PREFIX.length) : (i: Item) => productOf(i) === key;
  return s.items.filter(match).sort((a, b) => (a.expires || '9999').localeCompare(b.expires || '9999'));
}

export const stockFor = (s: Pick<State, 'items'>, key: string) => lotsFor(s, key).reduce((a, x) => a + x.qty, 0);

/** ¿Existe lo que pide el ingrediente? (un artículo del inventario o un tipo de la estructura) */
export const ingredientExists = (s: Pick<State, 'items'>, key: string) =>
  isTypeKey(key) ? Boolean(findType(key.slice(TYPE_PREFIX.length))) : s.items.some((i) => productOf(i) === key);

/** Nombre legible: «Arroz integral (cualquiera · 11.02.02)» o el nombre del artículo. */
export function ingredientName(s: Pick<State, 'items'>, key: string): string {
  if (isTypeKey(key)) {
    const code = key.slice(TYPE_PREFIX.length);
    return `${findType(code)?.name ?? 'Tipo ' + code} (cualquiera · ${formatCode(code)})`;
  }
  return s.items.find((i) => productOf(i) === key)?.name ?? key;
}

/** Unidad de un ingrediente: la del primer lote que encaje. */
export const ingredientUnit = (s: Pick<State, 'items'>, key: string) => lotsFor(s, key)[0]?.unit ?? 'g';
