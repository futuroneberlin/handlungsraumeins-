const STORAGE_KEY = "handlungsraum.graphState.v1";

export const graphState = {
  nodes: [],
  edges: [],
  categories: [],
  history: [],
  selectedNode: null,
  ingestionQueue: [],
  transformationQueue: [],
  feedQueue: [],
  feedLines: [],
  wikiEntries: [],
  wikiSeed: [],
  viewport: {
    width: 0,
    height: 0,
    dpr: 1,
  },
  debug: false,
  hydrated: false,
  lastSavedAt: 0,
};

Object.defineProperties(graphState, {
  fragments: {
    get() {
      return this.nodes;
    },
    set(value) {
      this.nodes = Array.isArray(value) ? value : [];
    },
  },
  relations: {
    get() {
      return this.edges;
    },
    set(value) {
      this.edges = Array.isArray(value) ? value : [];
    },
  },
});

function cloneList(value) {
  return Array.isArray(value) ? value.map((item) => ({ ...item })) : [];
}

export function serializeGraphState(state = graphState) {
  return {
    version: 1,
    savedAt: Date.now(),
    selectedNode: state.selectedNode ?? null,
    nodes: cloneList(state.nodes),
    edges: cloneList(state.edges),
    categories: cloneList(state.categories),
    history: cloneList(state.history),
  };
}

export function saveGraphState(state = graphState) {
  if (typeof localStorage === "undefined") {
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeGraphState(state)));
    state.lastSavedAt = Date.now();
    return true;
  } catch {
    return false;
  }
}

export function loadGraphState(state = graphState) {
  if (typeof localStorage === "undefined") {
    return false;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return false;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return false;
    }

    state.nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    state.edges = Array.isArray(parsed.edges) ? parsed.edges : [];
    state.categories = Array.isArray(parsed.categories) ? parsed.categories : [];
    state.history = Array.isArray(parsed.history) ? parsed.history : [];
    state.selectedNode = parsed.selectedNode ?? null;
    state.hydrated = true;
    return true;
  } catch {
    return false;
  }
}

let saveTimer = 0;

export function scheduleGraphStateSave(state = graphState, delay = 600) {
  if (typeof window === "undefined") {
    return;
  }

  if (saveTimer) {
    window.clearTimeout(saveTimer);
  }

  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    saveGraphState(state);
  }, delay);
}
