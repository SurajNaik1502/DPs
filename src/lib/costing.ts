import type { AppState, Purchase, Recipe } from "../types";
import { convertQty, convertToKg, unitCode } from "./units";

export function landedCost(p: Purchase) {
  const base = p.qty * p.rate;
  return base + (base * p.taxPct) / 100 + p.freight;
}

export function itemPurchases(state: AppState, itemId: string) {
  return state.purchases
    .filter((p) => p.itemId === itemId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface BatchCostRow {
  purchase: Purchase;
  qtyBase: number | null;
  qtyKg: number | null;
  landed: number;
  costPerBase: number | null;
  costPerKg: number | null;
}

export function batchCostsForItem(state: AppState, itemId: string): BatchCostRow[] {
  const item = state.items.find((x) => x.id === itemId);
  if (!item) return [];
  return itemPurchases(state, itemId).map((p) => {
    const landed = landedCost(p);
    const qtyBase = convertQty(state, p.qty, p.unitId, item.baseUnitId, itemId);
    const qtyKg = convertToKg(state, p.qty, p.unitId, itemId);
    return {
      purchase: p,
      qtyBase,
      qtyKg,
      landed,
      costPerBase: qtyBase && qtyBase > 0 ? landed / qtyBase : null,
      costPerKg: qtyKg && qtyKg > 0 ? landed / qtyKg : null,
    };
  });
}

export function weightedAvgRate(state: AppState, itemId: string): number | null {
  const item = state.items.find((x) => x.id === itemId);
  if (!item) return null;
  let value = 0;
  let qty = 0;
  for (const p of itemPurchases(state, itemId)) {
    const q = convertQty(state, p.qty, p.unitId, item.baseUnitId, itemId);
    if (q == null) continue;
    value += landedCost(p);
    qty += q;
  }
  if (qty <= 0) return 0;
  return value / qty;
}

export function costForItemQty(
  state: AppState,
  itemId: string,
  qty: number,
  unitId: string
): { cost: number | null; reason?: string } {
  const item = state.items.find((x) => x.id === itemId);
  if (!item) return { cost: null, reason: "Item missing" };
  const rate = weightedAvgRate(state, itemId);
  if (rate == null) return { cost: null, reason: "No rate" };
  const qtyBase = convertQty(state, qty, unitId, item.baseUnitId, itemId);
  if (qtyBase == null) {
    return {
      cost: null,
      reason: `No conversion ${unitCode(state, unitId)} → ${unitCode(state, item.baseUnitId)}`,
    };
  }
  return { cost: qtyBase * rate };
}

export interface ExplodedLine {
  path: string;
  recipeName: string;
  source: "item" | "recipe";
  name: string;
  qty: number;
  unitId: string;
  cost: number | null;
  note?: string;
}

export function explodeRecipe(
  state: AppState,
  recipe: Recipe,
  multiplier = 1,
  path = recipe.name
): ExplodedLine[] {
  const rows: ExplodedLine[] = [];
  for (const line of recipe.lines) {
    if (line.source === "item") {
      const item = state.items.find((x) => x.id === line.refId);
      const { cost, reason } = costForItemQty(state, line.refId, line.qty * multiplier, line.unitId);
      rows.push({
        path,
        recipeName: recipe.name,
        source: "item",
        name: item?.name ?? line.refId,
        qty: line.qty * multiplier,
        unitId: line.unitId,
        cost,
        note: reason,
      });
    } else {
      const child = state.recipes.find((x) => x.id === line.refId);
      if (!child) {
        rows.push({
          path,
          recipeName: recipe.name,
          source: "recipe",
          name: line.refId,
          qty: line.qty * multiplier,
          unitId: line.unitId,
          cost: null,
          note: "Missing sub recipe",
        });
        continue;
      }
      const childQty = convertQty(state, line.qty * multiplier, line.unitId, child.yieldUnitId);
      if (childQty == null) {
        rows.push({
          path,
          recipeName: recipe.name,
          source: "recipe",
          name: child.name,
          qty: line.qty * multiplier,
          unitId: line.unitId,
          cost: null,
          note: "Unit conversion missing for sub recipe",
        });
        continue;
      }
      const childMult = child.yieldQty > 0 ? childQty / child.yieldQty : 0;
      rows.push({
        path,
        recipeName: recipe.name,
        source: "recipe",
        name: child.name,
        qty: line.qty * multiplier,
        unitId: line.unitId,
        cost: recipeCost(state, child).total * childMult,
      });
      rows.push(...explodeRecipe(state, child, childMult, `${path} → ${child.name}`));
    }
  }
  return rows;
}

export function recipeCost(state: AppState, recipe: Recipe, seen = new Set<string>()) {
  if (seen.has(recipe.id)) {
    return { total: 0, error: "Circular recipe" };
  }
  seen.add(recipe.id);
  let total = 0;
  for (const line of recipe.lines) {
    if (line.source === "item") {
      const { cost } = costForItemQty(state, line.refId, line.qty, line.unitId);
      total += cost ?? 0;
    } else {
      const child = state.recipes.find((x) => x.id === line.refId);
      if (!child) continue;
      const childQty = convertQty(state, line.qty, line.unitId, child.yieldUnitId);
      if (childQty == null || child.yieldQty <= 0) continue;
      const nested = recipeCost(state, child, new Set(seen));
      total += nested.total * (childQty / child.yieldQty);
    }
  }
  return { total, error: null as string | null };
}

export function costPerKg(state: AppState, recipe: Recipe) {
  const { total } = recipeCost(state, recipe);
  const kg = convertToKg(state, recipe.yieldQty, recipe.yieldUnitId);
  if (kg == null || kg <= 0) return { perKg: null as number | null, yieldKg: kg, total };
  return { perKg: total / kg, yieldKg: kg, total };
}

export function costPerYieldUnit(state: AppState, recipe: Recipe) {
  const { total } = recipeCost(state, recipe);
  if (recipe.yieldQty <= 0) return null;
  return total / recipe.yieldQty;
}

export function portionCost(state: AppState, recipe: Recipe, qty: number, unitId: string) {
  const batch = recipeCost(state, recipe).total;
  const used = convertQty(state, qty, unitId, recipe.yieldUnitId);
  if (used == null || recipe.yieldQty <= 0) return null;
  return batch * (used / recipe.yieldQty);
}

export function menuCosting(state: AppState) {
  return state.menu.map((m) => {
    const recipe = state.recipes.find((r) => r.id === m.recipeId);
    if (!recipe) {
      return {
        menu: m,
        recipe: null,
        cost: 0,
        perKg: null as number | null,
        margin: m.sellingPrice,
        marginPct: 100,
      };
    }
    const usedCost = portionCost(state, recipe, m.portionQty, m.portionUnitId) ?? 0;
    const { perKg } = costPerKg(state, recipe);
    const margin = m.sellingPrice - usedCost;
    return {
      menu: m,
      recipe,
      cost: usedCost,
      perKg,
      margin,
      marginPct: m.sellingPrice > 0 ? (margin / m.sellingPrice) * 100 : 0,
    };
  });
}
