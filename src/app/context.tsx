// Contexto de React: da a cada pantalla acceso al hogar, a «quién soy» y a las acciones comunes.
import { createContext, useContext } from 'react';
import type { HouseholdStore, Snapshot } from './store';
import type { OpBody } from '../domain/ops';
import { COMMON, type Member, type MemberId, type State } from '../domain/types';

export type Tab = 'hoy' | 'cocina' | 'inventario' | 'compra' | 'gastos' | 'kits' | 'campanas' | 'hogar' | 'mas';

export type ModalState = { kind: string; data?: any } | null;

export type HomeCtx = {
  store: HouseholdStore;
  snap: Snapshot;
  state: State;
  me: Member;
  /** Miembros activos. */
  members: Member[];
  /** Aplica un cambio. Devuelve true si ha ido bien; si no, muestra el error. */
  act: (body: OpBody, message?: string, closeAfter?: boolean) => boolean;
  toast: (message: string) => void;
  open: (kind: string, data?: any) => void;
  close: () => void;
  modal: ModalState;
  error: string;
  setError: (message: string) => void;
  /** Navega a una pantalla. `param` sirve para abrir algo concreto (p. ej. un kit). */
  go: (tab: Tab, param?: string) => void;
  tab: Tab;
  param: string;
  nameOf: (id: MemberId | undefined | null) => string;
};

export const HomeContext = createContext<HomeCtx | null>(null);

export function useHome(): HomeCtx {
  const ctx = useContext(HomeContext);
  if (!ctx) throw Error('useHome fuera de HomeContext');
  return ctx;
}

export function makeNameOf(state: State) {
  return (id: MemberId | undefined | null) => {
    if (!id) return 'La casa';
    if (id === COMMON) return 'Cuenta común';
    return state.household.members.find((m) => m.id === id)?.name ?? 'Antiguo miembro';
  };
}
