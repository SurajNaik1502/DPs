import { useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import { latestPurchaseRate } from "../lib/costing";
import { fmtMoney, unitCode } from "../lib/units";
import { uid, useStore } from "../store/db";
import type { Item, ItemKind } from "../types";

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
              <tr key={item.id}>
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
                  <button
                    className="btn ghost small"
                    onClick={() => setEdit(item)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
