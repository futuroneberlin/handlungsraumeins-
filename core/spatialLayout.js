import { createFoundationState, placeFoundationFragment } from "./layout.js";
import { semanticGroupOrder } from "./semantics.js";

export function placeInFoundation(fragment, index, viewport, foundation = null, existingFragments = []) {
  const view = viewport || { width: 1280, height: 800 };
  if (!foundation) foundation = createFoundationState(view);

  // Map semantic groups to lanes where possible so related terms cluster
  const groupOrder = semanticGroupOrder();
  if (fragment.semanticGroup) {
    const gIndex = groupOrder.indexOf(fragment.semanticGroup);
    if (gIndex >= 0) {
      fragment.preferredLane = Math.min(2, gIndex);
    }
  }

  // Prefer central role to center lane
  if (fragment.role === "central") {
    fragment.preferredLane = 1;
    fragment.preferredDepthLayer = 0;
  }

  return placeFoundationFragment(fragment, index, view, foundation);
}
