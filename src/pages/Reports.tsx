import { useMemo, useState } from "react";
import {
  batchCostsForItem,
  costPerKg,
  explodeRecipe,
  menuCosting,
  recipeCost,
} from "../lib/costing";
import { fmtMoney, fmtQty, unitCode } from "../lib/units";
import { useStore } from "../store/db";

type Tab = "batch" | "menu" | "recipe";

export function Reports() {
  const { state } = useStore();
  const [tab, setTab] = useState<Tab>("batch");
  const [itemId, setItemId] = useState(
    state.items.find((i) => i.code === "IRM-001")?.id ?? state.items[0].id,
  );
  const [recipeId, setRecipeId] = useState(
    state.recipes.find((r) => r.code === "MN-001")?.id ?? state.recipes[0].id,
  );

  const batches = useMemo(
    () => batchCostsForItem(state, itemId),
    [state, itemId],
  );
  const menus = useMemo(() => menuCosting(state), [state]);
  const recipe = state.recipes.find((r) => r.id === recipeId);
  const exploded = recipe ? explodeRecipe(state, recipe) : [];
  const kg = recipe ? costPerKg(state, recipe) : null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Costing reports</h2>
          <p className="muted">
            Batch-wise per kg, menu item costing, and recipe explosion.
          </p>
        </div>
      </div>
      <div className="tabs">
        <button
          className={tab === "batch" ? "on" : ""}
          onClick={() => setTab("batch")}
        >
          Batch-wise per kg
        </button>
        <button
          className={tab === "menu" ? "on" : ""}
          onClick={() => setTab("menu")}
        >
          Menu item costing
        </button>
        <button
          className={tab === "recipe" ? "on" : ""}
          onClick={() => setTab("recipe")}
        >
          Recipe cost sheet
        </button>
      </div>

      {tab === "batch" && (
        <div className="card">
          <div className="toolbar">
            <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
              {state.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} {i.name}
                </option>
              ))}
            </select>
          </div>
          <table>
            <thead>
              <tr>
                <th>Batch</th>
                <th>Date</th>
                <th>Supplier</th>
                <th className="num">Qty (kg)</th>
                <th className="num">Landed</th>
                <th className="num">₹ / kg</th>
                <th className="num">₹ / base</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.purchase.id}>
                  <td>{b.purchase.batchNo}</td>
                  <td>{b.purchase.date}</td>
                  <td>{b.purchase.supplier}</td>
                  <td className="num">
                    {b.qtyKg == null ? "—" : fmtQty(b.qtyKg)}
                  </td>
                  <td className="num">{fmtMoney(b.landed)}</td>
                  <td className="num">
                    {b.costPerKg == null ? "—" : fmtMoney(b.costPerKg)}
                  </td>
                  <td className="num">
                    {b.costPerBase == null ? "—" : fmtMoney(b.costPerBase)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {batches.length > 1 && (
            <p className="muted" style={{ marginTop: 12 }}>
              Latest purchase rate is used for costing. Each batch shows the
              real rate at which the item was bought and landed with tax +
              freight.
            </p>
          )}
        </div>
      )}

      {tab === "menu" && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Menu</th>
                <th>Recipe</th>
                <th>Portion</th>
                <th className="num">Food cost</th>
                <th className="num">Sell</th>
                <th className="num">Margin</th>
                <th className="num">Recipe ₹/kg</th>
              </tr>
            </thead>
            <tbody>
              {menus.map((m) => (
                <tr key={m.menu.id}>
                  <td>
                    <strong>{m.menu.name}</strong>
                    <div className="muted">{m.menu.code}</div>
                  </td>
                  <td>{m.recipe?.name ?? "—"}</td>
                  <td>
                    {m.menu.portionQty} {unitCode(state, m.menu.portionUnitId)}
                  </td>
                  <td className="num">{fmtMoney(m.cost)}</td>
                  <td className="num">{fmtMoney(m.menu.sellingPrice)}</td>
                  <td className="num">
                    {fmtMoney(m.margin)} ({m.marginPct.toFixed(1)}%)
                  </td>
                  <td className="num">
                    {m.perKg == null ? "—" : fmtMoney(m.perKg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "recipe" && recipe && kg && (
        <div className="card">
          <div className="toolbar">
            <select
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
            >
              {state.recipes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid-cards">
            <div className="stat">
              <span>Batch cost</span>
              <strong>{fmtMoney(recipeCost(state, recipe).total)}</strong>
              <em>
                {fmtQty(recipe.yieldQty)} {unitCode(state, recipe.yieldUnitId)}
              </em>
            </div>
            <div className="stat">
              <span>Per kg</span>
              <strong>{kg.perKg == null ? "—" : fmtMoney(kg.perKg)}</strong>
              <em>
                {kg.yieldKg == null
                  ? "Need kg conversion"
                  : `${fmtQty(kg.yieldKg)} kg yield`}
              </em>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Path</th>
                <th>Component</th>
                <th className="num">Qty</th>
                <th className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {exploded.map((l, idx) => (
                <tr key={idx}>
                  <td className="muted">{l.path}</td>
                  <td>
                    {l.name}
                    {l.note && <div className="warn">{l.note}</div>}
                  </td>
                  <td className="num">
                    {fmtQty(l.qty)} {unitCode(state, l.unitId)}
                  </td>
                  <td className="num">
                    {l.cost == null ? "—" : fmtMoney(l.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
