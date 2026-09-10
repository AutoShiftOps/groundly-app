import { BarChart3, ChevronLeft, ChevronRight, FileSearch, Globe, Lightbulb } from "lucide-react";
import { PRO_TIPS } from "@/lib/analysis/types";
import { cn } from "@/lib/utils";

function Sparkline({
  points,
  color,
}: {
  points: number[];
  color: string;
}) {
  const w = 132;
  const h = 36;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = Math.max(1, max - min);
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / span) * (h - 6) - 3;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="sparkline mt-3 w-full" viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={d} stroke={color} />
      <path d={d} stroke={color} strokeOpacity="0.25" strokeWidth="6" />
    </svg>
  );
}

const World = () => (
  <svg viewBox="0 0 240 120" className="world-faint absolute right-2 top-6 h-20 w-40" aria-hidden>
    <ellipse cx="120" cy="60" rx="92" ry="46" fill="none" stroke="#67e8f9" strokeWidth="1" />
    <path
      d="M40 58 C58 40, 80 38, 98 50 C120 66, 128 40, 158 44 C178 46, 190 62, 210 58"
      fill="none"
      stroke="#67e8f9"
      strokeWidth="1.2"
    />
    <path
      d="M52 72 C74 68, 90 80, 112 74 C138 66, 160 78, 188 70"
      fill="none"
      stroke="#67e8f9"
      strokeWidth="1"
    />
    <circle cx="86" cy="52" r="2" fill="#67e8f9" />
    <circle cx="150" cy="48" r="2" fill="#67e8f9" />
    <circle cx="176" cy="64" r="2" fill="#67e8f9" />
  </svg>
);

export function StatCards({
  sources,
  dataPoints,
  markets,
  tipIndex,
  onPrevTip,
  onNextTip,
  onSetTip,
}: {
  sources: number;
  dataPoints: number;
  markets: string[];
  tipIndex: number;
  onPrevTip: () => void;
  onNextTip: () => void;
  onSetTip: (i: number) => void;
}) {
  const tip = PRO_TIPS[tipIndex % PRO_TIPS.length];
  const sourcePoints = [8, 10, 9, 14, 13, 18, 16, 22, 28, 26, 34, 40];
  const dataLine = [12, 14, 13, 18, 22, 20, 28, 26, 30, 36, 34, 42];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <article className="glass-card relative overflow-hidden rounded-[24px] p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-[12px] bg-cyan/10 text-cyan">
            <FileSearch className="size-4.5" />
          </span>
          <div>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{sources}</p>
            <p className="text-sm text-muted">sources scanned</p>
            <p className="mt-1 text-xs font-medium text-green">+12 in the last 30s</p>
          </div>
        </div>
        <Sparkline points={sourcePoints} color="#4ade80" />
      </article>

      <article className="glass-card relative overflow-hidden rounded-[24px] p-5">
        <World />
        <div className="relative flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-[12px] bg-cyan/10 text-cyan">
            <Globe className="size-4.5" />
          </span>
          <div>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{markets.length}</p>
            <p className="text-sm text-muted">markets analyzed</p>
            <p className="mt-2 max-w-[18ch] text-xs leading-relaxed text-faint">
              {markets.join(", ") || "Unlocking regions"}
            </p>
          </div>
        </div>
      </article>

      <article className="glass-card relative overflow-hidden rounded-[24px] p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-[12px] bg-violet/15 text-violet">
            <BarChart3 className="size-4.5" />
          </span>
          <div>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{dataPoints}</p>
            <p className="text-sm text-muted">data points processed</p>
            <p className="mt-1 text-xs text-faint">Crunching numbers for deeper insights</p>
          </div>
        </div>
        <Sparkline points={dataLine} color="#a78bfa" />
      </article>

      <article className="glass-card relative overflow-hidden rounded-[24px] p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-[12px] bg-violet/15 text-violet">
              <Lightbulb className="size-4.5" />
            </span>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-faint">Pro Tip</p>
              <p className="mt-2 text-[15px] font-medium leading-snug text-fg">{tip}</p>
            </div>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-white/5 hover:text-fg"
            onClick={onPrevTip}
            aria-label="Previous tip"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex gap-1.5">
            {PRO_TIPS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Tip ${i + 1}`}
                onClick={() => onSetTip(i)}
                className={cn(
                  "size-1.5 rounded-full",
                  i === tipIndex % PRO_TIPS.length ? "bg-fg" : "bg-white/20",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-white/5 hover:text-fg"
            onClick={onNextTip}
            aria-label="Next tip"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </article>
    </div>
  );
}
