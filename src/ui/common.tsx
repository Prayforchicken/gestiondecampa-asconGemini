// Piezas pequeñas reutilizadas en toda la app.
import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Search, X } from 'lucide-react';
import type { Member, MemberId } from '../domain/types';
import { useHome } from '../app/context';
import { DEPARTMENTS, findType, formatCode, searchTypes, typePath } from '../domain/estructura';

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

export type Classification = { section: number; type?: string };

/** Código interno con formato: 11.02.02.001. Los 6 primeros dígitos (el tipo) en negrita. */
export function CodeTag({ type, article, title }: { type?: string; article?: string; title?: string }) {
  if (!type) return null;
  return (
    <span className="code-tag" title={title ?? 'Código interno'}>
      <strong>{formatCode(type)}</strong>
      {article ? '.' + article : ''}
    </span>
  );
}

/** Sección de la estructura (agrupada por departamento). */
export function SectionSelect({ value, onChange, name }: { value?: number; onChange?: (v: number) => void; name?: string }) {
  return (
    <select name={name} value={value} onChange={(e) => onChange?.(Number(e.target.value))}>
      {value !== undefined && !DEPARTMENTS.some((d) => d.sections.some((s) => s.code === value)) && <option value={value}>Sección {value}</option>}
      {DEPARTMENTS.map((d) => (
        <optgroup key={d.code} label={`${d.code} · ${d.name}`}>
          {d.sections.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} · {s.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/**
 * Elegir el tipo de un artículo en la estructura. Se busca por nombre, sinónimo o código.
 * `suggestion` es un tipo adivinado por el nombre del artículo (se ofrece con un toque).
 */
export function TypePicker({ value, onChange, suggestion }: { value: Classification; onChange: (v: Classification) => void; suggestion?: string }) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => searchTypes(query, 10), [query]);
  const current = findType(value.type);
  const suggested = !current && suggestion ? findType(suggestion) : undefined;
  return (
    <div className="class-picker">
      <span className="field-label">Tipo de artículo</span>
      {current ? (
        <div className="type-chosen">
          <CodeTag type={current.code} />
          <span>{typePath(current.code)}</span>
          <button type="button" className="text-button" onClick={() => onChange({ section: value.section })}>
            Cambiar
          </button>
        </div>
      ) : (
        <>
          {suggested && (
            <button type="button" className="type-suggestion" onClick={() => onChange({ section: Number(suggested.code.slice(0, 2)), type: suggested.code })}>
              ¿Es <strong>{suggested.name}</strong>? <CodeTag type={suggested.code} /> <small>Toca para elegirlo</small>
            </button>
          )}
          <div className="search-field small">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busca: arroz, pardina, pilas, 1102…" aria-label="Buscar tipo en la estructura" />
            {query && (
              <button type="button" className="icon-button" aria-label="Borrar búsqueda" onClick={() => setQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
          {matches.length > 0 && (
            <div className="class-results">
              {matches.map((t) => (
                <button
                  type="button"
                  key={t.code}
                  onClick={() => {
                    onChange({ section: Number(t.code.slice(0, 2)), type: t.code });
                    setQuery('');
                  }}
                >
                  <strong>
                    {t.name} <CodeTag type={t.code} />
                  </strong>
                  <small>
                    {t.family.section.name} › {t.family.name}
                  </small>
                </button>
              ))}
            </div>
          )}
          {query && !matches.length && <p className="muted footnote">No está en la estructura. Elige solo la sección o añádelo a src/data/estructura.ts.</p>}
          <label>
            Solo la sección (si no encuentras el tipo)
            <SectionSelect value={value.section} onChange={(section) => onChange({ section })} />
          </label>
        </>
      )}
    </div>
  );
}

/** Lee un número de un formulario. */
export const num = (f: FormData, key: string) => Number(f.get(key));
export const str = (f: FormData, key: string) => String(f.get(key) ?? '').trim();
