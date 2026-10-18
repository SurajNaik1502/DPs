import { useState } from "react";
import { Modal } from "../components/Modal";
import { unitCode } from "../lib/units";
import { uid, useStore } from "../store/db";
import type { Conversion } from "../types";

export function Conversions() {
  const { state, save } = useStore();
  const [edit, setEdit] = useState<Conversion | null>(null);

  const persist = (c: Conversion) => {
    const next = c.id
      ? state.conversions.map((x) => (x.id === c.id ? c : x))
      : [...state.conversions, { ...c, id: uid("c") }];
    save({ ...state, conversions: next });
    setEdit(null);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Unit conversion master</h2>
          <p className="muted">
            Global factors (kg ↔ g) plus item-specific ones (curry leaf bunch → g, oil L → kg).
          </p>
        </div>
        <button
          className="btn"
          onClick={() =>
            setEdit({
              id: "",
              fromUnitId: state.units[0]?.id ?? "",
              toUnitId: state.units[1]?.id ?? "",
              factor: 1,
            })
          }
        >
          New conversion
        </button>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th className="num">Factor</th>
              <th>Scope</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {state.conversions.map((c) => (
              <tr key={c.id}>
                <td>{unitCode(state, c.fromUnitId)}</td>
                <td>{unitCode(state, c.toUnitId)}</td>
                <td className="num">{c.factor}</td>
                <td>
                  {c.itemId
                    ? state.items.find((i) => i.id === c.itemId)?.name
                    : "Global"}
                </td>
                <td className="muted">{c.notes ?? "—"}</td>
                <td>
                  <button className="btn ghost small" onClick={() => setEdit(c)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id ? "Edit conversion" : "New conversion"} onClose={() => setEdit(null)}>
          <div className="form-grid">
            <div>
              <label>From unit</label>
              <select
                value={edit.fromUnitId}
                onChange={(e) => setEdit({ ...edit, fromUnitId: e.target.value })}
              >
                {state.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>To unit</label>
              <select value={edit.toUnitId} onChange={(e) => setEdit({ ...edit, toUnitId: e.target.value })}>
                {state.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Factor (1 from = n to)</label>
              <input
                type="number"
                step="any"
                value={edit.factor}
                onChange={(e) => setEdit({ ...edit, factor: Number(e.target.value) })}
              />
            </div>
            <div>
              <label>Item (optional)</label>
              <select
                value={edit.itemId ?? ""}
                onChange={(e) => setEdit({ ...edit, itemId: e.target.value || undefined })}
              >
                <option value="">Global</option>
                {state.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="span-2">
              <label>Notes</label>
              <input value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button className="btn" onClick={() => persist(edit)}>
              Save conversion
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
