// Inventario: lotes con cantidad, ubicación, fecha y código interno.
//
// Código interno (11.02.02.001) = tipo de la estructura + número de artículo.
// El EAN es el código de barras del fabricante: dos arroces integrales tienen EAN distintos
// pero el mismo tipo (11.02.02), así que aparecen juntos en la vista «Por tipo».
import { useMemo, useState } from 'react';
import { ArrowUpRight, ChevronRight, Info, Layers, List, Plus, Search, Sparkles } from 'lucide-react';
import { useHome } from '../../app/context';
import type { ModalComp } from '../App';
import { day, fmtDate, relative } from '../../domain/dates';
import { euros, qty, uid } from '../../domain/format';
import { FROZEN_SECTION, findType, formatCode, guessType, internalCode, isValidEan, normalize, placeOf, sectionName, typePath, TYPES } from '../../domain/estructura';
import { PLACES, type Item, type Place, type State, type Unit } from '../../domain/types';
import { baseUnit, catalogSchema, nutrition, unitPrice, upgradeCatalog, type Catalog } from '../../domain/catalog';
import { productOf } from '../../domain/stock';
import { CodeTag, OwnerSelect, PageHeading, TypePicker, num, str, type Classification } from '../common';
import { zodMessage } from '../../domain/schemas';

const FILTERS = ['Todo', 'Nevera', 'Despensa', 'Congelador', 'Hogar', 'Próximos', 'Míos'] as const;

export const isUrgent = (i: Item) => i.qty > 0 && !!i.expires && i.expires <= day(2) && i.section !== FROZEN_SECTION;

/** ¿Coincide un lote con lo buscado? Nombre, código interno (con o sin puntos) o EAN. */
function matches(i: Item, q: string) {
  if (!q) return true;
  const digits = q.replace(/[.\s]/g, '');
  if (/^\d{2,14}$/.test(digits)) return (internalCode(i) ?? i.type ?? '').startsWith(digits) || (i.ean ?? '').startsWith(digits);
  return normalize(i.name).includes(normalize(q));
}

/** Resumen por artículo (suma de sus lotes). */
function articlesOf(items: Item[]) {
  const map = new Map<string, { first: Item; qty: number; lots: number }>();
  for (const i of items) {
    const key = productOf(i);
    const a = map.get(key) ?? { first: i, qty: 0, lots: 0 };
    a.qty += i.qty;
    a.lots++;
    map.set(key, a);
  }
  return [...map.values()];
}

