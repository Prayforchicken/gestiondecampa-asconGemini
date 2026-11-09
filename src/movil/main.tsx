// Comemos móvil (prueba): una app mínima que solo habla con el ordenador de casa.
//
//  - Se une al hogar con el enlace de invitación (no crea hogares).
//  - «Pedir datos»: descarga lo nuevo del servidor y enseña un resumen.
//  - «Mandar»: añade a la compra, marca comprados y apunta gastos.
//
// Usa el mismo motor que la app completa (operaciones + reducer), pero guarda sus datos
// aparte (prefijo «comemos-movil:»), así no se mezcla con la app completa del mismo móvil.
import { StrictMode, useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, Check, CloudOff, Cloud, Download, RefreshCw, Send, ShoppingBasket, Wallet, Zap } from 'lucide-react';
import { HouseholdStore, browserKV, decodeInvite, prefixedKV, type Snapshot } from '../app/store';
import type { OpBody } from '../domain/ops';
import { COMMON } from '../domain/types';
import { day, fromNow, relative } from '../domain/dates';
import { euros, qty, uid } from '../domain/format';
import { pendingDues, visibleKits } from '../domain/kits';
import { balances, settleUp } from '../domain/money';
import { guessType, sectionName } from '../domain/estructura';
import '../styles/base.css';
import '../styles/app.css';
import './movil.css';

// Guarda con un prefijo propio: los datos de esta app no pisan los de la app completa.
const store = new HouseholdStore(prefixedKV(browserKV(), 'comemos-movil:'));

function readInvite() {
  const m = location.hash.match(/#unirse=(.+)$/);
  return m ? m[1] : '';
}

function App() {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => store.startAutoSync(), []);
  if (!snap.state || !snap.sync) return <Connect />;
  const me = snap.state.household.members.find((m) => m.id === snap.me && m.active);
  if (!me) return <Who snap={snap} />;
  return <Home snap={snap} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-shell">
      <header className="m-header">
        <span className="brand-symbol">🌿</span>
        <div>
          <strong>comemos</strong>
          <small>móvil · prueba</small>
        </div>
      </header>
      {children}
    </div>
  );
}

function Connect() {
  const [code, setCode] = useState(readInvite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Shell>
      <section className="m-card">
        <h1>Conectar con el ordenador de casa</h1>
        <p className="muted">Pega el enlace de invitación (en la app completa: Hogar → Invitar). Esta versión solo pide y manda datos a casa; guarda una copia para poder verla sin conexión.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const raw = code.includes('#unirse=') ? code.split('#unirse=')[1] : code;
              const invite = decodeInvite(raw);
              await store.join({ ...invite, server: invite.server || location.origin });
              history.replaceState(null, '', location.pathname);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'No se pudo conectar.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="https://…/#unirse=…" rows={3} required aria-label="Enlace de invitación" />
          {error && <p className="m-error">{error}</p>}
          <button className="button primary full" disabled={busy}>
            {busy ? 'Conectando…' : 'Conectar'}
          </button>
        </form>
      </section>
    </Shell>
  );
}

function Who({ snap }: { snap: Snapshot }) {
  return (
    <Shell>
      <section className="m-card">
        <h1>¿Quién eres?</h1>
        <p className="muted">{snap.state!.household.name}</p>
        <div className="m-who">
          {snap.state!.household.members
            .filter((m) => m.active)
            .map((m) => (
              <button key={m.id} className="button secondary" onClick={() => store.setMe(m.id)}>
                <span className={'avatar small ' + m.color}>{m.name[0]}</span> {m.name}
              </button>
            ))}
        </div>
      </section>
    </Shell>
  );
}

