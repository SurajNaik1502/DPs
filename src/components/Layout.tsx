import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useStore } from "../store/db";

const links = [
  { to: "/", label: "Kitchen board", all: true },
  { to: "/items", label: "Item master", need: "masters" as const },
  { to: "/units", label: "Unit master", need: "masters" as const },
  { to: "/conversions", label: "Unit conversion", need: "masters" as const },
  { to: "/menu", label: "Menu master", need: "masters" as const },
  { to: "/purchase", label: "Purchase", need: "purchase" as const },
  {
    to: "/component-recipes",
    label: "Component recipes",
    need: "recipes" as const,
  },
  { to: "/reports", label: "Costing reports", need: "reports" as const },
];

export function Layout() {
  const { user, logout, can } = useStore();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <button className="menu-toggle" onClick={() => setOpen((v) => !v)}>
        Menu
      </button>
      <aside
        className={`sidebar ${open ? "open" : ""}`}
        onClick={() => setOpen(false)}
      >
        <div className="side-brand">
          <div className="brand-mark">D</div>
          <div>
            <h1>DPs</h1>
            <small>Item-level recipe costing</small>
          </div>
        </div>
        <div className="nav-label">Masters</div>
        <nav>
          {links.slice(0, 5).map((l) =>
            l.all || can(l.need!) ? (
              <NavLink key={l.to} to={l.to} end={l.to === "/"}>
                {l.label}
              </NavLink>
            ) : null,
          )}
        </nav>
        <div className="nav-label">Operations</div>
        <nav>
          {links.slice(5).map((l) =>
            can(l.need!) ? (
              <NavLink key={l.to} to={l.to}>
                {l.label}
              </NavLink>
            ) : null,
          )}
        </nav>
        <div className="side-user">
          <strong>{user?.name}</strong>
          <span className="muted">@{user?.username}</span>
          <div>
            <span className="role-pill">{user?.role}</span>
          </div>
          <button
            className="btn ghost small"
            style={{
              marginTop: 12,
              color: "#f3e7d8",
              borderColor: "rgba(255,255,255,.2)",
            }}
            onClick={() => {
              logout();
              nav("/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
