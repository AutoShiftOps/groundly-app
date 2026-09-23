import { Fragment } from "react";

const W = 1600;
const H = 380;
const CREST_X = 880;
const CREST_Y = 228;
const RADIUS = 16000;

const rail = (x: number) => CREST_Y + Math.pow(x - CREST_X, 2) / (2 * RADIUS);
const tilt = (x: number) => (Math.atan((x - CREST_X) / RADIUS) * 180) / Math.PI;

const railPath = (dy = 0, x0 = 40, x1 = W - 40) => {
  const pts: string[] = [];
  for (let x = x0, i = 0; x <= x1; x += 10, i++) {
    pts.push(`${i ? "L" : "M"}${x.toFixed(1)} ${(rail(x) + dy).toFixed(1)}`);
  }
  return pts.join(" ");
};

const CAR_W = 172;
const CAR_H = 78;
const GAP = 46;
const START = 110;
const WR = 7;

const carX = (i: number) => START + CAR_W / 2 + i * (CAR_W + GAP);

type Status = "done" | "active" | "pending";

const THEME: Record<Status, { hue: string; lit: string; fill: string; pool: string }> = {
  done: { hue: "#3dffc0", lit: "#e9fff8", fill: "url(#podMint)", pool: "url(#poolMint)" },
  active: { hue: "#ffc44a", lit: "#fff4cc", fill: "url(#podGold)", pool: "url(#poolGold)" },
  pending: { hue: "#4cc4ff", lit: "#dff4ff", fill: "url(#podBlue)", pool: "url(#poolBlue)" },
};

export const STAGE_LABELS = ["Ideating", "Researching", "Prototyping", "Testing", "Finalizing"];

const statusFor = (i: number, active: number): Status =>
  i < active ? "done" : i === active ? "active" : "pending";

function Tube({ d, hue, lit, hot }: { d: string; hue: string; lit: string; hot: boolean }) {
  const k = hot ? 1 : 0.85;
  return (
    <g className="ts-add">
      <path d={d} fill="none" stroke={hue} strokeWidth={22} opacity={0.22 * k} filter="url(#tsB18)" />
      <path d={d} fill="none" stroke={hue} strokeWidth={9} opacity={0.55 * k} filter="url(#tsB8)" />
      <path d={d} fill="none" stroke={hue} strokeWidth={3.4} opacity={k} />
      <path d={d} fill="none" stroke={lit} strokeWidth={1.15} opacity={0.9} />
    </g>
  );
}

function Wheel({ x }: { x: number }) {
  return (
    <g>
      <circle cx={x} cy={-WR} r={WR} fill="url(#tsWheel)" />
      <circle cx={x} cy={-WR} r={2} fill="#05070d" />
    </g>
  );
}

function Cylinder({ status, index, label }: { status: Status; index: number; label: string }) {
  const x = carX(index);
  const t = THEME[status];
  const hot = true;
  const hw = CAR_W / 2;
  const hh = CAR_H / 2;
  const rx = 22;
  const body = `M${-hw + rx} ${-hh} H${hw - rx} A${rx} ${hh} 0 0 1 ${hw - rx} ${hh} H${-hw + rx} A${rx} ${hh} 0 0 1 ${-hw + rx} ${-hh} Z`;
  const capCx = -hw + rx;

  return (
    <g transform={`translate(${x} ${rail(x)}) rotate(${tilt(x).toFixed(2)})`}>
      {status === "active" && (
        <ellipse className="ts-add" cx={0} cy={-hh} rx={150} ry={90} fill="url(#auraGold)" opacity={0.7} />
      )}
      <ellipse className="ts-add" cx={0} cy={8} rx={hw * 0.92} ry={10} fill={t.pool} filter="url(#tsB18)" />
      <g>
        <Wheel x={-hw + 40} />
        <Wheel x={-hw + 58} />
        <Wheel x={hw - 58} />
        <Wheel x={hw - 40} />
      </g>
      <path d={body} fill={t.fill} />
      <Tube d={body} hue={t.hue} lit={t.lit} hot={hot} />
      <ellipse cx={capCx} cy={0} rx={rx} ry={hh - 1} fill="url(#podFace)" stroke={t.hue} strokeWidth={2.2} />
      <ellipse cx={capCx - 3} cy={-6} rx={rx * 0.42} ry={hh * 0.28} fill={t.lit} opacity={0.18} className="ts-add" />
      <ellipse cx={hw - rx} cy={0} rx={rx * 0.55} ry={hh - 2} fill={t.hue} opacity={0.12} />
      <rect x={-hw + 36} y={-hh + 8} width={CAR_W - 72} height={11} rx={6} fill="url(#podSheen)" opacity={0.45} />
      <text
        x={0}
        y={36}
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        letterSpacing="0.4"
        fill={t.lit}
        opacity={0.92}
      >
        {label}
      </text>
    </g>
  );
}

