import { useState } from "react";
import { Modal } from "../components/Modal";
import { uid, useStore } from "../store/db";
import type { Unit } from "../types";

export function Units() {
  const { state, save } = useStore();
  const [edit, setEdit] = useState<Unit | null>(null);

  const persist = (u: Unit) => {
    const next = u.id
      ? state.units.map((x) => (x.id === u.id ? u : x))
      : [...state.units, { ...u, id: uid("u"), code: u.code.toUpperCase() }];
    save({ ...state, units: next });
    setEdit(null);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Unit master</h2>
          <p className="muted">Weight, volume and count units used on items, recipes and purchases.</p>
        </div>
        <button
          className="btn"
          onClick={() =>
            setEdit({ id: "", code: "", name: "", kind: "weight", isBase: false })
          }
        >
          New unit
        </button>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Kind</th>
              <th>Base</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {state.units.map((u) => (
              <tr key={u.id}>
                <td>{u.code}</td>
                <td>{u.name}</td>
                <td>{u.kind}</td>
                <td>{u.isBase ? "Yes" : "No"}</td>
                <td>
                  <button className="btn ghost small" onClick={() => setEdit(u)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id ? "Edit unit" : "New unit"} onClose={() => setEdit(null)}>
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
              <label>Kind</label>
              <select
                value={edit.kind}
                onChange={(e) => setEdit({ ...edit, kind: e.target.value as Unit["kind"] })}
              >
                <option value="weight">Weight</option>
                <option value="volume">Volume</option>
                <option value="count">Count</option>
              </select>
            </div>
            <div>
              <label>Is base</label>
              <select
                value={edit.isBase ? "y" : "n"}
                onChange={(e) => setEdit({ ...edit, isBase: e.target.value === "y" })}
              >
                <option value="n">No</option>
                <option value="y">Yes</option>
              </select>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button className="btn" onClick={() => persist(edit)}>
              Save unit
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
