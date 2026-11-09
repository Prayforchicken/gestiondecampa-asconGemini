// Gastos del hogar: quién paga, entre quién se reparte y cómo quedar en paz.
import { useState } from 'react';
import { ArrowRight, HandCoins, House, Plus, ShoppingBasket, Wallet } from 'lucide-react';
import { useHome } from '../../app/context';
import type { ModalComp } from '../App';
import { day, fmtDate } from '../../domain/dates';
import { euros, uid } from '../../domain/format';
import { balances, monthByCategory, settleUp } from '../../domain/money';
import { COMMON, type Expense } from '../../domain/types';
import { Avatar, IconBadge, MemberPicker, PageHeading, num, str } from '../common';

const CATEGORIES = ['Alimentación', 'Hogar', 'Servicios', 'Alquiler', 'Mascota', 'Ocio', 'Otros'];

export function ExpensesPage() {
  const { state, open, me, members, nameOf, act } = useHome();
  const month = day().slice(0, 7);
  const thisMonth = state.expenses.filter((e) => e.date.slice(0, 7) === month);
  const total = thisMonth.reduce((a, e) => a + e.amount, 0);
  const common = thisMonth.filter((e) => e.payer === COMMON).reduce((a, e) => a + e.amount, 0);
  const b = balances(state);
  const mine = b.get(me.id) ?? 0;
  const transfers = settleUp(b);
  const categories = monthByCategory(state, month);
  const max = Math.max(1, ...categories.map(([, v]) => v));
  // Movimientos: gastos y pagos entre miembros, del más reciente al más antiguo.
  const movements = [
    ...state.expenses.map((e) => ({ kind: 'expense' as const, date: e.date, e })),
    ...state.settlements.map((p) => ({ kind: 'settlement' as const, date: p.date, p })),
  ]
    .sort((x, y) => y.date.localeCompare(x.date))
    .slice(0, 60);
  return (
    <>
      <PageHeading
        overline={state.household.name}
        title="Gastos"
        subtitle="Las cuentas, claras."
        action={
          <button className="button primary compact" onClick={() => open('expense', {})}>
            <Plus size={17} />
            <span>Añadir gasto</span>
          </button>
        }
      />
      <div className="stats-grid">
        <section className="card stat">
          <span>Gasto registrado este mes</span>
          <strong>{euros(total)}</strong>
          <small>Compras y gastos del hogar</small>
        </section>
        <section className="card stat">
          <span>Pagado con la cuenta común</span>
          <strong>{euros(common)}</strong>
          <small>No genera deudas entre vosotros</small>
        </section>
        <section className="card stat">
          <span>Tu saldo</span>
          <strong className={mine > 0.004 ? 'positive' : mine < -0.004 ? 'negative' : ''}>{euros(mine)}</strong>
          <small>{mine > 0.004 ? 'Te deben dinero' : mine < -0.004 ? 'Debes dinero' : 'Estás en paz'}</small>
        </section>
      </div>

      <div className="two-columns">
        <section className="card expenses">
          <div className="section-title">
            <div>
              <Wallet size={18} />
              <h2>Últimos movimientos</h2>
            </div>
            <button className="text-button" onClick={() => open('expense', {})}>
              <Plus size={16} /> Añadir
            </button>
          </div>
          {movements.map((m) =>
            m.kind === 'expense' ? (
              <button className="expense-row as-button" key={m.e.id} onClick={() => open('expense', { expenseId: m.e.id })}>
                <IconBadge color={m.e.category === 'Servicios' || m.e.category === 'Alquiler' ? 'blue' : 'green'}>
                  {m.e.category === 'Servicios' || m.e.category === 'Alquiler' ? <House size={18} /> : <ShoppingBasket size={18} />}
                </IconBadge>
                <div>
                  <strong>{m.e.label}</strong>
                  <small>
                    {fmtDate(m.e.date)} · paga {nameOf(m.e.payer)} · {m.e.category}
                    {m.e.payer !== COMMON && m.e.split.length < members.length ? ` · entre ${m.e.split.map(nameOf).join(', ')}` : ''}
                  </small>
                </div>
                <strong>{euros(m.e.amount)}</strong>
              </button>
            ) : (
              <div className="expense-row" key={m.p.id}>
                <IconBadge color="orange">
                  <HandCoins size={18} />
                </IconBadge>
                <div>
                  <strong>
                    {nameOf(m.p.from)} pagó a {nameOf(m.p.to)}
                  </strong>
                  <small>
                    {fmtDate(m.p.date)}
                    {m.p.note ? ` · ${m.p.note}` : ''}
                  </small>
                </div>
                <strong>{euros(m.p.amount)}</strong>
              </div>
            ),
          )}
          {!movements.length && <p className="muted spaced">Todavía no hay gastos.</p>}
        </section>
        <aside>
          <section className="card settings-card">
            <h2>Cuentas entre vosotros</h2>
            <p className="muted">Gastos pagados por una persona y repartidos a partes iguales.</p>
            {state.household.members
              .filter((m) => m.active || Math.abs(b.get(m.id) ?? 0) > 0.004)
              .map((m) => {
                const v = b.get(m.id) ?? 0;
                return (
                  <div className="balance-row" key={m.id}>
                    <Avatar member={m} size="small" />
                    <div>
                      <strong>{m.name}</strong>
                      <small>{v > 0.004 ? 'Le deben' : v < -0.004 ? 'Debe' : 'En paz'}</small>
                    </div>
                    <strong className={v > 0.004 ? 'positive' : v < -0.004 ? 'negative' : ''}>{euros(v)}</strong>
                  </div>
                );
              })}
            {transfers.length > 0 ? (
              <>
                <h3 className="subhead">Para quedar en paz</h3>
                {transfers.map((t) => (
                  <div className="transfer-row" key={t.from + t.to}>
                    <span>
                      {nameOf(t.from)} <ArrowRight size={12} /> {nameOf(t.to)}: <strong>{euros(t.amount)}</strong>
                    </span>
                    <button
                      className="button secondary compact"
                      onClick={() =>
                        act({ type: 'upsert', collection: 'settlements', entity: { id: uid(), from: t.from, to: t.to, amount: t.amount, date: day(), note: 'Ajuste de cuentas' } }, 'Pago registrado')
                      }
                    >
                      Registrar pago
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <p className="muted spaced">Nadie debe nada a nadie. 🌿</p>
            )}
            <button className="text-button spaced" onClick={() => open('settle')}>
              <HandCoins size={14} /> Registrar otro pago entre miembros
            </button>
          </section>
          {categories.length > 0 && (
            <section className="card settings-card spaced-card">
              <h2>Este mes por categoría</h2>
              <div className="category-bars">
                {categories.map(([cat, v]) => (
                  <div key={cat}>
                    <span>{cat}</span>
                    <span className="track">
                      <span style={{ width: `${(v / max) * 100}%` }} />
                    </span>
                    <strong>{euros(v)}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

const ExpenseModal: ModalComp = ({ data }) => {
  const { state, act, members, me } = useHome();
  const e = state.expenses.find((x) => x.id === data?.expenseId);
  const [split, setSplit] = useState<string[]>(e?.split.length ? e.split : members.map((m) => m.id));
  const [payer, setPayer] = useState<string>(e?.payer ?? me.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <>
      <h2>{e ? 'Editar gasto' : 'Añadir un gasto'}</h2>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          const f = new FormData(ev.currentTarget);
          const entity: Expense = { id: e?.id ?? uid(), label: str(f, 'label'), amount: num(f, 'amount'), payer, split, date: str(f, 'date'), category: str(f, 'category') };
          act({ type: 'upsert', collection: 'expenses', entity }, e ? 'Gasto actualizado' : 'Gasto guardado', true);
        }}
      >
        <label>
          Concepto
          <input name="label" defaultValue={e?.label} placeholder="Ej. compra en E.Leclerc" maxLength={100} required />
        </label>
        <div className="form-grid">
          <label>
            Importe (€)
            <input name="amount" type="number" min="0.01" step="0.01" defaultValue={e?.amount} required />
          </label>
          <label>
            Fecha
            <input name="date" type="date" defaultValue={e?.date ?? day()} required />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Pagado por
            <select value={payer} onChange={(ev) => setPayer(ev.target.value)}>
              <option value={COMMON}>Cuenta común</option>
              {state.household.members
                .filter((m) => m.active || m.id === e?.payer)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Categoría
            <select name="category" defaultValue={e?.category ?? 'Alimentación'}>
              {[...new Set([...CATEGORIES, e?.category ?? 'Otros'])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        {payer !== COMMON && (
          <>
            <span className="field-label">Se reparte entre</span>
            <MemberPicker value={split} onChange={setSplit} members={members} />
            <p className="footnote">A partes iguales. Si solo es para quien paga, deja solo a esa persona.</p>
          </>
        )}
        <button className="button primary full" type="submit" disabled={payer !== COMMON && !split.length}>
          Guardar gasto
        </button>
      </form>
      {e &&
        (confirmDelete ? (
          <button className="button danger-button full spaced" onClick={() => act({ type: 'remove', collection: 'expenses', entityId: e.id }, 'Gasto eliminado', true)}>
            Sí, eliminar este gasto
          </button>
        ) : (
          <button className="text-button danger spaced" onClick={() => setConfirmDelete(true)}>
            Eliminar gasto
          </button>
        ))}
    </>
  );
};

const SettleModal: ModalComp = () => {
  const { act, members, me, setError } = useHome();
  return (
    <>
      <h2>Pago entre miembros</h2>
      <p className="muted">Por ejemplo, un Bizum para quedar en paz.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (str(f, 'from') === str(f, 'to')) return setError('Elige dos personas distintas.');
          act({ type: 'upsert', collection: 'settlements', entity: { id: uid(), from: str(f, 'from'), to: str(f, 'to'), amount: num(f, 'amount'), date: str(f, 'date'), note: str(f, 'note') } }, 'Pago registrado', true);
        }}
      >
        <div className="form-grid">
          <label>
            Quién paga
            <select name="from" defaultValue={me.id}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            A quién
            <select name="to" defaultValue={members.find((m) => m.id !== me.id)?.id}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            Importe (€)
            <input name="amount" type="number" min="0.01" step="0.01" required />
          </label>
          <label>
            Fecha
            <input name="date" type="date" defaultValue={day()} required />
          </label>
        </div>
        <label>
          Nota (opcional)
          <input name="note" maxLength={100} placeholder="Bizum, efectivo…" />
        </label>
        <button className="button primary full" type="submit">
          Registrar pago
        </button>
      </form>
    </>
  );
};

export const expenseModals: Record<string, ModalComp> = { expense: ExpenseModal, settle: SettleModal };
