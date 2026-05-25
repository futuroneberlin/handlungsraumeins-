import { createElement } from "react";
import { createRoot } from "react-dom/client";
import "../style.css";
import { App } from "./App.js";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found.");
}

createRoot(rootElement).render(createElement(App));
