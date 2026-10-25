import { useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import { latestPurchaseRate } from "../lib/costing";
import { fmtMoney, unitCode } from "../lib/units";
import { uid, useStore } from "../store/db";
import type { Item, ItemKind, Recipe } from "../types";

function recipeContainsItem(
  recipe: Recipe,
  itemId: string,
  recipes: Recipe[],
  seen = new Set<string>(),
): boolean {
  if (seen.has(recipe.id)) return false;
  seen.add(recipe.id);

  for (const line of recipe.lines) {
    if (line.source === "item" && line.refId === itemId) return true;
    if (line.source !== "recipe") continue;
    const child = recipes.find((r) => r.id === line.refId);
    if (child && recipeContainsItem(child, itemId, recipes, seen)) return true;
  }

  return false;
}

const empty = (): Item => ({
  id: "",
  code: "",
  name: "",
  kind: "raw",
  category: "Spices",
  baseUnitId: "u-kg",
  purchaseUnitId: "u-kg",
  minStock: 1,
  active: true,
});

export function Items() {
  const { state, save, user } = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Item | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = state.items.find((item) => item.id === selectedId) ?? null;
  const rows = useMemo(
    () =>
      state.items.filter(
        (i) =>
          i.name.toLowerCase().includes(q.toLowerCase()) ||
          i.code.toLowerCase().includes(q.toLowerCase()) ||
          i.category.toLowerCase().includes(q.toLowerCase()),
      ),
    [state.items, q],
  );

  const linkedMenuHistory = useMemo(() => {
    if (!selected) return [];
    return state.menu.filter((menu) => {
      const recipe = state.recipes.find((r) => r.id === menu.recipeId);
      return recipe
        ? recipeContainsItem(recipe, selected.id, state.recipes)
        : false;
    });
  }, [selected, state.menu, state.recipes]);

  const persist = (item: Item) => {
    const next = item.id
      ? state.items.map((x) => (x.id === item.id ? item : x))
      : [
          ...state.items,
          {
            ...item,
            id: uid("i"),
            code: item.code || `IRM-${state.items.length + 1}`,
          },
        ];
    save({ ...state, items: next });
    setEdit(null);
  };

  const handleDelete = (id: string) => {
    if (
      !window.confirm(
        "Delete this item? This will remove its purchase history and any linked recipe lines.",
      )
    )
      return;

    const nextItems = state.items.filter((item) => item.id !== id);
    const nextPurchases = state.purchases.filter((p) => p.itemId !== id);
    const nextRecipes = state.recipes.map((recipe) => ({
      ...recipe,
      lines: recipe.lines.filter(
        (line) => !(line.source === "item" && line.refId === id),
      ),
    }));

    save({
      ...state,
      items: nextItems,
      purchases: nextPurchases,
      recipes: nextRecipes,
    });
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Item master</h2>
          <p className="muted">
            Raw materials at item level. Latest purchase rates are used for
            costing.
          </p>
        </div>
        {user?.role !== "kitchen" && (
          <button className="btn" onClick={() => setEdit(empty())}>
            New item
          </button>
        )}
      </div>
      <div className="dash-split">
        <div className="card">
          <div className="toolbar">
            <input
              placeholder="Search code, name, category"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Item</th>
                <th>Category</th>
                <th>Base</th>
                <th className="num">Latest price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{item.code}</td>
                  <td>
                    {item.name}
                    <div className="muted">{item.kind}</div>
                  </td>
                  <td>
                    <span className="tag">{item.category}</span>
                  </td>
                  <td>{unitCode(state, item.baseUnitId)}</td>
                  <td className="num">
                    {fmtMoney(latestPurchaseRate(state, item.id) ?? 0)}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn ghost small"
                        onClick={() => setEdit(item)}
                      >
                        Edit
                      </button>
                      {user?.role !== "kitchen" && (
                        <button
                          className="icon-btn"
                          type="button"
                          title="Delete item"
                          aria-label="Delete item"
                          onClick={() => handleDelete(item.id)}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          {selected ? (
            <>
              <h3 style={{ fontFamily: "Fraunces, serif", marginTop: 0 }}>
                {selected.name}
              </h3>
              <div className="muted" style={{ marginBottom: 8 }}>
                Latest purchase price:{" "}
                <strong style={{ color: "var(--ink)" }}>
                  {fmtMoney(latestPurchaseRate(state, selected.id) ?? 0)}
                </strong>
              </div>
              <div className="muted" style={{ marginBottom: 12 }}>
                Menu price history linked to this item
              </div>
              {linkedMenuHistory.length > 0 ? (
                <div className="recipe-batch-list">
                  {linkedMenuHistory.map((menu) => (
                    <div key={menu.id} className="recipe-batch-item">
                      <div className="recipe-batch-header">
                        <strong>{menu.name}</strong>
                        <span className="batch-tag">
                          {fmtMoney(menu.sellingPrice)}
                        </span>
                      </div>
                      {(menu.priceHistory ?? []).length > 0 ? (
                        <div>
                          {menu.priceHistory!.map((entry) => (
                            <div
                              key={entry.id}
                              className="muted"
                              style={{ marginTop: 4 }}
                            >
                              {new Date(entry.changedAt).toLocaleString()} ·{" "}
                              {fmtMoney(entry.price)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="muted" style={{ marginTop: 4 }}>
                          No past price record for this menu.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  No menu price history is linked to this item.
                </p>
              )}
            </>
          ) : (
            <p className="muted">
              Select an item to view linked menu pricing history.
            </p>
          )}
        </div>
      </div>
      {edit && (
        <Modal
          title={edit.id ? "Edit item" : "New item"}
          onClose={() => setEdit(null)}
        >
          <div className="form-grid">
            <div>
              <label>Code</label>
              <input
                value={edit.code}
                onChange={(e) => setEdit({ ...edit, code: e.target.value })}
              />
            </div>
            <div>
              <label>Name</label>
              <input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </div>
            <div>
              <label>Kind</label>
              <select
                value={edit.kind}
                onChange={(e) =>
                  setEdit({ ...edit, kind: e.target.value as ItemKind })
                }
              >
                <option value="raw">Raw</option>
                <option value="packaging">Packaging</option>
                <option value="consumable">Consumable</option>
              </select>
            </div>
            <div>
              <label>Category</label>
              <input
                value={edit.category}
                onChange={(e) => setEdit({ ...edit, category: e.target.value })}
              />
            </div>
            <div>
              <label>Base unit</label>
              <select
                value={edit.baseUnitId}
                onChange={(e) =>
                  setEdit({ ...edit, baseUnitId: e.target.value })
                }
              >
                {state.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code} — {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Purchase unit</label>
              <select
                value={edit.purchaseUnitId}
                onChange={(e) =>
                  setEdit({ ...edit, purchaseUnitId: e.target.value })
                }
              >
                {state.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button className="btn" onClick={() => persist(edit)}>
              Save item
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
