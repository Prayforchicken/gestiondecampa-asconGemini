// Inventario: lotes con cantidad, ubicación, fecha y clasificación por rayón.
// En pisos compartidos, cada artículo puede ser de la casa o de una persona (su balda).
import { useState } from 'react';
import { ArrowUpRight, ChevronRight, Info, Plus, Search, Sparkles } from 'lucide-react';
import { useHome } from '../../app/context';
import type { ModalComp } from '../App';
import { day, fmtDate, relative } from '../../domain/dates';
import { euros, qty, uid } from '../../domain/format';
import { FROZEN_SECTION, classificationPath, rayonList, rayonName } from '../../domain/abaco';
import { PLACES, type Item, type Place, type Unit } from '../../domain/types';
import { baseUnit, catalogSchema, internalCode, nutrition, unitPrice, type Catalog } from '../../domain/catalog';
import { ClassPicker, OwnerSelect, PageHeading, num, str, type Classification } from '../common';
import { zodMessage } from '../../domain/schemas';

const FILTERS = ['Todo', 'Nevera', 'Despensa', 'Congelador', 'Hogar', 'Próximos', 'Míos'] as const;

export const isUrgent = (i: Item) => i.qty > 0 && !!i.expires && i.expires <= day(2) && i.section !== FROZEN_SECTION;

export function InventoryPage() {
  const { state, open, snap, me, nameOf } = useHome();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Todo');
  const [showEmpty, setShowEmpty] = useState(false);
  const q = search.toLowerCase();
  const items = state.items
    .filter((i) => showEmpty || i.qty > 0)
    .filter((i) => i.name.toLowerCase().includes(q))
    .filter((i) => (filter === 'Todo' ? true : filter === 'Próximos' ? isUrgent(i) : filter === 'Míos' ? i.owner === me.id : i.place === filter))
    .sort((a, b) => a.section - b.section || a.name.localeCompare(b.name));
  const empties = state.items.filter((i) => i.qty <= 0).length;
  return (
    <>
      <PageHeading
        overline={state.household.name}
        title="Inventario"
        subtitle="Todo lo que tenemos."
        action={
          <button className="button primary compact" onClick={() => open('stock', {})}>
            <Plus size={17} />
            <span>Añadir artículo</span>
          </button>
        }
      />
      <div className="catalog-banner">
        <div>
          <strong>Un artículo. Muchos formatos.</strong>
          <p>Compara por kilo, litro o unidad antes de comprar.</p>
        </div>
        <button className="button secondary" onClick={() => open('catalog')}>
          Precios y formatos <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="toolbar">
        <div className="search-field">
          <Search size={17} />
          <input placeholder="Buscar artículos o lotes…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="button secondary" onClick={() => open('ai')}>
          <Sparkles size={16} /> Entrada con IA
        </button>
      </div>
      <div className="filter-row">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <section className="card inventory-list">
        <div className="list-header">
          <span>ARTÍCULO / LOTE</span>
          <span>CANTIDAD</span>
          <span>FECHA</span>
          <span />
        </div>
        {items.map((i) => (
          <button className="inventory-row" key={i.id} onClick={() => open('item', { itemId: i.id })}>
            <span className="item-name">
              <span className="food-tile">{i.emoji}</span>
              <span>
                <strong>{i.name}</strong>
                <small>
                  {i.place} · {rayonName(snap.abaco, i.section)}
                  {i.owner ? ` · de ${nameOf(i.owner)}` : ''}
                </small>
              </span>
            </span>
            <span className="stock-number">
              {qty(i.qty)} <small>{i.unit}</small>
            </span>
            <span className={isUrgent(i) ? 'urgent' : 'muted'}>{i.expires ? relative(i.expires) : 'Sin fecha'}</span>
            <ChevronRight size={17} />
          </button>
        ))}
        {!items.length && <p className="muted inventory-empty">Nada con estos filtros.</p>}
      </section>
      {empties > 0 && (
        <button className="text-button spaced" onClick={() => setShowEmpty(!showEmpty)}>
          {showEmpty ? 'Ocultar' : 'Mostrar'} {empties} lote{empties === 1 ? '' : 's'} agotado{empties === 1 ? '' : 's'}
        </button>
      )}
      <p className="footnote">
        Cada compra puede crear un lote con su propia fecha. {snap.abaco ? 'Clasificación importada activa.' : 'Puedes importar vuestra estructura de clasificación en Hogar.'}
      </p>
    </>
  );
}

