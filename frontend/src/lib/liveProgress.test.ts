import test from "node:test";
import assert from "node:assert/strict";
import {
  applyStreamEvent,
  initialLiveProgress,
  liveActiveIndex,
  liveProgressPct,
  liveStageLabels,
  liveStageStatuses,
  runningStageView,
  type LiveProgress,
  type StreamEvent,
} from "./liveProgress";

const COUNTED = ["searching", "writing", "checking"] as const;

/** The full, in-order event sequence the backend sends for 10 frameworks. */
function fullRun(): StreamEvent[] {
  const events: StreamEvent[] = [{ stage: "reading", status: "done" }];
  for (const stage of COUNTED) {
    for (let n = 1; n <= 10; n++) events.push({ stage, done: n, total: 10 });
    events.push({ stage, status: "done" });
  }
  events.push({ stage: "building", status: "done" });
  return events;
}

const apply = (events: StreamEvent[], from: LiveProgress = initialLiveProgress()) =>
  events.reduce(applyStreamEvent, from);

test("nothing is green before any event: reading is active, the rest pending", () => {
  const state = initialLiveProgress();
  assert.deepEqual(liveStageStatuses(state), ["active", "pending", "pending", "pending", "pending"]);
  assert.equal(liveProgressPct(state), 0);
});

test("a compartment turns green only when its own status:done arrives, never from counts", () => {
  let state = apply([{ stage: "reading", status: "done" }]);
  for (let n = 1; n <= 10; n++) {
    state = applyStreamEvent(state, { stage: "searching", done: n, total: 10 });
    // even at 10/10, searching is not done until its done event
    assert.equal(liveStageStatuses(state)[1], "active", `searching at ${n}/10`);
  }
  state = applyStreamEvent(state, { stage: "searching", status: "done" });
  assert.deepEqual(liveStageStatuses(state), ["done", "done", "active", "pending", "pending"]);
});

test("at every point of a real run, every green compartment has received its done event", () => {
  let state = initialLiveProgress();
  const doneReceived = new Set<string>();
  const ids = ["reading", "searching", "writing", "checking", "building"];
  for (const event of fullRun()) {
    state = applyStreamEvent(state, event);
    if ("status" in event) doneReceived.add(event.stage);
    liveStageStatuses(state).forEach((status, i) => {
      assert.equal(status === "done", doneReceived.has(ids[i]), `${ids[i]} after ${JSON.stringify(event)}`);
    });
  }
  assert.deepEqual(liveStageStatuses(state), ["done", "done", "done", "done", "done"]);
  assert.equal(liveProgressPct(state), 100);
});

test("the active compartment shows its live count", () => {
  const state = apply([
    { stage: "reading", status: "done" },
    { stage: "searching", status: "done" },
    { stage: "writing", status: "done" },
    { stage: "checking", done: 6, total: 10 },
  ]);
  assert.equal(liveActiveIndex(state), 3);
  assert.deepEqual(liveStageLabels(state), [
    "Reading idea", "Searching sources", "Writing analysis", "Checking claims 6/10", "Building report",
  ]);
});

test("progress follows real stages: 20% per stage, split by done/total", () => {
  const state = apply([
    { stage: "reading", status: "done" },
    { stage: "searching", status: "done" },
    { stage: "writing", done: 5, total: 10 },
  ]);
  assert.equal(liveProgressPct(state), 50); // 20 + 20 + 10
});

test("counts never go backwards and unknown or non-stage events are ignored", () => {
  let state = apply([{ stage: "searching", done: 7, total: 10 }]);
  state = applyStreamEvent(state, { stage: "searching", done: 3, total: 10 });
  assert.equal(state.searching.done, 7);
  const before = state;
  state = applyStreamEvent(state, { type: "keepalive" });
  state = applyStreamEvent(state, { stage: "nonsense" as never, status: "done" });
  assert.equal(state, before);
});

test("timer fallback never shows a compartment green before the report arrives", () => {
  for (let progress = 0; progress <= 92; progress += 0.9) {
    const view = runningStageView({ mode: "timer", live: initialLiveProgress(), timerProgress: progress, reportArrived: false });
    assert.ok(!view.stageStatuses.includes("done"), `timer at ${progress}%`);
    assert.deepEqual(view.stageLabels, ["Reading idea", "Searching sources", "Writing analysis", "Checking claims", "Building report"]);
  }
  const arrived = runningStageView({ mode: "timer", live: initialLiveProgress(), timerProgress: 100, reportArrived: true });
  assert.deepEqual(arrived.stageStatuses, ["done", "done", "done", "done", "done"]);
});

test("live mode ignores the timer entirely, and timer mode ignores live events (never mixed)", () => {
  const live = apply([{ stage: "reading", status: "done" }]);
  const liveView = runningStageView({ mode: "live", live, timerProgress: 90, reportArrived: false });
  assert.deepEqual(liveView.stageStatuses, ["done", "active", "pending", "pending", "pending"]);
  assert.equal(liveView.progress, 20);

  const timerView = runningStageView({ mode: "timer", live: apply(fullRun()), timerProgress: 30, reportArrived: false });
  assert.ok(!timerView.stageStatuses.includes("done"));
  assert.equal(timerView.progress, 30);
});
