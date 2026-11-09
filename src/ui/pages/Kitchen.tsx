// Cocina: tuppers, recetas y plan de comidas. Cocinar descuenta del inventario;
// repartir registra lo que come cada persona y deja las sobras como tupper.
import { useState } from 'react';
import {
  ArrowRight,
  Box,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Info,
  Leaf,
  Minus,
  NotebookPen,
  Plus,
  Search,
  Snowflake,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useHome } from '../../app/context';
import type { ModalComp } from '../App';
import { day, fmtDate, relative } from '../../domain/dates';
import { qty, uid } from '../../domain/format';
import { FROZEN_SECTION, formatCode } from '../../domain/estructura';
import { ingredientName, ingredientUnit, isTypeKey, lotsFor, stockFor, typeKey } from '../../domain/stock';
import type { Meal, Recipe, State, Tupper } from '../../domain/types';
import { AvatarStack, Empty, IconBadge, MemberPicker, PageHeading, num, str, togetherLabel, Avatar } from '../common';

export const stockOf = stockFor;
export const canCook = (s: State, r: Recipe) => r.ingredients.every((g) => g.optional || stockOf(s, g.itemId) >= g.amount);
export const tuppersInStock = (s: State) => s.tuppers.filter((t) => t.grams > 0).sort((a, b) => a.review.localeCompare(b.review));
export const nextMeals = (s: State) => s.meals.filter((m) => !m.done).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

/** Abre el modal adecuado para una comida planificada. */
export function useMealAction() {
  const { state, open, toast } = useHome();
  return (m: Meal) => {
    if (m.tupperId) {
      const t = state.tuppers.find((t) => t.id === m.tupperId);
      if (t && t.grams > 0) open('serve', { tupperId: t.id, mealId: m.id });
      else toast('Ya no queda esa preparación. Cambia la comida.');
    } else {
      const r = state.recipes.find((r) => r.id === m.recipeId);
      if (r) open('recipe', { recipeId: r.id, mealId: m.id });
      else toast('Esa receta ya no existe. Cambia la comida.');
    }
  };
}

export function MealCard({ meal: m, index }: { meal: Meal; index: number }) {
  const { state, open, members } = useHome();
  const mealAction = useMealAction();
  const r = state.recipes.find((r) => r.id === m.recipeId);
  const t = state.tuppers.find((t) => t.id === m.tupperId);
  const frozen = !!r?.ingredients.some((g) => lotsFor(state, g.itemId).some((i) => i.section === FROZEN_SECTION)) || t?.place === 'Congelador';
  const diners = m.diners?.length ? members.filter((x) => m.diners!.includes(x.id)) : members;
  return (
    <article className={'meal-card ' + (index === 0 ? 'warm' : 'mint')}>
      <div className="meal-top">
        <span className="eyebrow">
          {m.kind} · {relative(m.date)} {m.time}
        </span>
        <button className="icon-button" aria-label={'Cambiar ' + m.name} onClick={() => open('plan', { mealId: m.id })}>
          <NotebookPen size={17} />
        </button>
      </div>
      <div className="meal-middle">
        <div>
          <span className={'pill ' + (t ? 'orange' : 'green')}>
            {t ? (
              <>
                <Box size={12} /> Aprovecha un tupper
              </>
            ) : (
              <>
                <Leaf size={12} /> Cocinar en casa
              </>
            )}
          </span>
          <h3>{m.name}</h3>
          <p>
            <Clock size={14} />
            {t ? '5 min · calentar y servir' : `${r?.minutes ?? 0} min · preparación total`}
          </p>
        </div>
        <div className="food-disc" aria-hidden="true">
          {t?.emoji ?? r?.emoji ?? '🥗'}
        </div>
      </div>
      <div className="meal-people">
        <AvatarStack members={diners} />
        <span>
          {togetherLabel(diners.length)} <span className="dot">·</span> cantidades ajustables
        </span>
      </div>
      {frozen && (
        <button className="frozen-note" onClick={() => open('reminder', { mealId: m.id })}>
          <Snowflake size={14} />
          {m.thawed ? 'Preparación del congelado confirmada' : 'Congelados · revisar aviso de 12 h'}
          <ChevronRight size={14} />
        </button>
      )}
      <button className={'button ' + (index === 0 ? 'dark' : 'white')} onClick={() => mealAction(m)}>
        {t ? 'Repartir y registrar' : 'Ver receta y cantidades'}
        <ArrowRight size={16} />
      </button>
    </article>
  );
}