// ---------- Modales ----------

const ItemModal: ModalComp = ({ data }) => {
  const { state, act, open, snap, nameOf } = useHome();
  const i = state.items.find((i) => i.id === data.itemId);
  if (!i) return <p className="muted">Este lote ya no existe.</p>;
  const perUnit = i.unit === 'g' ? 'kg' : i.unit === 'ml' ? 'l' : 'ud';
  return (
    <>
      <div className="modal-food">{i.emoji}</div>
      <h2>{i.name}</h2>
      <p className="muted">
        {i.place} · {classificationPath(snap.abaco, i.section, i.family, i.subfamily)}
        {i.section === FROZEN_SECTION ? ' · Congelados' : ''}
      </p>
      <div className="big-quantity">
        {qty(i.qty)} <span>{i.unit} disponibles</span>
      </div>
      <div className="detail-list">
        <p>
          <span>Fecha del lote</span>
          <strong>{i.expires ? fmtDate(i.expires) : 'No registrada'}</strong>
        </p>
        <p>
          <span>De quién es</span>
          <strong>{i.owner ? nameOf(i.owner) : 'De toda la casa'}</strong>
        </p>
        {i.price > 0 && (
          <p>
            <span>Precio de compra</span>
            <strong>
              {euros(i.price * (i.unit === 'ud' ? 1 : 1000))} / {perUnit}
            </strong>
          </p>
        )}
      </div>
      <button className="button primary full" onClick={() => open('stock', { itemId: i.id })}>
        Corregir existencias y datos
      </button>
      <button
        className="button secondary full spaced"
        onClick={() =>
          act(
            { type: 'upsert', collection: 'shopping', entity: { id: uid(), name: i.name, quantity: 'Por decidir', checked: false, section: i.section, ...(i.owner ? { owner: i.owner } : {}) } },
            'Añadido a la lista de la compra',
            true,
          )
        }
      >
        Añadir a la compra
      </button>
      <button className="text-button danger spaced" onClick={() => open('out', { target: 'item', id: i.id })}>
        Registrar salida extraordinaria
      </button>
    </>
  );
};

