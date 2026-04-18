import { Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotePage from "./pages/Note";
import MindMapPage from "./pages/MindMap";
import NotFound from "./pages/NotFound";
import AnchorLanding from "./pages/AnchorLanding";
import Architecture from "./pages/Architecture";
import PricingPage from "./pages/PricingPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import RefundPage from "./pages/RefundPage";
import { StarMapLayout } from "./components/layout/StarMapLayout";
import AdminLayout from "./pages/admin/AdminLayout";
import OrdersPage   from "./pages/admin/OrdersPage";
import UsersPage    from "./pages/admin/UsersPage";
import CreditsPage  from "./pages/admin/CreditsPage";
import PlansPage    from "./pages/admin/PlansPage";
import ProjectsPage from "./pages/admin/ProjectsPage";
import SystemPage   from "./pages/admin/SystemPage";
import SettingsPage from "./pages/admin/SettingsPage";

export const routers = [
  {
    path: "/",
    name: "home",
    element: <Index />,
  },
  {
    path: "/landing",
    name: "landing",
    element: <Index preview />,
  },
  {
    path: "/auth",
    name: "auth",
    element: <Auth />,
  },
  {
    path: "/app",
    element: <StarMapLayout />,
    children: [
      {
        index: true,
        name: "cosmos",
        element: null,
      },
      {
        path: "note/:id",
        name: "note",
        element: <NotePage />,
      },
      {
        path: "mindmap/:id",
        name: "mindmap",
        element: <MindMapPage />,
      },
    ],
  },
  /* Admin backend — sidebar layout */
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/orders" replace /> },
      { path: "orders",   name: "admin-orders",   element: <OrdersPage /> },
      { path: "users",    name: "admin-users",    element: <UsersPage /> },
      { path: "credits",  name: "admin-credits",  element: <CreditsPage /> },
      { path: "plans",    name: "admin-plans",    element: <PlansPage /> },
      { path: "projects", name: "admin-projects", element: <ProjectsPage /> },
      { path: "system",   name: "admin-system",   element: <SystemPage /> },
      { path: "settings", name: "admin-settings", element: <SettingsPage /> },
    ],
  },
  /* Legacy redirect */
  {
    path: "/admin/payments",
    name: "admin-payments-legacy",
    element: <Navigate to="/admin/orders" replace />,
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
  {
    path: "/pricing",
    name: "pricing",
    element: <PricingPage />,
  },
  {
    path: "/terms",
    name: "terms",
    element: <TermsPage />,
  },
  {
    path: "/privacy",
    name: "privacy",
    element: <PrivacyPage />,
  },
  {
    path: "/refund",
    name: "refund",
    element: <RefundPage />,
  },
  {
    path: "/anchor/:anchorId",
    name: "anchor-landing",
    element: <AnchorLanding />,
  },
  {
    path: "/architecture",
    name: "architecture",
    element: <Architecture />,
  },
  {
    path: "*",
    name: "404",
    element: <NotFound />,
  },
];

declare global {
  interface Window {
    __routers__: typeof routers;
  }
}

window.__routers__ = routers;
