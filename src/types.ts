export type Role = "admin" | "kitchen" | "purchase";

export type ItemKind = "raw" | "packaging" | "consumable";
export type RecipeKind = "sub" | "menu";
export type LineSource = "item" | "recipe";

export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: Role;
}

export interface Unit {
  id: string;
  code: string;
  name: string;
  kind: "weight" | "volume" | "count";
  isBase: boolean;
}

export interface Conversion {
  id: string;
  fromUnitId: string;
  toUnitId: string;
  factor: number;
  itemId?: string;
  notes?: string;
}

export interface Item {
  id: string;
  code: string;
  name: string;
  kind: ItemKind;
  category: string;
  baseUnitId: string;
  purchaseUnitId: string;
  minStock: number;
  active: boolean;
}

export interface Purchase {
  id: string;
  batchNo: string;
  date: string;
  supplier: string;
  itemId: string;
  qty: number;
  unitId: string;
  rate: number;
  taxPct: number;
  freight: number;
  createdBy: string;
}

export interface RecipeLine {
  id: string;
  source: LineSource;
  refId: string;
  qty: number;
  unitId: string;
}

export interface Recipe {
  id: string;
  code: string;
  name: string;
  kind: RecipeKind;
  yieldQty: number;
  yieldUnitId: string;
  notes: string;
  lines: RecipeLine[];
  sellingPrice?: number;
  menuGroup?: string;
}

export interface MenuItem {
  id: string;
  code: string;
  name: string;
  group: string;
  recipeId: string;
  portionQty: number;
  portionUnitId: string;
  sellingPrice: number;
  active: boolean;
}

export interface AppState {
  users: User[];
  units: Unit[];
  conversions: Conversion[];
  items: Item[];
  purchases: Purchase[];
  recipes: Recipe[];
  menu: MenuItem[];
}

export const STORAGE_KEY = "annapurna-recipe-db-v1";
export const SESSION_KEY = "annapurna-session-user";