const StockModal: ModalComp = ({ data }) => {
  const { state, act, snap, open } = useHome();
  const i = state.items.find((x) => x.id === data?.itemId);
  const [cls, setCls] = useState<Classification>({ section: i?.section ?? 11, family: i?.family, subfamily: i?.subfamily });
  const [place, setPlace] = useState<Place>(i?.place ?? 'Despensa');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const changeClass = (c: Classification) => {
    setCls(c);
    // Para artículos nuevos, sugerimos la ubicación habitual de la sección.
    if (!i) {
      const suggested = rayonList(snap.abaco).find((r) => r.code === c.section)?.place;
      if (suggested) setPlace(suggested);
    }
  };
  return (
    <>
      <h2>{i ? 'Corregir lote' : 'Añadir al inventario'}</h2>
      <p className="muted">Entrada manual. El gasto se registra aparte (o junto al ticket con la IA).</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const unit = str(f, 'unit') as Unit;
          const pricePerBase = num(f, 'price') || 0;
          const owner = str(f, 'owner');
          const entity: Item = {
            ...(i ?? { id: uid() }),
            name: str(f, 'name'),
            emoji: str(f, 'emoji') || '📦',
            qty: num(f, 'qty'),
            unit,
            place,
            section: cls.section,
            expires: str(f, 'expires'),
            price: unit === 'ud' ? pricePerBase : pricePerBase / 1000,
            protein: num(f, 'protein') || 0,
          };
          delete entity.family;
          delete entity.subfamily;
          delete entity.owner;
          if (cls.family) entity.family = cls.family;
          if (cls.subfamily) entity.subfamily = cls.subfamily;
          if (owner) entity.owner = owner;
          act({ type: 'upsert', collection: 'items', entity }, i ? 'Lote corregido' : 'Artículo añadido', true);
        }}
      >
        <div className="form-grid">
          <label>
            Nombre
            <input name="name" defaultValue={i?.name} placeholder="Ej. garbanzos cocidos" maxLength={100} required />
          </label>
          <label>
            Emoji
            <input name="emoji" defaultValue={i?.emoji ?? '📦'} maxLength={8} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Cantidad
            <input name="qty" type="number" min="0" step="0.1" defaultValue={i?.qty} required />
          </label>
          <label>
            Unidad
            <select name="unit" defaultValue={i?.unit ?? 'g'}>
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="ud">ud</option>
            </select>
          </label>
        </div>
        <ClassPicker value={cls} onChange={changeClass} />
        <div className="form-grid">
          <label>
            Ubicación
            <select value={place} onChange={(e) => setPlace(e.target.value as Place)}>
              {PLACES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            De quién es
            <OwnerSelect name="owner" defaultValue={i?.owner} />
          </label>
        </div>
        <label>
          Fecha del lote (opcional)
          <input type="date" name="expires" defaultValue={i?.expires} />
        </label>
        <div className="form-grid">
          <label>
            Precio por kg / l / ud (opcional)
            <input name="price" type="number" min="0" step="0.01" defaultValue={i ? Number((i.price * (i.unit === 'ud' ? 1 : 1000)).toFixed(2)) || '' : ''} />
          </label>
          <label>
            Proteína por 100 g (opcional)
            <input name="protein" type="number" min="0" max="100" step="0.1" defaultValue={i?.protein || ''} />
          </label>
        </div>
        <p className="footnote">La sección 13 identifica congelados: al planificar avisamos 12 horas antes.</p>
        <button className="button primary full" type="submit">
          Guardar artículo
        </button>
      </form>
      {i &&
        (confirmDelete ? (
          <button className="button danger-button full spaced" onClick={() => act({ type: 'remove', collection: 'items', entityId: i.id }, 'Lote eliminado', true)}>
            Sí, eliminar este lote
          </button>
        ) : (
          <div className="button-row spaced">
            <button className="text-button" onClick={() => open('item', { itemId: i.id })}>
              Volver
            </button>
            <button className="text-button danger" onClick={() => setConfirmDelete(true)}>
              Eliminar lote
            </button>
          </div>
        ))}
    </>
  );
};

const OutModal: ModalComp = ({ data }) => {
  const { state, act } = useHome();
  const target = data.target === 'tupper' ? state.tuppers.find((t) => t.id === data.id) : state.items.find((i) => i.id === data.id);
  if (!target) return <p className="muted">Ya no existe.</p>;
  const available = 'grams' in target ? target.grams : target.qty;
  const unit = 'grams' in target ? 'g' : target.unit;
  return (
    <>
      <h2>Registrar una salida</h2>
      <p className="muted">
        {target.name} · disponible: {qty(available)} {unit}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          act({ type: 'stock.out', target: data.target, entityId: data.id, qty: num(f, 'qty'), reason: str(f, 'reason') }, 'Salida registrada sin contarla como comida', true);
        }}
      >
        <label>
          Cantidad
          <input type="number" name="qty" min="0.1" max={available} step="0.1" defaultValue={available} required />
        </label>
        <label>
          Motivo
          <select name="reason">
            <option>Caducó</option>
            <option>Se puso malo</option>
            <option>Se cocinó mal</option>
            <option>Se lo dimos a alguien</option>
            <option>Otro motivo</option>
          </select>
        </label>
        <button className="button primary full" type="submit">
          Registrar salida
        </button>
      </form>
    </>
  );
};

