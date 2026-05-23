import { createEmergentCategories } from "../../core/relations.js";

export function refreshCategories(state, timestamp = performance.now()) {
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];
  const edges = Array.isArray(state.edges) ? state.edges : [];
  return createEmergentCategories(nodes, edges, timestamp);
}
