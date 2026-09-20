import { Fragment } from "react";

const W = 1520;
const CREST_X = 1880;
const CREST_Y = 188;
const RADIUS = 34000;

const rail = (x: number) => CREST_Y + Math.pow(x - CREST_X, 2) / (2 * RADIUS);
const tilt = (x: number) => (Math.atan((x - CREST_X) / RADIUS) * 180) / Math.PI;

const railPoly = (dy = 0) => {
  const pts: [number, number][] = [];
  for (let x = -80; x <= W + 90; x += 14) pts.push([x, rail(x) + dy]);
  return pts;
};

const railPath = (dy = 0) => {
  const pts = railPoly(dy);
  return pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1].toFixed(1)}`).join(" ");
};

const closedBand = (topDy: number, botDy: number) => {
  const top = railPoly(topDy);
  const bot = railPoly(botDy).reverse();
  return `M${top[0][0]} ${top[0][1].toFixed(1)} ${top.slice(1).map((p) => `L${p[0]} ${p[1].toFixed(1)}`).join(" ")} ${bot.map((p) => `L${p[0]} ${p[1].toFixed(1)}`).join(" ")} Z`;
};

const CAR_W = 208;
const CAR_H = 90;
const GAP = 34;
const RX = 12;
const WR = 11;
const BOT = -16;
const TOP = BOT - CAR_H;
const LOCO_W = 162;
const START = 36;

const carX = (i: number) => START + LOCO_W + 20 + CAR_W / 2 + i * (CAR_W + GAP);

type Status = "done" | "active" | "pending";

const THEME: Record<Status, { hue: string; lit: string; glass: string; pool: string }> = {
  done: { hue: "#2fe89a", lit: "#d6ffe9", glass: "url(#tsMint)", pool: "url(#tsPoolMint)" },
  active: { hue: "#ffb42c", lit: "#fff1c9", glass: "url(#tsGold)", pool: "url(#tsPoolGold)" },
  pending: { hue: "#8ea6d6", lit: "#e4edff", glass: "url(#tsDim)", pool: "url(#tsPoolDim)" },
};

export const STAGE_LABELS = ["Ideating", "Researching", "Prototyping", "Testing", "Finalizing"];

const statusFor = (i: number, active: number): Status =>
  i < active ? "done" : i === active ? "active" : "pending";

const STARS = Array.from({ length: 86 }, (_, i) => ({
  x: (i * 173 + 31) % W,
  y: (i * 97 + 18) % 168,
  r: i % 9 === 0 ? 1.7 : i % 4 === 0 ? 1.15 : 0.7,
  o: 0.22 + (i % 8) * 0.08,
}));

function Tube({ d, hue, lit, dim, scale = 1 }: { d: string; hue: string; lit: string; dim?: boolean; scale?: number }) {
  const k = dim ? 0.4 : 1;
  return (
    <g className="ts-add">
      <path d={d} fill="none" stroke={hue} strokeWidth={20 * scale} opacity={0.2 * k} filter="url(#tsB18)" />
      <path d={d} fill="none" stroke={hue} strokeWidth={9 * scale} opacity={0.5 * k} filter="url(#tsB9)" />
      <path d={d} fill="none" stroke={hue} strokeWidth={4.2 * scale} opacity={0.95 * k} />
      <path d={d} fill="none" stroke={lit} strokeWidth={1.25 * scale} opacity={dim ? 0.45 : 0.95} />
    </g>
  );
}

function Wheel({ x, hue }: { x: number; hue: string }) {
  return (
    <g>
      <circle cx={x} cy={-WR} r={WR} fill="url(#tsWheel)" />
      <circle cx={x} cy={-WR} r={WR} fill="none" stroke={hue} strokeWidth={1.15} strokeOpacity={0.55} />
      <circle cx={x} cy={-WR} r={3} fill="#05070d" />
    </g>
  );
}

function Bogie({ x, hue }: { x: number; hue: string }) {
  return (
    <g>
      <rect x={x - 17} y={-WR - 5} width={34} height={7} rx={2} fill="#070b14" />
      <Wheel x={x - 12} hue={hue} />
      <Wheel x={x + 12} hue={hue} />
    </g>
  );
}

function Smoke({ colour, x, y }: { colour: string; x: number; y: number }) {
  return (
    <g className="ts-add" transform={`translate(${x} ${y})`} filter="url(#tsSmoke)">
      {[0, 1, 2, 3, 4].map((i) => {
        const begin = `${(i * 0.65).toFixed(2)}s`;
        return (
          <circle key={i} cx={0} cy={0} r={5} fill={colour} opacity={0}>
            <animate attributeName="cy" values="0;-40;-84;-126" dur="3.5s" begin={begin} repeatCount="indefinite" />
            <animate attributeName="cx" values="0;10;20;32" dur="3.5s" begin={begin} repeatCount="indefinite" />
            <animate attributeName="r" values="4;11;17;23" dur="3.5s" begin={begin} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;.55;.2;0" dur="3.5s" begin={begin} repeatCount="indefinite" />
          </circle>
        );
      })}
    </g>
  );
}

function Windows({ hue, lit, dim }: { hue: string; lit: string; dim: boolean }) {
  const cells = [
    [-44, TOP + 18],
    [6, TOP + 18],
    [-44, TOP + 48],
    [6, TOP + 48],
  ];
  return (
    <g>
      {cells.map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width={38} height={24} rx={3} fill={dim ? "#0b111c" : "rgba(8,14,24,.78)"} stroke={hue} strokeWidth={1.15} opacity={dim ? 0.58 : 1} />
          <line x1={x + 19} y1={y + 2} x2={x + 19} y2={y + 22} stroke={hue} strokeWidth={0.8} opacity={0.35} />
          <line x1={x + 2} y1={y + 12} x2={x + 36} y2={y + 12} stroke={hue} strokeWidth={0.8} opacity={0.35} />
          <rect x={x + 3} y={y + 3} width={12} height={7} rx={1.5} fill={lit} opacity={dim ? 0.08 : 0.22} />
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
        <ellipse className="ts-add" cx={0} cy={TOP + CAR_H / 2} rx={200} ry={110} fill="url(#tsAura)" opacity={0.5} />
      )}
      <Bogie x={-CAR_W / 2 + 50} hue={t.hue} />
      <Bogie x={CAR_W / 2 - 50} hue={t.hue} />
      <rect x={-CAR_W / 2 + 8} y={BOT - 6} width={CAR_W - 16} height={8} rx={2} fill="#070b14" opacity={0.85} />
      <path d={body} fill={t.glass} />
      <Tube d={body} hue={t.hue} lit={t.lit} dim={dim} />
      <rect x={-CAR_W / 2 + 10} y={TOP - 7} width={CAR_W - 20} height={8} rx={3} fill={t.glass} stroke={t.hue} strokeWidth={1.2} opacity={0.9} />
      <rect x={-CAR_W / 2 + 16} y={TOP + 6} width={CAR_W - 32} height={10} rx={4} fill="url(#tsSheen)" opacity={dim ? 0.16 : 0.4} />
      <line x1={0} y1={TOP + 14} x2={0} y2={BOT - 8} stroke={t.lit} strokeWidth={1} opacity={0.22} />
      <Windows hue={t.hue} lit={t.lit} dim={dim} />
      <text x={0} y={28} textAnchor="middle" fontSize={15} fontWeight={700} letterSpacing="0.3" fill={dim ? "#9aafd4" : t.lit}>
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
  const cabL = R - 60;
  const boilerTop = TOP + 12;
  const hull = `M${L + 24} ${BOT} V${boilerTop + 16} C${L + 24} ${boilerTop} ${L + 44} ${boilerTop - 8} ${L + 68} ${boilerTop - 8} H${cabL} V${TOP} H${R - 8} A8 8 0 0 1 ${R} ${TOP + 8} V${BOT} Z`;

  return (
    <g transform={`translate(${x} ${rail(x)}) rotate(${tilt(x).toFixed(2)})`}>
      {lit && <Smoke colour="#7dffc4" x={L + 54} y={boilerTop - 30} />}
      <Bogie x={L + 48} hue={t.hue} />
      <Bogie x={R - 38} hue={t.hue} />
      <polygon points={`${L + 8},${BOT} ${L - 18},${BOT + 16} ${L + 36},${BOT + 16} ${L + 42},${BOT}`} fill="#081018" stroke={t.hue} strokeWidth={1.4} />
      <path d={hull} fill={t.glass} />
      <Tube d={hull} hue={t.hue} lit={t.lit} />
      <rect x={L + 46} y={boilerTop - 36} width={16} height={32} rx={3} fill={t.glass} stroke={t.hue} strokeWidth={2.1} />
      <rect x={L + 43} y={boilerTop - 40} width={22} height={6} rx={2} fill={t.hue} opacity={0.9} />
      <circle cx={L + 30} cy={boilerTop + 22} r={10} fill="#0b1018" stroke={t.lit} strokeWidth={2} />
      <circle cx={L + 30} cy={boilerTop + 22} r={5} fill="#fff6d0" />
      <circle className="ts-add" cx={L + 30} cy={boilerTop + 22} r={15} fill="#ffd27a" opacity={0.28} filter="url(#tsB9)" />
      <rect x={cabL + 8} y={TOP + 14} width={18} height={22} rx={3} fill="#102018" stroke={t.lit} strokeWidth={1.2} />
      <rect x={cabL + 30} y={TOP + 14} width={18} height={22} rx={3} fill="#102018" stroke={t.lit} strokeWidth={1.2} />
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
      <rect x={-wd / 2} y={BOT - 20} width={wd} height={7} rx={2.5} fill="#0b1220" stroke="#6f8ec8" strokeWidth={1} opacity={0.9} />
    </g>
  );
}

function Platform() {
  return (
    <g>
      <path d={closedBand(10, 78)} fill="url(#tsPlatFront)" />
      <path d={closedBand(4, 44)} fill="url(#tsPlatTop)" />
      <path d={railPath(8)} fill="none" stroke="#c9a227" strokeWidth={3.2} opacity={0.85} />
      <path d={railPath(12)} fill="none" stroke="#f5e6a3" strokeWidth={1.1} opacity={0.55} />
      {Array.from({ length: 18 }, (_, i) => {
        const x = 40 + i * 82;
        const y = rail(x) + 18;
        return <line key={x} x1={x} y1={y} x2={x + 28} y2={y} stroke="#3d5478" strokeWidth={1.4} strokeDasharray="6 8" opacity={0.35} />;
      })}
      <path d={closedBand(44, 78)} fill="none" stroke="#1b2c4a" strokeWidth={1.2} opacity={0.7} />
    </g>
  );
}

export default function TrainScene({ activeStageIndex }: { activeStageIndex: number }) {
  const active = activeStageIndex < 0 ? -1 : Math.max(0, Math.min(STAGE_LABELS.length - 1, activeStageIndex));

  return (
    <svg
      viewBox={`0 0 ${W} 400`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Analysis pipeline. Current stage: ${active < 0 ? "idle" : STAGE_LABELS[active]}.`}
      style={{ display: "block", width: "100%", height: "100%", minHeight: 168, overflow: "visible", isolation: "isolate" }}
    >
      <style>{`
        .ts-add { mix-blend-mode: plus-lighter; }
        @supports not (mix-blend-mode: plus-lighter) { .ts-add { mix-blend-mode: screen; } }
        @media (prefers-reduced-motion: reduce) { svg animate { display: none; } }
      `}</style>
      <defs>
        <linearGradient id="tsRib" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3ec9e0" stopOpacity="0" />
          <stop offset=".2" stopColor="#43d8ec" stopOpacity=".9" />
          <stop offset=".55" stopColor="#4da6ff" stopOpacity="1" />
          <stop offset="1" stopColor="#b07bff" stopOpacity=".45" />
        </linearGradient>
        <linearGradient id="tsCore" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".05" />
          <stop offset=".4" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#dcc9ff" stopOpacity=".2" />
        </linearGradient>
        <linearGradient id="tsMint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b6ffe4" stopOpacity=".3" />
          <stop offset=".5" stopColor="#0fbb80" stopOpacity=".16" />
          <stop offset="1" stopColor="#03140e" stopOpacity=".62" />
        </linearGradient>
        <linearGradient id="tsGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff0c6" stopOpacity=".36" />
          <stop offset=".5" stopColor="#e59a10" stopOpacity=".2" />
          <stop offset="1" stopColor="#1c0f00" stopOpacity=".6" />
        </linearGradient>
        <linearGradient id="tsDim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfeaff" stopOpacity=".16" />
          <stop offset=".5" stopColor="#8fa6d8" stopOpacity=".08" />
          <stop offset="1" stopColor="#01050e" stopOpacity=".55" />
        </linearGradient>
        <linearGradient id="tsSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tsPlatTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1730" stopOpacity=".55" />
          <stop offset=".45" stopColor="#081224" stopOpacity=".92" />
          <stop offset="1" stopColor="#050a16" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="tsPlatFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#152445" />
          <stop offset="1" stopColor="#070d18" />
        </linearGradient>
        <radialGradient id="tsWheel" cx=".34" cy=".28" r=".9">
          <stop offset="0" stopColor="#4d5f7d" />
          <stop offset=".45" stopColor="#131c2c" />
          <stop offset="1" stopColor="#01030a" />
        </radialGradient>
        <radialGradient id="tsPoolMint">
          <stop offset="0" stopColor="#4dffb4" stopOpacity=".7" />
          <stop offset="1" stopColor="#4dffb4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tsPoolGold">
          <stop offset="0" stopColor="#ffc247" stopOpacity=".9" />
          <stop offset="1" stopColor="#ffc247" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tsPoolDim">
          <stop offset="0" stopColor="#93a9d6" stopOpacity=".28" />
          <stop offset="1" stopColor="#93a9d6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tsAura">
          <stop offset="0" stopColor="#ffbb33" stopOpacity=".65" />
          <stop offset=".55" stopColor="#ff9500" stopOpacity=".14" />
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

      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#e8f0ff" opacity={s.o} />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const x = 180 + i * 220;
        const y = 28 + (i % 3) * 22;
        return (
          <g key={`sp-${i}`} className="ts-add" transform={`translate(${x} ${y})`} opacity={0.45}>
            <path d="M0 -6 L1.1 -1.1 L6 0 L1.1 1.1 L0 6 L-1.1 1.1 L-6 0 L-1.1 -1.1 Z" fill="#c4b5fd" />
          </g>
        );
      })}

      <Platform />

      {Array.from({ length: 40 }, (_, i) => {
        const x = -30 + i * 40;
        const y = rail(x);
        return <line key={x} x1={x} y1={y + 2} x2={x} y2={y + 14} stroke="#6a86b8" strokeWidth={3.2} opacity={0.32} />;
      })}
      <g className="ts-add">
        <path d={railPath(0)} fill="none" stroke="url(#tsRib)" strokeWidth={8} opacity={0.3} filter="url(#tsB9)" />
        <path d={railPath(0)} fill="none" stroke="url(#tsCore)" strokeWidth={2.4} opacity={0.95} />
        <path d={railPath(15)} fill="none" stroke="url(#tsRib)" strokeWidth={8} opacity={0.24} filter="url(#tsB9)" />
        <path d={railPath(15)} fill="none" stroke="url(#tsCore)" strokeWidth={2.2} opacity={0.8} />
      </g>

      {STAGE_LABELS.map((_, i) => {
        const x = carX(i);
        return (
          <ellipse
            key={`pool-${i}`}
            className="ts-add"
            cx={x}
            cy={rail(x) + 6}
            rx={CAR_W * 0.56}
            ry={14}
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
