// Armazón de la app: navegación, barra lateral, barra inferior en móvil, modales y avisos.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FC } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Backpack,
  BriefcaseBusiness,
  ChevronRight,
  CloudOff,
  House,
  LayoutGrid,
  Leaf,
  Package,
  RefreshCw,
  Settings,
  ShoppingBasket,
  Sparkles,
  UtensilsCrossed,
  Wallet,
  X,
  CheckCircle2,
  Cloud,
} from 'lucide-react';
import { HomeContext, makeNameOf, type HomeCtx, type ModalState, type Tab } from '../app/context';
import type { HouseholdStore, Snapshot } from '../app/store';
import type { OpBody } from '../domain/ops';
import { Avatar } from './common';
import { Onboarding, WhoAreYou } from './pages/Onboarding';
import { TodayPage } from './pages/Today';
import { KitchenPage, kitchenModals } from './pages/Kitchen';
import { InventoryPage, inventoryModals } from './pages/Inventory';
import { ShoppingPage, shoppingModals } from './pages/Shopping';
import { ExpensesPage, expenseModals } from './pages/Expenses';
import { KitsPage, kitModals } from './pages/Kits';
import { CampaignsPage, campaignModals } from './pages/Campaigns';
import { HomePage, MorePage, homeModals } from './pages/Home';
import { aiModals } from './pages/Ai';
import { pendingDues, visibleKits } from '../domain/kits';
import { day } from '../domain/dates';

export type ModalComp = FC<{ data: any }> & { wide?: boolean };

const MODALS: Record<string, ModalComp> = {
  ...kitchenModals,
  ...inventoryModals,
  ...shoppingModals,
  ...expenseModals,
  ...kitModals,
  ...campaignModals,
  ...homeModals,
  ...aiModals,
};

const TABS: Tab[] = ['hoy', 'cocina', 'inventario', 'compra', 'gastos', 'kits', 'campanas', 'hogar', 'mas'];

const SHARED_NAV = [
  { tab: 'hoy' as Tab, name: 'Hoy', icon: House },
  { tab: 'cocina' as Tab, name: 'Cocina', icon: UtensilsCrossed },
  { tab: 'inventario' as Tab, name: 'Inventario', icon: Package },
  { tab: 'compra' as Tab, name: 'Compra', icon: ShoppingBasket },
  { tab: 'gastos' as Tab, name: 'Gastos', icon: Wallet },
];
const PERSONAL_NAV = [
  { tab: 'kits' as Tab, name: 'Kits y revisiones', icon: Backpack },
  { tab: 'campanas' as Tab, name: 'Campañas', icon: BriefcaseBusiness },
];
const MOBILE_NAV = [...SHARED_NAV.slice(0, 4), { tab: 'mas' as Tab, name: 'Más', icon: LayoutGrid }];

