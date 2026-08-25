import "@fontsource-variable/dm-sans";
import "@fontsource-variable/newsreader";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { initializeAnalytics } from "./analytics";
import "./styles.css";

const root = document.getElementById("root");

if (!root) throw new Error("Root element not found");

void initializeAnalytics();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