function statusText(s: Snapshot) {
  if (s.status === 'syncing') return 'Pidiendo y mandando datos…';
  if (s.status === 'offline') return s.pending ? `Sin conexión · ${s.pending} cambio${s.pending === 1 ? '' : 's'} esperando` : 'Sin conexión con casa';
  if (s.status === 'error') return s.lastError || 'Error al hablar con casa';
  if (s.pending) return `${s.pending} cambio${s.pending === 1 ? '' : 's'} por mandar`;
  return 'Conectado con casa';
}

function Home({ snap }: { snap: Snapshot }) {
  const state = snap.state!;
  const me = state.household.members.find((m) => m.id === snap.me)!;
  const [msg, setMsg] = useState('');
  const [ping, setPing] = useState('');
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  const act = (body: OpBody, ok: string) => {
    try {
      store.dispatch(body);
      setMsg(ok);
      return true;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo guardar.');
      return false;
    }
  };

  const testConnection = async () => {
    const t0 = performance.now();
    try {
      const res = await fetch(snap.sync!.server.replace(/\/+$/, '') + '/api/health', { cache: 'no-store' });
      if (!res.ok) throw Error();
      setPing(`Responde en ${Math.round(performance.now() - t0)} ms`);
    } catch {
      setPing('No responde. ¿Está encendido el ordenador y conectado a la red?');
    }
  };

  const pending = state.shopping.filter((s) => !s.checked);
  const bought = state.shopping.filter((s) => s.checked);
  const dues = pendingDues(visibleKits(state.kits, me.id)).slice(0, 3);
  const meals = state.meals.filter((m) => !m.done).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 2);
  const urgent = state.items.filter((i) => i.qty > 0 && i.expires && i.expires <= day(2) && i.section !== 13).slice(0, 3);
  const mine = settleUp(balances(state)).filter((t) => t.from === me.id || t.to === me.id);
  const nameOf = (id: string) => (id === COMMON ? 'cuenta común' : state.household.members.find((m) => m.id === id)?.name ?? '—');
  const everyone = state.household.members.filter((m) => m.active).map((m) => m.id);

  return (
    <Shell>
      <section className={'m-card m-status sync-' + snap.status}>
        <div className="m-status-row">
          {snap.status === 'idle' && !snap.pending ? <Cloud size={22} /> : snap.status === 'syncing' ? <RefreshCw size={22} className="spin" /> : <CloudOff size={22} />}
          <div>
            <strong>{statusText(snap)}</strong>
            <small>
              {state.household.name} · {snap.sync!.server.replace(/^https?:\/\//, '')}
              {snap.lastSync ? ` · ${new Date(snap.lastSync).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </small>
          </div>
          <button className="m-me" onClick={() => store.setMe('')} aria-label="Cambiar de persona">
            <span className={'avatar small ' + me.color}>{me.name[0]}</span>
          </button>
        </div>
        <div className="button-row">
          <button className="button primary" onClick={() => void store.sync().then(() => setMsg('Datos al día'))}>
            <Download size={16} /> Pedir datos
          </button>
          <button className="button secondary" onClick={testConnection}>
            <Zap size={16} /> Probar
          </button>
        </div>
        {ping && <p className="m-ping">{ping}</p>}
      </section>

      <section className="m-card">
        <h2>
          <Send size={17} /> Mandar a casa
        </h2>
        <form
          className="m-inline"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const name = String(f.get('name') ?? '').trim();
            const t = guessType(name);
            if (
              act(
                { type: 'upsert', collection: 'shopping', entity: { id: uid(), name, quantity: String(f.get('qty') ?? '').trim(), checked: false, ...(t ? { section: Number(t.code.slice(0, 2)) } : {}) } },
                `«${name}» a la lista`,
              )
            )
              e.currentTarget.reset();
          }}
        >
          <label className="m-label">
            <ShoppingBasket size={15} /> A la lista de la compra
          </label>
          <div className="m-row">
            <input name="name" placeholder="¿Qué falta?" required maxLength={100} aria-label="Artículo" />
            <input name="qty" placeholder="Cantidad" maxLength={60} className="m-small" aria-label="Cantidad" />
            <button className="button primary" aria-label="Añadir a la lista">
              <Check size={16} />
            </button>
          </div>
        </form>
        <form
          className="m-inline"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const amount = Number(f.get('amount'));
            const label = String(f.get('label') ?? '').trim();
            if (
              act(
                { type: 'upsert', collection: 'expenses', entity: { id: uid(), label, amount, payer: me.id, split: everyone, date: day(), category: String(f.get('category')) } },
                `Gasto de ${euros(amount)} apuntado`,
              )
            )
              e.currentTarget.reset();
          }}
        >
          <label className="m-label">
            <Wallet size={15} /> Un gasto que he pagado yo (a partes iguales)
          </label>
          <div className="m-row">
            <input name="label" placeholder="Concepto" required maxLength={100} aria-label="Concepto" />
            <input name="amount" type="number" min="0.01" step="0.01" placeholder="€" required className="m-small" aria-label="Importe" inputMode="decimal" />
          </div>
          <div className="m-row">
            <select name="category" aria-label="Categoría" defaultValue="Alimentación">
              {['Alimentación', 'Hogar', 'Servicios', 'Alquiler', 'Mascota', 'Ocio', 'Otros'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button className="button primary">Apuntar</button>
          </div>
        </form>
      </section>

      <section className="m-card">
        <h2>
          <ShoppingBasket size={17} /> La compra · {pending.length}
        </h2>
        {pending.map((s) => (
          <button key={s.id} className="m-item" onClick={() => act({ type: 'patch', collection: 'shopping', entityId: s.id, fields: { checked: true } }, `«${s.name}» comprado`)}>
            <span className="check-button" />
            <span>
              {s.name}
              <small>
                {s.quantity}
                {s.section ? ` · ${sectionName(s.section)}` : ''}
              </small>
            </span>
          </button>
        ))}
        {!pending.length && <p className="muted">Nada pendiente.</p>}
        {bought.length > 0 && <p className="muted m-foot">{bought.length} marcado{bought.length === 1 ? '' : 's'} como comprado{bought.length === 1 ? '' : 's'}.</p>}
      </section>

      {(dues.length > 0 || urgent.length > 0 || mine.length > 0 || meals.length > 0) && (
        <section className="m-card">
          <h2>Lo que dice casa</h2>
          {meals.map((m) => (
            <p className="m-line" key={m.id}>
              🍽️ {m.kind} {relative(m.date).toLowerCase()} {m.time}: <strong>{m.name}</strong>
            </p>
          ))}
          {urgent.map((i) => (
            <p className="m-line" key={i.id}>
              ⏳ Úsalo pronto: <strong>{i.name}</strong> ({qty(i.qty)} {i.unit}, {relative(i.expires).toLowerCase()})
            </p>
          ))}
          {dues.map((d) => (
            <p className="m-line" key={`${d.kitId}-${d.itemId}-${d.kind}`}>
              {d.kitEmoji} {d.label} · <strong>{d.kind === 'missing' ? 'falta' : fromNow(d.date)}</strong>
            </p>
          ))}
          {mine.map((t) => (
            <p className="m-line" key={t.from + t.to}>
              💶 {t.from === me.id ? `Debes ${euros(t.amount)} a ${nameOf(t.to)}` : `${nameOf(t.from)} te debe ${euros(t.amount)}`}
            </p>
          ))}
        </section>
      )}

      <footer className="m-footer">
        <a href="./" className="text-button">
          Abrir la app completa <ArrowUpRight size={14} />
        </a>
        <button
          className="text-button danger"
          onClick={() => {
            if (confirm('¿Desconectar este móvil? Los datos siguen en el ordenador de casa.')) store.reset();
          }}
        >
          Desconectar
        </button>
      </footer>
      {msg && (
        <div className="toast m-toast" role="status">
          {msg}
        </div>
      )}
    </Shell>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
