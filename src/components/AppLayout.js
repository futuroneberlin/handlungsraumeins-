import { createElement } from "react";

export function AppLayout({ left, center, right }) {
  return createElement("div", { className: "app-shell" }, left, center, right);
}
