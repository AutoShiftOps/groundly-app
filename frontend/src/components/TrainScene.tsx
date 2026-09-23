import { Fragment } from "react";

const W = 1640;
const H = 360;
const CREST_X = 820;
const CREST_Y = 214;
const RADIUS = 9800;

const rail = (x: number) => CREST_Y + Math.pow(x - CREST_X, 2) / (2 * RADIUS);
const tilt = (x: number) => (Math.atan((x - CREST_X) / RADIUS) * 180) / Math.PI;

const railPoly = (dy = 0, x0 = -30, x1 = W + 40) => {
  const pts: [number, number][] = [];
  for (let x = x0; x <= x1; x += 8) pts.push([x, rail(x) + dy]);
  return pts;
};

const railPath = (dy = 0, x0 = -30, x1 = W + 40) => {
  const pts = railPoly(dy, x0, x1);
  return pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
};

const closedBand = (topDy: number, botDy: number, x0: number, x1: number) => {
  const top = railPoly(topDy, x0, x1);
  const bot = railPoly(botDy, x0, x1).reverse();
  return `M${top[0][0].toFixed(1)} ${top[0][1].toFixed(1)} ${top
    .slice(1)
    .map((p) => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ")} ${bot.map((p) => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ")} Z`;
};

const CAR_W = 236;
const CAR_H = 92;
const GAP = 26;
const RX = 38;
const WR = 9;
const BOT = -16;
const TOP = BOT - CAR_H;
const START = 70;

const carX = (i: number) => START + CAR_W / 2 + i * (CAR_W + GAP);

type Status = "done" | "active" | "pending";

const THEME: Record<Status, { hue: string; lit: string; glass: string; pool: string }> = {
  done: { hue: "#3dffb0", lit: "#e9fff6", glass: "url(#tsMint)", pool: "url(#tsPoolMint)" },
  active: { hue: "#ffc44a", lit: "#fff6d2", glass: "url(#tsGold)", pool: "url(#tsPoolGold)" },
  pending: { hue: "#7f97c8", lit: "#d7e4ff", glass: "url(#tsDim)", pool: "url(#tsPoolDim)" },
};

export const STAGE_LABELS = ["Ideating", "Researching", "Prototyping", "Testing", "Finalizing"];

const statusFor = (i: number, active: number): Status =>
  i < active ? "done" : i === active ? "active" : "pending";

function Tube({ d, hue, lit, dim }: { d: string; hue: string; lit: string; dim?: boolean }) {
  const k = dim ? 0.38 : 1;
  return (
    <g className="ts-add">
      <path d={d} fill="none" stroke={hue} strokeWidth={28} opacity={0.2 * k} filter="url(#tsB22)" />
      <path d={d} fill="none" stroke={hue} strokeWidth={12} opacity={0.55 * k} filter="url(#tsB9)" />
      <path d={d} fill="none" stroke={hue} strokeWidth={4.6} opacity={k} />
      <path d={d} fill="none" stroke={lit} strokeWidth={1.35} opacity={dim ? 0.45 : 0.95} />
    </g>
  );
}

function Wheel({ x }: { x: number }) {
  return (
    <g>
      <circle cx={x} cy={-WR} r={WR} fill="url(#tsWheel)" />
      <circle cx={x} cy={-WR} r={WR - 2.4} fill="none" stroke="#8aa3d0" strokeWidth={0.8} opacity={0.45} />
      <circle cx={x} cy={-WR} r={2.4} fill="#05070d" />
    </g>
  );
}

function Bogie({ x }: { x: number }) {
  return (
    <g>
      <rect x={x - 16} y={-WR - 4} width={32} height={5} rx={1.5} fill="#0a101c" />
      <Wheel x={x - 11} />
      <Wheel x={x + 11} />
    </g>
  );
}

function Smoke({ colour, x, y }: { colour: string; x: number; y: number }) {
  return (
    <g className="ts-add" transform={`translate(${x} ${y})`} filter="url(#tsSmoke)">
      {[0, 1, 2, 3, 4].map((i) => {
        const begin = `${(i * 0.55).toFixed(2)}s`;
        return (
          <ellipse key={i} cx={0} cy={0} rx={7} ry={6} fill={colour} opacity={0}>
            <animate attributeName="cy" values="0;-36;-78;-120" dur="3.6s" begin={begin} repeatCount="indefinite" />
            <animate attributeName="cx" values="0;6;16;28" dur="3.6s" begin={begin} repeatCount="indefinite" />
            <animate attributeName="rx" values="5;11;16;22" dur="3.6s" begin={begin} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;.55;.2;0" dur="3.6s" begin={begin} repeatCount="indefinite" />
          </ellipse>
        );
      })}
    </g>
  );
}

