const PHASE_ORDER = ["pdf", "extraction", "foundation", "form", "wiki"];

const PHASE_LABELS = {
  pdf: "PDF-Typewriter / Archiv",
  extraction: "Begriffsextraktion",
  foundation: "Fundamentbau",
  form: "Räumliche Form",
  wiki: "Wikipedia-Relationen",
  "wiki-loading": "Wikipedia-Relationen",
};

function nextPhaseName(phase) {
  const index = PHASE_ORDER.indexOf(phase);
  return index >= 0 && index < PHASE_ORDER.length - 1 ? PHASE_ORDER[index + 1] : null;
}

export function createTimelineController({ phaseInterval = 1800, phaseIntervals = {} } = {}) {
  const timeline = {
    phaseInterval,
    phaseIntervals,
    phases: {
      pdf: [],
      extraction: [],
      foundation: [],
      form: [],
      wiki: [],
    },
    phase: "pdf",
    phaseIndex: 0,
    nextPlaybackAt: 0,
    switchingPlayback: false,
    activeSource: "all",
    setQueues(queues = {}) {
      this.phases = {
        ...this.phases,
        ...queues,
      };
    },
    reset() {
      this.phase = "pdf";
      this.phaseIndex = 0;
      this.nextPlaybackAt = 0;
      this.switchingPlayback = false;
    },
    setPhase(phase, index = 0) {
      this.phase = phase;
      this.phaseIndex = index;
    },
    setActiveSource(source) {
      this.activeSource = source;
    },
    getCurrentPhaseQueue() {
      return this.phases[this.phase] || [];
    },
    getPhaseLabel() {
      return PHASE_LABELS[this.phase] || "Sequenz";
    },
    getInterval(forPhase) {
      return this.phaseIntervals[forPhase] ?? this.phaseInterval;
    },
    scheduleNext(now = performance.now(), delay = undefined) {
      const actual = typeof delay === 'number' ? delay : this.getInterval(this.phase);
      this.nextPlaybackAt = now + actual;
    },
    canAdvance(now) {
      return now >= this.nextPlaybackAt && !this.switchingPlayback;
    },
    getNextFragment() {
      const queue = this.getCurrentPhaseQueue();
      if (this.phaseIndex >= queue.length) {
        return null;
      }

      const fragment = queue[this.phaseIndex];
      this.phaseIndex += 1;
      return fragment;
    },
    step(now = performance.now()) {
      if (!this.canAdvance(now) || this.phase === "wiki-loading") {
        return { type: "wait" };
      }

      const fragment = this.getNextFragment();
      if (fragment) {
        return { type: "fragment", fragment };
      }

      const next = nextPhaseName(this.phase);
      if (!next) {
        return { type: "cycle" };
      }

      if (next === "wiki") {
        this.phase = "wiki-loading";
        this.phaseIndex = 0;
        this.scheduleNext(now, this.getInterval('wiki') * 1.5);
        return { type: "wiki-request" };
      }

      this.phase = next;
      this.phaseIndex = 0;
      this.scheduleNext(now);
      return { type: "transition", phase: next };
    },
  };

  return timeline;
}