import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Analyze from "./pages/Analyze";
import Library from "./pages/Library";
import NotePage from "./pages/Note";
import MindMapPage from "./pages/MindMap";
import Distiller from "./pages/Distiller";
import ActionLayer from "./pages/ActionLayer";
import CognitiveMirror from "./pages/CognitiveMirror";
import AnticipationLayer from "./pages/AnticipationLayer";
import RAGSearch from "./pages/RAGSearch";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { AppLayout } from "./components/layout/AppLayout";

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
    path: "/",
    element: <AppLayout />,
    children: [
      {
        path: "dashboard",
        name: "dashboard",
        element: <Dashboard />,
      },
      {
        path: "analyze",
        name: "analyze",
        element: <Analyze />,
      },
      {
        path: "library",
        name: "library",
        element: <Library />,
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
      {
        path: "distiller",
        name: "distiller",
        element: <Distiller />,
      },
      {
        path: "search",
        name: "search",
        element: <RAGSearch />,
      },
      {
        path: "actions",
        name: "actions",
        element: <ActionLayer />,
      },
      {
        path: "mirror",
        name: "mirror",
        element: <CognitiveMirror />,
      },
      {
        path: "anticipation",
        name: "anticipation",
        element: <AnticipationLayer />,
      },
      {
        path: "settings",
        name: "settings",
        element: <Settings />,
      },
    ],
  },
  /* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */
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
