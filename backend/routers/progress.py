"""Stage-ordered progress events for /api/analyze/stream.

Frameworks run in parallel, so one framework can finish writing before
another has finished searching. StageProgress records every real step
completion as it happens, but only *emits* events in pipeline order:
a later stage's counts are held back until every earlier stage is done,
then released. Nothing is ever emitted for a step that hasn't finished.
"""

from typing import Callable

STAGES = ("reading", "searching", "writing", "checking", "building")
COUNTED_STAGES = ("searching", "writing", "checking")


class StageProgress:
    def __init__(self, total: int, emit: Callable[[dict], None]):
        self.total = total
        self._emit = emit
        self._counts = {stage: 0 for stage in COUNTED_STAGES}
        self._sent = {stage: 0 for stage in COUNTED_STAGES}
        self._finished_single: set[str] = set()
        self._current = 0

    def step_done(self, stage: str) -> None:
        """One framework finished `stage` (searching/writing/checking)."""
        if stage not in COUNTED_STAGES:
            raise ValueError(f"not a per-framework stage: {stage!r}")
        self._counts[stage] += 1
        self._flush()

    def stage_done(self, stage: str) -> None:
        """A whole-request stage (reading/building) finished."""
        if stage in COUNTED_STAGES or stage not in STAGES:
            raise ValueError(f"not a whole-request stage: {stage!r}")
        self._finished_single.add(stage)
        self._flush()

    def _flush(self) -> None:
        while self._current < len(STAGES):
            stage = STAGES[self._current]
            if stage in COUNTED_STAGES:
                count = min(self._counts[stage], self.total)
                while self._sent[stage] < count:
                    self._sent[stage] += 1
                    self._emit({"stage": stage, "done": self._sent[stage], "total": self.total})
                if count < self.total:
                    return
            elif stage not in self._finished_single:
                return
            self._emit({"stage": stage, "status": "done"})
            self._current += 1
