import { useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import { costPerKg, explodeRecipe, recipeCost } from "../lib/costing";
import { fmtMoney, fmtQty, unitCode } from "../lib/units";
import { uid, useStore } from "../store/db";
import type { Recipe, RecipeKind, RecipeLine } from "../types";

function blankLine(): RecipeLine {
  return { id: uid("ln"), source: "item", refId: "", qty: 0, unitId: "u-g" };
}

function blankRecipe(): Recipe {
  return {
    id: "",
    code: "",
    name: "",
    kind: "sub",
    yieldQty: 1,
    yieldUnitId: "u-kg",
    notes: "",
    lines: [blankLine()],
  };
}

export function Recipes({ kind = "sub" }: { kind?: "sub" | "menu" }) {
  const { state, save } = useStore();
  const [kindFilter, setKindFilter] = useState<"all" | RecipeKind>(kind);
  const [edit, setEdit] = useState<Recipe | null>(null);
  const [openId, setOpenId] = useState<string | null>(
    state.recipes.find(
      (r) =>
        r.kind === kind && r.code === (kind === "sub" ? "SR-001" : "RC-001"),
    )?.id ?? null,
  );

  const rows = useMemo(
    () =>
      state.recipes.filter(
        (r) => kindFilter === "all" || r.kind === kindFilter,
      ),
    [state.recipes, kindFilter],
  );
  const open = state.recipes.find((r) => r.id === openId);

  const persist = (recipe: Recipe) => {
    const cleaned = {
      ...recipe,
      lines: recipe.lines.filter((l) => l.refId && l.qty > 0),
    };
    const next = recipe.id
      ? state.recipes.map((x) => (x.id === recipe.id ? cleaned : x))
      : [
          ...state.recipes,
          {
            ...cleaned,
            id: uid("r"),
            code: recipe.code || `RC-${state.recipes.length + 1}`,
          },
        ];
    save({ ...state, recipes: next });
    setEdit(null);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>{kind === "sub" ? "Sub recipes" : "Menu recipes"}</h2>
          <p className="muted">
            {kind === "sub"
              ? "Batch-wise preparation logs for each sub recipe and its multiple production runs."
              : "Menu recipe modules that convert sub recipes into plated outputs."}
          </p>
        </div>
        <button className="btn" onClick={() => setEdit(blankRecipe())}>
          New {kind === "sub" ? "sub recipe" : "menu recipe"}
        </button>
      </div>
      <div className="tabs">
        {(["all", kind] as const).map((k) => (
          <button
            key={k}
            className={kindFilter === k ? "on" : ""}
            onClick={() => setKindFilter(k === "all" ? "all" : k)}
          >
            {k === "all"
              ? "All"
              : kind === "sub"
                ? "Sub recipes"
                : "Menu recipes"}
          </button>
        ))}
      </div>
      <div className="dash-split">
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Yield</th>
                <th className="num">Batch cost</th>
                <th className="num">/ kg</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const kg = costPerKg(state, r);
                return (
                  <tr
                    key={r.id}
                    onClick={() => setOpenId(r.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>{r.code}</td>
                    <td>
                      {r.name}{" "}
                      <span className={`tag ${r.kind}`}>
                        {r.kind === "sub" ? "sub" : "menu"}
                      </span>
                    </td>
                    <td>
                      {fmtQty(r.yieldQty)} {unitCode(state, r.yieldUnitId)}
                    </td>
                    <td className="num">
                      {fmtMoney(recipeCost(state, r).total)}
                    </td>
                    <td className="num">
                      {kg.perKg == null ? "—" : fmtMoney(kg.perKg)}
                    </td>
                    <td>
                      <button
                        className="btn ghost small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEdit(structuredClone(r));
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card">
          {open ? (
            <>
              <h3 style={{ fontFamily: "Fraunces, serif", marginTop: 0 }}>
                {open.name}
              </h3>
              {open.kind === "sub" &&
                open.batches &&
                open.batches.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="muted" style={{ marginBottom: 8 }}>
                      Production batches
                    </div>
                    {open.batches.map((batch) => (
                      <div
                        key={batch.id}
                        className="muted"
                        style={{ marginBottom: 4 }}
                      >
                        {new Date(batch.madeAt).toLocaleString()} ·{" "}
                        {fmtQty(batch.qty)} {unitCode(state, batch.unitId)}
                      </div>
                    ))}
                  </div>
                )}
              <p className="muted">{open.notes}</p>
              <table>
                <thead>
                  <tr>
                    <th>Line</th>
                    <th className="num">Qty</th>
                    <th className="num">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {explodeRecipe(state, open)
                    .filter((l) => l.path === open.name)
                    .map((l, idx) => (
                      <tr key={idx}>
                        <td>
                          {l.name}
                          <div className="muted">
                            {l.source === "recipe" ? "sub recipe" : "item"}
                          </div>
                        </td>
                        <td className="num">
                          {fmtQty(l.qty)} {unitCode(state, l.unitId)}
                        </td>
                        <td className="num">
                          {l.cost == null ? l.note : fmtMoney(l.cost)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="muted">Select a recipe to explode item-level cost.</p>
          )}
        </div>
      </div>
      {edit && (
        <Modal
          title={edit.id ? "Edit recipe" : "New recipe"}
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
                  setEdit({ ...edit, kind: e.target.value as RecipeKind })
                }
              >
                <option value="sub">Sub recipe</option>
                <option value="menu">Menu recipe</option>
              </select>
            </div>
            <div>
              <label>Yield qty</label>
              <input
                type="number"
                step="any"
                value={edit.yieldQty}
                onChange={(e) =>
                  setEdit({ ...edit, yieldQty: Number(e.target.value) })
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
                {state.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code}
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
          <label>Lines</label>
          {edit.lines.map((line, idx) => (
            <div className="line-row" key={line.id}>
              <select
                value={line.source}
                onChange={(e) => {
                  const lines = [...edit.lines];
                  lines[idx] = {
                    ...line,
                    source: e.target.value as RecipeLine["source"],
                    refId: "",
                  };
                  setEdit({ ...edit, lines });
                }}
              >
                <option value="item">Item</option>
                <option value="recipe">Sub recipe</option>
              </select>
              <select
                value={line.refId}
                onChange={(e) => {
                  const lines = [...edit.lines];
                  lines[idx] = { ...line, refId: e.target.value };
                  setEdit({ ...edit, lines });
                }}
              >
                <option value="">Select</option>
                {(line.source === "item"
                  ? state.items
                  : state.recipes.filter((r) => r.id !== edit.id)
                ).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="any"
                value={line.qty}
                onChange={(e) => {
                  const lines = [...edit.lines];
                  lines[idx] = { ...line, qty: Number(e.target.value) };
                  setEdit({ ...edit, lines });
                }}
              />
              <select
                value={line.unitId}
                onChange={(e) => {
                  const lines = [...edit.lines];
                  lines[idx] = { ...line, unitId: e.target.value };
                  setEdit({ ...edit, lines });
                }}
              >
                {state.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.code}
                  </option>
                ))}
              </select>
              <button
                className="btn ghost small"
                onClick={() =>
                  setEdit({
                    ...edit,
                    lines: edit.lines.filter((l) => l.id !== line.id),
                  })
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="btn ghost small"
            onClick={() =>
              setEdit({ ...edit, lines: [...edit.lines, blankLine()] })
            }
          >
            Add line
          </button>
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
