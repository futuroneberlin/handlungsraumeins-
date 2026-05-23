import React from "react";
import ReactDOM from "react-dom/client";
import "../style.css";
import { App } from "./App.jsx";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found.");
}

ReactDOM.createRoot(rootElement).render(
  <App />,
);
