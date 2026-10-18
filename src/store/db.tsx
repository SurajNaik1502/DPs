import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { seedState } from "../data/seed";
import { SESSION_KEY, STORAGE_KEY, type AppState, type Role, type User } from "../types";

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed?.items?.length && parsed?.recipes?.length) return parsed;
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

interface Store {
  state: AppState;
  user: User | null;
  login: (username: string, password: string) => string | null;
  logout: () => void;
  save: (next: AppState) => void;
  can: (action: "masters" | "purchase" | "recipes" | "reports") => boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [user, setUser] = useState<User | null>(() => loadSession(loadState().users));

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
          (u) => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
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
    [state, user]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Store missing");
  return ctx;
}

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}
