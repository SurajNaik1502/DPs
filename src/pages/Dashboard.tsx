import { Link } from "react-router-dom";
import { costPerKg, menuCosting, recipeCost } from "../lib/costing";
import { fmtMoney } from "../lib/units";
import { useStore } from "../store/db";

export function Dashboard() {
  const { state, user } = useStore();
  const plate = state.recipes.find((r) => r.code === "MN-001");
  const batter = state.recipes.find((r) => r.code === "SR-001");
  const sambar = state.recipes.find((r) => r.code === "SR-002");
  const chutney = state.recipes.find((r) => r.code === "SR-003");
  const menus = menuCosting(state);
  const plateRow = menus.find((m) => m.menu.code === "MENU-01");

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>Good afternoon, {user?.name.split(" ")[0]}.</h2>
          <p className="muted">
            Working kitchen: Idli · Sambar · Coconut chutney
          </p>
        </div>
        <Link className="btn" to="/reports">
          Open costing reports
        </Link>
      </div>
      <div className="grid-cards">
        <div className="stat">
          <span>Plate food cost</span>
          <strong>{fmtMoney(plateRow?.cost ?? 0)}</strong>
          <em>Sell {fmtMoney(plateRow?.menu.sellingPrice ?? 0)}</em>
        </div>
        <div className="stat">
          <span>Plate margin</span>
          <strong>{fmtMoney(plateRow?.margin ?? 0)}</strong>
          <em>{(plateRow?.marginPct ?? 0).toFixed(1)}% of sell</em>
        </div>
        <div className="stat">
          <span>Batter / kg</span>
          <strong>
            {batter ? fmtMoney(costPerKg(state, batter).perKg ?? 0) : "—"}
          </strong>
          <em>Component recipe SR-001</em>
        </div>
        <div className="stat">
          <span>Live SKUs</span>
          <strong>{state.items.filter((i) => i.active).length}</strong>
          <em>{state.purchases.length} purchase batches</em>
        </div>
      </div>
      <div className="dash-split">
        <div className="card">
          <h3 style={{ fontFamily: "Fraunces, serif", marginTop: 0 }}>
            Build of the plate
          </h3>
          {plate && (
            <div className="recipe-tree">
              <div className="tree-item">
                <b>{plate.name}</b> — {fmtMoney(recipeCost(state, plate).total)}{" "}
                / plate
              </div>
              {batter && (
                <div className="tree-item">
                  4 steamed idlis from <b>{batter.name}</b> ·{" "}
                  {fmtMoney(costPerKg(state, batter).perKg ?? 0)} / kg
                </div>
              )}
              {sambar && (
                <div className="tree-item">
                  150 g <b>{sambar.name}</b> ·{" "}
                  {fmtMoney(costPerKg(state, sambar).perKg ?? 0)} / kg
                </div>
              )}
              {chutney && (
                <div className="tree-item">
                  40 g <b>{chutney.name}</b> ·{" "}
                  {fmtMoney(costPerKg(state, chutney).perKg ?? 0)} / kg
                </div>
              )}
            </div>
          )}
          <p className="muted" style={{ marginTop: 16 }}>
            Cost rolls from latest purchase prices, tax + freight through item
            conversions into component recipes, then into the menu plate.
          </p>
        </div>
        <div className="card">
          <h3 style={{ fontFamily: "Fraunces, serif", marginTop: 0 }}>
            Menu contribution
          </h3>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Cost</th>
                <th className="num">Margin</th>
              </tr>
            </thead>
            <tbody>
              {menus.map((m) => (
                <tr key={m.menu.id}>
                  <td>{m.menu.name}</td>
                  <td className="num">{fmtMoney(m.cost)}</td>
                  <td className="num">{m.marginPct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