export function KitchenPage() {
  const { state, open, param, go } = useHome();
  const kitchen = param === 'recetas' ? 'Recetas' : param === 'plan' ? 'Plan' : 'Tuppers';
  const [search, setSearch] = useState('');
  const stock = tuppersInStock(state);
  const meals = nextMeals(state);
  return (
    <>
      <PageHeading
        overline={state.household.name}
        title="Cocina"
        subtitle="Algo rico, sin complicarse."
        action={
          <button className="button primary compact" onClick={() => open('recipe-edit', {})}>
            <Plus size={17} />
            <span>Nueva receta</span>
          </button>
        }
      />
      <div className="toolbar">
        <div className="segmented large">
          {['Tuppers', 'Recetas', 'Plan'].map((k) => (
            <button className={kitchen === k ? 'selected' : ''} key={k} onClick={() => go('cocina', k === 'Tuppers' ? '' : k.toLowerCase())}>
              {k}
            </button>
          ))}
        </div>
        <button className="text-button" onClick={() => open('ai')}>
          <Sparkles size={15} /> Organizar con IA
        </button>
      </div>

      {kitchen === 'Tuppers' && (
        <>
          <div className="info-strip">
            <Box size={18} />
            <span>Primero lo que ya está hecho. Ordenado por fecha de revisión.</span>
          </div>
          <div className="cards-grid">
            {stock.map((t) => (
              <article className="card tupper-card" key={t.id}>
                <div className={'food-panel ' + (t.place === 'Congelador' ? 'ice' : 'warm')}>
                  <span>{t.emoji}</span>
                  <span className={'pill ' + (t.place === 'Congelador' ? 'blue' : 'orange')}>
                    {t.place === 'Congelador' ? <Snowflake size={12} /> : <Clock size={12} />}{' '}
                    {t.place === 'Congelador' ? 'Congelado' : `Revisar ${relative(t.review).toLowerCase()}`}
                  </span>
                </div>
                <div className="card-content">
                  <h3>{t.name}</h3>
                  <p className="muted">
                    Preparado el {fmtDate(t.created)} · {t.place}
                  </p>
                  <div className="quantity">
                    <strong>{qty(t.grams)} g</strong>
                    <span>disponibles</span>
                  </div>
                  <div className="button-row">
                    <button className="button primary" onClick={() => open('serve', { tupperId: t.id })}>
                      Servir
                    </button>
                    <button className="button secondary" onClick={() => open('tupper', { tupperId: t.id })}>
                      Detalles
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!stock.length && <Empty title="No quedan tuppers" body="Al cocinar una receta, la preparación aparecerá aquí." />}
        </>
      )}

      {kitchen === 'Recetas' && (
        <>
          <div className="search-field">
            <Search size={18} />
            <input placeholder="Buscar una receta…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <p className="muted footnote">Solo se proponen para cocinar recetas con todos los ingredientes obligatorios disponibles.</p>
          <div className="cards-grid">
            {state.recipes
              .filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
              .map((r) => (
                <article className="card recipe-card" key={r.id}>
                  <div className="food-panel mint">
                    <span>{r.emoji}</span>
                    <span className={'pill ' + (canCook(state, r) ? 'green' : 'neutral')}>{canCook(state, r) ? 'Tienes los ingredientes' : 'Pendiente de compra'}</span>
                  </div>
                  <div className="card-content">
                    <h3>{r.name}</h3>
                    <p className="muted">{r.description}</p>
                    <p className="inline-meta">
                      <Clock size={14} />
                      {r.minutes} min<span>·</span>
                      {r.servings} raciones base
                    </p>
                    <button className="button secondary full" onClick={() => open('recipe', { recipeId: r.id })}>
                      Ver receta <ChevronRight size={15} />
                    </button>
                  </div>
                </article>
              ))}
          </div>
          {!state.recipes.length && (
            <Empty title="Aún no hay recetas" body="Crea la primera a mano o pídesela a tu IA con lo que tenéis en casa.">
              <button className="button primary spaced" onClick={() => open('recipe-edit', {})}>
                <Plus size={16} /> Nueva receta
              </button>
            </Empty>
          )}
        </>
      )}

      {kitchen === 'Plan' && (
        <>
          <div className="button-row plan-top">
            <p className="muted">Las comidas previstas no cuentan como consumidas.</p>
            <button className="button secondary" onClick={() => open('plan', {})}>
              <Plus size={16} /> Planificar
            </button>
          </div>
          <div className="meal-grid">
            {meals.map((m, i) => (
              <MealCard meal={m} index={i} key={m.id} />
            ))}
          </div>
          {!meals.length && <Empty title="Nada planificado" body="Planifica la próxima comida: primero los tuppers, luego las recetas." />}
          {state.meals.some((m) => m.done) && (
            <section className="card completed">
              <h3>Ya registrado</h3>
              {state.meals
                .filter((m) => m.done)
                .slice(-10)
                .reverse()
                .map((m) => (
                  <p key={m.id}>
                    <CheckCircle2 size={17} />
                    {m.name}
                    <span>{relative(m.date)}</span>
                  </p>
                ))}
            </section>
          )}
        </>
      )}
    </>
  );
}

// ---------- Modales ----------

const RecipeModal: ModalComp = ({ data }) => {
  const { state, act, open, setError } = useHome();
  const r = state.recipes.find((r) => r.id === data.recipeId);
  const [scale, setScale] = useState(1);
  const [amounts, setAmounts] = useState<number[]>(() => r?.ingredients.map((g) => g.amount) ?? []);
  if (!r) return <p className="muted">Esta receta ya no existe.</p>;
  const rescale = (n: number) => {
    setScale(n);
    setAmounts(r.ingredients.map((g) => Math.round(g.amount * n * 10) / 10));
  };
  return (
    <>
      <div className="modal-food">{r.emoji}</div>
      <h2>{r.name}</h2>
      <p className="muted">{r.minutes} min · Ajusta lo que vas a cocinar. Los platos se reparten después.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const review = str(f, 'review');
          if (!review || review < day()) return setError('Elige una fecha de revisión de hoy en adelante.');
          act(
            { type: 'cook', recipeId: r.id, amounts, yieldGrams: num(f, 'yield'), review, date: day(), tupperId: uid(), mealId: data.mealId },
            'Preparación guardada. Ya puedes repartir los platos.',
            true,
          );
        }}
      >
        <div className="scale-row">
          <span>Raciones</span>
          <div className="stepper">
            <button type="button" aria-label="Menos raciones" onClick={() => rescale(Math.max(0.25, scale - 0.25))}>
              <Minus size={15} />
            </button>
            <strong>{qty(r.servings * scale)}</strong>
            <button type="button" aria-label="Más raciones" onClick={() => rescale(scale + 0.25)}>
              <Plus size={15} />
            </button>
          </div>
        </div>
        <h3>Ingredientes</h3>
        <div className="ingredient-list">
          {r.ingredients.map((g, k) => {
            const name = ingredientName(state, g.itemId);
            const unit = ingredientUnit(state, g.itemId);
            return (
              <label className="ingredient" key={g.itemId + k}>
                <span>
                  <strong>{name}</strong>
                  <small>
                    {g.optional ? 'Opcional · ' : ''}Disponible: {qty(stockOf(state, g.itemId))} {unit}
                    {isTypeKey(g.itemId) ? ' · de cualquier marca, primero lo que caduca antes' : ''}
                  </small>
                </span>
                <input
                  aria-label={'Cantidad de ' + name}
                  type="number"
                  min={0}
                  step="0.1"
                  value={amounts[k] ?? 0}
                  onChange={(e) => setAmounts((a) => a.map((v, j) => (j === k ? Number(e.target.value) : v)))}
                />
                <span>{unit}</span>
              </label>
            );
          })}
        </div>
        <h3>Preparación</h3>
        <ol className="steps">
          {r.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <div className="form-grid">
          <label>
            Peso final cocinado (g)
            <input name="yield" type="number" required min="1" placeholder="Pesa o estima" />
          </label>
          <label>
            Revisar conservación el
            <input name="review" type="date" min={day()} defaultValue={day(2)} required />
          </label>
        </div>
        <p className="footnote">La fecha es un recordatorio elegido por ti, no una garantía de conservación. El peso final permite calcular porciones y sobras.</p>
        <button className="button primary full" type="submit">
          <Check size={17} /> Confirmar que lo he cocinado
        </button>
        <button className="button secondary full spaced" type="button" onClick={() => open('plan', { recipeId: r.id })}>
          <CalendarDays size={17} /> Solo planificar, sin descontar
        </button>
      </form>
      <div className="button-row spaced">
        <button className="text-button" onClick={() => open('recipe-edit', { recipeId: r.id })}>
          <NotebookPen size={14} /> Editar receta
        </button>
      </div>
    </>
  );
};

const ServeModal: ModalComp = ({ data }) => {
  const { state, act, members } = useHome();
  const t = state.tuppers.find((t) => t.id === data.tupperId);
  const meal = state.meals.find((m) => m.id === data.mealId);
  const [diners, setDiners] = useState(() => (meal?.diners?.length ? meal.diners : members.map((m) => m.id)));
  if (!t) return <p className="muted">Esta preparación ya no existe.</p>;
  const eating = members.filter((m) => diners.includes(m.id));
  const share = eating.length ? Math.floor(t.grams / eating.length) : 0;
  const extras = state.items.filter((i) => i.section !== 14 && i.section !== 15 && i.place !== 'Hogar' && i.qty > 0);
  return (
    <>
      <h2>Un plato para cada uno</h2>
      <p className="muted">
        {t.name} · {qty(t.grams)} g disponibles
      </p>
      <span className="field-label">Quién come</span>
      <MemberPicker value={diners} onChange={setDiners} members={members} />
      <form
        key={diners.join()}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const plates = eating.map((m, k) => ({ person: m.id, grams: num(f, 'grams' + k), extraId: str(f, 'extra' + k), extraAmount: num(f, 'amount' + k) || 0 }));
          act({ type: 'serve', tupperId: t.id, plates, date: day(), ids: plates.map(() => uid()), mealId: data.mealId }, 'Platos registrados. Las sobras se han actualizado.', true);
        }}
      >
        {eating.map((p, k) => (
          <section className="plate" key={p.id}>
            <div className="plate-title">
              <Avatar member={p} />
              <h3>{p.name}</h3>
            </div>
            <label>
              Cantidad de la preparación (g)
              <input name={'grams' + k} type="number" min="0" step="1" defaultValue={share} required />
            </label>
            <div className="form-grid">
              <label>
                Extra para este plato
                <select name={'extra' + k}>
                  <option value="">Sin extra</option>
                  {extras.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cantidad del extra
                <input name={'amount' + k} type="number" min="0" step="0.1" defaultValue="0" />
              </label>
            </div>
          </section>
        ))}
        {!eating.length && <p className="muted">Elige al menos a una persona.</p>}
        <p className="footnote">Lo que no sirvas seguirá disponible como tupper. Los extras se añaden por plato.</p>
        <button type="submit" className="button primary full" disabled={!eating.length}>
          Confirmar lo que hemos comido <Check size={17} />
        </button>
      </form>
    </>
  );
};

