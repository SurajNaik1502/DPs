import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Conversions } from "./pages/Conversions";
import { Dashboard } from "./pages/Dashboard";
import { Items } from "./pages/Items";
import { Login } from "./pages/Login";
import { MenuPage } from "./pages/Menu";
import { PurchasePage } from "./pages/Purchase";
import { Recipes } from "./pages/Recipes";
import { Reports } from "./pages/Reports";
import { Units } from "./pages/Units";
import { useStore } from "./store/db";
import type { Role } from "./types";

function Guard({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user } = useStore();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/items" element={<Items />} />
        <Route path="/units" element={<Units />} />
        <Route path="/conversions" element={<Conversions />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/purchase" element={<PurchasePage />} />
        <Route path="/component-recipes" element={<Recipes kind="sub" />} />
        <Route path="/menu-recipes" element={<Recipes kind="menu" />} />
        <Route path="/reports" element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
