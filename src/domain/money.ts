// Cuentas claras entre compañeros: quién ha puesto más y quién debe a quién.
import { COMMON, type MemberId, type State } from './types';

/** Saldo de cada miembro. Positivo = le deben dinero. Negativo = debe dinero. */
export function balances(s: State): Map<MemberId, number> {
  const b = new Map<MemberId, number>(s.household.members.map((m) => [m.id, 0]));
  const add = (id: MemberId, v: number) => b.set(id, (b.get(id) ?? 0) + v);
  for (const e of s.expenses) {
    // Lo pagado con la cuenta común no genera deudas.
    if (e.payer === COMMON || !e.split.length) continue;
    add(e.payer, e.amount);
    const share = e.amount / e.split.length;
    for (const m of e.split) add(m, -share);
  }
  for (const p of s.settlements) {
    add(p.from, p.amount);
    add(p.to, -p.amount);
  }
  // Redondeo a céntimos para evitar «debes 0,0000001 €».
  for (const [k, v] of b) b.set(k, Math.round(v * 100) / 100);
  return b;
}

export type Transfer = { from: MemberId; to: MemberId; amount: number };

/** El mínimo de pagos (aproximado) para quedar en paz. */
export function settleUp(b: Map<MemberId, number>): Transfer[] {
  const debtors = [...b].filter(([, v]) => v < -0.004).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const creditors = [...b].filter(([, v]) => v > 0.004).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].v, creditors[j].v);
    out.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(amount * 100) / 100 });
    debtors[i].v -= amount;
    creditors[j].v -= amount;
    if (debtors[i].v < 0.005) i++;
    if (creditors[j].v < 0.005) j++;
  }
  return out.filter((t) => t.amount >= 0.01);
}

/** Gasto del mes (AAAA-MM) por categoría. */
export function monthByCategory(s: State, month: string) {
  const map = new Map<string, number>();
  for (const e of s.expenses) if (e.date.slice(0, 7) === month) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  return [...map].sort((a, b) => b[1] - a[1]);
}