const CatalogModal: ModalComp = () => {
  const { state, open } = useHome();
  const c = state.catalog;
  const [typeId, setTypeId] = useState(c.types[0]?.id ?? '');
  const offers = c.offers.filter((o) => o.typeId === typeId).sort((a, b) => baseUnit(a.unit).localeCompare(baseUnit(b.unit)) || unitPrice(a) - unitPrice(b));
  return (
    <>
      <h2>Formatos y precio real</h2>
      <p className="muted">Compara envases del mismo tipo por kilo, litro o unidad.</p>
      <label>
        Tipo de artículo
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          {c.types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <div className="offer-list">
        {offers.map((o) => {
          const n = nutrition(c, o);
          return (
            <article className="offer" key={o.id}>
              <div>
                <span className="pill neutral">{c.providers.find((p) => p.id === o.providerId)?.name}</span>
                <h3>{o.label}</h3>
                <p>
                  {o.packQty} {o.unit} · {fmtDate(o.date)}
                </p>
              </div>
              <div className="offer-price">
                <strong>
                  {euros(unitPrice(o))}
                  <small> / {baseUnit(o.unit)}</small>
                </strong>
                <span>{euros(o.price)} el envase</span>
              </div>
              <p className="offer-nutrition">
                Código interno: {internalCode(c, o) ?? 'pendiente'} · EAN: {o.ean ?? 'sin registrar'}
                <br />
                Proteína: {n.value === null ? 'sin datos' : n.value + ' g / 100 g'} · {n.source}
              </p>
            </article>
          );
        })}
      </div>
      <div className="info-strip">
        <Info size={18} />
        <span>Un saco de 20 kg puede ser el más caro al pagar y el más barato por kilo. El presupuesto, el espacio y el consumo también importan.</span>
      </div>
      <p className="footnote">Los precios de ejemplo son ficticios. Importa vuestro catálogo real en JSON.</p>
      <button className="button primary full" onClick={() => open('catalog-import')}>
        Importar catálogo JSON
      </button>
    </>
  );
};

const CatalogImportModal: ModalComp = () => {
  const { state, act, setError } = useHome();
  const [text, setText] = useState(() => JSON.stringify(state.catalog, null, 2));
  const [preview, setPreview] = useState<Catalog | null>(null);
  return (
    <>
      <h2>Catálogo de precios</h2>
      <p className="muted">Secciones, familias, tipos, proveedores y formatos. El catálogo actual sirve de plantilla.</p>
      <textarea
        className="json-area"
        aria-label="JSON del catálogo"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
        }}
      />
      <button
        className="button secondary full"
        onClick={() => {
          try {
            setPreview(catalogSchema.parse(JSON.parse(text)));
            setError('');
          } catch (e) {
            setPreview(null);
            setError(e instanceof SyntaxError ? 'JSON no válido: revisa llaves, comillas y comas.' : zodMessage(e));
          }
        }}
      >
        Validar
      </button>
      {preview && (
        <div className="import-preview">
          <h3>Catálogo válido</h3>
          <p>
            {preview.sections.length} secciones · {preview.families.length} familias · {preview.types.length} tipos · {preview.providers.length} proveedores · {preview.offers.length} formatos
          </p>
          <button className="button primary full" onClick={() => act({ type: 'catalog.set', catalog: preview }, 'Catálogo guardado', true)}>
            Aplicar catálogo
          </button>
        </div>
      )}
    </>
  );
};
CatalogImportModal.wide = true;

export const inventoryModals: Record<string, ModalComp> = {
  item: ItemModal,
  stock: StockModal,
  out: OutModal,
  catalog: CatalogModal,
  'catalog-import': CatalogImportModal,
};
