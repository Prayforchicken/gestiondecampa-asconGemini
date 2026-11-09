// Kits e inventarios personales: mochila de emergencia, botiquín, kit de la mascota...
// Lista de kits, detalle de cada uno, revisión guiada y avisos en el calendario del móvil.
import '../../styles/kits.css';
import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  History,
  Info,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { ModalComp } from '../App';
import { useHome } from '../../app/context';
import { Empty, OwnerSelect, PageHeading, num, str } from '../common';
import { download } from '../download';
import { uid } from '../../domain/format';
import { day, fmtDate, fromNow } from '../../domain/dates';
import {
  KIT_TEMPLATES,
  itemHealth,
  kitDues,
  kitFromTemplate,
  kitHealth,
  kitsToIcs,
  pendingDues,
  taskDue,
  visibleKits,
  type Due,
  type Health,
} from '../../domain/kits';
import type { Kit, KitItem } from '../../domain/types';

// ---------- Pequeñas ayudas ----------

const RANK: Record<Health, number> = { overdue: 0, soon: 1, ok: 2 };

/** Etiqueta de estado para un aviso concreto. */
function DuePill({ due }: { due: Due }) {
  if (due.health === 'overdue') return <span className="pill red">{due.kind === 'missing' ? 'Falta' : due.kind === 'expires' ? 'Caducado' : 'Vencido'}</span>;
  if (due.health === 'soon') return <span className="pill orange">{fromNow(due.date)}</span>;
  return <span className="pill green">{fromNow(due.date)}</span>;
}

/** Etiqueta de estado de un kit o un artículo completo. */
function HealthPill({ health }: { health: Health }) {
  if (health === 'overdue') return <span className="pill red">Necesita atención</span>;
  if (health === 'soon') return <span className="pill orange">Pronto toca revisar</span>;
  return <span className="pill green">Al día</span>;
}

function exportCalendar(kits: Kit[], toast: (m: string) => void) {
  download('revisiones-hogar.ics', kitsToIcs(kits), 'text/calendar');
  toast('Calendario descargado. Ábrelo para añadir los avisos a tu móvil.');
}

/** Primera fecha en la que toca algo para un artículo (para ordenar). */
function firstDue(kit: Kit, item: KitItem) {
  return kitDues(kit).find((d) => d.itemId === item.id)?.date ?? '9999-99-99';
}

const TASK_SUGGESTIONS = ['Cambiar pilas', 'Comprobar que funciona', 'Recargar', 'Revisar caducidades', 'Actualizar'];
const UNIT_SUGGESTIONS = ['ud', 'l', 'latas', 'caja', 'paquete', 'sobre', 'días'];

// ---------- Página ----------

export function KitsPage() {
  const { param } = useHome();
  return param ? <KitDetail kitId={param} /> : <KitList />;
}

type Filter = 'Todos' | 'Míos' | 'De la casa';

