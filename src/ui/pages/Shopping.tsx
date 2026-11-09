// Lista de la compra compartida, agrupada por sección para recorrer la tienda en orden.
import { useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, Info, Plus, ShoppingBasket, Sparkles, Trash2, X } from 'lucide-react';
import { useHome } from '../../app/context';
import type { ModalComp } from '../App';
import { rayonName, searchAbaco, normalize } from '../../domain/abaco';
import { uid } from '../../domain/format';
import type { Shopping, State } from '../../domain/types';
import type { AbacoTree } from '../../domain/abaco';
import { Avatar, ClassPicker, IconBadge, OwnerSelect, PageHeading, str, type Classification } from '../common';

/** Adivina la sección de un artículo: primero por el inventario, luego por la clasificación. */
export function guessSection(state: State, tree: AbacoTree | null, name: string): number | undefined {
  const n = normalize(name);
  if (!n) return undefined;
  const known = state.items.find((i) => normalize(i.name) === n) ?? state.items.find((i) => normalize(i.name).includes(n) || n.includes(normalize(i.name)));
  if (known) return known.section;
  const word = n.split(' ').find((w) => w.length > 3) ?? n;
  return searchAbaco(tree, word, 1)[0]?.rayon;
}

export function ShoppingPage() {
  const { state, act, open, snap, nameOf, members, go } = useHome();
  const pending = state.shopping.filter((s) => !s.checked);
  const checked = state.shopping.filter((s) => s.checked);
  // Agrupar por sección: así la lista sigue el recorrido de la tienda.
  const groups = new Map<number, Shopping[]>();
  for (const s of [...pending, ...checked]) {
    const key = s.section ?? 9999;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const ordered = [...groups].sort((a, b) => a[0] - b[0]);
  const ownerOf = (id?: string) => members.find((m) => m.id === id);
  return (
    <>
      <PageHeading
        overline={state.household.name}
        title="Compra"
        subtitle="Comprar lo justo."
        action={
          <button className="button primary compact" onClick={() => open('shopping')}>
            <Plus size={17} />
            <span>Añadir a la lista</span>
          </button>
        }
      />
      <div className="two-columns">
        <section className="card shopping-card">
          <div className="section-title">
            <div>
              <ShoppingBasket size={19} />
              <h2>La próxima compra</h2>
            </div>
            <span className="pill green">{pending.length} pendientes</span>
          </div>
          {ordered.map(([section, list]) => (
            <div className="shop-group" key={section}>
              <h3>{section === 9999 ? 'Sin sección' : rayonName(snap.abaco, section)}</h3>
              {list.map((s) => (
                <div className={'shopping-row ' + (s.checked ? 'checked' : '')} key={s.id}>
                  <button
                    className="check-button"
                    aria-label={(s.checked ? 'Desmarcar ' : 'Marcar ') + s.name}
                    aria-pressed={s.checked}
                    onClick={() => act({ type: 'patch', collection: 'shopping', entityId: s.id, fields: { checked: !s.checked } })}
                  >
                    {s.checked && <Check size={16} />}
                  </button>
                  <div>
                    <strong>{s.name}</strong>
                    <small>
                      {s.quantity}
                      {s.owner && <span className="owner-tag">· para {nameOf(s.owner)}</span>}
                    </small>
                  </div>
                  {s.owner && <Avatar member={ownerOf(s.owner)} size="small" />}
                  <button className="icon-button" aria-label={'Editar ' + s.name} onClick={() => open('shopping', { shoppingId: s.id })}>
                    <ChevronRight size={15} />
                  </button>
                  <button className="icon-button" aria-label={'Quitar ' + s.name} onClick={() => act({ type: 'remove', collection: 'shopping', entityId: s.id }, 'Retirado de la lista')}>
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          ))}
          {!state.shopping.length && <p className="muted spaced">La lista está vacía. ¡Bien!</p>}
          <div className="button-row spaced">
            <button className="wide-link" onClick={() => open('shopping')}>
              <Plus size={16} /> Añadir a la lista
            </button>
            {checked.length > 0 && (
              <button className="wide-link" onClick={() => act({ type: 'shopping.clearChecked' }, 'Comprados retirados de la lista')}>
                <Trash2 size={15} /> Retirar {checked.length} comprado{checked.length === 1 ? '' : 's'}
              </button>
            )}
          </div>
        </section>
        <aside>
          <section className="card callout-card">
            <IconBadge>
              <Sparkles size={22} />
            </IconBadge>
            <h3>Del ticket a la despensa</h3>
            <p>Tu IA interpreta el ticket. Tú revisas cantidades e importe antes de guardar.</p>
            <button className="button primary full" onClick={() => open('ai')}>
              Preparar entrada con IA <ArrowUpRight size={16} />
            </button>
          </section>
          <div className="info-strip">
            <Info size={18} />
            <span>Marcar un producto no añade existencias. Registra la compra cuando tengas el ticket.</span>
          </div>
          <section className="card callout-card">
            <h3>Compra con intención</h3>
            <p>Revisa primero lo que hay en casa y lo que vais a cocinar.</p>
            <button className="text-button" onClick={() => go('inventario')}>
              Ver lo que tenemos <ChevronRight size={15} />
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}

const ShoppingModal: ModalComp = ({ data }) => {
  const { state, act, snap } = useHome();
  const s = state.shopping.find((x) => x.id === data?.shoppingId);
  const [cls, setCls] = useState<Classification | null>(s?.section !== undefined ? { section: s.section } : null);
  return (
    <>
      <h2>{s ? 'Editar' : 'Para la próxima compra'}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const name = str(f, 'name');
          const section = cls?.section ?? guessSection(state, snap.abaco, name);
          const owner = str(f, 'owner');
          const entity: Shopping = { id: s?.id ?? uid(), name, quantity: str(f, 'quantity'), checked: s?.checked ?? false };
          if (section !== undefined) entity.section = section;
          if (owner) entity.owner = owner;
          act({ type: 'upsert', collection: 'shopping', entity }, s ? 'Guardado' : 'Añadido a la lista', true);
        }}
      >
        <label>
          Artículo
          <input name="name" defaultValue={s?.name} placeholder="¿Qué necesitamos?" required maxLength={100} />
        </label>
        <div className="form-grid">
          <label>
            Cantidad
            <input name="quantity" defaultValue={s?.quantity} placeholder="Ej. 500 g o 2 unidades" maxLength={60} />
          </label>
          <label>
            Para
            <OwnerSelect name="owner" defaultValue={s?.owner} />
          </label>
        </div>
        {cls ? (
          <ClassPicker value={cls} onChange={setCls} />
        ) : (
          <button type="button" className="text-button" onClick={() => setCls({ section: 11 })}>
            Elegir sección (si no, la adivinamos por el nombre)
          </button>
        )}
        <button className="button primary full" type="submit">
          {s ? 'Guardar' : 'Añadir a la lista'}
        </button>
      </form>
    </>
  );
};

export const shoppingModals: Record<string, ModalComp> = { shopping: ShoppingModal };
