import { createElement } from "react";

export function TheoryPanel({ className = "", style, ...rest }) {
  return createElement(
    "details",
    { className: `theory-core ${className}`.trim(), open: true, style, ...rest },
    createElement(
      "summary",
      null,
      createElement("span", { className: "eyebrow" }, "Theory Core"),
      createElement("strong", null, "Actional Space of Aesthetic Practice"),
    ),
    createElement(
      "div",
      { className: "theory-core-body", id: "theory-core-panel" },
      createElement("p", null, "The Actional Space of Aesthetic Practice is an expanded sculptural environment in which the artwork loses its fixed object identity and dissolves into a living process."),
      createElement("p", null, "It is constituted through the dynamics of action itself: through interaction, temporality, participation, and spatial transformation."),
      createElement("p", null, "Within this space, the distance between author and viewer collapses. The work is no longer a static object, but the experience generated through the participant's own activity."),
      createElement("p", { className: "theory-principle-label" }, "First Principle"),
      createElement("p", null, "Transformation of Sculptural Properties"),
      createElement(
        "ul",
        null,
        createElement("li", null, "From Volume to Body / Action"),
        createElement("li", null, "From Static Object to Time / Interaction"),
      ),
    ),
  );
}