export function InventoryPage() {
  const { state, open, me, nameOf } = useHome();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Todo');
  const [view, setView] = useState<'lotes' | 'tipos'>('lotes');
  const [showEmpty, setShowEmpty] = useState(false);
  const items = state.items
    .filter((i) => showEmpty || i.qty > 0)
    .filter((i) => matches(i, search.trim()))
    .filter((i) => (filter === 'Todo' ? true : filter === 'Próximos' ? isUrgent(i) : filter === 'Míos' ? i.owner === me.id : i.place === filter))
    .sort((a, b) => (internalCode(a) ?? a.section + 'z').localeCompare(internalCode(b) ?? b.section + 'z') || a.name.localeCompare(b.name));
  const empties = state.items.filter((i) => i.qty <= 0).length;

  // Vista «Por tipo»: los artículos con el mismo tipo (6 primeros dígitos) juntos.
  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of items) {
      const key = i.type ?? 'S' + String(i.section).padStart(2, '0');
      map.set(key, [...(map.get(key) ?? []), i]);
    }
    return [...map].sort((a, b) => a[0].replace('S', '').localeCompare(b[0].replace('S', '')));
  }, [items]);

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
          <strong>Un tipo. Muchas marcas y formatos.</strong>
          <p>El código interno agrupa lo que es lo mismo aunque el EAN sea distinto. Compara por kilo, litro o unidad.</p>
        </div>
        <button className="button secondary" onClick={() => open('catalog', {})}>
          Precios y formatos <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="toolbar">
        <div className="search-field">
          <Search size={17} />
          <input placeholder="Buscar por nombre, código (11.02) o EAN…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar en el inventario" />
        </div>
        <div className="segmented">
          <button className={view === 'lotes' ? 'selected' : ''} onClick={() => setView('lotes')} aria-label="Ver lotes">
            <List size={14} /> Lotes
          </button>
          <button className={view === 'tipos' ? 'selected' : ''} onClick={() => setView('tipos')} aria-label="Agrupar por tipo">
            <Layers size={14} /> Por tipo
          </button>
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

      {view === 'lotes' ? (
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
                    <CodeTag type={i.type} article={i.article} /> {i.place} · {findType(i.type)?.name ?? sectionName(i.section)}
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
      ) : (
        <div className="type-groups">
          {groups.map(([key, list]) => {
            const t = findType(key);
            const units = [...new Set(list.map((i) => i.unit))];
            const total = units.length === 1 ? `${qty(list.reduce((a, i) => a + i.qty, 0))} ${units[0]}` : `${list.length} lotes`;
            return (
              <section className="card type-group" key={key}>
                <header>
                  {t ? <CodeTag type={t.code} /> : <span className="code-tag muted">{key.slice(1)}</span>}
                  <div>
                    <strong>{t?.name ?? sectionName(Number(key.slice(1)))}</strong>
                    <small>{t ? `${t.family.section.name} › ${t.family.name}` : 'Sin tipo: elige uno al editar el artículo'}</small>
                  </div>
                  <span className="type-total">{total}</span>
                </header>
                {articlesOf(list).map(({ first, qty: q, lots }) => (
                  <button key={productOf(first)} className="type-article" onClick={() => open('item', { itemId: first.id })}>
                    <span className="code-cell">
                      <CodeTag type={first.type} article={first.article} />
                    </span>
                    <span className="type-article-name">
                      {first.emoji} {first.name}
                      <small>{first.ean ? `EAN ${first.ean}` : 'Sin EAN'}{lots > 1 ? ` · ${lots} lotes` : ''}</small>
                    </span>
                    <span className="stock-number">
                      {qty(q)} <small>{first.unit}</small>
                    </span>
                  </button>
                ))}
              </section>
            );
          })}
          {!groups.length && <p className="muted">Nada con estos filtros.</p>}
        </div>
      )}

      {empties > 0 && (
        <button className="text-button spaced" onClick={() => setShowEmpty(!showEmpty)}>
          {showEmpty ? 'Ocultar' : 'Mostrar'} {empties} lote{empties === 1 ? '' : 's'} agotado{empties === 1 ? '' : 's'}
        </button>
      )}
      <p className="footnote">
        Código interno = sección · familia · tipo · artículo. Los números de artículo los asigna la app al guardar. Estructura: {TYPES.length} tipos en src/data/estructura.ts.
      </p>
    </>
  );
}

// ---------- Modales ----------