const TupperModal: ModalComp = ({ data }) => {
  const { state, act, open } = useHome();
  const t = state.tuppers.find((t) => t.id === data.tupperId);
  if (!t) return <p className="muted">Esta preparación ya no existe.</p>;
  return (
    <>
      <div className="modal-food">{t.emoji}</div>
      <h2>{t.name}</h2>
      <p className="muted">
        Preparado el {fmtDate(t.created)} · {t.place}
      </p>
      <div className="big-quantity">
        {qty(t.grams)} <span>g disponibles</span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          act({ type: 'patch', collection: 'tuppers', entityId: t.id, fields: { grams: num(f, 'grams'), review: str(f, 'review'), place: str(f, 'place') } }, 'Tupper actualizado', true);
        }}
      >
        <label>
          Corregir cantidad restante (g)
          <input name="grams" type="number" min="0" step="1" defaultValue={t.grams} required />
        </label>
        <div className="form-grid">
          <label>
            Ubicación
            <select name="place" defaultValue={t.place}>
              <option>Nevera</option>
              <option>Congelador</option>
            </select>
          </label>
          <label>
            Fecha de revisión
            <input type="date" name="review" defaultValue={t.review} required />
          </label>
        </div>
        <button className="button secondary full" type="submit">
          Guardar cambios
        </button>
      </form>
      <button className="button primary full spaced" onClick={() => open('serve', { tupperId: t.id })}>
        Repartir en platos
      </button>
      <button className="text-button danger spaced" onClick={() => open('out', { target: 'tupper', id: t.id })}>
        Registrar una salida extraordinaria
      </button>
    </>
  );
};

