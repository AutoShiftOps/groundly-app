import { Fragment } from "react";

const W = 1680;
const H = 400;
const CREST_X = 840;
const CREST_Y = 250;
const RADIUS = 11000;

const rail = (x: number) => CREST_Y + Math.pow(x - CREST_X, 2) / (2 * RADIUS);
const tilt = (x: number) => (Math.atan((x - CREST_X) / RADIUS) * 180) / Math.PI;

const railPoly = (dy = 0, x0 = 20, x1 = W - 20) => {
  const pts: [number, number][] = [];
  for (let x = x0; x <= x1; x += 8) pts.push([x, rail(x) + dy]);
  return pts;
};

const railPath = (dy = 0, x0 = 20, x1 = W - 20) =>
  railPoly(dy, x0, x1)
    .map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");

const closedBand = (topDy: number, botDy: number, x0 = 20, x1 = W - 20) => {
  const top = railPoly(topDy, x0, x1);
  const bot = railPoly(botDy, x0, x1).reverse();
  return `M${top[0][0].toFixed(1)} ${top[0][1].toFixed(1)} ${top
    .slice(1)
    .map((p) => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ")} ${bot.map((p) => `L${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ")} Z`;
};

const CAR_W = 228;
const GAP = 22;
const START = 78;
const WR = 8;

const carX = (i: number) => START + CAR_W / 2 + i * (CAR_W + GAP);

type Status = "done" | "active" | "pending";

const THEME: Record<Status, { hue: string; lit: string; fill: string; pool: string }> = {
  done: { hue: "#3dffc0", lit: "#f0fff8", fill: "url(#podMint)", pool: "url(#poolMint)" },
  active: { hue: "#ffc44a", lit: "#fff6d2", fill: "url(#podGold)", pool: "url(#poolGold)" },
  pending: { hue: "#4cc4ff", lit: "#e2f4ff", fill: "url(#podBlue)", pool: "url(#poolBlue)" },
};

export const STAGE_LABELS = ["Ideating", "Researching", "Prototyping", "Testing", "Finalizing"];

const statusFor = (i: number, active: number): Status =>
  i < active ? "done" : i === active ? "active" : "pending";

function GlowStroke({ d, hue, lit, dim }: { d: string; hue: string; lit: string; dim?: boolean }) {
  const k = dim ? 0.45 : 1;
  return (
    <g className="ts-add">
      <path d={d} fill="none" stroke={hue} strokeWidth={24} opacity={0.2 * k} filter="url(#tsB18)" />
      <path d={d} fill="none" stroke={hue} strokeWidth={10} opacity={0.5 * k} filter="url(#tsB8)" />
      <path d={d} fill="none" stroke={hue} strokeWidth={3.6} opacity={k} />
      <path d={d} fill="none" stroke={lit} strokeWidth={1.2} opacity={dim ? 0.4 : 0.9} />
    </g>
  );
}

function Smoke({ colour }: { colour: string }) {
  return (
    <g className="ts-add" transform="translate(8 -52)" filter="url(#tsSmoke)">
      {[0, 1, 2, 3].map((i) => {
        const begin = `${(i * 0.7).toFixed(2)}s`;
        return (
          <ellipse key={i} cx={0} cy={0} rx={8} ry={6} fill={colour} opacity={0}>
            <animate attributeName="cy" values="0;-32;-70;-110" dur="3.8s" begin={begin} repeatCount="indefinite" />
            <animate attributeName="cx" values="0;8;18;30" dur="3.8s" begin={begin} repeatCount="indefinite" />
            <animate attributeName="rx" values="6;12;18;24" dur="3.8s" begin={begin} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;.5;.18;0" dur="3.8s" begin={begin} repeatCount="indefinite" />
          </ellipse>
        );
      })}
    </g>
  );
}

function FaceIcon({ kind, hue, lit }: { kind: Status; hue: string; lit: string }) {
  return (
    <g transform="translate(-62 0)">
      <circle r={15} fill="rgba(4,10,18,.55)" stroke={hue} strokeWidth={1.7} />
      {kind === "done" && (
        <path d="M-6.5 .5 L-2 6 L7.5 -7" fill="none" stroke={lit} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {kind === "active" && (
        <g fill="none" stroke={lit} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M-5 -7 H5 L3 7 H-3 Z" />
          <path d="M-2 1 H2" />
        </g>
      )}
      {kind === "pending" && (
        <g fill={lit}>
          <circle cx={-5.5} r={1.7} />
          <circle r={1.7} />
          <circle cx={5.5} r={1.7} />
        </g>
      )}
    </g>
  );
}

function Cylinder({ status, index, label }: { status: Status; index: number; label: string }) {
  const x = carX(index);
  const t = THEME[status];
  const dim = status === "pending";
  const frontX = -CAR_W / 2 + 28;
  const backX = CAR_W / 2 - 22;
  const fRx = 18;
  const fRy = 38;
  const bRx = 13;
  const bRy = 30;
  const body = `M${frontX} ${-fRy} L${backX} ${-bRy} A${bRx} ${bRy} 0 0 1 ${backX} ${bRy} L${frontX} ${fRy} A${fRx} ${fRy} 0 0 1 ${frontX} ${-fRy} Z`;

  return (
    <g transform={`translate(${x} ${rail(x) - 18}) rotate(${tilt(x).toFixed(2)})`}>
      {status === "active" && (
        <ellipse className="ts-add" cx={10} cy={-8} rx={170} ry={95} fill="url(#auraGold)" opacity={0.7} />
      )}
      {(status === "done" || status === "active") && <Smoke colour={status === "active" ? "#ffd27a" : "#7dffc4"} />}
      <g>
        <circle cx={-36} cy={fRy + 6} r={WR} fill="url(#tsWheel)" />
        <circle cx={-18} cy={fRy + 6} r={WR} fill="url(#tsWheel)" />
        <circle cx={42} cy={bRy + 10} r={WR - 1} fill="url(#tsWheel)" />
        <circle cx={60} cy={bRy + 10} r={WR - 1} fill="url(#tsWheel)" />
      </g>
      <ellipse cx={backX} cy={0} rx={bRx} ry={bRy} fill="#061018" stroke={t.hue} strokeWidth={1.4} opacity={0.85} />
      <path d={body} fill={t.fill} />
      <GlowStroke d={body} hue={t.hue} lit={t.lit} dim={dim} />
      <ellipse cx={frontX} cy={0} rx={fRx} ry={fRy} fill="url(#podFace)" stroke={t.hue} strokeWidth={2.4} />
      <ellipse cx={frontX - 4} cy={-10} rx={7} ry={12} fill={t.lit} opacity={dim ? 0.08 : 0.22} className="ts-add" />
      <rect x={-18} y={-28} width={96} height={10} rx={5} fill="url(#podSheen)" opacity={dim ? 0.12 : 0.4} />
      <g opacity={dim ? 0.75 : 1}>
        <FaceIcon kind={status} hue={t.hue} lit={t.lit} />
        <text x={-40} y={6} fontSize={18} fontWeight={700} fill={dim ? "#c5d6f0" : t.lit}>
          {label}
        </text>
      </g>
    </g>
  );
}

function GlassTrack() {
  return (
    <g>
      <path d={closedBand(-4, 26)} fill="url(#trackGlow)" className="ts-add" opacity={0.7} filter="url(#tsB18)" />
      <path d={closedBand(0, 20)} fill="url(#trackBody)" />
      <path d={closedBand(0, 8)} fill="url(#trackTop)" />
      <g className="ts-add">
        <path d={railPath(1)} fill="none" stroke="#f3ffff" strokeWidth={2.2} opacity={0.95} />
        <path d={railPath(11)} fill="none" stroke="#7be7ff" strokeWidth={1.8} opacity={0.75} />
      </g>
      {Array.from({ length: 26 }, (_, i) => {
        const x = 50 + i * 62;
        const y = rail(x);
        return <line key={x} x1={x} y1={y + 3} x2={x} y2={y + 16} stroke="#9ad8ff" strokeWidth={2} opacity={0.28} />;
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
      style={{ display: "block", height: "100%", width: "auto", minWidth: 1100, overflow: "visible" }}
    >
      <style>{`
        .ts-add { mix-blend-mode: plus-lighter; }
        @supports not (mix-blend-mode: plus-lighter) { .ts-add { mix-blend-mode: screen; } }
        @media (prefers-reduced-motion: reduce) { svg animate { display: none; } }
      `}</style>
      <defs>
        <linearGradient id="podMint" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b8ffe4" stopOpacity=".5" />
          <stop offset=".45" stopColor="#12c98a" stopOpacity=".18" />
          <stop offset="1" stopColor="#03241a" stopOpacity=".8" />
        </linearGradient>
        <linearGradient id="podGold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffe7a3" stopOpacity=".55" />
          <stop offset=".45" stopColor="#e59a10" stopOpacity=".22" />
          <stop offset="1" stopColor="#1c0f00" stopOpacity=".82" />
        </linearGradient>
        <linearGradient id="podBlue" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b9e8ff" stopOpacity=".4" />
          <stop offset=".45" stopColor="#2a8fff" stopOpacity=".16" />
          <stop offset="1" stopColor="#04101f" stopOpacity=".82" />
        </linearGradient>
        <radialGradient id="podFace" cx=".3" cy=".32" r="1">
          <stop offset="0" stopColor="#e7fff8" stopOpacity=".3" />
          <stop offset=".45" stopColor="#0a1a22" stopOpacity=".55" />
          <stop offset="1" stopColor="#02060c" stopOpacity=".92" />
        </radialGradient>
        <linearGradient id="podSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trackBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8feaff" stopOpacity=".5" />
          <stop offset=".4" stopColor="#1a4d88" stopOpacity=".65" />
          <stop offset="1" stopColor="#06101f" stopOpacity=".1" />
        </linearGradient>
        <linearGradient id="trackTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4ffff" stopOpacity=".9" />
          <stop offset="1" stopColor="#67d7ff" stopOpacity=".15" />
        </linearGradient>
        <linearGradient id="trackGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7af0ff" stopOpacity=".55" />
          <stop offset="1" stopColor="#4d7dff" stopOpacity="0" />
        </linearGradient>
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
          <stop offset="0" stopColor="#ffbb33" stopOpacity=".75" />
          <stop offset="1" stopColor="#ffbb33" stopOpacity="0" />
        </radialGradient>
        <filter id="tsB8" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id="tsB18" x="-260%" y="-260%" width="620%" height="620%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <filter id="tsSmoke" x="-400%" y="-400%" width="900%" height="900%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      <GlassTrack />

      {STAGE_LABELS.map((label, i) => (
        <Fragment key={label}>
          <ellipse
            className="ts-add"
            cx={carX(i)}
            cy={rail(carX(i)) + 8}
            rx={90}
            ry={14}
            fill={THEME[statusFor(i, active)].pool}
            filter="url(#tsB18)"
          />
          <Cylinder status={statusFor(i, active)} index={i} label={label} />
        </Fragment>
      ))}
    </svg>
  );
}