const ItemModal: ModalComp = ({ data }) => {
  const { state, act, open, nameOf } = useHome();
  const i = state.items.find((i) => i.id === data.itemId);
  if (!i) return <p className="muted">Este lote ya no existe.</p>;
  const perUnit = i.unit === 'g' ? 'kg' : i.unit === 'ml' ? 'l' : 'ud';
  const siblings = i.type ? articlesOf(state.items.filter((x) => x.type === i.type && productOf(x) !== productOf(i))) : [];
  const lots = state.items.filter((x) => productOf(x) === productOf(i));
  return (
    <>
      <div className="modal-food">{i.emoji}</div>
      <h2>{i.name}</h2>
      <p className="muted">
        {i.place} · {typePath(i.type) || sectionName(i.section)}
        {i.section === FROZEN_SECTION ? ' · Congelados' : ''}
      </p>
      <div className="big-quantity">
        {qty(i.qty)} <span>{i.unit} en este lote</span>
      </div>
      <div className="detail-list">
        <p>
          <span>Código interno</span>
          <strong>{internalCode(i) ? <CodeTag type={i.type} article={i.article} /> : 'Sin tipo asignado'}</strong>
        </p>
        <p>
          <span>EAN (código de barras)</span>
          <strong>{i.ean ?? 'Sin registrar'}</strong>
        </p>
        <p>
          <span>Fecha del lote</span>
          <strong>{i.expires ? fmtDate(i.expires) : 'No registrada'}</strong>
        </p>
        <p>
          <span>De quién es</span>
          <strong>{i.owner ? nameOf(i.owner) : 'De toda la casa'}</strong>
        </p>
        {lots.length > 1 && (
          <p>
            <span>Lotes de este artículo</span>
            <strong>
              {lots.length} · {qty(lots.reduce((a, x) => a + x.qty, 0))} {i.unit} en total
            </strong>
          </p>
        )}
        {i.price > 0 && (
          <p>
            <span>Precio de compra</span>
            <strong>
              {euros(i.price * (i.unit === 'ud' ? 1 : 1000))} / {perUnit}
            </strong>
          </p>
        )}
      </div>
      {siblings.length > 0 && (
        <div className="siblings">
          <span className="field-label">Del mismo tipo ({formatCode(i.type)})</span>
          {siblings.map(({ first, qty: q }) => (
            <button key={first.id} onClick={() => open('item', { itemId: first.id })}>
              <CodeTag type={first.type} article={first.article} /> {first.name}
              <small>
                {qty(q)} {first.unit}
              </small>
            </button>
          ))}
        </div>
      )}
      <div className="button-row">
        <button className="button primary" onClick={() => open('stock', { lotOf: productOf(i) })}>
          <Plus size={16} /> Otro lote
        </button>
        <button className="button secondary" onClick={() => open('stock', { itemId: i.id })}>
          Corregir
        </button>
      </div>
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
      {i.type && (
        <button className="text-button spaced" onClick={() => open('catalog', { type: i.type })}>
          Comparar precios de {findType(i.type)?.name.toLowerCase()} <ArrowUpRight size={14} />
        </button>
      )}
      <button className="text-button danger spaced" onClick={() => open('out', { target: 'item', id: i.id })}>
        Registrar salida extraordinaria
      </button>
    </>
  );
};

/** Busca un artículo existente con ese EAN. */
const byEan = (s: State, ean: string, except?: string) => (ean ? s.items.find((x) => x.ean === ean && productOf(x) !== except) : undefined);

