import { useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import { fmtMoney } from "../lib/units";
import { uid, useStore } from "../store/db";
import type { MenuItem } from "../types";

const empty = (): MenuItem => ({
  id: "",
  code: "",
  name: "",
  group: "South tiffin",
  recipeId: "",
  portionQty: 1,
  portionUnitId: "u-plate",
  sellingPrice: 0,
  active: true,
  priceHistory: [],
});

export function Menu() {
  const { state, save, user } = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<MenuItem | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = state.menu.find((menu) => menu.id === selectedId) ?? null;

  const rows = useMemo(
    () =>
      state.menu.filter(
        (m) =>
          m.name.toLowerCase().includes(q.toLowerCase()) ||
          m.code.toLowerCase().includes(q.toLowerCase()) ||
          m.group.toLowerCase().includes(q.toLowerCase()),
      ),
    [state.menu, q],
  );

  const persist = (menu: MenuItem) => {
    const normalized = {
      ...menu,
      code: menu.code || `M-${state.menu.length + 1}`,
      priceHistory: menu.priceHistory ?? [],
    };

    const next = normalized.id
      ? state.menu.map((x) => (x.id === normalized.id ? normalized : x))
      : [...state.menu, { ...normalized, id: uid("m") }];

    save({ ...state, menu: next });
    setEdit(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this menu?")) return;
    save({ ...state, menu: state.menu.filter((menu) => menu.id !== id) });
  };

  const applyPrice = (menuId: string, price: number) => {
    const nextMenu = state.menu.map((menu) => {
      if (menu.id !== menuId) return menu;
      const history = [
        ...(menu.priceHistory ?? []),
        {
          id: uid("mh"),
          price,
          changedAt: new Date().toISOString(),
        },
      ];
      return {
        ...menu,
        sellingPrice: price,
        priceHistory: history,
      };
    });
    save({ ...state, menu: nextMenu });
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Menu master</h2>
          <p className="muted">
            Selling price management and menu price history.
          </p>
        </div>
        {user?.role !== "kitchen" && (
          <button className="btn" onClick={() => setEdit(empty())}>
            New menu item
          </button>
        )}
      </div>

      <div className="dash-split">
        <div className="card">
          <div className="toolbar">
            <input
              placeholder="Search menu or group"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Menu</th>
                <th>Group</th>
                <th>Recipe</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((menu) => (
                <tr
                  key={menu.id}
                  onClick={() => setSelectedId(menu.id)}
                  style={{ cursor: "pointer" }}
                >
                  <td>{menu.code}</td>
                  <td>{menu.name}</td>
                  <td>{menu.group}</td>
                  <td>
                    {state.recipes.find((r) => r.id === menu.recipeId)?.name ??
                      "—"}
                  </td>
                  <td className="num">{fmtMoney(menu.sellingPrice)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn ghost small"
                        onClick={() => setEdit(menu)}
                      >
                        Edit
                      </button>
                      {user?.role !== "kitchen" && (
                        <button
                          className="icon-btn"
                          type="button"
                          title="Delete menu"
                          aria-label="Delete menu"
                          onClick={() => handleDelete(menu.id)}
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
              <div className="muted" style={{ marginBottom: 12 }}>
                Current price:{" "}
                <strong style={{ color: "var(--ink)" }}>
                  {fmtMoney(selected.sellingPrice)}
                </strong>
              </div>

              <div className="stack gap-small" style={{ marginBottom: 16 }}>
                <label>Update selling price</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={selected.sellingPrice}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = Number(
                          (e.target as HTMLInputElement).value,
                        );
                        if (!Number.isNaN(val)) applyPrice(selected.id, val);
                      }
                    }}
                  />
                  <button
                    className="btn"
                    onClick={(e) => {
                      const input =
                        e.currentTarget.parentElement?.querySelector(
                          "input",
                        ) as HTMLInputElement | null;
                      const val = Number(input?.value ?? selected.sellingPrice);
                      if (!Number.isNaN(val)) applyPrice(selected.id, val);
                    }}
                  >
                    Save price
                  </button>
                </div>
              </div>

              <h4 style={{ margin: "8px 0" }}>Price history</h4>
              {selected.priceHistory && selected.priceHistory.length > 0 ? (
                <div className="recipe-batch-list">
                  {selected.priceHistory
                    .slice()
                    .reverse()
                    .map((entry) => (
                      <div key={entry.id} className="recipe-batch-item">
                        <div className="recipe-batch-header">
                          <strong>{fmtMoney(entry.price)}</strong>
                          <span className="batch-tag">
                            {new Date(entry.changedAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="muted">No price history yet.</p>
              )}
            </>
          ) : (
            <p className="muted">Select a menu item to view pricing details.</p>
          )}
        </div>
      </div>

      {edit && (
        <Modal
          title={edit.id ? "Edit menu" : "New menu"}
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
              <label>Group</label>
              <input
                value={edit.group}
                onChange={(e) => setEdit({ ...edit, group: e.target.value })}
              />
            </div>
            <div>
              <label>Recipe</label>
              <select
                value={edit.recipeId}
                onChange={(e) => setEdit({ ...edit, recipeId: e.target.value })}
              >
                <option value="">Choose recipe</option>
                {state.recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Portion qty</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={edit.portionQty}
                onChange={(e) =>
                  setEdit({ ...edit, portionQty: Number(e.target.value || 0) })
                }
              />
            </div>
            <div>
              <label>Portion unit</label>
              <select
                value={edit.portionUnitId}
                onChange={(e) =>
                  setEdit({ ...edit, portionUnitId: e.target.value })
                }
              >
                {state.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} — {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Selling price</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={edit.sellingPrice}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    sellingPrice: Number(e.target.value || 0),
                  })
                }
              />
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button
              className="btn"
              onClick={() => {
                const normalized = {
                  ...edit,
                  priceHistory: edit.id
                    ? (edit.priceHistory ?? [])
                    : [
                        {
                          id: uid("mh"),
                          price: edit.sellingPrice,
                          changedAt: new Date().toISOString(),
                        },
                      ],
                };
                persist(normalized);
              }}
            >
              Save menu
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export const MenuPage = Menu;
