import { buildRelations as buildRel, updateRelationLayer as updateRel } from "./relations.js";

export function buildRelations(fragments, wikiEntries, now) {
  return buildRel(fragments, wikiEntries, now);
}

export function updateRelationLayer(relations, now) {
  return updateRel(relations, now);
}
