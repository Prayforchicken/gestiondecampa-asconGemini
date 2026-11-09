// Primera vez: crear un hogar nuevo o unirse a uno existente con un enlace de invitación.
import { useState } from 'react';
import { ArrowRight, Leaf, Link2, Minus, Plus, Users } from 'lucide-react';
import type { HouseholdStore } from '../../app/store';
import { decodeInvite } from '../../app/store';
import { newHousehold, withDemoContent } from '../../domain/seed';
import type { State } from '../../domain/types';
import { uid } from '../../domain/format';
import { Avatar } from '../common';

export function Onboarding({ store, invite, onDone }: { store: HouseholdStore; invite: string | null; onDone: () => void }) {
  const [mode, setMode] = useState<'create' | 'join'>(invite ? 'join' : 'create');
  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <span className="brand">
          <span className="brand-symbol">
            <Leaf size={23} />
          </span>
          comemos<span className="brand-dot">.</span>
        </span>
        <h1>{mode === 'create' ? 'Vuestro hogar, en una sola app.' : 'Únete a tu hogar'}</h1>
        <p>Cocina, inventario, compra, gastos compartidos y kits de emergencia. Para ti, tu pareja y tus compañeros de piso.</p>
        <div className="split-choice">
          <button className={mode === 'create' ? 'selected' : ''} onClick={() => setMode('create')}>
            <Users size={20} />
            <strong>Crear un hogar</strong>
            <small>Empiezas tú y luego invitas a los demás.</small>
          </button>
          <button className={mode === 'join' ? 'selected' : ''} onClick={() => setMode('join')}>
            <Link2 size={20} />
            <strong>Tengo una invitación</strong>
            <small>Alguien del piso ya lo creó y te pasó un enlace.</small>
          </button>
        </div>
        {mode === 'create' ? <CreateForm store={store} /> : <JoinForm store={store} initial={invite ?? ''} onDone={onDone} />}
      </div>
    </div>
  );
}

function CreateForm({ store }: { store: HouseholdStore }) {
  const [people, setPeople] = useState<string[]>(['', '']);
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        try {
          const pet = String(f.get('pet') ?? '').trim();
          let s = newHousehold({ name: String(f.get('home') ?? ''), people, pets: pet ? [{ name: pet, emoji: String(f.get('petEmoji') || '🐈') }] : [] }, uid);
          if (f.get('demo')) s = withDemoContent(s);
          store.createLocal(s, s.household.members[0].id);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo crear el hogar.');
        }
      }}
    >
      <label>
        Nombre del hogar
        <input name="home" placeholder="Ej. Piso de la calle Mayor" maxLength={60} defaultValue="Nuestro hogar" />
      </label>
      <label>Quién vive aquí (tú primero)</label>
      <div className="people-list">
        {people.map((p, i) => (
          <div key={i}>
            <Avatar member={{ name: p || '?', color: (['peach', 'purple', 'mint', 'sky', 'rose', 'sand'] as const)[i % 6] }} size="small" />
            <input
              value={p}
              onChange={(e) => setPeople(people.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={i === 0 ? 'Tu nombre' : 'Nombre (opcional)'}
              maxLength={40}
              required={i === 0}
              aria-label={i === 0 ? 'Tu nombre' : `Persona ${i + 1}`}
            />
            {i > 0 && (
              <button type="button" className="icon-button" aria-label="Quitar persona" onClick={() => setPeople(people.filter((_, j) => j !== i))}>
                <Minus size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      {people.length < 12 && (
        <button type="button" className="text-button" onClick={() => setPeople([...people, ''])}>
          <Plus size={14} /> Añadir otra persona
        </button>
      )}
      <div className="form-grid">
        <label>
          Mascota (opcional)
          <input name="pet" placeholder="Ej. Lenny" maxLength={40} />
        </label>
        <label>
          Emoji
          <select name="petEmoji" defaultValue="🐈">
            <option>🐈</option>
            <option>🐕</option>
            <option>🐇</option>
            <option>🐦</option>
            <option>🐢</option>
            <option>🐾</option>
          </select>
        </label>
      </div>
      <label className="checkbox-label">
        <input type="checkbox" name="demo" defaultChecked style={{ width: 'auto', display: 'inline', minHeight: 0, marginRight: 8 }} />
        Empezar con recetas e inventario de ejemplo (se pueden borrar)
      </label>
      {error && <p className="error">{error}</p>}
      <button className="button primary full" type="submit">
        Crear hogar <ArrowRight size={16} />
      </button>
      <p className="footnote">Se guarda en este dispositivo. Cuando quieras compartirlo, en «Hogar» lo conectas a un servidor y mandas el enlace al resto.</p>
    </form>
  );
}

function JoinForm({ store, initial, onDone }: { store: HouseholdStore; initial: string; onDone: () => void }) {
  const [code, setCode] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          // Acepta el enlace completo o solo el código.
          const raw = code.includes('#unirse=') ? code.split('#unirse=')[1] : code;
          const invite = decodeInvite(raw);
          await store.join({ ...invite, server: invite.server || location.origin });
          history.replaceState(null, '', '#/hoy');
          onDone();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo unir al hogar.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Enlace o código de invitación
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Pega aquí el enlace que te han pasado" required />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="button primary full" type="submit" disabled={busy}>
        {busy ? 'Conectando…' : 'Unirme'} <ArrowRight size={16} />
      </button>
      <p className="footnote">Descargaremos los datos del hogar. Después elegirás quién eres.</p>
    </form>
  );
}

/** Elegir quién usa este dispositivo. Se recuerda solo en este móvil. */
export function WhoAreYou({ store, state }: { store: HouseholdStore; state: State }) {
  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <h1>¿Quién eres?</h1>
        <p>{state.household.name}. Lo recordaremos en este dispositivo; puedes cambiarlo cuando quieras.</p>
        <div className="who-grid">
          {state.household.members
            .filter((m) => m.active)
            .map((m) => (
              <button key={m.id} onClick={() => store.setMe(m.id)}>
                <Avatar member={m} />
                {m.name}
              </button>
            ))}
        </div>
        <p className="footnote">¿No apareces? Pide a alguien del piso que te añada en «Hogar → Personas».</p>
      </div>
    </div>
  );
}
