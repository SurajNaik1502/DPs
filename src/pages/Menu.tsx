import { useState } from "react";
import { Modal } from "../components/Modal";
import { menuCosting } from "../lib/costing";
import { fmtMoney, unitCode } from "../lib/units";
import { uid, useStore } from "../store/db";
import type { MenuItem } from "../types";

export function MenuPage() {
  const { state, save } = useStore();
  const rows = menuCosting(state);
  const [edit, setEdit] = useState<MenuItem | null>(null);

  const persist = (m: MenuItem) => {
    const next = m.id
      ? state.menu.map((x) => (x.id === m.id ? m : x))
      : [...state.menu, { ...m, id: uid("m"), code: m.code || `MENU-${state.menu.length + 1}` }];
    save({ ...state, menu: next });
    setEdit(null);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Menu master</h2>
          <p className="muted">Selling items linked to a recipe and a portion size.</p>
        </div>
        <button
          className="btn"
          onClick={() =>
            setEdit({
              id: "",
              code: "",
              name: "",
              group: "South tiffin",
              recipeId: state.recipes[0]?.id ?? "",
              portionQty: 1,
              portionUnitId: state.units.find((u) => u.code === "PLT")?.id ?? state.units[0].id,
              sellingPrice: 0,
              active: true,
            })
          }
        >
          New menu item
        </button>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Menu</th>
              <th>Recipe / portion</th>
              <th className="num">Sell</th>
              <th className="num">Food cost</th>
              <th className="num">Margin</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.menu.id}>
                <td>{r.menu.code}</td>
                <td>
                  {r.menu.name}
                  <div className="muted">{r.menu.group}</div>
                </td>
                <td>
                  {r.recipe?.name}
                  <div className="muted">
                    {r.menu.portionQty} {unitCode(state, r.menu.portionUnitId)}
                  </div>
                </td>
                <td className="num">{fmtMoney(r.menu.sellingPrice)}</td>
                <td className="num">{fmtMoney(r.cost)}</td>
                <td className="num">{r.marginPct.toFixed(1)}%</td>
                <td>
                  <button className="btn ghost small" onClick={() => setEdit(r.menu)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id ? "Edit menu item" : "New menu item"} onClose={() => setEdit(null)}>
          <div className="form-grid">
            <div>
              <label>Code</label>
              <input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} />
            </div>
            <div>
              <label>Name</label>
              <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </div>
            <div>
              <label>Group</label>
              <input value={edit.group} onChange={(e) => setEdit({ ...edit, group: e.target.value })} />
            </div>
            <div>
              <label>Recipe</label>
              <select
                value={edit.recipeId}
                onChange={(e) => setEdit({ ...edit, recipeId: e.target.value })}
              >
                {state.recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Portion qty</label>
              <input
                type="number"
                step="any"
                value={edit.portionQty}
                onChange={(e) => setEdit({ ...edit, portionQty: Number(e.target.value) })}
              />
            </div>
            <div>
              <label>Portion unit</label>
              <select
                value={edit.portionUnitId}
                onChange={(e) => setEdit({ ...edit, portionUnitId: e.target.value })}
              >
                {state.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Selling price (₹)</label>
              <input
                type="number"
                step="any"
                value={edit.sellingPrice}
                onChange={(e) => setEdit({ ...edit, sellingPrice: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button className="btn" onClick={() => persist(edit)}>
              Save menu item
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
