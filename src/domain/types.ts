// Tipos de datos del hogar. Todo lo que se guarda y se sincroniza vive aquí.
import type { Catalog } from './catalog';

/** Fecha local en formato AAAA-MM-DD. */
export type ISODate = string;
export type MemberId = string;

/** Pagador especial: la cuenta o el bote común. No genera deudas entre miembros. */
export const COMMON = 'common';

export type AvatarColor = 'peach' | 'purple' | 'mint' | 'sky' | 'rose' | 'sand';

export type Member = {
  id: MemberId;
  name: string;
  color: AvatarColor;
  /** Objetivo diario de proteína en gramos (opcional, lo decide cada persona). */
  proteinTarget: number | null;
  /** Los antiguos compañeros se desactivan, no se borran: así se conservan sus gastos. */
  active: boolean;
};

export type Pet = { id: string; name: string; emoji: string };

export type Household = { name: string; members: Member[]; pets: Pet[] };

export type Unit = 'g' | 'ml' | 'ud';
export type Place = 'Nevera' | 'Despensa' | 'Congelador' | 'Hogar';
export const PLACES: Place[] = ['Nevera', 'Despensa', 'Congelador', 'Hogar'];

/** Lote de inventario. Varios lotes del mismo producto comparten `productId`. */
export type Item = {
  id: string;
  productId?: string;
  name: string;
  qty: number;
  unit: Unit;
  /** Sección de la estructura (11 alimentación seca, 13 congelados...). */
  section: number;
  /** Tipo de la estructura, 6 dígitos (sección + familia + tipo). Ej.: 110202 = arroz integral. */
  type?: string;
  /** Número de artículo dentro del tipo (001, 002...). Lo asigna la app. */
  article?: string;
  /** Código de barras del fabricante. Independiente del código interno. */
  ean?: string;
  place: Place;
  expires: ISODate | '';
  /** Precio por g, ml o unidad. */
  price: number;
  emoji: string;
  /** Proteína por 100 g/ml (o por unidad). */
  protein: number;
  /** Si tiene dueño, es de esa persona (su balda). Si no, es de toda la casa. */
  owner?: MemberId;
};

export type Ingredient = { itemId: string; amount: number; optional: boolean };

export type Recipe = {
  id: string;
  name: string;
  description: string;
  minutes: number;
  emoji: string;
  ingredients: Ingredient[];
  steps: string[];
  servings: number;
};

export type Tupper = {
  id: string;
  name: string;
  grams: number;
  created: ISODate;
  review: ISODate;
  place: 'Nevera' | 'Congelador';
  emoji: string;
  proteinPer100: number;
};

export type Meal = {
  id: string;
  recipeId?: string;
  tupperId?: string;
  name: string;
  date: ISODate;
  time: string;
  kind: string;
  done: boolean;
  thawed: boolean;
  /** Quién come. Vacío = todos los miembros activos. */
  diners?: MemberId[];
};

export type Shopping = {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
  /** Rayón para agrupar la lista según el recorrido de la tienda. */
  section?: number;
  /** Para quién es (en pisos compartidos). Vacío = para la casa. */
  owner?: MemberId;
};

export type Expense = {
  id: string;
  label: string;
  amount: number;
  /** Id del miembro que pagó o COMMON. */
  payer: MemberId;
  /** Entre quién se reparte a partes iguales. */
  split: MemberId[];
  date: ISODate;
  category: string;
};

/** Un pago entre miembros para saldar deudas. */
export type Settlement = { id: string; from: MemberId; to: MemberId; amount: number; date: ISODate; note: string };

export type Consumption = { id: string; person: MemberId; name: string; grams: number; protein: number; date: ISODate };

// ---------- Kits e inventarios personales ----------

export type KitItem = {
  id: string;
  name: string;
  qty: number;
  unit: string;
  /** Caducidad del propio artículo: latas, agua, medicamentos... */
  expires: ISODate | '';
  /** Tarea periódica: «Cambiar pilas», «Comprobar que funciona», «Recargar»... */
  task: string;
  /** Cada cuántos meses toca la tarea. 0 = sin tarea periódica. */
  everyMonths: number;
  /** Última vez que se hizo la tarea. */
  lastDone: ISODate | '';
  notes: string;
  /** Marcado como «falta» en la última revisión. */
  missing: boolean;
};

export type KitLogEntry = { id: string; date: ISODate; by: MemberId; summary: string };

export type Kit = {
  id: string;
  name: string;
  emoji: string;
  /** null = de toda la casa. */
  owner: MemberId | null;
  place: string;
  notes: string;
  /** Revisión general del kit cada N meses. */
  reviewEveryMonths: number;
  lastReview: ISODate | '';
  /** Con cuántos días de antelación avisar. */
  warnDays: number;
  items: KitItem[];
  history: KitLogEntry[];
};

// ---------- Campañas (módulo personal de trabajo) ----------

export type CampaignType = 'Nacional' | 'Local';
export type CampaignStatus = 'Por Empezar' | 'En Curso' | 'Terminada';
export const CAMPAIGN_STATUSES: CampaignStatus[] = ['Por Empezar', 'En Curso', 'Terminada'];

export type CampaignTask = { id: string; description: string; completed: boolean; due?: ISODate };

export type Campaign = {
  id: string;
  owner: MemberId;
  name: string;
  type: CampaignType;
  startDate: ISODate;
  endDate: ISODate;
  tasks: CampaignTask[];
  status: CampaignStatus;
  url?: string;
};

// ---------- Estado completo ----------

export type LogEntry = { id: string; label: string; at: string; by: MemberId };

export type State = {
  version: 2;
  /** Número de operaciones aplicadas. Sirve para detectar contextos de IA obsoletos. */
  revision: number;
  household: Household;
  catalog: Catalog;
  items: Item[];
  recipes: Recipe[];
  tuppers: Tupper[];
  meals: Meal[];
  shopping: Shopping[];
  expenses: Expense[];
  settlements: Settlement[];
  consumptions: Consumption[];
  kits: Kit[];
  campaigns: Campaign[];
  /** Ids de propuestas de IA ya aplicadas (para no aplicarlas dos veces). */
  applied: string[];
  log: LogEntry[];
};