function DualRails() {
  return (
    <g>
      <ellipse cx={W / 2} cy={CREST_Y + 48} rx={620} ry={70} fill="url(#floorDisc)" opacity={0.55} />
      <g className="ts-add">
        <path d={railPath(0)} fill="none" stroke="url(#railGrad)" strokeWidth={14} opacity={0.28} filter="url(#tsB18)" />
        <path d={railPath(14)} fill="none" stroke="url(#railGrad)" strokeWidth={14} opacity={0.22} filter="url(#tsB18)" />
        <path d={railPath(0)} fill="none" stroke="url(#railGrad)" strokeWidth={3.4} opacity={0.95} />
        <path d={railPath(14)} fill="none" stroke="url(#railGrad)" strokeWidth={3.2} opacity={0.9} />
        <path d={railPath(0)} fill="none" stroke="#f4ffff" strokeWidth={1.1} opacity={0.85} />
        <path d={railPath(14)} fill="none" stroke="#f4ffff" strokeWidth={1} opacity={0.75} />
      </g>
    </g>
  );
}

export default function TrainScene({ activeStageIndex }: { activeStageIndex: number }) {
  const active = activeStageIndex < 0 ? -1 : Math.max(0, Math.min(STAGE_LABELS.length - 1, activeStageIndex));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Analysis pipeline. Current stage: ${active < 0 ? "idle" : STAGE_LABELS[active]}.`}
      style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
    >
      <style>{`
        .ts-add { mix-blend-mode: plus-lighter; }
        @supports not (mix-blend-mode: plus-lighter) { .ts-add { mix-blend-mode: screen; } }
      `}</style>
      <defs>
        <linearGradient id="podMint" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9cffd9" stopOpacity=".55" />
          <stop offset=".45" stopColor="#0ecf8a" stopOpacity=".2" />
          <stop offset="1" stopColor="#03241a" stopOpacity=".75" />
        </linearGradient>
        <linearGradient id="podGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe7a3" stopOpacity=".6" />
          <stop offset=".45" stopColor="#e59a10" stopOpacity=".22" />
          <stop offset="1" stopColor="#1c0f00" stopOpacity=".78" />
        </linearGradient>
        <linearGradient id="podBlue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b9e8ff" stopOpacity=".45" />
          <stop offset=".45" stopColor="#2a8fff" stopOpacity=".18" />
          <stop offset="1" stopColor="#04101f" stopOpacity=".78" />
        </linearGradient>
        <radialGradient id="podFace" cx=".32" cy=".28" r=".9">
          <stop offset="0" stopColor="#d9fff4" stopOpacity=".28" />
          <stop offset=".55" stopColor="#071018" stopOpacity=".65" />
          <stop offset="1" stopColor="#02060c" stopOpacity=".9" />
        </radialGradient>
        <linearGradient id="podSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="railGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3dffc0" />
          <stop offset=".38" stopColor="#5dffb0" />
          <stop offset=".52" stopColor="#ffc44a" />
          <stop offset=".72" stopColor="#4cc4ff" />
          <stop offset="1" stopColor="#3a8bff" />
        </linearGradient>
        <radialGradient id="floorDisc" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#123056" stopOpacity=".55" />
          <stop offset="1" stopColor="#050a14" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tsWheel" cx=".34" cy=".28" r=".9">
          <stop offset="0" stopColor="#6a7f9e" />
          <stop offset="1" stopColor="#070b12" />
        </radialGradient>
        <radialGradient id="poolMint">
          <stop offset="0" stopColor="#3dffc0" stopOpacity=".8" />
          <stop offset="1" stopColor="#3dffc0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="poolGold">
          <stop offset="0" stopColor="#ffc44a" stopOpacity=".9" />
          <stop offset="1" stopColor="#ffc44a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="poolBlue">
          <stop offset="0" stopColor="#4cc4ff" stopOpacity=".7" />
          <stop offset="1" stopColor="#4cc4ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="auraGold">
          <stop offset="0" stopColor="#ffbb33" stopOpacity=".7" />
          <stop offset="1" stopColor="#ffbb33" stopOpacity="0" />
        </radialGradient>
        <filter id="tsB8" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id="tsB18" x="-260%" y="-260%" width="620%" height="620%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>

      <DualRails />

      {STAGE_LABELS.map((label, i) => (
        <Fragment key={label}>
          <Cylinder status={statusFor(i, active)} index={i} label={label} />
        </Fragment>
      ))}
    </svg>
  );
}
