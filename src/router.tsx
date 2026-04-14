import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotePage from "./pages/Note";
import MindMapPage from "./pages/MindMap";
import NotFound from "./pages/NotFound";
import { StarMapLayout } from "./components/layout/StarMapLayout";

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
