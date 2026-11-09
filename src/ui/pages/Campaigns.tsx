// Campañas: el antiguo «Gestor de Campañas de Hipermercado», ahora dentro de comemos.
// Es un espacio personal: solo se ven las campañas de la persona que usa este dispositivo.
import { useState, type FormEvent } from 'react';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Info,
  Pencil,
  Play,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import '../../styles/campaigns.css';
import type { ModalComp } from '../App';
import { useHome } from '../../app/context';
import { duplicateCampaign, importCampaigns, newCampaign, nextStatus, progress, safeUrl, suggestedStatus } from '../../domain/campaigns';
import { CAMPAIGN_STATUSES, type Campaign, type CampaignStatus, type CampaignTask, type CampaignType } from '../../domain/types';
import { day, fmtDate, relative } from '../../domain/dates';
import { uid } from '../../domain/format';
import { download, readFile } from '../download';
import { Empty, IconBadge, PageHeading, str } from '../common';

// ---------- Ayudas ----------

/** Nombre del filtro (como en la app antigua) para cada estado. */
const FILTER_LABEL: Record<CampaignStatus, string> = { 'Por Empezar': 'Planeadas', 'En Curso': 'Activas', Terminada: 'Terminadas' };
const STATUS_COLOR: Record<CampaignStatus, string> = { 'Por Empezar': 'neutral', 'En Curso': 'blue', Terminada: 'green' };
const STATUS_ICON: Record<CampaignStatus, typeof Clock> = { 'Por Empezar': Clock, 'En Curso': Play, Terminada: CheckCircle2 };

const byStart = (a: Campaign, b: Campaign) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name);

/** Campañas de la persona que usa este dispositivo. */
function useMyCampaigns() {
  const { state, me } = useHome();
  return state.campaigns.filter((c) => c.owner === me.id).sort(byStart);
}

/** Texto de la fecha límite de una tarea y si está vencida. */
function dueInfo(t: CampaignTask, today = day()) {
  if (!t.due) return null;
  const late = !t.completed && t.due < today;
  return { late, text: late ? `Vencida · ${relative(t.due)}` : relative(t.due) };
}

/** Pista de estado: solo si las fechas dicen que la campaña va «por delante» del estado marcado. */
function statusHint(c: Campaign, today = day()): { to: CampaignStatus; text: string } | null {
  const s = suggestedStatus(c, today);
  if (CAMPAIGN_STATUSES.indexOf(s) <= CAMPAIGN_STATUSES.indexOf(c.status)) return null;
  if (s === 'En Curso') return { to: s, text: `${c.startDate === today ? 'Empieza hoy' : `Empezó el ${fmtDate(c.startDate)}`} · ¿Pasar a En curso?` };
  return { to: s, text: `Terminó el ${fmtDate(c.endDate)} · ¿Marcar como terminada?` };
}

// ---------- Página ----------

