import { useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import { fmtMoney, unitCode } from "../lib/units";
import { uid, useStore } from "../store/db";
import type { Recipe, RecipeBatch } from "../types";

const empty = (): Recipe => ({
  id: "",
  code: "",
  name: "",
  kind: "sub",
  yieldQty: 0,
  yieldUnitId: "u-kg",
  notes: "",
  lines: [],
  batches: [],
});

const blankBatch = (): RecipeBatch => ({
  id: uid("rb"),
  madeAt: new Date().toISOString(),
  qty: 0,
  unitId: "u-kg",
  cost: 0,
});

export function Recipes() {
  const { state, save, user } = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Recipe | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [batchDraft, setBatchDraft] = useState<RecipeBatch | null>(null);

  const selected =
    state.recipes.find((recipe) => recipe.id === selectedId) ?? null;
  const rows = useMemo(
    () =>
      state.recipes.filter(
        (r) =>
          r.name.toLowerCase().includes(q.toLowerCase()) ||
          r.code.toLowerCase().includes(q.toLowerCase()),
      ),
    [state.recipes, q],
  );

  const persist = (recipe: Recipe) => {
    const next = recipe.id
      ? state.recipes.map((x) => (x.id === recipe.id ? recipe : x))
      : [
          ...state.recipes,
          {
            ...recipe,
            id: uid("r"),
            code: recipe.code || `CR-${state.recipes.length + 1}`,
          },
        ];

    save({ ...state, recipes: next });
    setEdit(null);
  };

  const saveBatch = () => {
    if (!selected || !batchDraft) return;
    const nextRecipe = {
      ...selected,
      batches: [...(selected.batches ?? []), { ...batchDraft, id: uid("rb") }],
    };
    save({
      ...state,
      recipes: state.recipes.map((recipe) =>
        recipe.id === nextRecipe.id ? nextRecipe : recipe,
      ),
    });
    setBatchDraft(null);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this component recipe?")) return;
    const nextRecipes = state.recipes.filter((recipe) => recipe.id !== id);
    const nextMenu = state.menu.filter((menu) => menu.recipeId !== id);
    save({ ...state, recipes: nextRecipes, menu: nextMenu });
  };

  const toggleSelected = (recipeId: string) => {
    setSelectedId((prev) => (prev === recipeId ? null : recipeId));
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Component recipes</h2>
          <p className="muted">
            Master recipe records with dated production batches.
          </p>
        </div>
        {user?.role !== "kitchen" && (
          <button className="btn" onClick={() => setEdit(empty())}>
            New component recipe
          </button>
        )}
      </div>

      <div className="dash-split">
        <div className="card">
          <div className="toolbar">
            <input
              placeholder="Search recipe"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Recipe</th>
                <th>Yield</th>
                <th>Batches</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((recipe) => (
                <tr key={recipe.id}>
                  <td>{recipe.code}</td>
                  <td>
                    <button
                      className="link-btn"
                      onClick={() => toggleSelected(recipe.id)}
                    >
                      {recipe.name}
                    </button>
                  </td>
                  <td className="num">
                    {recipe.yieldQty} {unitCode(state, recipe.yieldUnitId)}
                  </td>
                  <td>{recipe.batches?.length ?? 0}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn ghost small"
                        onClick={() => setEdit(recipe)}
                      >
                        Edit
                      </button>
                      {user?.role !== "kitchen" && (
                        <button
                          className="icon-btn"
                          type="button"
                          title="Delete recipe"
                          aria-label="Delete recipe"
                          onClick={() => handleDelete(recipe.id)}
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
                {selected.batches?.length ?? 0} batch records
              </div>

              <div className="stack gap-small" style={{ marginBottom: 16 }}>
                <button
                  className="btn"
                  onClick={() => setBatchDraft(blankBatch())}
                >
                  Add batch / production run
                </button>
              </div>

              {batchDraft && (
                <div className="batch-editor" style={{ marginBottom: 16 }}>
                  <div className="form-grid compact">
                    <div>
                      <label>Made at</label>
                      <input
                        type="datetime-local"
                        value={batchDraft.madeAt.slice(0, 16)}
                        onChange={(e) =>
                          setBatchDraft({
                            ...batchDraft,
                            madeAt: new Date(e.target.value).toISOString(),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label>Qty</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={batchDraft.qty}
                        onChange={(e) =>
                          setBatchDraft({
                            ...batchDraft,
                            qty: Number(e.target.value || 0),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label>Unit</label>
                      <select
                        value={batchDraft.unitId}
                        onChange={(e) =>
                          setBatchDraft({
                            ...batchDraft,
                            unitId: e.target.value,
                          })
                        }
                      >
                        {state.units.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.code}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Cost</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={batchDraft.cost ?? 0}
                        onChange={(e) =>
                          setBatchDraft({
                            ...batchDraft,
                            cost: Number(e.target.value || 0),
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button
                      className="btn ghost"
                      onClick={() => setBatchDraft(null)}
                    >
                      Cancel
                    </button>
                    <button className="btn" onClick={saveBatch}>
                      Save batch
                    </button>
                  </div>
                </div>
              )}

              {selected.batches && selected.batches.length > 0 ? (
                <div className="recipe-batch-list">
                  {selected.batches
                    .slice()
                    .reverse()
                    .map((batch) => (
                      <div key={batch.id} className="recipe-batch-item">
                        <div className="recipe-batch-header">
                          <strong>
                            {new Date(batch.madeAt).toLocaleString()}
                          </strong>
                          <span className="batch-tag">
                            {batch.qty} {unitCode(state, batch.unitId)} ·{" "}
                            {fmtMoney(batch.cost ?? 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="muted">No production batches recorded yet.</p>
              )}
            </>
          ) : (
            <p className="muted">
              Select a component recipe to view its production batches.
            </p>
          )}
        </div>
      </div>

      {edit && (
        <Modal
          title={edit.id ? "Edit component recipe" : "New component recipe"}
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
              <label>Yield qty</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={edit.yieldQty}
                onChange={(e) =>
                  setEdit({ ...edit, yieldQty: Number(e.target.value || 0) })
                }
              />
            </div>
            <div>
              <label>Yield unit</label>
              <select
                value={edit.yieldUnitId}
                onChange={(e) =>
                  setEdit({ ...edit, yieldUnitId: e.target.value })
                }
              >
                {state.units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} — {unit.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="span-2">
              <label>Notes</label>
              <textarea
                value={edit.notes}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button className="btn" onClick={() => persist(edit)}>
              Save recipe
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