function KitList() {
  const { state, me, open, go, nameOf, toast } = useHome();
  const [filter, setFilter] = useState<Filter>('Todos');
  // Solo se ven los kits de la casa y los propios: los personales de otros nunca aparecen.
  const visible = useMemo(() => visibleKits(state.kits, me.id), [state.kits, me.id]);
  const shown = visible.filter((k) => (filter === 'Todos' ? true : filter === 'Míos' ? k.owner === me.id : k.owner === null));
  const dues = pendingDues(visible).slice(0, 5);

  return (
    <>
      <PageHeading
        overline="MI ESPACIO"
        title="Kits y revisiones"
        subtitle="Pilas, latas y botiquín a punto. Sin sorpresas el día que haga falta."
        action={
          <button className="button primary compact" onClick={() => open('kit-new')}>
            <Plus size={17} />
            <span>Nuevo kit</span>
          </button>
        }
      />

      {dues.length > 0 && (
        <section className="card kit-dues">
          <div className="section-title">
            <div>
              <AlertCircle size={18} className="amber" />
              <h2>Lo que toca pronto</h2>
            </div>
            <span className="count-badge">{pendingDues(visible).length}</span>
          </div>
          {dues.map((d) => (
            <button key={`${d.kitId}-${d.itemId ?? 'kit'}-${d.kind}`} className="alert-row" onClick={() => go('kits', d.kitId)}>
              <span>{d.kitEmoji}</span>
              <div>
                <strong>{d.label}</strong>
                <small>
                  {d.kitName} · {fmtDate(d.date)}
                </small>
              </div>
              <DuePill due={d} />
            </button>
          ))}
        </section>
      )}

      {visible.length > 0 && (
        <div className="toolbar">
          <div className="segmented">
            {(['Todos', 'Míos', 'De la casa'] as Filter[]).map((f) => (
              <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          <button className="button secondary" onClick={() => exportCalendar(visible, toast)}>
            <CalendarPlus size={16} /> Exportar avisos al calendario
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <Empty title="Todavía no hay kits" body="Empieza por una mochila de emergencia: te avisaremos cuando toque cambiar pilas o revisar latas.">
          <button className="button primary spaced" onClick={() => open('kit-new', { template: 'emergencia' })}>
            <Plus size={16} /> Crear mochila de emergencia
          </button>
        </Empty>
      ) : shown.length === 0 ? (
        <Empty title="Nada por aquí" body={filter === 'Míos' ? 'No tienes kits personales todavía.' : 'No hay kits de toda la casa todavía.'} />
      ) : (
        <div className="cards-grid">
          {shown.map((k) => {
            const health = kitHealth(k);
            const next = kitDues(k)[0];
            return (
              <button key={k.id} className="card kit-card" onClick={() => go('kits', k.id)}>
                <div className={'food-panel ' + (health === 'overdue' ? 'warm' : health === 'soon' ? 'warm' : 'mint')}>
                  <span>{k.emoji}</span>
                  <HealthPill health={health} />
                </div>
                <div className="card-content">
                  <h3>{k.name}</h3>
                  <p className="muted">
                    {k.owner ? `De ${nameOf(k.owner)}` : 'De la casa'}
                    {k.place ? ` · ${k.place}` : ''}
                  </p>
                  <div className="quantity">
                    <strong>{k.items.length}</strong>
                    <span>{k.items.length === 1 ? 'artículo' : 'artículos'}</span>
                  </div>
                  <p className="kit-next">
                    {next ? (
                      <>
                        Próximo: {next.label} · <span className={next.health === 'ok' ? '' : 'urgent'}>{fromNow(next.date)}</span>
                      </>
                    ) : (
                      'Sin avisos programados'
                    )}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {visible.length > 0 && (
        <div className="info-strip">
          <CalendarPlus size={18} />
          <span>
            El calendario del móvil te avisa aunque la app esté cerrada: exporta los avisos e impórtalos en Google Calendar o Apple Calendario. Después de
            cada revisión, vuelve a exportarlos para que las fechas estén al día.
          </span>
        </div>
      )}
      <p className="footnote kit-privacy">
        <Lock size={12} /> «Personal» significa organizado por persona: solo aparece en tu perfil, pero no es privado frente a quien comparte el servidor del
        hogar.
      </p>
    </>
  );
}

// ---------- Detalle de un kit ----------

function KitDetail({ kitId }: { kitId: string }) {
  const { state, me, open, go, nameOf, toast } = useHome();
  const kit = visibleKits(state.kits, me.id).find((k) => k.id === kitId);

  if (!kit)
    return (
      <>
        <button className="text-button kit-back" onClick={() => go('kits')}>
          <ArrowLeft size={15} /> Todos los kits
        </button>
        <Empty title="No encontramos este kit" body="Puede que se haya borrado o que sea el kit personal de otra persona." />
      </>
    );

  const health = kitHealth(kit);
  const dues = kitDues(kit);
  const attention = dues.filter((d) => d.health !== 'ok');
  // Primero lo vencido, luego lo próximo; dentro de cada grupo, por fecha.
  const items = [...kit.items].sort(
    (a, b) => RANK[itemHealth(kit, a)] - RANK[itemHealth(kit, b)] || firstDue(kit, a).localeCompare(firstDue(kit, b)) || a.name.localeCompare(b.name),
  );
  const needDates = kit.items.filter((i) => !i.expires && /apunta/i.test(i.notes));
  const review = dues.find((d) => d.kind === 'review');

  return (
    <>
      <button className="text-button kit-back" onClick={() => go('kits')}>
        <ArrowLeft size={15} /> Todos los kits
      </button>

      <section className="card kit-header">
        <div className="kit-header-main">
          <span className="kit-emoji">{kit.emoji}</span>
          <div>
            <p className="overline">{kit.owner ? `KIT DE ${nameOf(kit.owner).toUpperCase()}` : 'KIT DE LA CASA'}</p>
            <h1>{kit.name}</h1>
            <p className="muted">
              {kit.place || 'Sin ubicación'} · {kit.items.length} {kit.items.length === 1 ? 'artículo' : 'artículos'}
              {kit.lastReview ? ` · última revisión ${fmtDate(kit.lastReview)}` : ' · sin revisar todavía'}
            </p>
            {kit.notes && <p className="kit-notes">{kit.notes}</p>}
          </div>
        </div>
        <div className="kit-health">
          <HealthPill health={health} />
          <span className="muted">
            {attention.length
              ? `${attention.length} ${attention.length === 1 ? 'cosa necesita' : 'cosas necesitan'} atención`
              : review
                ? `Próxima revisión general ${fromNow(review.date)}`
                : 'Todo en orden'}
          </span>
        </div>
        <div className="kit-actions">
          <button className="button primary" onClick={() => open('kit-review', { kitId: kit.id })} disabled={!kit.items.length}>
            <ClipboardCheck size={16} /> Revisar ahora
          </button>
          <button className="button secondary" onClick={() => open('kit-item', { kitId: kit.id })}>
            <Plus size={16} /> Añadir artículo
          </button>
          <button className="button secondary" onClick={() => exportCalendar([kit], toast)}>
            <CalendarPlus size={16} /> Calendario
          </button>
          <button className="button secondary" onClick={() => open('kit-edit', { kitId: kit.id })}>
            <Pencil size={16} /> Editar
          </button>
        </div>
      </section>

      {needDates.length > 0 && (
        <div className="info-strip">
          <Info size={18} />
          <span>
            Completa las fechas de caducidad para recibir avisos: {needDates.slice(0, 4).map((i) => i.name.toLowerCase()).join(', ')}
            {needDates.length > 4 ? '…' : '.'}
          </span>
        </div>
      )}

      <section className="card kit-items">
        <div className="section-title">
          <div>
            <h2>Contenido</h2>
          </div>
          <span className="count-badge">{kit.items.length}</span>
        </div>
        {items.length === 0 && <p className="muted kit-empty-items">Este kit está vacío. Añade lo que guardas dentro.</p>}
        {items.map((i) => (
          <KitItemRow key={i.id} kit={kit} item={i} />
        ))}
      </section>

      <section className="card kit-history">
        <div className="section-title">
          <div>
            <History size={17} />
            <h2>Historial</h2>
          </div>
        </div>
        {kit.history.length === 0 ? (
          <p className="muted">Aún no hay revisiones. La primera deja el kit al día.</p>
        ) : (
          kit.history.slice(0, 12).map((h) => (
            <p key={h.id} className="kit-history-row">
              <CheckCircle2 size={15} />
              <span>{h.summary}</span>
              <small>
                {fmtDate(h.date)} · {nameOf(h.by)}
              </small>
            </p>
          ))
        )}
      </section>
    </>
  );
}

function KitItemRow({ kit, item }: { kit: Kit; item: KitItem }) {
  const { open } = useHome();
  const health = itemHealth(kit, item);
  const next = taskDue(item);
  // ¿La caducidad está vencida o próxima? Entonces la resaltamos.
  const expiryUrgent = kitDues(kit).some((d) => d.itemId === item.id && d.kind === 'expires' && d.health !== 'ok');
  const doneLabel = item.task || 'Repuesto';
  return (
    <div className={'kit-item-row ' + health}>
      <button className="kit-item-main" onClick={() => open('kit-item', { kitId: kit.id, itemId: item.id })} aria-label={'Editar ' + item.name}>
        <span className={'kit-dot ' + health} aria-hidden="true" />
        <span className="kit-item-text">
          <strong>
            {item.name}
            {item.missing && <span className="pill red">Falta</span>}
          </strong>
          <small>
            {item.qty} {item.unit}
            {item.expires && (
              <>
                {' · '}
                <span className={expiryUrgent ? 'urgent' : ''}>
                  caduca {fmtDate(item.expires)} ({fromNow(item.expires)})
                </span>
              </>
            )}
          </small>
          {item.everyMonths > 0 && next && (
            <small>
              {item.task || 'Revisar'} · cada {item.everyMonths} {item.everyMonths === 1 ? 'mes' : 'meses'} · próxima: {fmtDate(next)} ({fromNow(next)})
            </small>
          )}
          {item.notes && <small className="kit-item-notes">{item.notes}</small>}
        </span>
      </button>
      <button className="button secondary compact kit-done-button" onClick={() => open('kit-done', { kitId: kit.id, itemId: item.id })}>
        <Check size={15} /> {doneLabel.length > 18 ? 'Hecho' : doneLabel}
      </button>
    </div>
  );
}

// ---------- Modales ----------

/** Busca kit y artículo a partir de los datos del modal. */
function useKit(data: { kitId?: string; itemId?: string } | undefined) {
  const { state } = useHome();
  const kit = state.kits.find((k) => k.id === data?.kitId);
  const item = kit?.items.find((i) => i.id === data?.itemId);
  return { kit, item };
}

const Gone = () => <p className="muted">Este kit ya no existe.</p>;

const KitNew: ModalComp = ({ data }) => {
  const { state, me, act, go } = useHome();
  const [key, setKey] = useState<string>(data?.template ?? 'emergencia');
  const template = KIT_TEMPLATES.find((t) => t.key === key) ?? KIT_TEMPLATES[0];
  return (
    <>
      <h2>Un kit nuevo</h2>
      <p className="muted">Elige una base. Después puedes añadir, quitar y cambiar lo que quieras.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const kit = kitFromTemplate(template, str(f, 'owner') || null, uid, state.household.pets[0]?.name);
          const name = str(f, 'name');
          if (name) kit.name = name;
          if (act({ type: 'upsert', collection: 'kits', entity: kit }, `${kit.name} creado`, true)) go('kits', kit.id);
        }}
      >
        <div className="template-grid" role="radiogroup" aria-label="Plantilla">
          {KIT_TEMPLATES.map((t) => (
            <button
              type="button"
              role="radio"
              aria-checked={t.key === key}
              key={t.key}
              className={'template-option' + (t.key === key ? ' selected' : '')}
              onClick={() => setKey(t.key)}
            >
              <span className="template-emoji">{t.emoji}</span>
              <span>
                <strong>{t.name}</strong>
                <small>{t.description}</small>
                <small className="template-count">{t.items.length ? `${t.items.length} artículos sugeridos` : 'Vacío'}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label>
            ¿De quién es?
            {/* La «key» reinicia el valor por defecto al cambiar de plantilla. */}
            <OwnerSelect key={template.key} name="owner" defaultValue={template.key === 'blanco' ? me.id : ''} />
          </label>
          <label>
            Nombre (opcional)
            <input name="name" maxLength={80} placeholder={template.key === 'mascota' && state.household.pets[0] ? `Kit de ${state.household.pets[0].name}` : template.name} />
          </label>
        </div>
        {template.key === 'emergencia' && (
          <p className="footnote">
            Basado en la recomendación de autonomía para 72 horas. Son sugerencias: ajusta cantidades a cuántos sois y a vuestras necesidades.
          </p>
        )}
        <button className="button primary full" type="submit">
          <Plus size={16} /> Crear kit
        </button>
      </form>
    </>
  );
};

const KitEdit: ModalComp = ({ data }) => {
  const { act, go } = useHome();
  const { kit } = useKit(data);
  const [confirm, setConfirm] = useState(false);
  if (!kit) return <Gone />;
  return (
    <>
      <h2>Editar kit</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const entity: Kit = {
            ...kit,
            name: str(f, 'name'),
            emoji: str(f, 'emoji') || kit.emoji,
            owner: str(f, 'owner') || null,
            place: str(f, 'place'),
            notes: str(f, 'notes'),
            reviewEveryMonths: Math.round(num(f, 'reviewEveryMonths')),
            warnDays: Math.round(num(f, 'warnDays')),
          };
          act({ type: 'upsert', collection: 'kits', entity }, 'Kit guardado', true);
        }}
      >
        <div className="form-grid kit-name-grid">
          <label>
            Icono
            <input name="emoji" defaultValue={kit.emoji} maxLength={8} aria-label="Emoji del kit" />
          </label>
          <label>
            Nombre
            <input name="name" defaultValue={kit.name} maxLength={80} required />
          </label>
        </div>
        <div className="form-grid">
          <label>
            ¿De quién es?
            <OwnerSelect name="owner" defaultValue={kit.owner} />
          </label>
          <label>
            Dónde está guardado
            <input name="place" defaultValue={kit.place} maxLength={80} placeholder="Ej. armario de la entrada" />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Revisión general cada (meses)
            <input name="reviewEveryMonths" type="number" min="0" max="120" step="1" defaultValue={kit.reviewEveryMonths} required />
          </label>
          <label>
            Avisar con (días de antelación)
            <input name="warnDays" type="number" min="0" max="365" step="1" defaultValue={kit.warnDays} required />
          </label>
        </div>
        <label>
          Notas
          <textarea name="notes" defaultValue={kit.notes} maxLength={500} rows={3} placeholder="Instrucciones, qué hacer en caso de emergencia…" />
        </label>
        <p className="footnote">Pon 0 meses si no quieres revisión general. Los artículos con tarea propia avisan igualmente.</p>
        <button className="button primary full" type="submit">
          Guardar cambios
        </button>
      </form>
      <div className="danger-zone">
        {!confirm ? (
          <button className="text-button danger" onClick={() => setConfirm(true)}>
            <Trash2 size={14} /> Eliminar este kit
          </button>
        ) : (
          <>
            <p className="muted">Se borrarán el kit, sus {kit.items.length} artículos y su historial. No se puede deshacer.</p>
            <div className="button-row spaced">
              <button className="button secondary" onClick={() => setConfirm(false)}>
                Cancelar
              </button>
              <button
                className="button danger-button"
                onClick={() => {
                  if (act({ type: 'remove', collection: 'kits', entityId: kit.id }, 'Kit eliminado', true)) go('kits');
                }}
              >
                Sí, eliminar
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

const KitItemForm: ModalComp = ({ data }) => {
  const { act } = useHome();
  const { kit, item } = useKit(data);
  if (!kit) return <Gone />;
  if (data?.itemId && !item) return <p className="muted">Este artículo ya no existe.</p>;
  return (
    <>
      <h2>{item ? 'Editar artículo' : 'Añadir al kit'}</h2>
      <p className="muted">{kit.name}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const next: KitItem = {
            id: item?.id ?? uid(),
            name: str(f, 'name'),
            qty: num(f, 'qty'),
            unit: str(f, 'unit') || 'ud',
            expires: str(f, 'expires'),
            task: str(f, 'task'),
            everyMonths: Math.round(num(f, 'everyMonths')),
            lastDone: str(f, 'lastDone'),
            notes: str(f, 'notes'),
            missing: item?.missing ?? false,
          };
          act({ type: 'kit.item.upsert', kitId: kit.id, item: next }, item ? 'Artículo guardado' : 'Artículo añadido', true);
        }}
      >
        <label>
          Nombre
          <input name="name" defaultValue={item?.name} maxLength={100} required placeholder="Ej. linterna frontal" />
        </label>
        <div className="form-grid">
          <label>
            Cantidad
            <input name="qty" type="number" min="0" step="any" defaultValue={item?.qty ?? 1} required />
          </label>
          <label>
            Unidad
            <input name="unit" list="kit-units" defaultValue={item?.unit ?? 'ud'} maxLength={20} />
          </label>
        </div>
        <label>
          Caduca el (opcional)
          <input name="expires" type="date" defaultValue={item?.expires} />
        </label>
        <h3>Tarea periódica</h3>
        <div className="form-grid">
          <label>
            Qué hay que hacer
            <input name="task" list="kit-tasks" defaultValue={item?.task} maxLength={80} placeholder="Ej. Cambiar pilas" />
          </label>
          <label>
            Cada (meses)
            <input name="everyMonths" type="number" min="0" max="120" step="1" defaultValue={item?.everyMonths ?? 0} />
          </label>
        </div>
        <label>
          Última vez que se hizo
          <input name="lastDone" type="date" defaultValue={item ? item.lastDone : day()} max={day()} />
        </label>
        <label>
          Notas
          <textarea name="notes" defaultValue={item?.notes} maxLength={300} rows={2} placeholder="Tamaño de pilas, dónde comprarlo…" />
        </label>
        <datalist id="kit-tasks">
          {TASK_SUGGESTIONS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <datalist id="kit-units">
          {UNIT_SUGGESTIONS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <p className="footnote">Deja 0 meses si no tiene tarea. Si nunca se ha hecho, deja la fecha vacía y te avisaremos ya.</p>
        <button className="button primary full" type="submit">
          {item ? 'Guardar artículo' : 'Añadir artículo'}
        </button>
      </form>
      {item && (
        <button
          className="text-button danger spaced"
          onClick={() => act({ type: 'kit.item.remove', kitId: kit.id, itemId: item.id }, `${item.name} retirado del kit`, true)}
        >
          <Trash2 size={14} /> Quitar del kit
        </button>
      )}
    </>
  );
};

const KitDone: ModalComp = ({ data }) => {
  const { act } = useHome();
  const { kit, item } = useKit(data);
  if (!kit || !item) return <p className="muted">Este artículo ya no existe.</p>;
  const label = item.task || 'Repuesto';
  // Si el artículo caduca (o la tarea es reponer), al reponerlo cambia su fecha.
  const askExpiry = Boolean(item.expires) || /repon|cambiar|renovar/i.test(item.task);
  return (
    <>
      <h2>{item.name}</h2>
      <p className="muted">
        {kit.name} · {label}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const expires = str(f, 'expires');
          act(
            { type: 'kit.item.done', kitId: kit.id, itemId: item.id, date: day(), logId: uid(), ...(expires ? { expires } : {}) },
            `${label}: ${item.name}. Siguiente aviso calculado.`,
            true,
          );
        }}
      >
        <div className="detail-list">
          {item.everyMonths > 0 && (
            <p>
              <span>Próxima vez</span>
              <strong>en {item.everyMonths} {item.everyMonths === 1 ? 'mes' : 'meses'}</strong>
            </p>
          )}
          {item.expires && (
            <p>
              <span>Caducidad actual</span>
              <strong>{fmtDate(item.expires)}</strong>
            </p>
          )}
        </div>
        {askExpiry && (
          <label>
            Nueva fecha de caducidad (si lo has repuesto)
            <input name="expires" type="date" min={day()} />
          </label>
        )}
        <button className="button primary full" type="submit">
          <Check size={16} /> Hecho hoy
        </button>
      </form>
    </>
  );
};

type ReviewStatus = 'ok' | 'done' | 'missing';

const KitReview: ModalComp = ({ data }) => {
  const { act, toast, close } = useHome();
  const { kit } = useKit(data);
  const [status, setStatus] = useState<Record<string, ReviewStatus>>({});
  const [expiry, setExpiry] = useState<Record<string, string>>({});
  const [toShopping, setToShopping] = useState(true);
  if (!kit) return <Gone />;
  const get = (id: string): ReviewStatus => status[id] ?? 'ok';
  const items = [...kit.items].sort((a, b) => RANK[itemHealth(kit, a)] - RANK[itemHealth(kit, b)]);
  const counts = { ok: 0, done: 0, missing: 0 };
  for (const i of kit.items) counts[get(i.id)]++;

  function submit() {
    const missing = kit!.items.filter((i) => get(i.id) === 'missing');
    const ok = act({
      type: 'kit.review',
      kitId: kit!.id,
      date: day(),
      results: kit!.items.map((i) => {
        const s = get(i.id);
        return s === 'done' && expiry[i.id] ? { itemId: i.id, status: s, expires: expiry[i.id] } : { itemId: i.id, status: s };
      }),
      shopping: toShopping ? missing.map((i) => ({ id: uid(), name: i.name.slice(0, 100), quantity: `${i.qty} ${i.unit}`.slice(0, 60) })) : [],
      logId: uid(),
    });
    if (ok) {
      toast(
        missing.length && toShopping
          ? `Revisión guardada. ${missing.length} ${missing.length === 1 ? 'cosa va' : 'cosas van'} a la lista de la compra.`
          : 'Revisión guardada. Kit al día.',
      );
      close();
    }
  }

  return (
    <>
      <h2>Revisar {kit.name}</h2>
      <p className="muted">Repasa cada cosa. Lo que falte puede ir directo a la lista de la compra.</p>
      <div className="review-summary">
        <span className="pill green">{counts.ok} bien</span>
        <span className="pill blue">{counts.done} hechos o repuestos</span>
        <span className="pill red">{counts.missing} faltan</span>
      </div>
      <div className="review-list">
        {items.map((i) => {
          const s = get(i.id);
          const h = itemHealth(kit, i);
          return (
            <div key={i.id} className={'review-row ' + s}>
              <div className="review-info">
                <strong>
                  <span className={'kit-dot ' + h} aria-hidden="true" /> {i.name}
                </strong>
                <small>
                  {i.qty} {i.unit}
                  {i.expires ? ` · caduca ${fmtDate(i.expires)}` : ''}
                  {i.task ? ` · ${i.task}` : ''}
                </small>
              </div>
              <div className="review-toggle" role="group" aria-label={'Estado de ' + i.name}>
                <button type="button" aria-pressed={s === 'ok'} className={s === 'ok' ? 'on ok' : ''} onClick={() => setStatus({ ...status, [i.id]: 'ok' })}>
                  Bien
                </button>
                <button type="button" aria-pressed={s === 'done'} className={s === 'done' ? 'on done' : ''} onClick={() => setStatus({ ...status, [i.id]: 'done' })}>
                  <RotateCcw size={12} /> {i.task || 'Repuesto'}
                </button>
                <button
                  type="button"
                  aria-pressed={s === 'missing'}
                  className={s === 'missing' ? 'on missing' : ''}
                  onClick={() => setStatus({ ...status, [i.id]: 'missing' })}
                >
                  Falta
                </button>
              </div>
              {s === 'done' && i.expires && (
                <label className="review-expiry">
                  Nueva caducidad
                  <input type="date" min={day()} value={expiry[i.id] ?? ''} onChange={(e) => setExpiry({ ...expiry, [i.id]: e.target.value })} />
                </label>
              )}
            </div>
          );
        })}
      </div>
      <label className="checkbox-label">
        <input type="checkbox" checked={toShopping} onChange={(e) => setToShopping(e.target.checked)} /> Añadir lo que falta a la lista de la compra
      </label>
      <button className="button primary full spaced" onClick={submit}>
        <ClipboardCheck size={16} /> Guardar revisión <ChevronRight size={15} />
      </button>
    </>
  );
};
KitReview.wide = true;
KitNew.wide = true;

export const kitModals: Record<string, ModalComp> = {
  'kit-new': KitNew,
  'kit-edit': KitEdit,
  'kit-item': KitItemForm,
  'kit-done': KitDone,
  'kit-review': KitReview,
};
