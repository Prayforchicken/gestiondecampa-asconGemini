// Formatos de números y dinero en español.
export const euros = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

export const qty = (v: number) => Number(v.toFixed(1)).toLocaleString('es-ES');

export const uid = () => crypto.randomUUID();

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
