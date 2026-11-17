import { Check, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import {
  DEFAULT_TRAIN_ADJUSTMENTS,
  type TrainAdjustments,
  type TrainGeometrySnapshot,
} from "../../lib/trainGeometryDebug";

interface TrainDebugOverlayProps {
  snapshot: TrainGeometrySnapshot | null;
  adjustments: TrainAdjustments;
  onChangeAdjustments: (next: TrainAdjustments) => void;
  onClose: () => void;
}

const STATUS_STROKE: Record<"done" | "active" | "pending", string> = {
  done: "#22f59d",
  active: "#ffc142",
  pending: "#60a5fa",
};

export default function TrainDebugOverlay({
  snapshot,
  adjustments,
  onChangeAdjustments,
  onClose,
}: TrainDebugOverlayProps) {
  const [panelExpanded, setPanelExpanded] = useState<boolean | null>(null);

  if (!snapshot) return null;

  const { containerWidth: w, containerHeight: h, bridgePoints, compartments } =
    snapshot;
  const isExpanded = panelExpanded ?? (w >= 1020 && h >= 460);

  const railPath =
    bridgePoints.length > 1
      ? `M ${bridgePoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")}`
      : "";
  const deckFrontPath =
    bridgePoints.length > 1
      ? `M ${bridgePoints.map((p) => `${p.x.toFixed(1)},${p.deckFrontY.toFixed(1)}`).join(" L ")}`
      : "";

  const mockLeftX = w * 0.08;
  const mockRightX = w * 0.92;
  const mockTopY = h * 0.2;
  const mockBottomY = h * 0.68;
  const passCount = snapshot.constraintChecks.filter((c) => c.pass).length;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none"
      data-testid="train-debug-overlay"
    >
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="h-full w-full"
        aria-hidden="true"
      >
        {/* Mock Geometry Reference Envelope (8%..92% horizontal span) */}
        <rect
          x={mockLeftX}
          y={mockTopY}
          width={mockRightX - mockLeftX}
          height={mockBottomY - mockTopY}
          fill="none"
          stroke="rgba(232, 121, 249, 0.36)"
          strokeWidth={1}
          strokeDasharray="6 4"
        />
        <text
          x={mockLeftX + 6}
          y={mockTopY - 5}
          fill="rgba(240, 171, 252, 0.85)"
          fontSize={10}
          fontFamily="monospace"
        >
          MOCK TARGET SPAN (8% – 92%)
        </text>
        <line
          x1={w * 0.5}
          y1={0}
          x2={w * 0.5}
          y2={h}
          stroke="rgba(148, 163, 184, 0.22)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />

        {/* Projected Bridge Rail & Front Deck Rim */}
        {railPath && (
          <path
            d={railPath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={1.6}
            strokeDasharray="5 3"
          />
        )}
        {deckFrontPath && (
          <path
            d={deckFrontPath}
            fill="none"
            stroke="rgba(129, 140, 248, 0.72)"
            strokeWidth={1.2}
          />
        )}
        {bridgePoints
          .filter((_, idx) => idx % 4 === 0)
          .map((pt) => (
            <g key={pt.t}>
              <circle cx={pt.x} cy={pt.y} r={2.2} fill="#38bdf8" />
              <text
                x={pt.x}
                y={pt.deckFrontY + 26}
                textAnchor="middle"
                fill="rgba(147, 197, 253, 0.78)"
                fontSize={8.5}
                fontFamily="monospace"
              >
                t={pt.t.toFixed(2)}
              </text>
            </g>
          ))}

        {/* Projected Train Compartment Bounding Boxes & Rail Clearances */}
        {compartments.map((car, idx) => {
          const stroke = STATUS_STROKE[car.status];
          const { x, y, width, height } = car.box;
          const next = compartments[idx + 1];
          const gapMidY = y + height * 0.52;

          return (
            <g key={car.index}>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={
                  car.status === "active"
                    ? "rgba(255, 193, 66, 0.06)"
                    : "rgba(56, 189, 248, 0.03)"
                }
                stroke={stroke}
                strokeWidth={1.35}
                strokeDasharray="4 2"
              />

              {/* Corner Crosshairs */}
              {[
                [x, y, 1, 1],
                [x + width, y, -1, 1],
                [x, y + height, 1, -1],
                [x + width, y + height, -1, -1],
              ].map(([cx, cy, sx, sy], cornerIdx) => (
                <path
                  key={cornerIdx}
                  d={`M ${cx} ${cy + sy * 7} L ${cx} ${cy} L ${cx + sx * 7} ${cy}`}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={2}
                />
              ))}

              {/* Compartment Tag + Pixel Bounds */}
              <rect
                x={x}
                y={Math.max(2, y - 18)}
                width={Math.min(Math.max(width, 108), 160)}
                height={15}
                rx={3}
                fill="rgba(2, 6, 20, 0.88)"
                stroke={stroke}
                strokeWidth={0.8}
              />
              <text
                x={x + 4}
                y={Math.max(12, y - 7.5)}
                fill="#f8fafc"
                fontSize={9}
                fontFamily="monospace"
              >
                {`C${car.index + 1} ${Math.round(width)}×${Math.round(height)}px`}
              </text>

              {/* Wheel-to-Rail Seating Indicator */}
              <line
                x1={car.centerX}
                y1={car.wheelBottomY}
                x2={car.centerX}
                y2={car.railY}
                stroke="#f472b6"
                strokeWidth={1.5}
              />
              <circle cx={car.centerX} cy={car.railY} r={2.6} fill="#f472b6" />
              <text
                x={car.centerX}
                y={Math.max(car.wheelBottomY, car.railY) + 12}
                textAnchor="middle"
                fill="#f9a8d4"
                fontSize={8.5}
                fontFamily="monospace"
              >
                {`Δy:${car.clearancePx.toFixed(1)} ${car.pitchDeg >= 0 ? "+" : ""}${car.pitchDeg.toFixed(1)}°`}
              </text>

              {/* Inter-car Gap Callout */}
              {next && car.gapToNextPx !== null && (
                <g>
                  <line
                    x1={x + width}
                    y1={gapMidY}
                    x2={next.box.x}
                    y2={gapMidY}
                    stroke="#facc15"
                    strokeWidth={1.3}
                  />
                  <rect
                    x={(x + width + next.box.x) / 2 - 17}
                    y={gapMidY - 14}
                    width={34}
                    height={12}
                    rx={2}
                    fill="rgba(2, 6, 20, 0.9)"
                  />
                  <text
                    x={(x + width + next.box.x) / 2}
                    y={gapMidY - 5}
                    textAnchor="middle"
                    fill="#fde047"
                    fontSize={8.5}
                    fontFamily="monospace"
                  >
                    {`${car.gapToNextPx.toFixed(0)}px`}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Top-Right Compact Geometry & CSS Audit Drawer */}
      <div className="pointer-events-auto absolute right-3 top-3 max-h-[calc(100%-1.5rem)] w-[290px] overflow-y-auto rounded-xl border border-cyan-400/40 bg-[#03091a]/92 p-2.5 text-[11px] text-slate-200 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-2 border-b border-slate-700/70 pb-1.5">
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Audit ({passCount}/{snapshot.constraintChecks.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPanelExpanded(!isExpanded)}
              className="rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              {isExpanded ? "Compact" : "Expand"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close geometry debug overlay"
              className="rounded p-0.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-slate-400">
          <span>
            {w}×{h}px ({snapshot.aspectRatio}:1)
          </span>
          <span className="truncate text-cyan-200/90">{snapshot.heightClass}</span>
        </div>

        {isExpanded && (
          <>
            <div className="mt-2 space-y-1 border-t border-slate-800 pt-1.5">
              {snapshot.constraintChecks.map((chk) => (
                <div
                  key={chk.id}
                  className="flex items-start justify-between gap-2 text-[10px]"
                >
                  <div className="min-w-0">
                    <span
                      className={`inline-flex items-center gap-1 font-medium ${
                        chk.pass ? "text-emerald-300" : "text-amber-300"
                      }`}
                    >
                      <Check className="h-2.5 w-2.5 shrink-0" />
                      {chk.label}
                    </span>
                    <p className="font-mono text-[9.5px] text-slate-400">
                      {chk.actual}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-1 py-0.5 font-mono text-[9px] ${
                      chk.pass
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {chk.pass ? "OK" : "TUNE"}
                  </span>
                </div>
              ))}
            </div>

            {/* Live Calibration Sliders */}
            <div className="mt-2 space-y-1.5 border-t border-slate-800 pt-2">
              <div className="flex items-center justify-between font-mono text-[10px] text-slate-300">
                <span>Live Geometry Fine-Tune</span>
                <button
                  type="button"
                  onClick={() => onChangeAdjustments(DEFAULT_TRAIN_ADJUSTMENTS)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] text-cyan-300 hover:bg-slate-800"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  Zero
                </button>
              </div>

              <label className="grid grid-cols-[68px_1fr_36px] items-center gap-1.5 font-mono text-[9.5px]">
                <span className="text-slate-400">Train Y</span>
                <input
                  type="range"
                  min={-0.2}
                  max={0.2}
                  step={0.01}
                  value={adjustments.trackYOffset}
                  onChange={(e) =>
                    onChangeAdjustments({
                      ...adjustments,
                      trackYOffset: Number(e.target.value),
                    })
                  }
                  className="accent-cyan-400"
                />
                <span className="text-right text-slate-200">
                  {adjustments.trackYOffset.toFixed(2)}
                </span>
              </label>

              <label className="grid grid-cols-[68px_1fr_36px] items-center gap-1.5 font-mono text-[9.5px]">
                <span className="text-slate-400">Cam X</span>
                <input
                  type="range"
                  min={-1.5}
                  max={1.5}
                  step={0.05}
                  value={adjustments.cameraXOffset}
                  onChange={(e) =>
                    onChangeAdjustments({
                      ...adjustments,
                      cameraXOffset: Number(e.target.value),
                    })
                  }
                  className="accent-cyan-400"
                />
                <span className="text-right text-slate-200">
                  {adjustments.cameraXOffset.toFixed(2)}
                </span>
              </label>

              <label className="grid grid-cols-[68px_1fr_36px] items-center gap-1.5 font-mono text-[9.5px]">
                <span className="text-slate-400">Zoom</span>
                <input
                  type="range"
                  min={0.82}
                  max={1.25}
                  step={0.01}
                  value={adjustments.cameraZoomFactor}
                  onChange={(e) =>
                    onChangeAdjustments({
                      ...adjustments,
                      cameraZoomFactor: Number(e.target.value),
                    })
                  }
                  className="accent-cyan-400"
                />
                <span className="text-right text-slate-200">
                  {adjustments.cameraZoomFactor.toFixed(2)}
                </span>
              </label>

              <label className="grid grid-cols-[68px_1fr_36px] items-center gap-1.5 font-mono text-[9.5px]">
                <span className="text-slate-400">Car Gap</span>
                <input
                  type="range"
                  min={0.5}
                  max={1.6}
                  step={0.05}
                  value={adjustments.carGapScale}
                  onChange={(e) =>
                    onChangeAdjustments({
                      ...adjustments,
                      carGapScale: Number(e.target.value),
                    })
                  }
                  className="accent-cyan-400"
                />
                <span className="text-right text-slate-200">
                  {adjustments.carGapScale.toFixed(2)}
                </span>
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