export function CampaignsPage() {
  const { me, open, toast } = useHome();
  const mine = useMyCampaigns();
  // Por defecto, como en la app antigua: planeadas y activas visibles, terminadas ocultas.
  const [filters, setFilters] = useState<Record<CampaignStatus, boolean>>({ 'Por Empezar': true, 'En Curso': true, Terminada: false });
  const visible = CAMPAIGN_STATUSES.filter((s) => filters[s]);

  function exportJson() {
    // Mismo formato que la app antigua (lista de campañas) para poder ir y volver.
    const data = mine.map(({ owner: _owner, ...c }) => c);
    download(`campanas-export-${day()}.json`, JSON.stringify(data, null, 2));
    toast(`${data.length} campaña${data.length === 1 ? '' : 's'} exportada${data.length === 1 ? '' : 's'}`);
  }

  return (
    <>
      <PageHeading
        overline="MI ESPACIO · TRABAJO"
        title="Campañas"
        subtitle="Folletos, banners y redes, cada tarea a su tiempo."
        action={
          <button className="button primary compact" onClick={() => open('campaign-edit')}>
            <Plus size={17} />
            <span>Nueva campaña</span>
          </button>
        }
      />
      <div className="info-strip campaign-note">
        <Info size={17} />
        <span>
          Espacio personal de {me.name}. Solo aparece en tu perfil; el resto del piso no lo ve en su menú.
        </span>
      </div>

      <TodayTasks campaigns={mine} />

      <div className="toolbar campaign-toolbar">
        <div className="filter-row" role="group" aria-label="Mostrar campañas">
          {CAMPAIGN_STATUSES.map((s) => (
            <button key={s} className={filters[s] ? 'active' : ''} aria-pressed={filters[s]} onClick={() => setFilters((f) => ({ ...f, [s]: !f[s] }))}>
              {FILTER_LABEL[s]} <span className="filter-count">{mine.filter((c) => c.status === s).length}</span>
            </button>
          ))}
        </div>
        <div className="campaign-io">
          <button className="button secondary compact" onClick={() => open('campaign-import')}>
            <Upload size={15} /> Importar JSON
          </button>
          <button className="button secondary compact" onClick={exportJson} disabled={!mine.length}>
            <Download size={15} /> Exportar JSON
          </button>
        </div>
      </div>

      {mine.length === 0 ? (
        <Empty title="Aún no hay campañas" body="Crea la primera o importa el JSON que exportabas en el gestor antiguo.">
          <div className="button-row campaign-empty-actions">
            <button className="button primary" onClick={() => open('campaign-edit')}>
              <Plus size={16} /> Nueva campaña
            </button>
            <button className="button secondary" onClick={() => open('campaign-import')}>
              <Upload size={16} /> Importar
            </button>
          </div>
        </Empty>
      ) : visible.length === 0 ? (
        <Empty title="Ningún estado seleccionado" body="Activa Planeadas, Activas o Terminadas para ver tus campañas." />
      ) : (
        <div className="campaign-columns" style={{ ['--cols' as string]: visible.length }}>
          {visible.map((s) => {
            const list = mine.filter((c) => c.status === s);
            const Icon = STATUS_ICON[s];
            return (
              <section key={s} className="campaign-column">
                <h2 className="campaign-column-title">
                  <span className={'pill ' + STATUS_COLOR[s]}>
                    <Icon size={12} /> {s}
                  </span>
                  <span className="count-badge">{list.length}</span>
                </h2>
                {list.map((c) => (
                  <CampaignCard key={c.id} campaign={c} />
                ))}
                {!list.length && <p className="muted column-empty">Nada por aquí.</p>}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Tareas de hoy o vencidas de todas mis campañas sin terminar. */
function TodayTasks({ campaigns }: { campaigns: Campaign[] }) {
  const { act } = useHome();
  const today = day();
  const rows = campaigns
    .filter((c) => c.status !== 'Terminada')
    .flatMap((c) => c.tasks.filter((t) => !t.completed && t.due && t.due <= today).map((t) => ({ c, t })))
    .sort((a, b) => a.t.due!.localeCompare(b.t.due!));
  if (!rows.length) return null;
  return (
    <section className="card campaign-today">
      <div className="section-title">
        <div>
          <span className="section-icon amber">
            <CalendarDays size={17} />
          </span>
          <h2>Para hoy</h2>
        </div>
        <span className="count-badge">{rows.length}</span>
      </div>
      {rows.map(({ c, t }) => {
        const late = t.due! < today;
        return (
          <div className="alert-row" key={t.id}>
            <TaskCheck task={t} onToggle={() => act({ type: 'campaign.task.toggle', campaignId: c.id, taskId: t.id, completed: true }, 'Tarea hecha')} />
            <div>
              <strong>{t.description}</strong>
              <small>{c.name}</small>
            </div>
            <span className={'pill ' + (late ? 'red' : 'orange')}>{late ? `Vencida · ${relative(t.due!)}` : 'Hoy'}</span>
          </div>
        );
      })}
    </section>
  );
}

function TaskCheck({ task, onToggle }: { task: CampaignTask; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={'check-button' + (task.completed ? ' done' : '')}
      aria-pressed={task.completed}
      aria-label={(task.completed ? 'Desmarcar: ' : 'Marcar como hecha: ') + task.description}
      onClick={onToggle}
    >
      {task.completed && <Check size={15} />}
    </button>
  );
}

// ---------- Tarjeta de campaña ----------

function CampaignCard({ campaign: c }: { campaign: Campaign }) {
  const { act, open } = useHome();
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const pending = c.tasks.filter((t) => !t.completed).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
  const done = c.tasks.filter((t) => t.completed);
  const hint = statusHint(c);
  const link = c.url ? safeUrl(c.url) : null;
  const pct = Math.round(progress(c) * 100);
  const StatusIcon = STATUS_ICON[c.status];

  const setStatus = (status: CampaignStatus) => act({ type: 'patch', collection: 'campaigns', entityId: c.id, fields: { status } }, `${c.name}: ${status}`);
  const toggle = (t: CampaignTask) => act({ type: 'campaign.task.toggle', campaignId: c.id, taskId: t.id, completed: !t.completed });

  function addTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const description = str(f, 'description');
    const due = str(f, 'due');
    if (!description) return;
    if (act({ type: 'campaign.task.add', campaignId: c.id, task: { id: uid(), description, ...(due ? { due } : {}) } }, 'Tarea añadida')) {
      form.reset();
      setAdding(false);
    }
  }

  return (
    <article className="card campaign-card">
      <div className="campaign-head">
        <div className="campaign-title">
          <span className={'pill ' + (c.type === 'Nacional' ? 'blue' : 'orange')}>{c.type}</span>
          <h3>{c.name}</h3>
          <p className="campaign-dates">
            <CalendarDays size={13} /> {fmtDate(c.startDate)} → {fmtDate(c.endDate)}
          </p>
          {link && (
            <a className="campaign-link" href={link} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={13} /> <span>{c.url}</span>
            </a>
          )}
        </div>
        <button
          className={'pill status-chip ' + STATUS_COLOR[c.status]}
          onClick={() => setStatus(nextStatus(c.status))}
          title="Cambiar de estado"
          aria-label={`Estado: ${c.status}. Pulsa para pasar a ${nextStatus(c.status)}`}
        >
          <StatusIcon size={12} /> {c.status}
        </button>
      </div>

      {hint && (
        <button className="status-hint" onClick={() => setStatus(hint.to)}>
          <Clock size={13} /> {hint.text}
        </button>
      )}

      <div className="campaign-progress" aria-label={`${done.length} de ${c.tasks.length} tareas hechas`}>
        <div className="track">
          <span style={{ width: pct + '%' }} />
        </div>
        <small>
          {done.length}/{c.tasks.length} tareas
        </small>
      </div>

      <ul className="task-list">
        {pending.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={() => toggle(t)} />
        ))}
        {!pending.length && c.tasks.length > 0 && <li className="muted all-done">Todo hecho. 🎉</li>}
      </ul>

      {done.length > 0 && (
        <>
          <button className="text-button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
            {showDone ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {showDone ? 'Ocultar' : 'Ver'} {done.length} hecha{done.length === 1 ? '' : 's'}
          </button>
          {showDone && (
            <ul className="task-list done-list">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} onToggle={() => toggle(t)} />
              ))}
            </ul>
          )}
        </>
      )}

      {adding ? (
        <form className="add-task" onSubmit={addTask}>
          <input name="description" placeholder="Nueva tarea…" maxLength={300} required autoFocus aria-label="Descripción de la tarea" />
          <input name="due" type="date" aria-label="Fecha límite (opcional)" />
          <div className="add-task-actions">
            <button className="button primary compact" type="submit">
              Añadir
            </button>
            <button className="button secondary compact" type="button" onClick={() => setAdding(false)}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button className="text-button add-task-link" onClick={() => setAdding(true)}>
          <Plus size={14} /> Añadir tarea
        </button>
      )}

      <div className="campaign-actions">
        <button className="icon-button" aria-label={'Editar ' + c.name} title="Editar" onClick={() => open('campaign-edit', { campaignId: c.id })}>
          <Pencil size={16} />
        </button>
        <button
          className="icon-button"
          aria-label={'Duplicar ' + c.name}
          title="Duplicar"
          onClick={() => act({ type: 'upsert', collection: 'campaigns', entity: duplicateCampaign(c, uid) }, 'Campaña duplicada')}
        >
          <Copy size={16} />
        </button>
        <button className="icon-button danger" aria-label={'Eliminar ' + c.name} title="Eliminar" onClick={() => open('campaign-delete', { campaignId: c.id })}>
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

function TaskRow({ task, onToggle }: { task: CampaignTask; onToggle: () => void }) {
  const info = dueInfo(task);
  return (
    <li className={'task-row' + (task.completed ? ' completed' : '')}>
      <TaskCheck task={task} onToggle={onToggle} />
      <div>
        <span>{task.description}</span>
        {info && <small className={info.late ? 'urgent' : 'muted'}>{info.text}</small>}
      </div>
    </li>
  );
}

// ---------- Ventanas ----------

const CampaignEdit: ModalComp = ({ data }) => {
  const { state, me, act, setError } = useHome();
  const existing = data?.campaignId ? state.campaigns.find((c) => c.id === data.campaignId) : undefined;
  const [type, setType] = useState<CampaignType>('Nacional');
  if (data?.campaignId && !existing) return <p className="muted">Esta campaña ya no existe.</p>;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = str(f, 'name');
    const startDate = str(f, 'startDate');
    const endDate = str(f, 'endDate');
    const url = str(f, 'url');
    if (!name) return setError('Ponle un nombre a la campaña.');
    if (endDate < startDate) return setError('La fecha de fin no puede ser anterior a la de inicio.');
    if (url && !safeUrl(url)) return setError('El enlace no es válido. Usa una dirección web (https://…).');
    if (existing) {
      // Editar no vuelve a generar las tareas (igual que la app antigua). url '' = sin enlace.
      act({ type: 'patch', collection: 'campaigns', entityId: existing.id, fields: { name, startDate, endDate, url } }, 'Campaña actualizada', true);
    } else {
      const campaign = newCampaign({ name, type, startDate, endDate, url }, me.id, uid);
      act({ type: 'upsert', collection: 'campaigns', entity: campaign }, `Campaña creada con ${campaign.tasks.length} tareas`, true);
    }
  }

  return (
    <>
      <h2>{existing ? 'Editar campaña' : 'Nueva campaña'}</h2>
      <p className="muted">{existing ? 'Las tareas no cambian al editar las fechas.' : 'Las tareas habituales se crean solas, cada una con su fecha.'}</p>
      <form onSubmit={submit}>
        <label>
          Nombre
          <input name="name" defaultValue={existing?.name} placeholder="Ej. Vuelta al cole" maxLength={120} required autoFocus />
        </label>
        {!existing && (
          <label>
            Tipo
            <select name="type" value={type} onChange={(e) => setType(e.target.value as CampaignType)}>
              <option value="Nacional">Nacional</option>
              <option value="Local">Local</option>
            </select>
          </label>
        )}
        <div className="form-grid">
          <label>
            Inicio
            <input name="startDate" type="date" defaultValue={existing?.startDate ?? day()} required />
          </label>
          <label>
            Fin
            <input name="endDate" type="date" defaultValue={existing?.endDate ?? day(7)} required />
          </label>
        </div>
        <label>
          Enlace (opcional)
          <input name="url" type="text" inputMode="url" defaultValue={existing?.url} placeholder="https://…" maxLength={500} />
        </label>
        {!existing && (
          <div className="info-strip">
            <Info size={17} />
            <span>
              {type === 'Nacional'
                ? 'Nacional crea las 11 tareas de siempre: web, app, Newsletter (el lunes), Steeple (2 días antes), Compra Online, Meta y X (1 día antes), PiSignage, reel y publicación especial.'
                : 'Local crea 3 tareas: planificar en tienda (7 días antes), coordinar con proveedores (5 días antes) y redes locales (1 día antes).'}
            </span>
          </div>
        )}
        <button className="button primary full" type="submit">
          {existing ? 'Guardar cambios' : 'Crear campaña'}
        </button>
      </form>
    </>
  );
};

const CampaignDelete: ModalComp = ({ data }) => {
  const { state, act, close } = useHome();
  const c = state.campaigns.find((x) => x.id === data?.campaignId);
  if (!c) return <p className="muted">Esta campaña ya no existe.</p>;
  return (
    <>
      <IconBadge color="orange">
        <Trash2 size={22} />
      </IconBadge>
      <h2>¿Eliminar «{c.name}»?</h2>
      <p className="muted">
        Se borrarán sus {c.tasks.length} tareas. Si quieres conservarla, exporta antes el JSON.
      </p>
      <button className="button danger-button full" onClick={() => act({ type: 'remove', collection: 'campaigns', entityId: c.id }, 'Campaña eliminada', true)}>
        <Trash2 size={16} /> Eliminar campaña
      </button>
      <button className="button secondary full spaced" onClick={close}>
        Cancelar
      </button>
    </>
  );
};

const CampaignImport: ModalComp = () => {
  const { me, act, close, toast, setError } = useHome();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Campaign[] | null>(null);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    try {
      setText(await readFile(file));
      setPreview(null);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.');
    }
  }

  function review() {
    try {
      const list = importCampaigns(JSON.parse(text), me.id, uid);
      if (!list.length) throw Error('El archivo no contiene campañas.');
      setPreview(list);
      setError('');
    } catch (e) {
      setPreview(null);
      setError(e instanceof SyntaxError ? 'JSON no válido: revisa llaves, comillas y comas.' : e instanceof Error ? e.message : 'Formato no válido.');
    }
  }

  function apply() {
    if (!preview) return;
    // Una operación por campaña. Si una falla, paramos y se ve el error.
    let count = 0;
    for (const c of preview) {
      if (!act({ type: 'upsert', collection: 'campaigns', entity: c })) break;
      count++;
    }
    if (count === preview.length) {
      close();
      toast(`${count} campaña${count === 1 ? '' : 's'} importada${count === 1 ? '' : 's'}`);
    }
  }

  return (
    <>
      <h2>Importar campañas</h2>
      <p className="muted">Sirve el JSON que exportabas en el gestor antiguo o el de esta app. Se añaden a tus campañas sin borrar nada.</p>
      <label>
        Archivo .json
        <input type="file" accept=".json,application/json" onChange={(e) => void pickFile(e.target.files?.[0])} />
      </label>
      <label>
        O pega el contenido
        <textarea
          className="json-area"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
          }}
          placeholder='[{"name": "…", "type": "Nacional", "startDate": "AAAA-MM-DD", …}]'
          aria-label="JSON de campañas"
        />
      </label>
      <button className="button secondary full" onClick={review} disabled={!text.trim()}>
        Revisar
      </button>
      {preview && (
        <div className="import-preview">
          <h3>
            <CheckCircle2 size={18} /> {preview.length} campaña{preview.length === 1 ? '' : 's'} lista{preview.length === 1 ? '' : 's'}
          </h3>
          <ul className="import-names">
            {preview.slice(0, 8).map((c) => (
              <li key={c.id}>
                {c.name} <small>· {c.type} · {fmtDate(c.startDate)} · {c.tasks.length} tareas</small>
              </li>
            ))}
            {preview.length > 8 && <li className="muted">y {preview.length - 8} más</li>}
          </ul>
          <button className="button primary full" onClick={apply}>
            Importar {preview.length} campaña{preview.length === 1 ? '' : 's'}
          </button>
        </div>
      )}
    </>
  );
};
CampaignImport.wide = true;

export const campaignModals: Record<string, ModalComp> = {
  'campaign-edit': CampaignEdit,
  'campaign-delete': CampaignDelete,
  'campaign-import': CampaignImport,
};
