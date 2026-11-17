import type { StageStatus } from "../types/groundly";

export interface TrainAdjustments {
  trackYOffset: number;
  cameraXOffset: number;
  cameraZoomFactor: number;
  carGapScale: number;
}

export const DEFAULT_TRAIN_ADJUSTMENTS: TrainAdjustments = {
  trackYOffset: 0,
  cameraXOffset: 0,
  cameraZoomFactor: 1,
  carGapScale: 1,
};

export interface ScreenBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CompartmentDebugMetric {
  index: number;
  label: string;
  status: StageStatus;
  box: ScreenBox;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  centerX: number;
  wheelBottomY: number;
  railY: number;
  clearancePx: number;
  pitchDeg: number;
  gapToNextPx: number | null;
  currentT: number;
}

export interface BridgePointMetric {
  t: number;
  x: number;
  y: number;
  deckFrontY: number;
}

export interface GeometryConstraintCheck {
  id: string;
  label: string;
  actual: string;
  target: string;
  pass: boolean;
}

export interface TrainGeometrySnapshot {
  containerWidth: number;
  containerHeight: number;
  aspectRatio: number;
  heightClass: string;
  modeLabel: string;
  spanLeftPct: number;
  spanRightPct: number;
  spanWidthPct: number;
  marginLeftPx: number;
  marginRightPx: number;
  marginSymmetryDiffPct: number;
  maxRailClearancePx: number;
  activeGapPx: number | null;
  standardGapAvgPx: number | null;
  compartments: CompartmentDebugMetric[];
  bridgePoints: BridgePointMetric[];
  constraintChecks: GeometryConstraintCheck[];
}

export function computeBoxFromProjectedCorners(
  points: ReadonlyArray<{ x: number; y: number }>,
): ScreenBox {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
}

export function evaluateVisualConstraints(input: {
  containerWidth: number;
  containerHeight: number;
  heightClass: string;
  isRunning: boolean;
  activeStageIndex: number;
  compartments: Omit<CompartmentDebugMetric, "gapToNextPx">[];
  bridgePoints: BridgePointMetric[];
}): TrainGeometrySnapshot {
  const w = Math.max(1, input.containerWidth);
  const h = Math.max(1, input.containerHeight);
  const aspectRatio = Number((w / h).toFixed(2));
  const modeLabel = input.isRunning
    ? "Live Running (full-width container)"
    : "Showcase (lg:col-span-7 container)";

  const compartments: CompartmentDebugMetric[] = input.compartments.map(
    (car, idx) => {
      const next = input.compartments[idx + 1];
      const gapToNextPx = next
        ? Number((next.box.x - (car.box.x + car.box.width)).toFixed(1))
        : null;
      return {
        ...car,
        gapToNextPx,
      };
    },
  );

  const first = compartments[0];
  const last = compartments[compartments.length - 1];
  const spanLeftPx = first ? first.box.x : 0;
  const spanRightPx = last ? last.box.x + last.box.width : w;
  const spanLeftPct = Number(((spanLeftPx / w) * 100).toFixed(1));
  const spanRightPct = Number(((spanRightPx / w) * 100).toFixed(1));
  const spanWidthPct = Number((spanRightPct - spanLeftPct).toFixed(1));

  const marginLeftPx = Number(spanLeftPx.toFixed(1));
  const marginRightPx = Number((w - spanRightPx).toFixed(1));
  const marginSymmetryDiffPct = Number(
    Math.abs(marginLeftPx / w - marginRightPx / w) * 100,
  );

  const maxRailClearancePx =
    compartments.length > 0
      ? Number(
          Math.max(
            ...compartments.map((c) => Math.abs(c.clearancePx)),
          ).toFixed(1),
        )
      : 0;

  const sparkCarIdx = Math.min(3, Math.max(0, input.activeStageIndex));
  const activeGapPx = compartments[sparkCarIdx]?.gapToNextPx ?? null;
  const standardGaps = compartments
    .slice(0, 4)
    .filter((_, idx) => idx !== sparkCarIdx)
    .map((c) => c.gapToNextPx)
    .filter((g): g is number => g !== null);
  const standardGapAvgPx =
    standardGaps.length > 0
      ? Number(
          (
            standardGaps.reduce((sum, g) => sum + g, 0) / standardGaps.length
          ).toFixed(1),
        )
      : null;

  const avgHeightPct =
    compartments.length > 0
      ? Number(
          (
            compartments.reduce((sum, c) => sum + c.heightPct, 0) /
            compartments.length
          ).toFixed(1),
        )
      : 0;

  const insideViewport =
    spanLeftPx >= 8 && spanRightPx <= w - 8 && compartments.every((c) => c.box.y >= 4);

  const constraintChecks: GeometryConstraintCheck[] = [
    {
      id: "viewport-fit",
      label: "Horizontal Bounds Fit",
      actual: `${spanLeftPct}% – ${spanRightPct}% (${spanWidthPct}% span)`,
      target: "6% – 94% inside overflow-hidden",
      pass: insideViewport && spanWidthPct >= 66 && spanWidthPct <= 90,
    },
    {
      id: "lr-symmetry",
      label: "L/R Margin Symmetry",
      actual: `L ${marginLeftPx}px / R ${marginRightPx}px (Δ ${marginSymmetryDiffPct.toFixed(1)}%)`,
      target: "|L - R| ≤ 6.5% of viewport",
      pass: marginSymmetryDiffPct <= 6.5,
    },
    {
      id: "rail-clearance",
      label: "Wheel-to-Rail Seating",
      actual: `Max Δy ${maxRailClearancePx}px`,
      target: "≤ 6.0px off viaduct rail",
      pass: maxRailClearancePx <= 6.0,
    },
    {
      id: "coupler-ratio",
      label: "Active Coupler Spark Gap",
      actual:
        activeGapPx !== null && standardGapAvgPx !== null
          ? `${activeGapPx}px vs ${standardGapAvgPx}px std`
          : "n/a",
      target: "Active gap > standard gap",
      pass:
        activeGapPx !== null &&
        standardGapAvgPx !== null &&
        activeGapPx > standardGapAvgPx,
    },
    {
      id: "car-scale",
      label: "Car Vertical Presence",
      actual: `${avgHeightPct}% avg height`,
      target: "16% – 38% of scene height",
      pass: avgHeightPct >= 16 && avgHeightPct <= 38,
    },
  ];

  return {
    containerWidth: w,
    containerHeight: h,
    aspectRatio,
    heightClass: input.heightClass,
    modeLabel,
    spanLeftPct,
    spanRightPct,
    spanWidthPct,
    marginLeftPx,
    marginRightPx,
    marginSymmetryDiffPct: Number(marginSymmetryDiffPct.toFixed(1)),
    maxRailClearancePx,
    activeGapPx,
    standardGapAvgPx,
    compartments,
    bridgePoints: input.bridgePoints,
    constraintChecks,
  };
}
