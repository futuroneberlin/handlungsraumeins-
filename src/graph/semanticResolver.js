import { createEmergentCategories, createSemanticEdges, updateRelationLayer } from "../../core/relations.js";
import { THEORY_CORE_TEXT, theoryResonanceProfile, stabilizeTheoryStatement } from "../../core/theoryModel.js";

export function refreshSemanticTopology(state, timestamp = performance.now()) {
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];
  const wikiEntries = Array.isArray(state.wikiEntries) ? state.wikiEntries : [];
  const edges = createSemanticEdges(nodes, wikiEntries, timestamp);
  const categories = createEmergentCategories(nodes, edges, timestamp);
  return {
    edges,
    categories,
  };
}

export function describeEdge(edge) {
  if (!edge) {
    return "";
  }

  if (edge.explanation) {
    return edge.explanation;
  }

  const labels = {
    wiki: "linked through live Wikipedia ingestion",
    semantic: "connected through participation and semantic overlap",
    category: "connected through category clustering",
    theory: "connected through the theory core's semantic gravity",
    drift: "connected through spatial drift and proximity",
  };

  return labels[edge.type] || "related through the theory core";
}

function collectConceptSignals(node) {
  return Array.from(new Set([
    ...(node?.concepts || []),
    ...(node?.keywords || []),
    ...(node?.wikiCategories || []),
    node?.semanticGroup,
    node?.category,
    node?.role,
  ].filter(Boolean)));
}

export function getNodeSummary(node, state) {
  if (!node) {
    return "";
  }

  if (node.id === "theory-core-actional-space") {
    return THEORY_CORE_TEXT;
  }

  const resonance = theoryResonanceProfile(node);
  const conceptSignals = collectConceptSignals(node);

  const matchedWiki = (state?.wikiEntries || []).find((entry) => {
    const title = String(entry.title || "").toLowerCase();
    const keyword = String(node.keyword || node.text || node.category || node.semanticGroup || "").toLowerCase();
    return title && keyword && (title.includes(keyword) || keyword.includes(title));
  });

  const feedLine = [...(state?.feedLines || [])].reverse().find((line) => String(line.text || line.source).toLowerCase().includes(String(node.keyword || node.text || "").toLowerCase()));
  const sourceSignals = [
    matchedWiki?.title,
    ...(matchedWiki?.categories || []),
    ...(matchedWiki?.concepts || []),
    ...(matchedWiki?.links || []),
    node.abstract,
    node.semanticExcerpt,
    node.wikiSummary,
    feedLine?.excerpt,
    feedLine?.concept,
  ].filter(Boolean);

  return stabilizeTheoryStatement([
    ...conceptSignals,
    ...sourceSignals,
    ...resonance.resonanceTerms,
  ], resonance.statement);
}

export function getSelectedNodeDetails(state) {
  const selectedNode = (state?.nodes || []).find((node) => node.id === state?.selectedNode) || (state?.nodes || []).find((node) => node.id === "theory-core-actional-space");
  if (!selectedNode) {
    return null;
  }

  const relatedEdges = (state?.edges || [])
    .filter((edge) => {
      const left = state.nodes[edge.leftIndex ?? edge.sourceIndex ?? -1];
      const right = state.nodes[edge.rightIndex ?? edge.targetIndex ?? -1];
      return left?.id === selectedNode.id || right?.id === selectedNode.id;
    })
    .slice(0, 6);

  return {
    title: selectedNode.title || selectedNode.semanticLabel || selectedNode.text || selectedNode.keyword || "Actional Space of Aesthetic Practice",
    summary: getNodeSummary(selectedNode, state),
    type: selectedNode.id === "theory-core-actional-space" ? "Theory Core" : selectedNode.semanticGroup || selectedNode.category || selectedNode.role || "Node",
    categories: Array.from(new Set([...(selectedNode.concepts || []), ...(selectedNode.wikiCategories || []), ...(selectedNode.category ? [selectedNode.category] : [])])),
    links: Array.from(new Set(selectedNode.wikiLinks || [])),
    relations: relatedEdges.map((edge) => ({
      label: edge.label || edge.type || "relation",
      explanation: stabilizeTheoryStatement([...(edge.sharedTheorySignals || []), ...(edge.sharedKeywords || []), ...(edge.sharedCategories || []), ...(edge.sharedLinks || [])], describeEdge(edge)),
      confidence: Math.round((edge.confidence ?? edge.score ?? 1) * 100),
      weight: edge.weight ?? edge.score ?? 1,
      evidence: Array.from(new Set([...(edge.keywords || []), ...(edge.sharedCategories || []), ...(edge.sharedLinks || []), ...(edge.sharedTheorySignals || [])])).slice(0, 4),
      kind: edge.type || "semantic",
    })),
  };
}

export function updateSemanticLayers(state, timestamp = performance.now()) {
  state.edges = updateRelationLayer(state.edges, timestamp);
  return state;
}
