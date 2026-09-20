import { Fragment } from "react";

const W = 1600;
const CREST_X = 2100;
const CREST_Y = 168;
const RADIUS = 42000;

const rail = (x: number) => CREST_Y + Math.pow(x - CREST_X, 2) / (2 * RADIUS);
const tilt = (x: number) => (Math.atan((x - CREST_X) / RADIUS) * 180) / Math.PI;

const railPoly = (dy = 0, x0 = -40, x1 = W + 50) => {
  const pts: [number, number][] = [];
  for (let x = x0; x <= x1; x += 10) pts.push([x, rail(x) + dy]);
  return pts;
};

const railPath = (dy = 0, x0 = -40, x1 = W + 50) => {
  const pts = railPoly(dy, x0, x1);
  return pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1].toFixed(1)}`).join(" ");
};

const closedBand = (topDy: number, botDy: number, x0: number, x1: number) => {
  const top = railPoly(topDy, x0, x1);
  const bot = railPoly(botDy, x0, x1).reverse();
  return `M${top[0][0]} ${top[0][1].toFixed(1)} ${top
    .slice(1)
    .map((p) => `L${p[0]} ${p[1].toFixed(1)}`)
    .join(" ")} ${bot.map((p) => `L${p[0]} ${p[1].toFixed(1)}`).join(" ")} Z`;
};

const CAR_W = 214;
const CAR_H = 96;
const GAP = 28;
const RX = 9;
const WR = 12;
const BOT = -18;
const TOP = BOT - CAR_H;
const LOCO_W = 178;
const START = 48;

const carX = (i: number) => START + LOCO_W + 16 + CAR_W / 2 + i * (CAR_W + GAP);

type Status = "done" | "active" | "pending";

const THEME: Record<Status, { hue: string; lit: string; glass: string; pool: string }> = {
  done: { hue: "#3dffb0", lit: "#e7fff4", glass: "url(#tsMint)", pool: "url(#tsPoolMint)" },
  active: { hue: "#ffc44a", lit: "#fff6d2", glass: "url(#tsGold)", pool: "url(#tsPoolGold)" },
  pending: { hue: "#8ea6d6", lit: "#e4edff", glass: "url(#tsDim)", pool: "url(#tsPoolDim)" },
};

export const STAGE_LABELS = ["Ideating", "Researching", "Prototyping", "Testing", "Finalizing"];

const statusFor = (i: number, active: number): Status =>
  i < active ? "done" : i === active ? "active" : "pending";

function Tube({ d, hue, lit, dim, scale = 1 }: { d: string; hue: string; lit: string; dim?: boolean; scale?: number }) {
  const k = dim ? 0.42 : 1;
  return (
    <g className="ts-add">
      <path d={d} fill="none" stroke={hue} strokeWidth={26 * scale} opacity={0.22 * k} filter="url(#tsB18)" />
      <path d={d} fill="none" stroke={hue} strokeWidth={11 * scale} opacity={0.55 * k} filter="url(#tsB9)" />
      <path d={d} fill="none" stroke={hue} strokeWidth={4.8 * scale} opacity={k} />
      <path d={d} fill="none" stroke={lit} strokeWidth={1.4 * scale} opacity={dim ? 0.5 : 0.95} />
    </g>
  );
}

function Wheel({ x, hue }: { x: number; hue: string }) {
  return (
    <g>
      <circle cx={x} cy={-WR} r={WR} fill="url(#tsWheel)" />
      <circle cx={x} cy={-WR} r={WR} fill="none" stroke={hue} strokeWidth={1.2} strokeOpacity={0.6} />
      <circle cx={x} cy={-WR} r={3.2} fill="#05070d" />
    </g>
  );
}

function Bogie({ x, hue }: { x: number; hue: string }) {
  return (
    <g>
      <rect x={x - 18} y={-WR - 5} width={36} height={7} rx={2} fill="#070b14" />
      <Wheel x={x - 13} hue={hue} />
      <Wheel x={x + 13} hue={hue} />
    </g>
  );
}

function Smoke({ colour, x, y }: { colour: string; x: number; y: number }) {
  return (
    <g className="ts-add" transform={`translate(${x} ${y})`} filter="url(#tsSmoke)">
      {[0, 1, 2, 3, 4].map((i) => {
        const begin = `${(i * 0.6).toFixed(2)}s`;
        return (
          <circle key={i} cx={0} cy={0} r={5} fill={colour} opacity={0}>
            <animate attributeName="cy" values="0;-38;-80;-122" dur="3.4s" begin={begin} repeatCount="indefinite" />
            <animate attributeName="cx" values="0;8;18;30" dur="3.4s" begin={begin} repeatCount="indefinite" />
            <animate attributeName="r" values="4;10;16;22" dur="3.4s" begin={begin} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;.6;.22;0" dur="3.4s" begin={begin} repeatCount="indefinite" />
          </circle>
        );
      })}
    </g>
  );
}

function Windows({ hue, lit, dim }: { hue: string; lit: string; dim: boolean }) {
  const cells = [
    [-46, TOP + 20],
    [8, TOP + 20],
    [-46, TOP + 50],
    [8, TOP + 50],
  ];
  return (
    <g>
      {cells.map(([x, y], i) => (
        <g key={i}>
          <rect
            x={x}
            y={y}
            width={38}
            height={24}
            rx={2}
            fill={dim ? "#0b111c" : "rgba(6,12,22,.82)"}
            stroke={hue}
            strokeWidth={1.35}
            opacity={dim ? 0.6 : 1}
          />
          <line x1={x + 19} y1={y + 2} x2={x + 19} y2={y + 22} stroke={hue} strokeWidth={0.9} opacity={0.4} />
          <line x1={x + 2} y1={y + 12} x2={x + 36} y2={y + 12} stroke={hue} strokeWidth={0.9} opacity={0.4} />
          <rect x={x + 3} y={y + 3} width={12} height={7} rx={1} fill={lit} opacity={dim ? 0.08 : 0.28} />
        </g>
      ))}
    </g>
  );
}

function Car({ label, status, index }: { label: string; status: Status; index: number }) {
  const x = carX(index);
  const t = THEME[status];
  const dim = status === "pending";
  const body = `M${-CAR_W / 2 + RX} ${TOP} H${CAR_W / 2 - RX} A${RX} ${RX} 0 0 1 ${CAR_W / 2} ${TOP + RX} V${BOT - RX} A${RX} ${RX} 0 0 1 ${CAR_W / 2 - RX} ${BOT} H${-CAR_W / 2 + RX} A${RX} ${RX} 0 0 1 ${-CAR_W / 2} ${BOT - RX} V${TOP + RX} A${RX} ${RX} 0 0 1 ${-CAR_W / 2 + RX} ${TOP} Z`;

  return (
    <g transform={`translate(${x} ${rail(x)}) rotate(${tilt(x).toFixed(2)})`}>
      {status === "active" && (
        <ellipse className="ts-add" cx={0} cy={TOP + CAR_H / 2} rx={220} ry={120} fill="url(#tsAura)" opacity={0.58} />
      )}
      <Bogie x={-CAR_W / 2 + 52} hue={t.hue} />
      <Bogie x={CAR_W / 2 - 52} hue={t.hue} />
      <rect x={-CAR_W / 2 + 10} y={BOT - 5} width={CAR_W - 20} height={7} rx={1.5} fill="#070b14" />
      <path d={body} fill={t.glass} />
      <Tube d={body} hue={t.hue} lit={t.lit} dim={dim} />
      <rect
        x={-CAR_W / 2 + 14}
        y={TOP - 6}
        width={CAR_W - 28}
        height={7}
        rx={2}
        fill={t.glass}
        stroke={t.hue}
        strokeWidth={1.15}
      />
      <rect x={-CAR_W / 2 + 18} y={TOP + 7} width={CAR_W - 36} height={10} rx={3} fill="url(#tsSheen)" opacity={dim ? 0.14 : 0.38} />
      <line x1={0} y1={TOP + 16} x2={0} y2={BOT - 8} stroke={t.lit} strokeWidth={1} opacity={0.2} />
      <Windows hue={t.hue} lit={t.lit} dim={dim} />
      <text
        x={0}
        y={32}
        textAnchor="middle"
        fontSize={15}
        fontWeight={700}
        letterSpacing="0.4"
        fill={dim ? "#9aafd4" : t.lit}
      >
        {label}
      </text>
    </g>
  );
}

function Locomotive({ lit }: { lit: boolean }) {
  const x = START + LOCO_W / 2;
  const t = THEME.done;
  const L = -LOCO_W / 2;
  const R = LOCO_W / 2;
  const cabL = R - 64;
  const boilerTop = TOP + 18;
  const hull = `M${L + 28} ${BOT} V${boilerTop + 14} C${L + 28} ${boilerTop - 2} ${L + 50} ${boilerTop - 10} ${L + 76} ${boilerTop - 10} H${cabL} V${TOP + 2} H${R - 8} A8 8 0 0 1 ${R} ${TOP + 10} V${BOT} Z`;

  return (
    <g transform={`translate(${x} ${rail(x)}) rotate(${tilt(x).toFixed(2)})`}>
      {lit && <Smoke colour="#7dffc4" x={L + 58} y={boilerTop - 34} />}
      <Bogie x={L + 54} hue={t.hue} />
      <Bogie x={R - 40} hue={t.hue} />
      <polygon
        points={`${L + 12},${BOT} ${L - 22},${BOT + 18} ${L + 40},${BOT + 18} ${L + 48},${BOT}`}
        fill="#081018"
        stroke={t.hue}
        strokeWidth={1.5}
      />
      <path d={hull} fill={t.glass} />
      <Tube d={hull} hue={t.hue} lit={t.lit} />
      <rect x={L + 50} y={boilerTop - 40} width={18} height={34} rx={3} fill={t.glass} stroke={t.hue} strokeWidth={2.2} />
      <rect x={L + 46} y={boilerTop - 44} width={26} height={7} rx={2} fill={t.hue} />
      <circle cx={L + 32} cy={boilerTop + 20} r={11} fill="#0b1018" stroke={t.lit} strokeWidth={2.1} />
      <circle cx={L + 32} cy={boilerTop + 20} r={5.5} fill="#fff6d0" />
      <circle className="ts-add" cx={L + 32} cy={boilerTop + 20} r={16} fill="#ffd27a" opacity={0.32} filter="url(#tsB9)" />
      <rect x={cabL + 10} y={TOP + 16} width={18} height={24} rx={2.5} fill="#102018" stroke={t.lit} strokeWidth={1.25} />
      <rect x={cabL + 32} y={TOP + 16} width={18} height={24} rx={2.5} fill="#102018" stroke={t.lit} strokeWidth={1.25} />
    </g>
  );
}

function Coupler({ index }: { index: number }) {
  const a = carX(index) + CAR_W / 2;
  const b = carX(index + 1) - CAR_W / 2;
  const m = (a + b) / 2;
  const wd = b - a;
  return (
    <g transform={`translate(${m} ${rail(m)}) rotate(${tilt(m).toFixed(2)})`}>
      <rect x={-wd / 2} y={BOT - 18} width={wd} height={6} rx={2} fill="#0b1220" stroke="#6f8ec8" strokeWidth={1.1} />
    </g>
  );
}

function Platform() {
  const x0 = START - 36;
  const x1 = carX(4) + CAR_W / 2 + 56;
  const L0: [number, number] = [x0, rail(x0) + 6];
  const L1: [number, number] = [x0, rail(x0) + 44];
  const L2: [number, number] = [x0, rail(x0) + 96];
  const R0: [number, number] = [x1, rail(x1) + 6];
  const R1: [number, number] = [x1, rail(x1) + 44];
  const R2: [number, number] = [x1, rail(x1) + 96];

  return (
    <g>
      <path d={closedBand(44, 96, x0, x1)} fill="url(#tsPlatFront)" />
      <path d={`M${L1[0]} ${L1[1]} L${L2[0]} ${L2[1]} L${L0[0] - 18} ${L2[1]} L${L0[0] - 10} ${L0[1]} Z`} fill="#0a1428" opacity={0.85} />
      <path d={`M${R1[0]} ${R1[1]} L${R2[0]} ${R2[1]} L${R0[0] + 18} ${R2[1]} L${R0[0] + 10} ${R0[1]} Z`} fill="#071020" opacity={0.7} />
      <path d={closedBand(6, 44, x0, x1)} fill="url(#tsPlatTop)" />
      <path d={`M${L0[0]} ${L0[1]} L${R0[0]} ${R0[1]} L${R0[0] + 10} ${R0[1] - 14} L${L0[0] - 10} ${L0[1] - 14} Z`} fill="url(#tsPlatBack)" opacity={0.55} />
      <path d={railPath(44, x0, x1)} fill="none" stroke="#e2c04a" strokeWidth={5} />
      <path d={railPath(44, x0, x1)} fill="none" stroke="#fff4c2" strokeWidth={1.6} opacity={0.8} />
      {Array.from({ length: 22 }, (_, i) => {
        const x = x0 + 24 + i * 64;
        if (x > x1 - 20) return null;
        const y = rail(x) + 18;
        return (
          <line
            key={x}
            x1={x}
            y1={y}
            x2={x + 22}
            y2={y}
            stroke="#4a628c"
            strokeWidth={1.6}
            strokeDasharray="5 7"
            opacity={0.45}
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
      viewBox={`0 0 ${W} 330`}
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
        <linearGradient id="tsRib" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3ec9e0" stopOpacity="0" />
          <stop offset=".18" stopColor="#43d8ec" stopOpacity=".95" />
          <stop offset=".55" stopColor="#4da6ff" stopOpacity="1" />
          <stop offset="1" stopColor="#b07bff" stopOpacity=".4" />
        </linearGradient>
        <linearGradient id="tsCore" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".05" />
          <stop offset=".45" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#dcc9ff" stopOpacity=".2" />
        </linearGradient>
        <linearGradient id="tsMint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c8ffe9" stopOpacity=".34" />
          <stop offset=".5" stopColor="#12c98a" stopOpacity=".16" />
          <stop offset="1" stopColor="#03140e" stopOpacity=".5" />
        </linearGradient>
        <linearGradient id="tsGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3cf" stopOpacity=".38" />
          <stop offset=".5" stopColor="#e59a10" stopOpacity=".2" />
          <stop offset="1" stopColor="#1c0f00" stopOpacity=".5" />
        </linearGradient>
        <linearGradient id="tsDim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfeaff" stopOpacity=".16" />
          <stop offset=".5" stopColor="#8fa6d8" stopOpacity=".08" />
          <stop offset="1" stopColor="#01050e" stopOpacity=".45" />
        </linearGradient>
        <linearGradient id="tsSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tsPlatTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#163056" />
          <stop offset=".4" stopColor="#0c1a32" />
          <stop offset="1" stopColor="#081224" />
        </linearGradient>
        <linearGradient id="tsPlatFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b335c" />
          <stop offset=".55" stopColor="#0d172c" />
          <stop offset="1" stopColor="#050914" stopOpacity=".35" />
        </linearGradient>
        <linearGradient id="tsPlatBack" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#0c1a32" />
          <stop offset="1" stopColor="#152848" />
        </linearGradient>
        <radialGradient id="tsWheel" cx=".34" cy=".28" r=".9">
          <stop offset="0" stopColor="#4d5f7d" />
          <stop offset=".45" stopColor="#131c2c" />
          <stop offset="1" stopColor="#01030a" />
        </radialGradient>
        <radialGradient id="tsPoolMint">
          <stop offset="0" stopColor="#4dffb4" stopOpacity=".75" />
          <stop offset="1" stopColor="#4dffb4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tsPoolGold">
          <stop offset="0" stopColor="#ffc247" stopOpacity=".92" />
          <stop offset="1" stopColor="#ffc247" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tsPoolDim">
          <stop offset="0" stopColor="#93a9d6" stopOpacity=".28" />
          <stop offset="1" stopColor="#93a9d6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tsAura">
          <stop offset="0" stopColor="#ffbb33" stopOpacity=".7" />
          <stop offset=".55" stopColor="#ff9500" stopOpacity=".16" />
          <stop offset="1" stopColor="#ff9500" stopOpacity="0" />
        </radialGradient>
        <filter id="tsB9" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="tsB18" x="-260%" y="-260%" width="620%" height="620%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id="tsSmoke" x="-400%" y="-400%" width="900%" height="900%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <Platform />

      {Array.from({ length: 36 }, (_, i) => {
        const x = START - 20 + i * 42;
        if (x > carX(4) + CAR_W / 2 + 40) return null;
        const y = rail(x);
        return <line key={x} x1={x} y1={y + 1} x2={x} y2={y + 15} stroke="#7a96c8" strokeWidth={3.4} opacity={0.45} />;
      })}
      <g className="ts-add">
        <path d={railPath(0, START - 28, carX(4) + CAR_W / 2 + 48)} fill="none" stroke="url(#tsRib)" strokeWidth={10} opacity={0.38} filter="url(#tsB9)" />
        <path d={railPath(0, START - 28, carX(4) + CAR_W / 2 + 48)} fill="none" stroke="url(#tsCore)" strokeWidth={2.8} opacity={1} />
        <path d={railPath(16, START - 28, carX(4) + CAR_W / 2 + 48)} fill="none" stroke="url(#tsRib)" strokeWidth={9} opacity={0.3} filter="url(#tsB9)" />
        <path d={railPath(16, START - 28, carX(4) + CAR_W / 2 + 48)} fill="none" stroke="url(#tsCore)" strokeWidth={2.4} opacity={0.9} />
      </g>

      {STAGE_LABELS.map((_, i) => {
        const x = carX(i);
        return (
          <ellipse
            key={`pool-${i}`}
            className="ts-add"
            cx={x}
            cy={rail(x) + 7}
            rx={CAR_W * 0.58}
            ry={15}
            fill={THEME[statusFor(i, active)].pool}
            filter="url(#tsB18)"
          />
        );
      })}

      <Locomotive lit={active >= 0} />
      {STAGE_LABELS.map((label, i) => (
        <Fragment key={label}>
          <Car label={label} status={statusFor(i, active)} index={i} />
          {i < STAGE_LABELS.length - 1 && <Coupler index={i} />}
        </Fragment>
      ))}
    </svg>
  );
}