function readRoute(): { tab: Tab; param: string } {
  const [tab, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  return TABS.includes(tab as Tab) ? { tab: tab as Tab, param: decodeURIComponent(rest.join('/')) } : { tab: 'hoy', param: '' };
}

/** Código de invitación si la app se abrió con un enlace «#unirse=...». */
function readInvite(): string | null {
  const m = location.hash.match(/^#unirse=(.+)$/);
  return m ? m[1] : null;
}

export function App({ store }: { store: HouseholdStore }) {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [invite, setInvite] = useState<string | null>(readInvite);

  useEffect(() => store.startAutoSync(), [store]);

  if (!snap.state) return <Onboarding store={store} invite={invite} onDone={() => setInvite(null)} />;
  const me = snap.state.household.members.find((m) => m.id === snap.me && m.active);
  if (!me) return <WhoAreYou store={store} state={snap.state} />;
  return <Shell store={store} snap={snap} invite={invite} clearInvite={() => setInvite(null)} />;
}

function Shell({ store, snap, invite, clearInvite }: { store: HouseholdStore; snap: Snapshot; invite: string | null; clearInvite: () => void }) {
  const state = snap.state!;
  const me = state.household.members.find((m) => m.id === snap.me)!;
  const members = state.household.members.filter((m) => m.active);
  const [route, setRoute] = useState(readRoute);
  const [modal, setModal] = useState<ModalState>(null);
  const [toastText, setToastText] = useState('');
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Enlace de invitación con un hogar ya creado: confirmar antes de sustituir datos.
  useEffect(() => {
    if (invite) {
      setModal({ kind: 'join', data: { code: invite } });
      clearInvite();
      history.replaceState(null, '', '#/hogar');
    }
  }, [invite, clearInvite]);

  useEffect(() => {
    if (!toastText) return;
    const t = setTimeout(() => setToastText(''), 3800);
    return () => clearTimeout(t);
  }, [toastText]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (modal && !d.open) {
      lastFocus.current = document.activeElement as HTMLElement;
      d.showModal();
    } else if (!modal && d.open) {
      d.close();
      lastFocus.current?.focus();
    }
  }, [modal]);

  const open = useCallback((kind: string, data?: any) => {
    setError('');
    setModal({ kind, data });
  }, []);
  const close = useCallback(() => {
    setModal(null);
    setError('');
  }, []);

  const go = useCallback((tab: Tab, param?: string) => {
    const hash = '#/' + tab + (param ? '/' + encodeURIComponent(param) : '');
    if (location.hash !== hash) location.hash = hash;
    else setRoute(readRoute());
    window.scrollTo({ top: 0 });
  }, []);

  const act = useCallback(
    (body: OpBody, message?: string, closeAfter = false) => {
      try {
        store.dispatch(body);
        if (message) setToastText(message);
        setError('');
        if (closeAfter) close();
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo guardar.';
        if (dialogRef.current?.open) setError(msg);
        else setToastText(msg);
        return false;
      }
    },
    [store, close],
  );

  const ctx: HomeCtx = useMemo(
    () => ({ store, snap, state, me, members, act, toast: setToastText, open, close, modal, error, setError, go, tab: route.tab, param: route.param, nameOf: makeNameOf(state) }),
    [store, snap, state, me, members, act, open, close, modal, error, go, route],
  );

  const Modal = modal ? MODALS[modal.kind] : null;
  const pendingCount = state.shopping.filter((s) => !s.checked).length;
  const kitAlerts = pendingDues(visibleKits(state.kits, me.id)).filter((d) => d.health === 'overdue').length;
  const campaignAlerts = state.campaigns
    .filter((c) => c.owner === me.id && c.status !== 'Terminada')
    .flatMap((c) => c.tasks)
    .filter((t) => !t.completed && t.due && t.due <= day()).length;
  const badge = (tab: Tab) => (tab === 'compra' ? pendingCount : tab === 'kits' ? kitAlerts : tab === 'campanas' ? campaignAlerts : 0);
  const others = members.filter((m) => m.id !== me.id);

  return (
    <HomeContext.Provider value={ctx}>
      <div className="app-shell">
        <aside className="sidebar">
          <a
            href="#/hoy"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              go('hoy');
            }}
          >
            <span className="brand-symbol">
              <Leaf size={23} />
            </span>
            comemos<span className="brand-dot">.</span>
          </a>
          <button className="home-selector" onClick={() => go('hogar')}>
            <div className="house-icon">
              <House size={19} />
            </div>
            <div>
              <strong>{state.household.name}</strong>
              <small>{members.map((m) => m.name).join(', ')}</small>
            </div>
            <ChevronRight size={15} />
          </button>
          <span className="nav-label">LA CASA</span>
          <nav>
            {SHARED_NAV.map((n) => (
              <button key={n.tab} className={route.tab === n.tab ? 'active' : ''} onClick={() => go(n.tab)}>
                <n.icon size={20} />
                <span>{n.name}</span>
                {badge(n.tab) > 0 && <span className="nav-count">{badge(n.tab)}</span>}
              </button>
            ))}
          </nav>
          <span className="nav-label spaced-label">MI ESPACIO</span>
          <nav>
            {PERSONAL_NAV.map((n) => (
              <button key={n.tab} className={route.tab === n.tab ? 'active' : ''} onClick={() => go(n.tab)}>
                <n.icon size={20} />
                <span>{n.name}</span>
                {badge(n.tab) > 0 && <span className="nav-count alert">{badge(n.tab)}</span>}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button className="ai-side" onClick={() => open('ai')}>
              <Sparkles size={19} />
              <span>Una mano con IA</span>
              <ArrowUpRight size={16} />
            </button>
            <button className="settings-side" onClick={() => go('hogar')}>
              <Settings size={18} /> Hogar y sincronización
            </button>
            <SyncLabel snap={snap} onClick={() => go('hogar')} />
            <button className="profile-footer" onClick={() => open('switch-member')} aria-label="Cambiar de persona">
              <Avatar member={me} />
              <div>
                <strong>{me.name}</strong>
                <small>Cambiar de persona</small>
              </div>
              {others[0] && <Avatar member={others[0]} size="small" />}
            </button>
          </div>
        </aside>

        <main>
          <header className="topbar">
            <div className="breadcrumbs">
              <House size={14} />
              <span>{state.household.name}</span>
              <ChevronRight size={12} />
              <strong>{[...SHARED_NAV, ...PERSONAL_NAV].find((n) => n.tab === route.tab)?.name ?? (route.tab === 'hogar' ? 'Hogar' : 'Más')}</strong>
            </div>
            <div className="top-actions">
              <SyncChip snap={snap} onClick={() => (snap.sync ? void store.sync() : go('hogar'))} />
              <button className="icon-button" aria-label="Intercambio con IA" onClick={() => open('ai')}>
                <Sparkles size={19} />
              </button>
              <button className="avatar-button" aria-label={`Eres ${me.name}. Cambiar de persona`} onClick={() => open('switch-member')}>
                <Avatar member={me} size="small" />
              </button>
            </div>
          </header>
          <div className="page">
            {snap.rejected.length > 0 && (
              <div className="conflict-strip" role="alert">
                <AlertCircle size={18} />
                <div>
                  <strong>
                    {snap.rejected.length === 1 ? 'Un cambio tuyo no se pudo aplicar' : `${snap.rejected.length} cambios tuyos no se pudieron aplicar`}
                  </strong>
                  {snap.rejected.slice(0, 3).map((r) => (
                    <small key={r.id}>
                      {r.label}: {r.reason}
                    </small>
                  ))}
                  <small>Otra persona cambió lo mismo antes. Revisa y repite si hace falta.</small>
                </div>
                <button className="icon-button" aria-label="Entendido" onClick={() => store.dismissRejected()}>
                  <X size={16} />
                </button>
              </div>
            )}
            {route.tab === 'hoy' && <TodayPage />}
            {route.tab === 'cocina' && <KitchenPage />}
            {route.tab === 'inventario' && <InventoryPage />}
            {route.tab === 'compra' && <ShoppingPage />}
            {route.tab === 'gastos' && <ExpensesPage />}
            {route.tab === 'kits' && <KitsPage />}
            {route.tab === 'campanas' && <CampaignsPage />}
            {route.tab === 'hogar' && <HomePage />}
            {route.tab === 'mas' && <MorePage badge={badge} />}
            <footer className="page-footer">
              <SyncLabel snap={snap} onClick={() => go('hogar')} />
              <span>{state.household.name} · {members.length} {members.length === 1 ? 'persona' : 'personas'}</span>
            </footer>
          </div>
        </main>

        <nav className="mobile-nav" aria-label="Navegación principal">
          {MOBILE_NAV.map((n) => {
            const active = route.tab === n.tab || (n.tab === 'mas' && ['gastos', 'kits', 'campanas', 'hogar'].includes(route.tab));
            const count = n.tab === 'mas' ? kitAlerts + campaignAlerts : n.tab === 'compra' ? 0 : 0;
            return (
              <button key={n.tab} className={active ? 'active' : ''} onClick={() => go(n.tab)}>
                <n.icon size={22} />
                <span>{n.name}</span>
                {count > 0 && <span className="mobile-dot" aria-label={`${count} avisos`} />}
              </button>
            );
          })}
        </nav>

        {toastText && (
          <div className="toast" role="status">
            <CheckCircle2 size={18} />
            {toastText}
          </div>
        )}

        <dialog
          ref={dialogRef}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
          onClick={(e) => {
            if (e.target === dialogRef.current) close();
          }}
        >
          <div className={'modal ' + (Modal?.wide ? 'wide-modal' : '')}>
            <div className="modal-top">
              <span className="modal-eyebrow">{state.household.name.toUpperCase()}</span>
              <button className="icon-button" aria-label="Cerrar" onClick={close}>
                <X size={22} />
              </button>
            </div>
            {Modal && modal && <Modal key={modal.kind + JSON.stringify(modal.data ?? null).slice(0, 200)} data={modal.data} />}
            {modal && !Modal && <p className="muted">Esta ventana no existe.</p>}
            {error && (
              <div className="error" role="alert">
                <AlertCircle size={17} />
                <span>{error}</span>
              </div>
            )}
          </div>
        </dialog>
      </div>
    </HomeContext.Provider>
  );
}

function syncText(snap: Snapshot): string {
  if (!snap.sync) return 'Solo en este dispositivo';
  if (snap.status === 'syncing') return 'Sincronizando…';
  if (snap.status === 'offline') return snap.pending ? `Sin conexión · ${snap.pending} pendiente${snap.pending === 1 ? '' : 's'}` : 'Sin conexión';
  if (snap.status === 'error') return 'Error de sincronización';
  if (snap.pending) return `${snap.pending} cambio${snap.pending === 1 ? '' : 's'} por enviar`;
  return 'Sincronizado';
}

function SyncLabel({ snap, onClick }: { snap: Snapshot; onClick: () => void }) {
  return (
    <button className={'local-label sync-' + snap.status} onClick={onClick}>
      <span className="status-dot" /> {syncText(snap)}
    </button>
  );
}

function SyncChip({ snap, onClick }: { snap: Snapshot; onClick: () => void }) {
  const Icon = !snap.sync ? CloudOff : snap.status === 'syncing' ? RefreshCw : snap.status === 'idle' && !snap.pending ? Cloud : CloudOff;
  return (
    <button className={'sync-chip sync-' + snap.status} onClick={onClick} title={snap.lastError || syncText(snap)}>
      <Icon size={15} className={snap.status === 'syncing' ? 'spin' : ''} />
      <span>{syncText(snap)}</span>
    </button>
  );
}
