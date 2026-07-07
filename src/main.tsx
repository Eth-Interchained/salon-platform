import React from "react";
import { createRoot } from "react-dom/client";
import { PortalProvider } from "@interchained/portal-react";
import { routes } from "@portal/routes";
import contract from "../app.contract";
import "./index.css";

function NotFound(): React.ReactElement {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
      <p className="font-mono text-sm opacity-60">404</p>
      <h1 className="text-3xl font-bold">Nothing at this address</h1>
      <a href="/" className="underline underline-offset-4">
        Back to the front desk
      </a>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("root element missing");

createRoot(root).render(
  <React.StrictMode>
    <PortalProvider routes={routes} contract={contract} notFound={NotFound} />
  </React.StrictMode>,
);
