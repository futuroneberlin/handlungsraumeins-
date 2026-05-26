import { createEmergentCategories, createSemanticEdges, updateRelationLayer } from "../../core/relations.js";
import { THEORY_CORE_TEXT, synthesizeConceptualStatement, theoryResonanceProfile, stabilizeTheoryStatement } from "../../core/theoryModel.js";

export function refreshSemanticTopology(state, timestamp = performance.now()) {
  const nodes = Array.isArray(state.nodes) ? state.nodes : [];
  const wikiEntries = Array.isArray(state.wikiEntries) ? state.wikiEntries : [];
  const edges = createSemanticEdges(nodes, wikiEntries, timestamp);
  const categories = createEmergentCategories(nodes, edges, timestamp);
  const relationCandidatesByNode = new Map();

  for (const node of nodes) {
    relationCandidatesByNode.set(node.id, []);
  }

  for (const edge of edges) {
    const left = nodes[edge.leftIndex ?? edge.sourceIndex ?? -1];
    const right = nodes[edge.rightIndex ?? edge.targetIndex ?? -1];
    if (!left || !right) {
      continue;
    }

    const leftCandidates = relationCandidatesByNode.get(left.id) || [];
    const rightCandidates = relationCandidatesByNode.get(right.id) || [];
    leftCandidates.push({ id: edge.id, targetId: right.id, label: edge.label, confidence: edge.confidence, score: edge.score, kind: edge.type, concepts: edge.sharedConcepts || [] });
    rightCandidates.push({ id: edge.id, targetId: left.id, label: edge.label, confidence: edge.confidence, score: edge.score, kind: edge.type, concepts: edge.sharedConcepts || [] });
    relationCandidatesByNode.set(left.id, leftCandidates);
    relationCandidatesByNode.set(right.id, rightCandidates);
  }

  state.nodes = nodes.map((node) => ({
    ...node,
    relationCandidates: (relationCandidatesByNode.get(node.id) || []).sort((left, right) => (right.score || 0) - (left.score || 0)).slice(0, 5),
  }));
  return {
    nodes: state.nodes,
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
    wiki: "linked through live Wikipedia concept transfer",
    semantic: "linked through shared conceptual density",
    category: "linked through synthesized category overlap",
    theory: "linked through theory-core resonance",
    drift: "linked through spatial proximity",
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
      id: edge.id,
      label: edge.label || edge.type || "relation",
      explanation: edge.explanation || stabilizeTheoryStatement([...(edge.sharedConcepts || []), ...(edge.sharedTheorySignals || []), ...(edge.sharedKeywords || []), ...(edge.sharedCategories || []), ...(edge.sharedLinks || [])], describeEdge(edge)),
      confidence: Math.round((edge.confidence ?? edge.score ?? 1) * 100),
      weight: edge.weight ?? edge.score ?? 1,
      evidence: Array.from(new Set([...(edge.sharedConcepts || []), ...(edge.keywords || []), ...(edge.sharedCategories || []), ...(edge.sharedLinks || []), ...(edge.sharedTheorySignals || [])])).slice(0, 4),
      kind: edge.type || "semantic",
    })),
  };
}

export function getTheorySynthesis(state) {
  const categories = Array.isArray(state?.categories) ? state.categories : [];
  const nodes = Array.isArray(state?.nodes) ? state.nodes : [];
  const strongestCategories = categories
    .slice()
    .sort((left, right) => (right.density || 0) - (left.density || 0) || (right.nodeCount || 0) - (left.nodeCount || 0))
    .slice(0, 4);

  const statements = [];
  for (const category of strongestCategories) {
    const concepts = [
      category.label,
      ...(category.concepts || []),
    ];
    const statement = synthesizeConceptualStatement(concepts, "Conceptual material stabilizes within the theory core.");
    statements.push(statement);
  }

  if (!statements.length) {
    const nodeConcepts = nodes.flatMap((node) => node.concepts || []).slice(0, 8);
    statements.push(synthesizeConceptualStatement(nodeConcepts, "Language condenses into spatial relation through theory-guided curation."));
  }

  return [...new Set(statements)].slice(0, 3);
}

export function getTheoryStabilizationEntries(state) {
  const nodes = Array.isArray(state?.nodes) ? state.nodes : [];
  const categories = Array.isArray(state?.categories) ? state.categories : [];
  const topCategories = categories
    .filter((category) => (category.stable || 0) && (category.density || 0) >= 0.9)
    .slice()
    .sort((left, right) => (right.conceptWeight || 0) - (left.conceptWeight || 0) || (right.density || 0) - (left.density || 0))
    .slice(0, 4);

  return topCategories.map((category) => {
    const linkedNodes = nodes
      .filter((node) => (category.nodeIds || []).includes(node.id))
      .sort((left, right) => (right.theoryResonanceScore || 0) - (left.theoryResonanceScore || 0))
      .slice(0, 3);

    const conceptName = String(category.label || "Conceptual Condensation");
    const stabilizationStatement = synthesizeConceptualStatement([
      conceptName,
      ...(category.concepts || []),
      ...linkedNodes.flatMap((node) => node.concepts || []),
    ], "Meaning stabilizes through theory-guided spatial transformation.");

    const explanation = `${stabilizationStatement} Die Verdichtung entsteht aus wiederholter semantischer Verstärkung und räumlicher Stabilisierung im Transformationsfeld.`;

    let mapping = "Mapped to Actional Space: participation as structure and temporal emergence of form.";
    const lower = stabilizationStatement.toLowerCase();
    if (lower.includes("temporal") || lower.includes("process")) {
      mapping = "Mapped to Actional Space: temporality structures how fragments become form.";
    } else if (lower.includes("spatial") || lower.includes("space")) {
      mapping = "Mapped to Actional Space: spatial interaction organizes semantic material into readable tension.";
    } else if (lower.includes("participation") || lower.includes("embodied")) {
      mapping = "Mapped to Actional Space: participation collapses subject/object distance through embodied relation.";
    } else if (lower.includes("transform")) {
      mapping = "Mapped to Actional Space: transformation converts linguistic fragments into stabilized spatial meaning.";
    }

    return {
      id: `stabilization-${category.id}`,
      conceptName,
      explanation,
      linkedFragments: linkedNodes.map((node) => node.semanticLabel || node.title || node.keyword || node.text).filter(Boolean),
      mapping,
    };
  }).filter((entry) => entry.linkedFragments.length >= 2);
}

export function updateSemanticLayers(state, timestamp = performance.now()) {
  state.edges = updateRelationLayer(state.edges, timestamp);
  return state;
}