function Sparks() {
  return (
    <g className="ts-add">
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const y = TOP + 18 + i * 12;
        const begin = `${(i * 0.18).toFixed(2)}s`;
        return (
          <circle key={i} cx={CAR_W / 2 + 8} cy={y} r={1.6} fill="#ffe08a" opacity={0}>
            <animate attributeName="cx" values={`${CAR_W / 2 + 6};${CAR_W / 2 + 28};${CAR_W / 2 + 48}`} dur="0.9s" begin={begin} repeatCount="indefinite" />
            <animate attributeName="cy" values={`${y};${y - 8};${y + 10}`} dur="0.9s" begin={begin} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur="0.9s" begin={begin} repeatCount="indefinite" />
          </circle>
        );
      })}
    </g>
  );
}

function Icon({ kind, hue, lit }: { kind: Status; hue: string; lit: string }) {
  return (
    <g transform="translate(-78 -2)">
      <circle r={16} fill="rgba(4,10,18,.55)" stroke={hue} strokeWidth={1.8} />
      {kind === "done" && (
        <path d="M-7 0 L-2 6 L8 -7" fill="none" stroke={lit} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === "active" && (
        <g fill="none" stroke={lit} strokeWidth={1.8} strokeLinecap="round">
          <path d="M-5 -7 H5 L3 6 H-3 Z" />
          <path d="M-5 -7 L5 -7" />
          <path d="M-2 1 H2" />
        </g>
      )}
      {kind === "pending" && (
        <g fill={lit}>
          <circle cx={-6} cy={0} r={1.8} />
          <circle cx={0} cy={0} r={1.8} />
          <circle cx={6} cy={0} r={1.8} />
        </g>
      )}
    </g>
  );
}

function capsulePath(kind: "nose" | "mid" | "tail") {
  const L = -CAR_W / 2;
  const R = CAR_W / 2;
  if (kind === "nose") {
    return `M${L + 54} ${TOP} H${R - RX} A${RX} ${RX} 0 0 1 ${R} ${TOP + RX} V${BOT - RX} A${RX} ${RX} 0 0 1 ${R - RX} ${BOT} H${L + 54} C${L + 8} ${BOT} ${L} ${(TOP + BOT) / 2 + 10} ${L} ${(TOP + BOT) / 2} C${L} ${(TOP + BOT) / 2 - 10} ${L + 8} ${TOP} ${L + 54} ${TOP} Z`;
  }
  if (kind === "tail") {
    return `M${L + RX} ${TOP} H${R - 54} C${R - 8} ${TOP} ${R} ${(TOP + BOT) / 2 - 10} ${R} ${(TOP + BOT) / 2} C${R} ${(TOP + BOT) / 2 + 10} ${R - 8} ${BOT} ${R - 54} ${BOT} H${L + RX} A${RX} ${RX} 0 0 1 ${L} ${BOT - RX} V${TOP + RX} A${RX} ${RX} 0 0 1 ${L + RX} ${TOP} Z`;
  }
  return `M${L + RX} ${TOP} H${R - RX} A${RX} ${RX} 0 0 1 ${R} ${TOP + RX} V${BOT - RX} A${RX} ${RX} 0 0 1 ${R - RX} ${BOT} H${L + RX} A${RX} ${RX} 0 0 1 ${L} ${BOT - RX} V${TOP + RX} A${RX} ${RX} 0 0 1 ${L + RX} ${TOP} Z`;
}

function Car({ label, status, index }: { label: string; status: Status; index: number }) {
  const x = carX(index);
  const t = THEME[status];
  const dim = status === "pending";
  const kind = index === 0 ? "nose" : index === STAGE_LABELS.length - 1 ? "tail" : "mid";
  const body = capsulePath(kind);

  return (
    <g transform={`translate(${x} ${rail(x)}) rotate(${tilt(x).toFixed(2)})`}>
      {status === "active" && (
        <ellipse className="ts-add" cx={0} cy={TOP + CAR_H / 2} rx={250} ry={130} fill="url(#tsAura)" opacity={0.72} />
      )}
      {status === "done" && <Smoke colour="#7dffc4" x={-18} y={TOP - 6} />}
      {status === "active" && <Smoke colour="#ffd27a" x={8} y={TOP - 10} />}
      <Bogie x={-CAR_W / 2 + 58} />
      <Bogie x={CAR_W / 2 - 58} />
      <path d={body} fill={t.glass} />
      <Tube d={body} hue={t.hue} lit={t.lit} dim={dim} />
      <rect
        x={-CAR_W / 2 + 42}
        y={TOP + 10}
        width={CAR_W - 84}
        height={14}
        rx={7}
        fill="url(#tsSheen)"
        opacity={dim ? 0.12 : 0.34}
      />
      <g opacity={dim ? 0.7 : 1}>
        <Icon kind={status} hue={t.hue} lit={t.lit} />
        <text x={-52} y={6} fontSize={20} fontWeight={700} fill={dim ? "#b7c7e8" : t.lit}>
          {label}
        </text>
      </g>
      {status === "active" && <Sparks />}
    </g>
  );
}

function Coupler({ index }: { index: number }) {
  const a = carX(index) + CAR_W / 2;
  const b = carX(index + 1) - CAR_W / 2;
  const m = (a + b) / 2;
  const wd = Math.max(10, b - a);
  return (
    <g transform={`translate(${m} ${rail(m)}) rotate(${tilt(m).toFixed(2)})`}>
      <rect x={-wd / 2} y={BOT - 22} width={wd} height={6} rx={3} fill="#0b1220" stroke="#6f8ec8" strokeWidth={1.1} />
    </g>
  );
}

function GlassTrack() {
  const x0 = 18;
  const x1 = W - 18;
  return (
    <g>
      <path d={closedBand(-6, 38, x0, x1)} fill="url(#tsTrackGlow)" className="ts-add" opacity={0.85} filter="url(#tsB22)" />
      <path d={closedBand(2, 28, x0, x1)} fill="url(#tsTrackBody)" />
      <path d={closedBand(2, 12, x0, x1)} fill="url(#tsTrackTop)" opacity={0.95} />
      <path d={railPath(2, x0, x1)} fill="none" stroke="#e8fbff" strokeWidth={2.4} opacity={0.95} className="ts-add" />
      <path d={railPath(11, x0, x1)} fill="none" stroke="#7be7ff" strokeWidth={1.6} opacity={0.7} className="ts-add" />
      <path d={railPath(22, x0, x1)} fill="none" stroke="#3aa0ff" strokeWidth={2.2} opacity={0.45} />
      {Array.from({ length: 28 }, (_, i) => {
        const x = 40 + i * 58;
        const y = rail(x);
        return (
          <line
            key={x}
            x1={x}
            y1={y + 6}
            x2={x}
            y2={y + 22}
            stroke="#9ad8ff"
            strokeWidth={2.2}
            opacity={0.22}
          />
        );
      })}
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
        @media (prefers-reduced-motion: reduce) { svg animate { display: none; } }
      `}</style>
      <defs>
        <linearGradient id="tsMint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d4ffe9" stopOpacity=".42" />
          <stop offset=".45" stopColor="#12c98a" stopOpacity=".16" />
          <stop offset="1" stopColor="#04140e" stopOpacity=".72" />
        </linearGradient>
        <linearGradient id="tsGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3cf" stopOpacity=".5" />
          <stop offset=".45" stopColor="#e59a10" stopOpacity=".22" />
          <stop offset="1" stopColor="#1c0f00" stopOpacity=".7" />
        </linearGradient>
        <linearGradient id="tsDim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfeaff" stopOpacity=".18" />
          <stop offset=".45" stopColor="#7f97c8" stopOpacity=".08" />
          <stop offset="1" stopColor="#050814" stopOpacity=".72" />
        </linearGradient>
        <linearGradient id="tsSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tsTrackBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8feaff" stopOpacity=".55" />
          <stop offset=".35" stopColor="#1a4d88" stopOpacity=".7" />
          <stop offset="1" stopColor="#06101f" stopOpacity=".15" />
        </linearGradient>
        <linearGradient id="tsTrackTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4ffff" stopOpacity=".85" />
          <stop offset=".55" stopColor="#67d7ff" stopOpacity=".35" />
          <stop offset="1" stopColor="#1a6db8" stopOpacity=".05" />
        </linearGradient>
        <linearGradient id="tsTrackGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7af0ff" stopOpacity=".55" />
          <stop offset="1" stopColor="#4d7dff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="tsWheel" cx=".34" cy=".28" r=".9">
          <stop offset="0" stopColor="#5a6f90" />
          <stop offset=".5" stopColor="#141c2c" />
          <stop offset="1" stopColor="#01030a" />
        </radialGradient>
        <radialGradient id="tsPoolMint">
          <stop offset="0" stopColor="#4dffb4" stopOpacity=".8" />
          <stop offset="1" stopColor="#4dffb4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tsPoolGold">
          <stop offset="0" stopColor="#ffc247" stopOpacity=".95" />
          <stop offset="1" stopColor="#ffc247" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tsPoolDim">
          <stop offset="0" stopColor="#93a9d6" stopOpacity=".28" />
          <stop offset="1" stopColor="#93a9d6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tsAura">
          <stop offset="0" stopColor="#ffbb33" stopOpacity=".75" />
          <stop offset=".55" stopColor="#ff9500" stopOpacity=".16" />
          <stop offset="1" stopColor="#ff9500" stopOpacity="0" />
        </radialGradient>
        <filter id="tsB9" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="tsB22" x="-260%" y="-260%" width="620%" height="620%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <filter id="tsSmoke" x="-400%" y="-400%" width="900%" height="900%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      <GlassTrack />

      {STAGE_LABELS.map((_, i) => {
        const x = carX(i);
        return (
          <ellipse
            key={`pool-${i}`}
            className="ts-add"
            cx={x}
            cy={rail(x) + 8}
            rx={CAR_W * 0.52}
            ry={16}
            fill={THEME[statusFor(i, active)].pool}
            filter="url(#tsB22)"
          />
        );
      })}

      {STAGE_LABELS.map((label, i) => (
        <Fragment key={label}>
          <Car label={label} status={statusFor(i, active)} index={i} />
          {i < STAGE_LABELS.length - 1 && <Coupler index={i} />}
        </Fragment>
      ))}
    </svg>
  );
}
