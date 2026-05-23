import { updateFragments } from "../../core/movement.js";
import { updateSpatialMemory } from "../../core/spatialMemory.js";

export function advanceForceSimulation(state, now, delta) {
  updateFragments(state.nodes, state.edges, state.viewport, now, delta);
  updateSpatialMemory(state.nodes, delta);
  return state;
}
