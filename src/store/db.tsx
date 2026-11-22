import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { seedState } from "../data/seed";
import {
  SESSION_KEY,
  STORAGE_KEY,
  type AppState,
  type Role,
  type User,
  type Purchase,
} from "../types";

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

async function fetchStateFromApi(): Promise<AppState | null> {
  try {
    const response = await fetch("http://localhost:3001/api/state");
    if (!response.ok) return null;

    const data = (await response.json()) as Partial<AppState>;
    if (!data?.items || !data?.users || !data?.units) return null;

    const normalized: AppState = {
      users: data.users ?? [],
      units: data.units ?? [],
      conversions: (data.conversions ?? []).map((c) => ({
        ...c,
        factor: Number(c.factor ?? 0),
      })),
      items: (data.items ?? []).map((item) => ({
        ...item,
        minStock: Number(item.minStock ?? 0),
      })),
      purchases: (data.purchases ?? []).map((purchase) => {
        const rawDate = String(purchase.date ?? "");
        const date =
          /^\d{4}-\d{2}-\d{2}$/.test(rawDate) || !rawDate
            ? rawDate
            : new Date(rawDate).toISOString().slice(0, 10);
        return {
          ...purchase,
          date,
          qty: Number(purchase.qty ?? 0),
          rate: Number(purchase.rate ?? 0),
          taxPct: Number(purchase.taxPct ?? 0),
          freight: Number(purchase.freight ?? 0),
        };
      }),
      recipes: (data.recipes ?? []).map((recipe) => ({
        ...recipe,
        yieldQty: Number(recipe.yieldQty ?? 0),
        sellingPrice:
          recipe.sellingPrice == null ? undefined : Number(recipe.sellingPrice),
      })),
      menu: (data.menu ?? []).map((menuItem) => ({
        ...menuItem,
        sellingPrice: Number(menuItem.sellingPrice ?? 0),
        portionQty: Number(menuItem.portionQty ?? 0),
      })),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return null;
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed?.items?.length && parsed?.users?.length) return parsed;
    }
  } catch {
    /* ignore */
  }

  const seeded = seedState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

function loadSession(users: User[]): User | null {
  const id = sessionStorage.getItem(SESSION_KEY);
  return users.find((u) => u.id === id) ?? null;
}

export async function saveItemToDb(item: {
  id?: string;
  code: string;
  name: string;
  kind: string;
  category: string;
  baseUnitId: string;
  purchaseUnitId: string;
  minStock: number;
  active: boolean;
}) {
  const isUpdate = Boolean(item.id);
  const url = isUpdate
    ? `http://localhost:3001/api/items/${item.id}`
    : "http://localhost:3001/api/items";
  const method = isUpdate ? "PUT" : "POST";

  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to save item");
  }

  return response.json();
}

export async function savePurchaseToDb(purchase: {
  id?: string;
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
}) {
  const isUpdate = Boolean(purchase.id);
  const response = await fetch(
    isUpdate
      ? `http://localhost:3001/api/purchases/${purchase.id}`
      : "http://localhost:3001/api/purchases",
    {
      method: isUpdate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(purchase),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to save purchase");
  }

  return response.json();
}

export async function importPurchasesToDb(
  purchases: Array<{
    batchNo: string;
    date: string;
    supplier: string;
    itemId: string;
    itemCode?: string;
    itemName?: string;
    qty: number;
    unitId: string;
    rate: number;
    taxPct: number;
    freight: number;
    createdBy: string;
  }>,
) {
  const response = await fetch("http://localhost:3001/api/purchases/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purchases }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to import purchases");
  }

  return response.json() as Promise<{
    imported: number;
    purchases: Purchase[];
  }>;
}

interface Store {
  state: AppState;
  user: User | null;
  login: (username: string, password: string) => string | null;
  logout: () => void;
  save: (next: AppState) => void;
  refreshFromDb: () => Promise<void>;
  can: (action: "masters" | "purchase" | "recipes" | "reports") => boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => seedState());
  const [user, setUser] = useState<User | null>(() =>
    loadSession(seedState().users),
  );

  useEffect(() => {
    let ignore = false;

    const hydrate = async () => {
      const fromApi = await fetchStateFromApi();
      if (ignore) return;

      if (fromApi) {
        setState(fromApi);
        setUser(loadSession(fromApi.users));
        return;
      }

      const cached = loadState();
      setState(cached);
      setUser(loadSession(cached.users));
    };

    hydrate();
    return () => {
      ignore = true;
    };
  }, []);

  const refreshFromDb = async () => {
    const fromApi = await fetchStateFromApi();
    if (fromApi) {
      setState(fromApi);
      setUser(loadSession(fromApi.users));
    }
  };

  const save = (next: AppState) => {
    setState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const value = useMemo<Store>(
    () => ({
      state,
      user,
      login: (username, password) => {
        const found = state.users.find(
          (u) =>
            u.username.toLowerCase() === username.trim().toLowerCase() &&
            u.password === password,
        );
        if (!found) return "Invalid username or password.";
        sessionStorage.setItem(SESSION_KEY, found.id);
        setUser(found);
        return null;
      },
      logout: () => {
        sessionStorage.removeItem(SESSION_KEY);
        setUser(null);
      },
      save,
      refreshFromDb,
      can: (action) => {
        if (!user) return false;
        const map: Record<Role, Set<string>> = {
          admin: new Set(["masters", "purchase", "recipes", "reports"]),
          kitchen: new Set(["recipes", "reports", "masters"]),
          purchase: new Set(["purchase", "masters", "reports"]),
        };
        return map[user.role].has(action);
      },
    }),
    [state, user],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Store missing");
  return ctx;
}
