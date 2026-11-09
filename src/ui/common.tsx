// Piezas pequeñas reutilizadas en toda la app.
import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Search, X } from 'lucide-react';
import type { Member, MemberId } from '../domain/types';
import { useHome } from '../app/context';
import { classificationPath, rayonList, searchAbaco } from '../domain/abaco';

export function PageHeading({ overline, title, subtitle, action }: { overline: string; title: string; subtitle: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <p className="overline">{overline}</p>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export function IconBadge({ children, color = 'green' }: { children: ReactNode; color?: string }) {
  return <span className={'icon-badge ' + color}>{children}</span>;
}

export function Empty({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <CheckCircle2 size={30} />
      <h3>{title}</h3>
      <p>{body}</p>
      {children}
    </div>
  );
}

export function Avatar({ member, size = 'normal' }: { member: Pick<Member, 'name' | 'color'> | undefined; size?: 'normal' | 'small' | 'mini' }) {
  const initial = (member?.name ?? '?').trim().charAt(0).toUpperCase();
  const cls = size === 'mini' ? 'mini-avatar' : 'avatar' + (size === 'small' ? ' small' : '');
  return (
    <span className={`${cls} ${member?.color ?? 'sand'}`} title={member?.name} aria-hidden="true">
      {initial}
    </span>
  );
}

/** Fila de avatares pequeños, p. ej. «para los tres». */
export function AvatarStack({ members }: { members: Member[] }) {
  return (
    <span className="avatar-stack">
      {members.slice(0, 5).map((m) => (
        <Avatar key={m.id} member={m} size="mini" />
      ))}
    </span>
  );
}

export const togetherLabel = (n: number) => (n === 1 ? 'Para ti' : n === 2 ? 'Para los dos' : n === 3 ? 'Para los tres' : `Para ${n}`);

/** Selector múltiple de miembros (para repartir gastos, comensales...). */
export function MemberPicker({ value, onChange, members }: { value: MemberId[]; onChange: (v: MemberId[]) => void; members: Member[] }) {
  return (
    <div className="member-picker" role="group">
      {members.map((m) => {
        const on = value.includes(m.id);
        return (
          <button
            type="button"
            key={m.id}
            className={on ? 'on' : ''}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== m.id) : [...value, m.id])}
          >
            <Avatar member={m} size="mini" /> {m.name}
          </button>
        );
      })}
    </div>
  );
}

/** Dueño: de la casa o de una persona. */
export function OwnerSelect({ name, defaultValue, allowHouse = true }: { name: string; defaultValue?: MemberId | null; allowHouse?: boolean }) {
  const { members } = useHome();
  return (
    <select name={name} defaultValue={defaultValue ?? ''}>
      {allowHouse && <option value="">De toda la casa</option>}
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          De {m.name}
        </option>
      ))}
    </select>
  );
}

export type Classification = { section: number; family?: string; subfamily?: string };

/** Elegir rayón (y, si hay estructura importada, familia y subfamilia) con búsqueda. */
export function ClassPicker({ value, onChange }: { value: Classification; onChange: (v: Classification) => void }) {
  const { snap } = useHome();
  const tree = snap.abaco;
  const [query, setQuery] = useState('');
  const rayons = useMemo(() => rayonList(tree), [tree]);
  const matches = useMemo(() => searchAbaco(tree, query, 12), [tree, query]);
  const known = rayons.some((r) => r.code === value.section);
  return (
    <div className="class-picker">
      <label>
        Sección (rayón)
        <select value={value.section} onChange={(e) => onChange({ section: Number(e.target.value) })}>
          {!known && <option value={value.section}>Rayón {value.section}</option>}
          {rayons.map((r) => (
            <option key={r.code} value={r.code}>
              {r.code} · {r.name}
            </option>
          ))}
        </select>
      </label>
      {tree && (
        <>
          <div className="search-field small">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar familia o subfamilia (aceite, tofu, pilas…)" aria-label="Buscar en la clasificación" />
            {query && (
              <button type="button" className="icon-button" aria-label="Borrar búsqueda" onClick={() => setQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
          {matches.length > 0 && (
            <div className="class-results">
              {matches.map((m) => (
                <button
                  type="button"
                  key={`${m.rayon}-${m.family}-${m.subfamily}`}
                  onClick={() => {
                    onChange({ section: m.rayon, family: m.family, subfamily: m.subfamily });
                    setQuery('');
                  }}
                >
                  <strong>{m.label}</strong>
                  <small>{m.path}</small>
                </button>
              ))}
            </div>
          )}
          {(value.family || value.subfamily) && <p className="class-path">{classificationPath(tree, value.section, value.family, value.subfamily)}</p>}
        </>
      )}
    </div>
  );
}

/** Lee un número de un formulario. */
export const num = (f: FormData, key: string) => Number(f.get(key));
export const str = (f: FormData, key: string) => String(f.get(key) ?? '').trim();
