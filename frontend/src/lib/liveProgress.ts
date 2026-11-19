// Real per-step progress from POST /api/analyze/stream. Pure reducer +
// selectors: a compartment is "done" only after its own
// {"stage": X, "status": "done"} event -- never from a timer.
import type { StageId, StageStatus } from "../types/groundly";
import { STAGE_DEFINITIONS, stageIndexFromProgress, stageStatusForIndex } from "./reportStats";

export const LIVE_STAGE_IDS: StageId[] = STAGE_DEFINITIONS.map((s) => s.id);

export interface LiveStage {
  done: number;
  total: number | null;
  complete: boolean;
}

export type LiveProgress = Record<StageId, LiveStage>;

export type StreamEvent =
  | { stage: StageId; status: "done" }
  | { stage: StageId; done: number; total: number }
  | { type: "result"; report: unknown }
  | { type: "error"; error: string }
  | { type: "keepalive" };

export function initialLiveProgress(): LiveProgress {
  return Object.fromEntries(
    LIVE_STAGE_IDS.map((id) => [id, { done: 0, total: null, complete: false }]),
  ) as LiveProgress;
}

export function applyStreamEvent(state: LiveProgress, event: StreamEvent): LiveProgress {
  if (!("stage" in event) || !(event.stage in state)) return state;
  const current = state[event.stage];
  if ("status" in event) {
    if (event.status !== "done" || current.complete) return state;
    return { ...state, [event.stage]: { ...current, complete: true } };
  }
  // Counts only ever move forward.
  const done = Math.max(current.done, event.done);
  return { ...state, [event.stage]: { ...current, done, total: event.total } };
}

/** Index of the stage being worked on: the first one not yet done
 * (the last stage once everything is done). */
export function liveActiveIndex(state: LiveProgress): number {
  const idx = LIVE_STAGE_IDS.findIndex((id) => !state[id].complete);
  return idx === -1 ? LIVE_STAGE_IDS.length - 1 : idx;
}

export function liveStageStatuses(state: LiveProgress): StageStatus[] {
  const active = LIVE_STAGE_IDS.findIndex((id) => !state[id].complete);
  return LIVE_STAGE_IDS.map((id, i) => {
    if (state[id].complete) return "done";
    return i === active ? "active" : "pending";
  });
}

/** Each stage is 20%; a counted stage fills its 20% by done/total. */
export function liveProgressPct(state: LiveProgress): number {
  const share = 100 / LIVE_STAGE_IDS.length;
  let pct = 0;
  for (const id of LIVE_STAGE_IDS) {
    const stage = state[id];
    if (stage.complete) pct += share;
    else if (stage.total) pct += share * Math.min(1, stage.done / stage.total);
  }
  return Math.round(pct);
}

/** Compartment labels; the active counted stage shows its live count. */
export function liveStageLabels(state: LiveProgress): string[] {
  const active = LIVE_STAGE_IDS.findIndex((id) => !state[id].complete);
  return STAGE_DEFINITIONS.map((def, i) => {
    const stage = state[def.id];
    return i === active && stage.total ? `${def.label} ${stage.done}/${stage.total}` : def.label;
  });
}

export interface RunningStageView {
  activeStageIndex: number;
  stageStatuses: StageStatus[];
  stageLabels: string[];
  progress: number;
}

/** Everything the train, status card and progress bar show during a run.
 * "live": only real stream events. "timer" (fallback when streaming is
 * unavailable): the timer moves stages to "passed", and nothing is done
 * until the report arrives. The two are never combined. */
export function runningStageView(opts: {
  mode: "live" | "timer";
  live: LiveProgress;
  timerProgress: number;
  reportArrived: boolean;
}): RunningStageView {
  if (opts.mode === "live") {
    return {
      activeStageIndex: liveActiveIndex(opts.live),
      stageStatuses: liveStageStatuses(opts.live),
      stageLabels: liveStageLabels(opts.live),
      progress: opts.reportArrived ? 100 : liveProgressPct(opts.live),
    };
  }
  const active = stageIndexFromProgress(opts.timerProgress);
  return {
    activeStageIndex: active,
    stageStatuses: STAGE_DEFINITIONS.map((_, i) => stageStatusForIndex(i, active, opts.reportArrived)),
    stageLabels: STAGE_DEFINITIONS.map((s) => s.label),
    progress: opts.timerProgress,
  };
}
