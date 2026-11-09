// «Hogar»: personas, mascotas, sincronización entre móviles, clasificación y copias.
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowDownToLine,
  BookOpen,
  House,
  ArrowUpFromLine,
  Backpack,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Cloud,
  Copy,
  Link2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  ShoppingBasket,
  Sparkles,
  Tags,
  Users,
  UtensilsCrossed,
  Wallet,
  WifiOff,
  CalendarDays,
} from 'lucide-react';
import { useHome, type Tab } from '../../app/context';
import type { ModalComp } from '../App';
import { decodeInvite, encodeInvite } from '../../app/store';
import { isNative, normalizeServer } from '../../app/native';
import { DEPARTMENTS, FAMILIES, SECTIONS, TYPES, formatCode, normalize } from '../../domain/estructura';
import { day } from '../../domain/dates';
import { uid } from '../../domain/format';
import { AVATAR_COLORS } from '../../domain/seed';
import type { AvatarColor, Member, State } from '../../domain/types';
import { Avatar, IconBadge, PageHeading, num, str } from '../common';
import { copyText, download, readFile } from '../download';

const COLOR_NAMES: Record<AvatarColor, string> = { peach: 'Melocotón', purple: 'Lavanda', mint: 'Menta', sky: 'Cielo', rose: 'Rosa', sand: 'Arena' };

// En la app Android la web vive dentro de la APK (https://localhost): los enlaces apuntan al
// servidor del hogar, que también sirve la web.
const appDir = (server: string) => (isNative() ? normalizeServer(server) + '/' : location.origin + location.pathname.replace(/[^/]*$/, ''));
const inviteLink = (code: string, server: string) => `${appDir(server)}#unirse=${code}`;
/** Enlace a la versión móvil mínima (prueba). */
const mobileLink = (code: string, server: string) => `${appDir(server)}movil.html#unirse=${code}`;

