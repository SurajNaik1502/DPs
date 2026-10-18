import { useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import { landedCost } from "../lib/costing";
import { fmtMoney, unitCode } from "../lib/units";
import { uid, useStore } from "../store/db";
import type { Purchase } from "../types";

export function PurchasePage() {
  const { state, save, user } = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Purchase | null>(null);
  const rows = useMemo(() => {
    return [...state.purchases]
      .sort((a, b) => b.date.localeCompare(a.date) || b.batchNo.localeCompare(a.batchNo))
      .filter((p) => {
        const item = state.items.find((i) => i.id === p.itemId);
        const blob = `${p.batchNo} ${p.supplier} ${item?.name ?? ""}`.toLowerCase();
        return blob.includes(q.toLowerCase());
      });
  }, [state, q]);

  const persist = (p: Purchase) => {
    const next = p.id
      ? state.purchases.map((x) => (x.id === p.id ? p : x))
      : [
          ...state.purchases,
          {
            ...p,
            id: uid("p"),
            batchNo: p.batchNo || `BTH-${Date.now().toString().slice(-4)}`,
            createdBy: user?.id ?? "",
          },
        ];
    save({ ...state, purchases: next });
    setEdit(null);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Purchase</h2>
          <p className="muted">Batch-wise inward. Landed cost = qty × rate + tax + freight.</p>
        </div>
        <button
          className="btn"
          onClick={() =>
            setEdit({
              id: "",
              batchNo: "",
              date: new Date().toISOString().slice(0, 10),
              supplier: "",
              itemId: state.items[0]?.id ?? "",
              qty: 1,
              unitId: state.items[0]?.purchaseUnitId ?? "u-kg",
              rate: 0,
              taxPct: 5,
              freight: 0,
              createdBy: user?.id ?? "",
            })
          }
        >
          New purchase
        </button>
      </div>
      <div className="card">
        <div className="toolbar">
          <input placeholder="Search batch, supplier, item" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <table>
          <thead>
            <tr>
              <th>Batch</th>
              <th>Date</th>
              <th>Item</th>
              <th>Supplier</th>
              <th className="num">Qty</th>
              <th className="num">Rate</th>
              <th className="num">Landed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const item = state.items.find((i) => i.id === p.itemId);
              return (
                <tr key={p.id}>
                  <td>{p.batchNo}</td>
                  <td>{p.date}</td>
                  <td>{item?.name}</td>
                  <td>{p.supplier}</td>
                  <td className="num">
                    {p.qty} {unitCode(state, p.unitId)}
                  </td>
                  <td className="num">{fmtMoney(p.rate)}</td>
                  <td className="num">{fmtMoney(landedCost(p))}</td>
                  <td>
                    <button className="btn ghost small" onClick={() => setEdit(p)}>
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {edit && (
        <Modal title={edit.id ? "Edit purchase" : "New purchase"} onClose={() => setEdit(null)}>
          <div className="form-grid">
            <div>
              <label>Batch no</label>
              <input value={edit.batchNo} onChange={(e) => setEdit({ ...edit, batchNo: e.target.value })} />
            </div>
            <div>
              <label>Date</label>
              <input
                type="date"
                value={edit.date}
                onChange={(e) => setEdit({ ...edit, date: e.target.value })}
              />
            </div>
            <div>
              <label>Supplier</label>
              <input value={edit.supplier} onChange={(e) => setEdit({ ...edit, supplier: e.target.value })} />
            </div>
            <div>
              <label>Item</label>
              <select
                value={edit.itemId}
                onChange={(e) => {
                  const item = state.items.find((i) => i.id === e.target.value);
                  setEdit({
                    ...edit,
                    itemId: e.target.value,
                    unitId: item?.purchaseUnitId ?? edit.unitId,
                  });
                }}
              >
                {state.items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Qty</label>
              <input
                type="number"
                step="any"
                value={edit.qty}
                onChange={(e) => setEdit({ ...edit, qty: Number(e.target.value) })}
              />
            </div>
            <div>
              <label>Unit</label>
              <select value={edit.unitId} onChange={(e) => setEdit({ ...edit, unitId: e.target.value })}>
                {state.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Rate</label>
              <input
                type="number"
                step="any"
                value={edit.rate}
                onChange={(e) => setEdit({ ...edit, rate: Number(e.target.value) })}
              />
            </div>
            <div>
              <label>Tax %</label>
              <input
                type="number"
                step="any"
                value={edit.taxPct}
                onChange={(e) => setEdit({ ...edit, taxPct: Number(e.target.value) })}
              />
            </div>
            <div>
              <label>Freight</label>
              <input
                type="number"
                step="any"
                value={edit.freight}
                onChange={(e) => setEdit({ ...edit, freight: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="muted">Landed: {fmtMoney(landedCost(edit))}</p>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button className="btn" onClick={() => persist(edit)}>
              Save purchase
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
