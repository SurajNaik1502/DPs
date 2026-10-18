import type { AppState, Conversion } from "../types";

export function unitById(state: AppState, id: string) {
  return state.units.find((u) => u.id === id);
}

export function unitCode(state: AppState, id: string) {
  return unitById(state, id)?.code ?? "—";
}

function edgesFor(conversions: Conversion[], itemId?: string) {
  const list = conversions.filter((c) => !c.itemId || c.itemId === itemId);
  const out: { from: string; to: string; factor: number }[] = [];
  for (const c of list) {
    out.push({ from: c.fromUnitId, to: c.toUnitId, factor: c.factor });
    if (c.factor) out.push({ from: c.toUnitId, to: c.fromUnitId, factor: 1 / c.factor });
  }
  return out;
}

export function convertQty(
  state: AppState,
  qty: number,
  fromUnitId: string,
  toUnitId: string,
  itemId?: string
): number | null {
  if (fromUnitId === toUnitId) return qty;
  const edges = edgesFor(state.conversions, itemId);
  const queue: { id: string; factor: number }[] = [{ id: fromUnitId, factor: 1 }];
  const seen = new Set<string>([fromUnitId]);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges) {
      if (e.from !== cur.id || seen.has(e.to)) continue;
      const next = cur.factor * e.factor;
      if (e.to === toUnitId) return qty * next;
      seen.add(e.to);
      queue.push({ id: e.to, factor: next });
    }
  }
  return null;
}

export function convertToKg(
  state: AppState,
  qty: number,
  unitId: string,
  itemId?: string
): number | null {
  return convertQty(state, qty, unitId, "u-kg", itemId);
}

export function fmtQty(n: number, digits = 3) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function fmtMoney(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
