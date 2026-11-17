import test from "node:test";
import assert from "node:assert/strict";
import {
  computeBoxFromProjectedCorners,
  evaluateVisualConstraints,
} from "./trainGeometryDebug";

test("computeBoxFromProjectedCorners returns exact pixel bounding box", () => {
  const box = computeBoxFromProjectedCorners([
    { x: 120, y: 80 },
    { x: 340, y: 84 },
    { x: 335, y: 195 },
    { x: 118, y: 190 },
  ]);
  assert.equal(box.x, 118);
  assert.equal(box.y, 80);
  assert.equal(box.width, 222);
  assert.equal(box.height, 115);
});

test("evaluateVisualConstraints validates balanced span, rail clearance, and active spark gap", () => {
  const mockCars = [
    { label: "Ideating", status: "done" as const, x: 120, w: 230, gapOffset: 0 },
    { label: "Researching", status: "done" as const, x: 365, w: 185, gapOffset: 0 },
    { label: "Prototyping", status: "active" as const, x: 565, w: 185, gapOffset: 0 },
    { label: "Testing", status: "pending" as const, x: 790, w: 185, gapOffset: 0 },
    { label: "Finalizing", status: "pending" as const, x: 990, w: 235, gapOffset: 0 },
  ].map((c, index) => ({
    index,
    label: c.label,
    status: c.status,
    box: { x: c.x, y: 110, width: c.w, height: 86 },
    xPct: Number(((c.x / 1376) * 100).toFixed(1)),
    yPct: 33.3,
    widthPct: Number(((c.w / 1376) * 100).toFixed(1)),
    heightPct: 26.1,
    centerX: c.x + c.w / 2,
    wheelBottomY: 196,
    railY: 198,
    clearancePx: -2,
    pitchDeg: 1.5,
    currentT: 0.18 + index * 0.13,
  }));

  const snapshot = evaluateVisualConstraints({
    containerWidth: 1376,
    containerHeight: 330,
    heightClass: "h-[290px] md:h-[330px]",
    isRunning: true,
    activeStageIndex: 2,
    compartments: mockCars,
    bridgePoints: [
      { t: 0.1, x: 20, y: 220, deckFrontY: 232 },
      { t: 0.5, x: 688, y: 196, deckFrontY: 208 },
      { t: 0.9, x: 1350, y: 215, deckFrontY: 228 },
    ],
  });

  assert.equal(snapshot.compartments[2].gapToNextPx, 40);
  assert.equal(snapshot.compartments[0].gapToNextPx, 15);
  assert.equal(snapshot.activeGapPx, 40);
  assert.equal(snapshot.standardGapAvgPx, 15);
  assert.equal(snapshot.constraintChecks.every((chk) => chk.pass), true);
});