export function HomePage() {
  const { state, snap, store, open, act, nameOf, toast } = useHome();
  const [name, setName] = useState(state.household.name);
  const members = state.household.members;
  return (
    <>
      <PageHeading
        overline="Ajustes"
        title="Hogar"
        subtitle="Quién vive aquí y cómo se comparten los datos."
        action={
          <a className="button secondary compact" href="./guia/index.html">
            <BookOpen size={16} /> Guía de uso
          </a>
        }
      />
      <DevicesHomes />
      <div className="settings-grid">
        <section className="card settings-card">
          <h2>El hogar</h2>
          <p className="muted">Todo lo de la casa es compartido. Lo de «Mi espacio» se organiza por persona.</p>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && name.trim() !== state.household.name) act({ type: 'household.rename', name: name.trim() }, 'Nombre del hogar actualizado');
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Nombre del hogar" />
            <button className="button secondary compact" type="submit">
              Guardar
            </button>
          </form>
          <h3 className="subhead">Personas</h3>
          {members.map((m) => (
            <div className={'member-row ' + (m.active ? '' : 'inactive')} key={m.id}>
              <Avatar member={m} />
              <div>
                <strong>
                  {m.name}
                  {m.id === snap.me ? ' (tú)' : ''}
                </strong>
                <small>
                  {m.active ? 'Vive aquí' : 'Antiguo compañero'}
                  {m.proteinTarget ? ` · objetivo ${m.proteinTarget} g proteína` : ''}
                </small>
              </div>
              <button className="icon-button" aria-label={'Editar ' + m.name} onClick={() => open('member', { memberId: m.id })}>
                <Pencil size={16} />
              </button>
            </div>
          ))}
          <button className="text-button spaced" onClick={() => open('member', {})}>
            <Plus size={14} /> Añadir persona (nuevo compañero de piso)
          </button>
          <h3 className="subhead">Mascotas</h3>
          {state.household.pets.map((p) => (
            <div className="member-row" key={p.id}>
              <span className="avatar sand">{p.emoji}</span>
              <div>
                <strong>{p.name}</strong>
              </div>
              <button className="icon-button" aria-label={'Quitar ' + p.name} onClick={() => act({ type: 'remove', collection: 'pets', entityId: p.id }, 'Mascota retirada')}>
                ×
              </button>
            </div>
          ))}
          <button className="text-button spaced" onClick={() => open('pet')}>
            <Plus size={14} /> Añadir mascota
          </button>
        </section>

        <section className="card settings-card">
          <h2>Compartir entre móviles</h2>
          {snap.sync ? (
            <>
              <div className="sync-box connected">
                <Cloud size={23} />
                <div>
                  <strong>Conectado · {snap.status === 'idle' && !snap.pending ? 'al día' : snap.status === 'syncing' ? 'sincronizando…' : snap.pending ? `${snap.pending} cambios por enviar` : 'sin conexión'}</strong>
                  <p>
                    Servidor: {snap.sync.server}
                    <br />
                    {snap.lastSync ? `Última sincronización: ${new Date(snap.lastSync).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </p>
                  {snap.lastError && <p className="negative">{snap.lastError}</p>}
                </div>
              </div>
              <div className="button-row">
                <button className="button primary" onClick={() => open('invite')}>
                  <Share2 size={16} /> Invitar
                </button>
                <button className="button secondary" onClick={() => void store.sync()}>
                  <RefreshCw size={16} /> Sincronizar
                </button>
              </div>
              <div className="button-row spaced">
                <button className="text-button" onClick={() => open('server-address')}>
                  Cambiar la dirección del ordenador
                </button>
                <button className="text-button danger" onClick={() => open('disconnect')}>
                  Desconectar este dispositivo
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="sync-box">
                <WifiOff size={23} />
                <div>
                  <strong>Solo en este dispositivo</strong>
                  <p>Para que todos veáis lo mismo, conecta el hogar a un servidor (puede ser un ordenador de casa) e invita al resto con un enlace o un QR.</p>
                </div>
              </div>
              <button className="button primary full" onClick={() => open('connect')}>
                <Cloud size={16} /> Conectar a un servidor
              </button>
              <button className="button secondary full spaced" onClick={() => open('join', {})}>
                <Link2 size={16} /> Unirme a otro hogar con un enlace
              </button>
            </>
          )}
          <p className="footnote">
            Cualquier persona con el enlace de invitación puede ver y cambiar los datos del hogar. Compártelo solo con quien vive contigo.
          </p>
        </section>

        <section className="card settings-card">
          <h2>Estructura de artículos</h2>
          <p className="muted">
            La clasificación propia de comemos: {DEPARTMENTS.length} departamentos, {SECTIONS.length} secciones, {FAMILIES.length} familias y {TYPES.length} tipos. De
            ella salen los códigos internos: sección · familia · tipo · artículo (p. ej. 11.02.02.001).
          </p>
          <button className="button secondary full" onClick={() => open('estructura')}>
            <Tags size={16} /> Ver la estructura y los códigos
          </button>
          <p className="footnote">Se edita en src/data/estructura.ts. Inspirada en Ábaco, pensada para una casa: proteínas vegetales, mascotas, botiquín y emergencias.</p>
        </section>

        <section className="card settings-card">
          <h2>Copias de seguridad</h2>
          <p className="muted">Descarga todo el hogar en un archivo. Guárdalo en tu nube o en el ordenador.</p>
          <div className="entry-options">
            <button
              onClick={() => {
                download(`comemos-copia-${day()}.json`, JSON.stringify(state, null, 2));
                toast('Copia descargada');
              }}
            >
              <IconBadge>
                <ArrowDownToLine size={19} />
              </IconBadge>
              <span>
                <strong>Descargar copia</strong>
                <small>Inventario, recetas, gastos, kits y campañas</small>
              </span>
              <ChevronRight size={16} />
            </button>
            <button onClick={() => open('restore')}>
              <IconBadge color="blue">
                <ArrowUpFromLine size={19} />
              </IconBadge>
              <span>
                <strong>Restaurar una copia</strong>
                <small>Sustituye los datos de este dispositivo</small>
              </span>
              <ChevronRight size={16} />
            </button>
          </div>
          <h3 className="subhead">Últimos cambios</h3>
          <div className="activity">
            {state.log.length ? (
              state.log.slice(0, 10).map((l) => (
                <p key={l.id}>
                  <Check size={14} />
                  <span>
                    {l.label} · {nameOf(l.by)}
                  </span>
                  <small>{new Date(l.at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
                </p>
              ))
            ) : (
              <p className="muted">Todavía no hay cambios.</p>
            )}
          </div>
          <div className="danger-zone">
            <button className="text-button danger" onClick={() => open('reset')}>
              Borrar los datos de este dispositivo
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

/** Hogares guardados en este dispositivo: cada uno con su ordenador (servidor). */
function DevicesHomes() {
  const { profiles, open } = useHome();
  const list = profiles.summaries();
  const active = profiles.active;
  return (
    <section className="card settings-card homes-card">
      <div className="section-title">
        <div>
          <h2>Hogares en este dispositivo</h2>
        </div>
        <button className="button secondary compact" onClick={() => open('profile-add')}>
          <Plus size={15} /> Añadir otro hogar u ordenador
        </button>
      </div>
      <p className="muted">Cada hogar guarda sus datos aparte y se conecta a su propio ordenador. Cambia entre ellos cuando quieras.</p>
      {list.map((p) => (
        <div className={'member-row' + (p.id === active ? ' current' : '')} key={p.id}>
          <span className="avatar sand">
            <House size={15} />
          </span>
          <div>
            <strong>
              {p.name}
              {p.id === active ? ' · abierto' : ''}
            </strong>
            <small>
              {p.server ? p.server.replace(/^https?:\/\//, '') : 'Solo en este dispositivo'}
              {p.members.length ? ` · ${p.members.join(', ')}` : ''}
            </small>
          </div>
          {p.id !== active && (
            <>
              <button
                className="button secondary compact"
                onClick={() => {
                  profiles.activate(p.id);
                  location.hash = '#/hoy';
                  location.reload();
                }}
              >
                Abrir
              </button>
              <button className="icon-button" aria-label={'Quitar ' + p.name} onClick={() => open('profile-remove', { id: p.id })}>
                ×
              </button>
            </>
          )}
        </div>
      ))}
    </section>
  );
}

/** Menú «Más» del móvil. */
export function MorePage({ badge }: { badge: (tab: Tab) => number }) {
  const { go, open, state } = useHome();
  const tiles: { tab?: Tab; action?: () => void; name: string; desc: string; icon: typeof Wallet; color: string }[] = [
    { tab: 'gastos', name: 'Gastos', desc: 'Quién paga y cuentas claras', icon: Wallet, color: 'green' },
    { tab: 'kits', name: 'Kits y revisiones', desc: 'Mochila de emergencia, botiquín…', icon: Backpack, color: 'orange' },
    { tab: 'campanas', name: 'Campañas', desc: 'Tu trabajo, tarea a tarea', icon: BriefcaseBusiness, color: 'blue' },
    { tab: 'hogar', name: 'Hogar', desc: 'Personas, móviles y copias', icon: Users, color: 'neutral' },
    { action: () => open('ai'), name: 'Una mano con IA', desc: 'Recetas, tickets y kits', icon: Sparkles, color: 'green' },
    { action: () => (location.href = './guia/index.html'), name: 'Guía de uso', desc: 'Instalar, invitar y usar la app', icon: BookOpen, color: 'neutral' },
  ];
  return (
    <>
      <PageHeading overline={state.household.name} title="Más" subtitle="Lo demás de la casa y tu espacio." />
      <div className="more-grid">
        {tiles.map((t) => (
          <button key={t.name} className="card more-tile" onClick={() => (t.tab ? go(t.tab) : t.action?.())}>
            <IconBadge color={t.color}>
              <t.icon size={20} />
            </IconBadge>
            <strong>{t.name}</strong>
            <small>{t.desc}</small>
            {t.tab && badge(t.tab) > 0 && <span className="nav-count alert">{badge(t.tab)}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

// ---------- Modales ----------

const SwitchMember: ModalComp = () => {
  const { store, members, me, close, toast } = useHome();
  return (
    <>
      <h2>¿Quién usa este dispositivo?</h2>
      <p className="muted">Cambia «Mi espacio» (kits personales y campañas) y quién aparece como autor de los cambios.</p>
      <div className="who-grid">
        {members.map((m) => (
          <button
            key={m.id}
            className={m.id === me.id ? 'selected' : ''}
            onClick={() => {
              store.setMe(m.id);
              close();
              toast(`Hola, ${m.name}`);
            }}
          >
            <Avatar member={m} />
            {m.name}
          </button>
        ))}
      </div>
    </>
  );
};

const MemberModal: ModalComp = ({ data }) => {
  const { state, act, snap, setError } = useHome();
  const m = state.household.members.find((x) => x.id === data?.memberId);
  return (
    <>
      <h2>{m ? `Editar a ${m.name}` : 'Nueva persona en casa'}</h2>
      <p className="muted">{m ? 'Los antiguos compañeros no se borran: así se conservan sus gastos.' : 'Después, mándale el enlace de invitación para que lo use en su móvil.'}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const target = num(f, 'protein');
          const entity: Member = {
            id: m?.id ?? uid(),
            name: str(f, 'name'),
            color: str(f, 'color') as AvatarColor,
            proteinTarget: target > 0 ? target : null,
            active: m ? f.get('active') === 'on' : true,
          };
          if (m && !entity.active && !state.household.members.some((x) => x.active && x.id !== m.id)) return setError('Tiene que quedar al menos una persona viviendo en casa.');
          act({ type: 'upsert', collection: 'members', entity }, m ? 'Persona actualizada' : `${entity.name} ya forma parte del hogar`, true);
        }}
      >
        <div className="form-grid">
          <label>
            Nombre
            <input name="name" defaultValue={m?.name} maxLength={40} required />
          </label>
          <label>
            Color
            <select name="color" defaultValue={m?.color ?? AVATAR_COLORS[state.household.members.length % AVATAR_COLORS.length]}>
              {AVATAR_COLORS.map((c) => (
                <option key={c} value={c}>
                  {COLOR_NAMES[c]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Objetivo diario de proteína en gramos (opcional)
          <input name="protein" type="number" min="0" max="500" defaultValue={m?.proteinTarget ?? ''} placeholder="Lo decide cada persona" />
        </label>
        {m && (
          <label className="checkbox-label">
            <input type="checkbox" name="active" defaultChecked={m.active} disabled={m.id === snap.me} /> Vive en casa
            {m.id === snap.me ? ' (cambia de persona para desactivarte)' : ''}
          </label>
        )}
        <button className="button primary full" type="submit">
          Guardar
        </button>
      </form>
    </>
  );
};

const PetModal: ModalComp = () => {
  const { act } = useHome();
  return (
    <>
      <h2>Nueva mascota</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          act({ type: 'upsert', collection: 'pets', entity: { id: uid(), name: str(f, 'name'), emoji: str(f, 'emoji') } }, 'Mascota añadida', true);
        }}
      >
        <div className="form-grid">
          <label>
            Nombre
            <input name="name" maxLength={40} required />
          </label>
          <label>
            Emoji
            <select name="emoji" defaultValue="🐈">
              {['🐈', '🐕', '🐇', '🐦', '🐢', '🐾'].map((e) => (
                <option key={e}>{e}</option>
              ))}
            </select>
          </label>
        </div>
        <button className="button primary full" type="submit">
          Añadir
        </button>
      </form>
    </>
  );
};

const ConnectModal: ModalComp = () => {
  const { store, open, setError } = useHome();
  const [server, setServer] = useState('');
  const [needsToken, setNeedsToken] = useState(false);
  const [busy, setBusy] = useState(false);
  // Si la app se sirve desde un servidor del hogar, lo proponemos directamente.
  useEffect(() => {
    if (isNative()) return; // en la APK no hay servidor en «localhost»
    store
      .checkServer(location.origin)
      .then((r) => {
        setServer((s) => s || location.origin);
        setNeedsToken(r.createNeedsToken);
      })
      .catch(() => {});
  }, [store]);
  return (
    <>
      <h2>Conectar a un servidor</h2>
      <p className="muted">Subiremos el hogar de este dispositivo y te daremos un enlace para invitar al resto.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const url = normalizeServer(server);
          setBusy(true);
          try {
            const info = await store.checkServer(url);
            if (info.createNeedsToken && !str(f, 'token')) {
              setNeedsToken(true);
              throw Error('Este servidor pide un código para crear hogares.');
            }
            await store.connectNew(url, str(f, 'token'));
            open('invite');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo conectar.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Dirección del servidor
          <input value={server} onChange={(e) => setServer(e.target.value)} placeholder="https://mi-ordenador.tailnet.ts.net o http://192.168.1.20:8787" required />
        </label>
        {needsToken && (
          <label>
            Código para crear hogares
            <input name="token" type="password" autoComplete="off" />
          </label>
        )}
        <button className="button primary full" type="submit" disabled={busy}>
          {busy ? 'Conectando…' : 'Conectar y crear invitación'}
        </button>
      </form>
      <div className="info-strip">
        <Cloud size={18} />
        <span>¿No tienes servidor? En un ordenador de casa: «npm run serve». Las instrucciones están en el README del proyecto.</span>
      </div>
    </>
  );
};

const InviteModal: ModalComp = () => {
  const { store, toast } = useHome();
  const invite = store.invite();
  const [svg, setSvg] = useState('');
  const link = invite ? inviteLink(encodeInvite(invite), invite.server) : '';
  useEffect(() => {
    if (link) QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg).catch(() => setSvg(''));
  }, [link]);
  if (!invite) return <p className="muted">Primero conecta el hogar a un servidor.</p>;
  return (
    <>
      <h2>Invitar al hogar</h2>
      <p className="muted">Escanea el código con el otro móvil o envía el enlace. Al abrirlo, elegirá quién es.</p>
      {/* El SVG lo genera la librería a partir de nuestro propio enlace. */}
      {svg && <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />}
      <div className="code-box">{link}</div>
      <div className="button-row spaced">
        <button
          className="button primary"
          onClick={() =>
            copyText(link)
              .then(() => toast('Enlace copiado'))
              .catch(() => toast('No se pudo copiar: selecciona el texto'))
          }
        >
          <Copy size={16} /> Copiar enlace
        </button>
        {'share' in navigator && (
          <button className="button secondary" onClick={() => navigator.share({ title: 'Únete a ' + invite.name, url: link }).catch(() => {})}>
            <Share2 size={16} /> Compartir
          </button>
        )}
      </div>
      <div className="info-strip">
        <Share2 size={18} />
        <span>
          ¿Solo quieres probar desde el móvil? La <strong>versión móvil mínima</strong> únicamente pide y manda datos a casa:{' '}
          <button className="text-button" onClick={() => copyText(mobileLink(encodeInvite(invite), invite.server)).then(() => toast('Enlace a la versión móvil copiado')).catch(() => {})}>
            copiar su enlace
          </button>
          .
        </span>
      </div>
      <p className="footnote">El enlace incluye la clave del hogar: quien lo tenga puede ver y cambiar los datos. No lo publiques.</p>
    </>
  );
};

const JoinModal: ModalComp = ({ data }) => {
  const { store, state, setError, close, toast } = useHome();
  const [code, setCode] = useState<string>(data?.code ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <h2>Unirme a un hogar</h2>
      <p className="muted">Los datos de este dispositivo ({state.household.name}) se sustituirán por los del hogar al que te unes.</p>
      <button className="button secondary full" onClick={() => download(`comemos-copia-${day()}.json`, JSON.stringify(state, null, 2))}>
        <ArrowDownToLine size={16} /> Descargar copia antes
      </button>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const raw = code.includes('#unirse=') ? code.split('#unirse=')[1] : code;
            const invite = decodeInvite(raw);
            await store.join({ ...invite, server: invite.server || location.origin });
            close();
            toast(`Te has unido a ${invite.name}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo unir.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Enlace o código de invitación
          <input value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <button className="button primary full" type="submit" disabled={busy}>
          {busy ? 'Conectando…' : 'Unirme y sustituir los datos'}
        </button>
      </form>
    </>
  );
};

/** Si el ordenador cambia de IP (o pasas a usar Tailscale), se actualiza aquí. */
const ServerAddressModal: ModalComp = () => {
  const { store, snap, close, toast, setError } = useHome();
  const [server, setServer] = useState(snap.sync?.server ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <h2>Cambiar la dirección del ordenador</h2>
      <p className="muted">Por ejemplo, si el router le ha dado otra IP o ahora usas Tailscale. Comprobamos que en la nueva dirección está este mismo hogar.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await store.changeServer(server);
            close();
            toast('Dirección actualizada');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'No se pudo cambiar.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Nueva dirección
          <input value={server} onChange={(e) => setServer(e.target.value)} placeholder="192.168.1.20:8787" required />
        </label>
        <button className="button primary full" type="submit" disabled={busy}>
          {busy ? 'Comprobando…' : 'Guardar dirección'}
        </button>
      </form>
      <p className="footnote">Cada móvil del hogar tiene que cambiarla también (o volver a unirse con un enlace nuevo).</p>
    </>
  );
};

const DisconnectModal: ModalComp = () => {
  const { store, close, toast, snap } = useHome();
  return (
    <>
      <h2>¿Desconectar este dispositivo?</h2>
      <p>Los datos se quedan aquí, pero dejarás de ver los cambios de los demás.{snap.pending ? ` Hay ${snap.pending} cambios sin enviar: se quedarán solo aquí.` : ''}</p>
      <button
        className="button danger-button full"
        onClick={() => {
          store.disconnect();
          close();
          toast('Dispositivo desconectado');
        }}
      >
        Desconectar
      </button>
    </>
  );
};

/** Visor de la estructura: departamentos, secciones, familias y tipos con sus códigos. */
const EstructuraModal: ModalComp = () => {
  const { state } = useHome();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const q = normalize(query);
  const count = (code: string) => new Set(state.items.filter((i) => i.type === code).map((i) => i.productId ?? i.id)).size;
  const visible = (name: string, syn: string[], code: string) => !q || normalize(name).includes(q) || syn.some((x) => normalize(x).includes(q)) || code.startsWith(q.replace(/\./g, ''));
  return (
    <>
      <h2>Estructura de artículos</h2>
      <p className="muted">Código interno: SS sección · FF familia · TT tipo · AAA artículo. Los artículos del mismo tipo comparten los 6 primeros dígitos.</p>
      <div className="search-field small">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar: arroz, pilas, 1102…" aria-label="Buscar en la estructura" />
      </div>
      <div className="tree">
        {DEPARTMENTS.map((d) => (
          <div key={d.code} className="tree-dept">
            <h3>
              {d.code} · {d.name}
            </h3>
            {d.sections.map((sec) => {
              const fams = sec.families
                .map((f) => ({ f, types: f.types.filter((t) => visible(t.name, t.synonyms, t.code) || visible(f.name, [], f.full) || visible(sec.name, [], String(sec.code))) }))
                .filter((x) => x.types.length);
              if (!fams.length) return null;
              const expanded = Boolean(q) || open === sec.code;
              return (
                <div key={sec.code} className="tree-section">
                  <button type="button" onClick={() => setOpen(open === sec.code ? null : sec.code)} aria-expanded={expanded}>
                    <span className="code-tag">
                      <strong>{sec.code}</strong>
                    </span>{' '}
                    {sec.name}
                    <small>
                      {sec.families.length} familias · {sec.place}
                    </small>
                    <ChevronRight size={14} className={expanded ? 'rot' : ''} />
                  </button>
                  {expanded &&
                    fams.map(({ f, types }) => (
                      <div key={f.full} className="tree-family">
                        <strong>
                          <span className="code-tag">{formatCode(f.full)}</span> {f.name}
                        </strong>
                        {types.map((t) => (
                          <p key={t.code}>
                            <span className="code-tag">
                              <strong>{formatCode(t.code)}</strong>
                            </span>{' '}
                            {t.name}
                            {t.protein !== null && <small> · {t.protein} g prot.</small>}
                            {count(t.code) > 0 && <span className="pill green">{count(t.code)} en casa</span>}
                          </p>
                        ))}
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
};
EstructuraModal.wide = true;

const RestoreModal: ModalComp = () => {
  const { store, setError, close, toast, snap } = useHome();
  const [preview, setPreview] = useState<State | null>(null);
  return (
    <>
      <h2>Restaurar una copia</h2>
      <p className="muted">
        Sustituye los datos de este dispositivo.{snap.sync ? ' El dispositivo se desconectará del servidor: después puedes conectarlo como hogar nuevo.' : ''}
      </p>
      <label>
        Archivo de copia (.json)
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const s = JSON.parse(await readFile(file));
              if (s?.version !== 2 || !s.household?.members?.length) throw Error('Este archivo no es una copia de comemos 0.2.');
              setPreview(s);
              setError('');
            } catch (err) {
              setPreview(null);
              setError(err instanceof SyntaxError ? 'El archivo no es un JSON válido.' : err instanceof Error ? err.message : 'Copia no válida.');
            }
          }}
        />
      </label>
      {preview && (
        <div className="import-preview">
          <h3>{preview.household.name}</h3>
          <p>
            {preview.household.members.length} personas · {preview.items.length} lotes · {preview.recipes.length} recetas · {preview.kits.length} kits · {preview.expenses.length} gastos
          </p>
          <button
            className="button danger-button full"
            onClick={() => {
              store.restore(preview);
              close();
              toast('Copia restaurada');
            }}
          >
            Restaurar y sustituir
          </button>
        </div>
      )}
    </>
  );
};

const ResetModal: ModalComp = () => {
  const { store, state, close } = useHome();
  return (
    <>
      <h2>¿Borrar los datos de este dispositivo?</h2>
      <p>Volverás a la pantalla de bienvenida. Si el hogar está conectado, los demás conservan sus datos y el servidor también.</p>
      <button className="button secondary full" onClick={() => download(`comemos-copia-${day()}.json`, JSON.stringify(state, null, 2))}>
        Descargar copia primero
      </button>
      <button
        className="button danger-button full spaced"
        onClick={() => {
          close();
          store.reset();
        }}
      >
        Borrar y empezar de cero
      </button>
    </>
  );
};

const EntryModal: ModalComp = () => {
  const { open, go, close } = useHome();
  const options = [
    { label: 'Una compra o un ticket', desc: 'Interpretar con IA y revisar antes de guardar', icon: Sparkles, action: () => open('ai') },
    { label: 'Un artículo al inventario', desc: 'Cantidad, ubicación y fecha del lote', icon: Package, action: () => open('stock', {}) },
    { label: 'Algo a la lista de la compra', desc: 'Para que no se nos olvide', icon: ShoppingBasket, action: () => open('shopping') },
    { label: 'Un gasto del hogar', desc: 'Quién paga y entre quién se reparte', icon: Wallet, action: () => open('expense', {}) },
    { label: 'Una comida al plan', desc: 'Primero tuppers, luego recetas', icon: CalendarDays, action: () => open('plan', {}) },
    { label: 'Una receta', desc: 'Con ingredientes del inventario', icon: UtensilsCrossed, action: () => open('recipe-edit', {}) },
    {
      label: 'Un kit o inventario personal',
      desc: 'Mochila de emergencia, botiquín…',
      icon: Backpack,
      action: () => {
        close();
        go('kits');
        setTimeout(() => open('kit-new'), 0);
      },
    },
  ];
  return (
    <>
      <h2>¿Qué añadimos?</h2>
      <p className="muted">Un pequeño gesto para tenerlo todo al día.</p>
      <div className="entry-options">
        {options.map((o) => (
          <button key={o.label} onClick={o.action}>
            <IconBadge>
              <o.icon size={20} />
            </IconBadge>
            <span>
              <strong>{o.label}</strong>
              <small>{o.desc}</small>
            </span>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
    </>
  );
};

const ProfileAddModal: ModalComp = () => {
  const { profiles } = useHome();
  return (
    <>
      <h2>Añadir otro hogar</h2>
      <p>Por ejemplo, el piso siguiente o la casa de tu familia, con su propio ordenador. El hogar actual se queda guardado y podrás volver a él desde aquí.</p>
      <p className="muted">En el siguiente paso eliges crear uno nuevo o unirte con un enlace de invitación.</p>
      <button
        className="button primary full"
        onClick={() => {
          profiles.add();
          location.hash = '';
          location.reload();
        }}
      >
        Continuar
      </button>
    </>
  );
};

const ProfileRemoveModal: ModalComp = ({ data }) => {
  const { profiles, close, toast } = useHome();
  const p = profiles.summary(data.id);
  return (
    <>
      <h2>¿Quitar «{p.name}» de este dispositivo?</h2>
      <p>
        {p.server
          ? 'Sus datos siguen en su ordenador: podrás volver a unirte con un enlace de invitación. Los cambios sin enviar se perderán.'
          : 'Este hogar solo está aquí: se borrará. Descarga antes una copia si quieres conservarlo.'}
      </p>
      <button
        className="button danger-button full"
        onClick={() => {
          profiles.remove(p.id);
          close();
          toast('Hogar quitado de este dispositivo');
        }}
      >
        Quitar
      </button>
    </>
  );
};

export const homeModals: Record<string, ModalComp> = {
  'profile-add': ProfileAddModal,
  'profile-remove': ProfileRemoveModal,
  'switch-member': SwitchMember,
  member: MemberModal,
  pet: PetModal,
  connect: ConnectModal,
  invite: InviteModal,
  join: JoinModal,
  disconnect: DisconnectModal,
  'server-address': ServerAddressModal,
  estructura: EstructuraModal,
  restore: RestoreModal,
  reset: ResetModal,
  entry: EntryModal,
};
