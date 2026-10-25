import { Fragment, useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import { costPerKg, explodeRecipe, recipeCost } from "../lib/costing";
import { convertToKg, fmtMoney, fmtQty, unitCode } from "../lib/units";
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
  const [expandedId, setExpandedId] = useState<string | null>(
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

  const isComponent = kind === "sub";

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>{isComponent ? "Component recipes" : "Menu recipes"}</h2>
          <p className="muted">
            {isComponent
              ? "Batch-wise preparation logs for each component recipe, including timestamp, yield and cost changes."
              : "Menu recipe modules that convert component recipes into plated outputs."}
          </p>
        </div>
        <button className="btn" onClick={() => setEdit(blankRecipe())}>
          New {isComponent ? "component recipe" : "menu recipe"}
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
              : isComponent
                ? "Component recipes"
                : "Menu recipes"}
          </button>
        ))}
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Latest</th>
              <th className="num">Batch cost</th>
              <th className="num">/ kg</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const kg = costPerKg(state, r);
              const isExpanded = expandedId === r.id;
              const latestBatch =
                r.batches && r.batches.length > 0
                  ? [...r.batches].sort(
                      (a, b) =>
                        new Date(b.madeAt).getTime() -
                        new Date(a.madeAt).getTime(),
                    )[0]
                  : null;

              const latestBatchCost =
                latestBatch && r.kind === "sub"
                  ? (() => {
                      const recipeTotal = recipeCost(state, r).total;
                      const batchShare =
                        Math.max(r.yieldQty, 0.0001) > 0
                          ? latestBatch.qty / Math.max(r.yieldQty, 0.0001)
                          : 0;
                      return recipeTotal * batchShare;
                    })()
                  : recipeCost(state, r).total;

              const latestPerKg =
                latestBatch && r.kind === "sub"
                  ? (() => {
                      const kgValue = convertToKg(
                        state,
                        latestBatch.qty,
                        latestBatch.unitId,
                      );
                      return kgValue && kgValue > 0
                        ? latestBatchCost / kgValue
                        : kg.perKg;
                    })()
                  : kg.perKg;

              return (
                <Fragment key={r.id}>
                  <tr
                    onClick={() =>
                      setExpandedId((prev) => (prev === r.id ? null : r.id))
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <td>{r.code}</td>
                    <td>
                      {r.name}{" "}
                      <span className={`tag ${r.kind}`}>
                        {r.kind === "sub" ? "component" : "menu"}
                      </span>
                    </td>
                    <td>
                      {latestBatch ? (
                        <div className="latest-summary">
                          <strong>{fmtQty(latestBatch.qty)}</strong>
                          <span>{unitCode(state, latestBatch.unitId)}</span>
                        </div>
                      ) : (
                        <span className="muted">No batch</span>
                      )}
                    </td>
                    <td className="num">{fmtMoney(latestBatchCost)}</td>
                    <td className="num">
                      {latestPerKg == null ? "—" : fmtMoney(latestPerKg)}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="btn ghost small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEdit(structuredClone(r));
                          }}
                        >
                          Edit
                        </button>
                        <span className="caret">{isExpanded ? "▾" : "▸"}</span>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="recipe-detail-row">
                      <td colSpan={6}>
                        <div className="recipe-detail-panel">
                          <div className="recipe-detail-header">
                            <div>
                              <strong>{r.name}</strong>
                              <div className="muted">
                                {r.notes || "No notes"}
                              </div>
                            </div>
                            <div className="num">
                              <div className="muted">Yield</div>
                              <strong>
                                {fmtQty(r.yieldQty)}{" "}
                                {unitCode(state, r.yieldUnitId)}
                              </strong>
                            </div>
                          </div>

                          {r.kind === "sub" &&
                          r.batches &&
                          r.batches.length > 0 ? (
                            <div className="batch-list">
                              {r.batches
                                .slice()
                                .sort(
                                  (a, b) =>
                                    new Date(b.madeAt).getTime() -
                                    new Date(a.madeAt).getTime(),
                                )
                                .map((batch) => {
                                  const recipeTotal = recipeCost(
                                    state,
                                    r,
                                  ).total;
                                  const batchShare =
                                    Math.max(r.yieldQty, 0.0001) > 0
                                      ? batch.qty / Math.max(r.yieldQty, 0.0001)
                                      : 0;
                                  const batchCost = recipeTotal * batchShare;
                                  return (
                                    <div
                                      key={batch.id}
                                      className="recipe-batch-item"
                                    >
                                      <div className="recipe-batch-header">
                                        <strong>
                                          {new Date(
                                            batch.madeAt,
                                          ).toLocaleString()}
                                        </strong>
                                        <span className="batch-tag">
                                          {fmtQty(batch.qty)}{" "}
                                          {unitCode(state, batch.unitId)}
                                        </span>
                                      </div>
                                      <div className="recipe-batch-meta">
                                        <span>
                                          Batch cost: {fmtMoney(batchCost)}
                                        </span>
                                        <span>
                                          Cost /{" "}
                                          {unitCode(state, r.yieldUnitId)}:{" "}
                                          {fmtMoney(
                                            recipeTotal /
                                              Math.max(r.yieldQty, 0.0001),
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          ) : (
                            <p className="muted">
                              No production timestamps available for this
                              recipe.
                            </p>
                          )}

                          <table className="inner-table">
                            <thead>
                              <tr>
                                <th>Line</th>
                                <th className="num">Qty</th>
                                <th className="num">Cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {explodeRecipe(state, r)
                                .filter((l) => l.path === r.name)
                                .map((l, idx) => (
                                  <tr key={idx}>
                                    <td>
                                      {l.name}
                                      <div className="muted">
                                        {l.source === "recipe"
                                          ? "component recipe"
                                          : "item"}
                                      </div>
                                    </td>
                                    <td className="num">
                                      {fmtQty(l.qty)}{" "}
                                      {unitCode(state, l.unitId)}
                                    </td>
                                    <td className="num">
                                      {l.cost == null
                                        ? l.note
                                        : fmtMoney(l.cost)}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
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
                <option value="sub">Component recipe</option>
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
                <option value="recipe">Component recipe</option>
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