const StockModal: ModalComp = ({ data }) => {
  const { state, act, open } = useHome();
  const i = state.items.find((x) => x.id === data?.itemId);
  // «Otro lote» de un artículo existente: mismo nombre, tipo, número y EAN.
  const base = data?.lotOf ? state.items.find((x) => productOf(x) === data.lotOf) : undefined;
  const model = i ?? base;
  const [name, setName] = useState(model?.name ?? '');
  const [cls, setCls] = useState<Classification>({ section: model?.section ?? 11, type: model?.type });
  const [place, setPlace] = useState<Place>(model?.place ?? 'Despensa');
  const [ean, setEan] = useState(model?.ean ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNewLot = Boolean(base && !i);
  const product = i ? productOf(i) : base ? productOf(base) : undefined;
  const existing = byEan(state, ean.trim(), product);
  const eanOk = !ean || isValidEan(ean.trim());
  const guess = !cls.type && name.length > 2 ? guessType(name)?.code : undefined;

  const changeClass = (c: Classification) => {
    setCls(c);
    // Para artículos nuevos, sugerimos la ubicación habitual del tipo o la sección.
    if (!i) {
      const suggested = placeOf(c.type, c.section);
      if (suggested) setPlace(suggested);
    }
  };

  // Vista previa del código: el número definitivo lo asigna el reducer al guardar.
  const previewArticle = () => {
    if (!cls.type) return undefined;
    if (model && productOf(model) && model.type === cls.type && model.article) return model.article;
    const used = state.items.filter((x) => x.type === cls.type).map((x) => Number(x.article ?? 0));
    return String(Math.max(0, ...used) + 1).padStart(3, '0');
  };

  return (
    <>
      <h2>{i ? 'Corregir lote' : isNewLot ? 'Otro lote' : 'Añadir al inventario'}</h2>
      <p className="muted">
        {isNewLot ? `Nuevo lote de «${base!.name}»: mismo código interno y EAN, con su propia cantidad y fecha.` : 'Entrada manual. El gasto se registra aparte (o junto al ticket con la IA).'}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const unit = str(f, 'unit') as Unit;
          const pricePerBase = num(f, 'price') || 0;
          const owner = str(f, 'owner');
          const entity: Item = {
            ...(i ?? { id: uid() }),
            name: name.trim(),
            emoji: str(f, 'emoji') || '📦',
            qty: num(f, 'qty'),
            unit,
            place,
            section: cls.section,
            expires: str(f, 'expires'),
            price: unit === 'ud' ? pricePerBase : pricePerBase / 1000,
            protein: num(f, 'protein') || 0,
          };
          delete entity.type;
          delete entity.ean;
          delete entity.owner;
          if (isNewLot) entity.productId = productOf(base!);
          if (cls.type) entity.type = cls.type;
          if (ean.trim()) entity.ean = ean.trim();
          if (owner) entity.owner = owner;
          // Si cambia el tipo, el reducer asigna un número nuevo dentro del tipo.
          if (i && i.type !== cls.type) delete entity.article;
          act({ type: 'upsert', collection: 'items', entity }, i ? 'Lote corregido' : isNewLot ? 'Lote añadido' : 'Artículo añadido', true);
        }}
      >
        <div className="form-grid">
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Arroz integral 1 kg" maxLength={100} required readOnly={isNewLot} />
          </label>
          <label>
            Emoji
            <input name="emoji" defaultValue={model?.emoji ?? '📦'} maxLength={8} />
          </label>
        </div>
        <label>
          EAN · código de barras (opcional)
          <input value={ean} onChange={(e) => setEan(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="8 o 13 dígitos del envase" maxLength={14} readOnly={isNewLot} />
        </label>
        {!eanOk && <p className="field-warning">El dígito de control no cuadra: revisa el número (se guardará igualmente).</p>}
        {existing && (
          <div className="field-warning info">
            Ese EAN es de <strong>{existing.name}</strong> <CodeTag type={existing.type} article={existing.article} />.{' '}
            <button type="button" className="text-button" onClick={() => open('stock', { lotOf: productOf(existing) })}>
              Añadir como lote de ese artículo
            </button>
          </div>
        )}
        <div className="form-grid">
          <label>
            Cantidad
            <input name="qty" type="number" min="0" step="0.1" defaultValue={i?.qty} required />
          </label>
          <label>
            Unidad
            <select name="unit" defaultValue={model?.unit ?? 'g'}>
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="ud">ud</option>
            </select>
          </label>
        </div>
        {isNewLot ? (
          <p className="class-path">
            <CodeTag type={base!.type} article={base!.article} /> {typePath(base!.type) || sectionName(base!.section)}
          </p>
        ) : (
          <TypePicker value={cls} onChange={changeClass} suggestion={guess} />
        )}
        {!isNewLot && cls.type && (
          <p className="code-preview">
            Código interno: <CodeTag type={cls.type} article={previewArticle()} />
            {!(model?.article && model.type === cls.type) && <small> (se confirma al guardar)</small>}
          </p>
        )}
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
            <OwnerSelect name="owner" defaultValue={model?.owner} />
          </label>
        </div>
        <label>
          Fecha del lote (opcional)
          <input type="date" name="expires" defaultValue={i?.expires} />
        </label>
        <div className="form-grid">
          <label>
            Precio por kg / l / ud (opcional)
            <input name="price" type="number" min="0" step="0.01" defaultValue={model ? Number((model.price * (model.unit === 'ud' ? 1 : 1000)).toFixed(2)) || '' : ''} />
          </label>
          <label>
            Proteína por 100 g (opcional)
            <input name="protein" type="number" min="0" max="100" step="0.1" defaultValue={model?.protein || findType(cls.type)?.protein || ''} />
          </label>
        </div>
        <p className="footnote">La sección 13 identifica congelados: al planificar avisamos 12 horas antes.</p>
        <button className="button primary full" type="submit" disabled={Boolean(existing) && !i}>
          Guardar
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

type Row = { key: string; source: string; label: string; detail: string; code: string | null; type: string; ean?: string; perUnit: number; base: string; pack?: number; protein: string };

/** Comparador: ofertas del catálogo y artículos de casa del mismo tipo, por precio por kg/l/ud. */
const CatalogModal: ModalComp = ({ data }) => {
  const { state, open } = useHome();
  const c = upgradeCatalog(state.catalog);
  const typesAvailable = [...new Set([...c.offers.map((o) => o.type), ...state.items.filter((i) => i.type && i.price > 0).map((i) => i.type!)])].sort();
  const [type, setType] = useState<string>(data?.type && typesAvailable.includes(data.type) ? data.type : typesAvailable[0] ?? '');
  const rows: Row[] = [
    ...c.offers
      .filter((o) => o.type === type)
      .map((o) => {
        const home = o.ean ? state.items.find((i) => i.ean === o.ean) : undefined;
        const n = nutrition(o);
        return {
          key: o.id,
          source: c.providers.find((p) => p.id === o.providerId)?.name ?? 'Tienda',
          label: o.label,
          detail: `${o.packQty} ${o.unit} · ${fmtDate(o.date)}`,
          code: home ? internalCode(home) : o.article ? o.type + o.article : null,
          type: o.type,
          ean: o.ean,
          perUnit: unitPrice(o),
          base: baseUnit(o.unit),
          pack: o.price,
          protein: n.value === null ? 'sin datos' : `${n.value} g / 100 g · ${n.source}`,
        };
      }),
    ...articlesOf(state.items.filter((i) => i.type === type && i.price > 0)).map(({ first }) => ({
      key: first.id,
      source: 'En casa',
      label: first.name,
      detail: 'Último precio registrado',
      code: internalCode(first),
      type: first.type!,
      ean: first.ean,
      perUnit: first.price * (first.unit === 'ud' ? 1 : 1000),
      base: first.unit === 'g' ? 'kg' : first.unit === 'ml' ? 'l' : 'ud',
      protein: first.protein ? `${first.protein} g / 100 g` : 'sin datos',
    })),
  ].sort((a, b) => a.base.localeCompare(b.base) || a.perUnit - b.perUnit);
  return (
    <>
      <h2>Formatos y precio real</h2>
      <p className="muted">Compara artículos del mismo tipo (mismos 6 primeros dígitos) por kilo, litro o unidad.</p>
      <label>
        Tipo
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {typesAvailable.map((t) => (
            <option key={t} value={t}>
              {formatCode(t)} · {findType(t)?.name}
            </option>
          ))}
        </select>
      </label>
      <div className="offer-list">
        {rows.map((r, k) => (
          <article className={'offer' + (k === 0 && rows.length > 1 ? ' best' : '')} key={r.key}>
            <div>
              <span className="pill neutral">{r.source}</span>
              {k === 0 && rows.length > 1 && <span className="pill green">Más barato por {r.base}</span>}
              <h3>{r.label}</h3>
              <p>{r.detail}</p>
            </div>
            <div className="offer-price">
              <strong>
                {euros(r.perUnit)}
                <small> / {r.base}</small>
              </strong>
              {r.pack !== undefined && <span>{euros(r.pack)} el envase</span>}
            </div>
            <p className="offer-nutrition">
              Código interno: {r.code ? <CodeTag type={r.type} article={r.code.slice(6)} /> : <>{formatCode(r.type)}.— (aún no está en casa)</>} · EAN: {r.ean ?? 'sin registrar'}
              <br />
              Proteína: {r.protein}
            </p>
          </article>
        ))}
        {!rows.length && <p className="muted">Todavía no hay precios para comparar.</p>}
      </div>
      <div className="info-strip">
        <Info size={18} />
        <span>Un saco de 20 kg puede ser el más caro al pagar y el más barato por kilo. El presupuesto, el espacio y el consumo también importan.</span>
      </div>
      <p className="footnote">Los precios de ejemplo son ficticios. Importa los vuestros en JSON.</p>
      <button className="button primary full" onClick={() => open('catalog-import')}>
        Importar precios (JSON)
      </button>
    </>
  );
};

const CatalogImportModal: ModalComp = () => {
  const { state, act, setError } = useHome();
  const [text, setText] = useState(() => JSON.stringify(upgradeCatalog(state.catalog), null, 2));
  const [preview, setPreview] = useState<Catalog | null>(null);
  return (
    <>
      <h2>Catálogo de precios</h2>
      <p className="muted">Proveedores y ofertas. Cada oferta indica su tipo con 6 dígitos de la estructura (p. ej. 110202 = arroz integral). El catálogo actual sirve de plantilla.</p>
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
            setPreview(catalogSchema.parse(upgradeCatalog(JSON.parse(text))));
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
            {preview.providers.length} proveedores · {preview.offers.length} ofertas de {new Set(preview.offers.map((o) => o.type)).size} tipos
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