const PlanModal: ModalComp = ({ data }) => {
  const { state, act, members, setError } = useHome();
  const meal = state.meals.find((m) => m.id === data?.mealId);
  const [diners, setDiners] = useState<string[]>(meal?.diners?.length ? meal.diners : members.map((m) => m.id));
  const stock = tuppersInStock(state);
  const defaultSource = meal?.tupperId ? 't:' + meal.tupperId : 'r:' + (data?.recipeId ?? meal?.recipeId ?? state.recipes[0]?.id ?? '');
  return (
    <>
      <h2>{meal ? 'Cambiar comida' : 'Planificar una comida'}</h2>
      <p className="muted">Las cantidades se confirman al cocinar o servir.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const [type, id] = str(f, 'source').split(':');
          const name = type === 't' ? state.tuppers.find((t) => t.id === id)?.name : state.recipes.find((r) => r.id === id)?.name;
          if (!name) return setError('Elige qué vais a comer.');
          const entity = {
            id: meal?.id ?? uid(),
            name,
            date: str(f, 'date'),
            time: str(f, 'time'),
            kind: str(f, 'kind'),
            done: false,
            thawed: meal?.thawed ?? false,
            ...(diners.length && diners.length < members.length ? { diners } : {}),
            ...(type === 't' ? { tupperId: id } : { recipeId: id }),
          };
          act({ type: 'upsert', collection: 'meals', entity }, 'Comida planificada', true);
        }}
      >
        <label>
          Qué vamos a comer
          <select name="source" defaultValue={defaultSource}>
            <optgroup label="Primero, tuppers">
              {stock.map((t) => (
                <option value={'t:' + t.id} key={t.id}>
                  {t.name} · {qty(t.grams)} g
                </option>
              ))}
            </optgroup>
            <optgroup label="Recetas">
              {state.recipes.map((r) => (
                <option value={'r:' + r.id} key={r.id}>
                  {r.name}
                  {canCook(state, r) ? '' : ' · faltan ingredientes'}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="form-grid">
          <label>
            Día
            <input name="date" type="date" defaultValue={meal?.date ?? day(1)} min={day()} required />
          </label>
          <label>
            Hora
            <input name="time" type="time" defaultValue={meal?.time ?? '14:30'} required />
          </label>
        </div>
        <label>
          Momento
          <select name="kind" defaultValue={meal?.kind ?? 'Comida'}>
            <option>Desayuno</option>
            <option>Comida</option>
            <option>Cena</option>
          </select>
        </label>
        <span className="field-label">Quién come</span>
        <MemberPicker value={diners} onChange={setDiners} members={members} />
        <button className="button primary full" type="submit" disabled={!state.recipes.length && !stock.length}>
          Guardar en el plan
        </button>
      </form>
      {meal && (
        <button className="text-button danger spaced" onClick={() => act({ type: 'remove', collection: 'meals', entityId: meal.id }, 'Retirada del plan', true)}>
          Retirar del plan
        </button>
      )}
    </>
  );
};

const ReminderModal: ModalComp = ({ data }) => {
  const { state, act } = useHome();
  const m = state.meals.find((m) => m.id === data.mealId);
  if (!m) return <p className="muted">Esta comida ya no está en el plan.</p>;
  const at = new Date(m.date + 'T' + m.time);
  at.setHours(at.getHours() - 12);
  return (
    <>
      <IconBadge color="blue">
        <Snowflake size={25} />
      </IconBadge>
      <h2>Prepara los congelados</h2>
      <p className="muted">{m.name}</p>
      <div className="info-strip">
        <Clock size={20} />
        <span>Aviso previsto: {at.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.</span>
      </div>
      <p>Revisa las instrucciones del envase. Algunos alimentos se cocinan directamente congelados.</p>
      <button className="button primary full" onClick={() => act({ type: 'patch', collection: 'meals', entityId: m.id, fields: { thawed: true } }, 'Preparación de congelados confirmada', true)}>
        Ya lo he revisado <Check size={16} />
      </button>
    </>
  );
};

const NutritionModal: ModalComp = () => {
  const { state, members } = useHome();
  const days = Array.from({ length: 7 }, (_, i) => day(i - 6));
  return (
    <>
      <h2>Balance de la última semana</h2>
      <p className="muted">Proteína registrada al repartir platos. No es una evaluación nutricional.</p>
      <div className="info-strip">
        <Info size={20} />
        <span>Cada persona puede fijar su objetivo diario en Hogar → Personas. Las comidas solo planificadas no cuentan.</span>
      </div>
      {members.map((p) => (
        <section key={p.id} className="plate">
          <div className="plate-title">
            <Avatar member={p} size="small" />
            <h3>
              {p.name}
              {p.proteinTarget ? ` · objetivo ${p.proteinTarget} g` : ''}
            </h3>
          </div>
          {days.map((d) => {
            const n = state.consumptions.filter((c) => c.person === p.id && c.date === d).reduce((a, c) => a + c.protein, 0);
            return (
              <div className="detail-line" key={d}>
                <span>{relative(d)}</span>
                <strong>{Math.round(n)} g</strong>
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
};

/** Crear o editar una receta a mano. */
const RecipeEditModal: ModalComp = ({ data }) => {
  const { state, act, open } = useHome();
  const r = state.recipes.find((x) => x.id === data?.recipeId);
  const products = state.items.filter((i) => !i.productId);
  // Tipos con existencias: «cualquier arroz integral», de la marca que haya.
  const types = [...new Set(state.items.filter((i) => i.type).map((i) => i.type!))].sort();
  const [rows, setRows] = useState(() => r?.ingredients.map((g) => ({ ...g })) ?? [{ itemId: products[0]?.id ?? '', amount: 100, optional: false }]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <>
      <h2>{r ? 'Editar receta' : 'Nueva receta'}</h2>
      <p className="muted">Los ingredientes salen del inventario: así sabremos si se puede cocinar.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const entity = {
            id: r?.id ?? uid(),
            name: str(f, 'name'),
            emoji: str(f, 'emoji') || '🥗',
            description: str(f, 'description'),
            minutes: num(f, 'minutes'),
            servings: num(f, 'servings'),
            ingredients: rows.filter((g) => g.itemId && g.amount > 0),
            steps: str(f, 'steps').split('\n').map((s) => s.trim()).filter(Boolean),
          };
          if (act({ type: 'upsert', collection: 'recipes', entity }, r ? 'Receta actualizada' : 'Receta creada')) open('recipe', { recipeId: entity.id });
        }}
      >
        <div className="form-grid">
          <label>
            Nombre
            <input name="name" defaultValue={r?.name} required minLength={2} maxLength={100} placeholder="Ej. Curry de garbanzos" />
          </label>
          <label>
            Emoji
            <input name="emoji" defaultValue={r?.emoji ?? '🥗'} maxLength={8} />
          </label>
        </div>
        <label>
          Descripción
          <input name="description" defaultValue={r?.description} maxLength={300} placeholder="Una frase que apetezca" />
        </label>
        <div className="form-grid">
          <label>
            Minutos
            <input name="minutes" type="number" min="1" max="1440" defaultValue={r?.minutes ?? 30} required />
          </label>
          <label>
            Raciones
            <input name="servings" type="number" min="1" max="100" defaultValue={r?.servings ?? 2} required />
          </label>
        </div>
        <span className="field-label">Ingredientes</span>
        {!products.length && <p className="muted">Primero añade artículos al inventario.</p>}
        {rows.map((g, k) => (
          <div className="form-grid ingredient-edit" key={k}>
            <label>
              Artículo
              <select value={g.itemId} onChange={(e) => setRows(rows.map((x, j) => (j === k ? { ...x, itemId: e.target.value } : x)))}>
                {types.length > 0 && (
                  <optgroup label="Cualquier marca (por tipo)">
                    {types.map((t) => (
                      <option key={t} value={typeKey(t)}>
                        {ingredientName(state, typeKey(t))}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Un artículo concreto">
                  {products.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.emoji} {i.name} ({i.unit}){i.type ? ` · ${formatCode(i.type)}.${i.article}` : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label>
              Cantidad
              <span className="inline-inputs">
                <input type="number" min="0.1" step="0.1" value={g.amount} onChange={(e) => setRows(rows.map((x, j) => (j === k ? { ...x, amount: Number(e.target.value) } : x)))} />
                <button type="button" className="icon-button" aria-label="Quitar ingrediente" onClick={() => setRows(rows.filter((_, j) => j !== k))}>
                  <Trash2 size={15} />
                </button>
              </span>
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={g.optional} onChange={(e) => setRows(rows.map((x, j) => (j === k ? { ...x, optional: e.target.checked } : x)))} /> Opcional
            </label>
          </div>
        ))}
        {products.length > 0 && (
          <button type="button" className="text-button" onClick={() => setRows([...rows, { itemId: products[0].id, amount: 100, optional: false }])}>
            <Plus size={14} /> Añadir ingrediente
          </button>
        )}
        <label>
          Pasos (uno por línea)
          <textarea name="steps" rows={5} defaultValue={r?.steps.join('\n')} required placeholder={'Lava y corta…\nSofríe…'} />
        </label>
        <button className="button primary full" type="submit" disabled={!products.length}>
          Guardar receta
        </button>
      </form>
      {r &&
        (confirmDelete ? (
          <button className="button danger-button full spaced" onClick={() => act({ type: 'remove', collection: 'recipes', entityId: r.id }, 'Receta eliminada', true)}>
            Sí, eliminar «{r.name}»
          </button>
        ) : (
          <button className="text-button danger spaced" onClick={() => setConfirmDelete(true)}>
            Eliminar receta
          </button>
        ))}
    </>
  );
};

export const kitchenModals: Record<string, ModalComp> = {
  recipe: RecipeModal,
  serve: ServeModal,
  tupper: TupperModal,
  plan: PlanModal,
  reminder: ReminderModal,
  nutrition: NutritionModal,
  'recipe-edit': RecipeEditModal,
};

export type { Tupper };
