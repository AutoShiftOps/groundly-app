// frontend/src/components/TrainScene.tsx
//
// The pipeline train, rendered as one SVG so the rail, wheels, bodies and
// couplers all live in a single coordinate space. Every element is placed by
// evaluating rail(x) — the wheels sit on the line by construction, at any width.
//
// Driven entirely by `activeStageIndex`, so it advances with the real analysis.
// No imperative DOM building, no useEffect, no browser storage.

import { Fragment } from "react";

/* ── geometry ──────────────────────────────────────────────────────────── */
const W = 1520;
const CREST_X = 1720;      // crest sits off-canvas, so the train climbs then levels
const CREST_Y = 250;
const RADIUS = 24000;

const rail = (x: number) => CREST_Y + Math.pow(x - CREST_X, 2) / (2 * RADIUS);
const tilt = (x: number) => (Math.atan((x - CREST_X) / RADIUS) * 180) / Math.PI;

const railPath = (dy = 0) => {
  let d = "";
  for (let x = -50; x <= W + 70; x += 20) d += (d ? "L" : "M") + x + " " + (rail(x) + dy).toFixed(1);
  return d;
};

const CAR_W = 246;
const CAR_H = 92;
const GAP = 26;
const RX = 28;
const WR = 12;                       // wheel radius; centre sits WR above the rail
const BOT = -16;                     // body bottom — wheels tuck up into it
const TOP = BOT - CAR_H;
const MID = BOT - CAR_H / 2;
const LOCO = 84;
const START = 18;

const carX = (i: number) => START + LOCO + CAR_W / 2 + i * (CAR_W + GAP);

/* ── theme ─────────────────────────────────────────────────────────────── */
type Status = "done" | "active" | "pending";

const THEME: Record<Status, { hue: string; lit: string; glass: string; pool: string; smoke: string | null }> = {
  done:    { hue: "#2fe89a", lit: "#d3ffee", glass: "url(#tsMint)", pool: "url(#tsPoolMint)", smoke: "#7dffc4" },
  active:  { hue: "#ffb42c", lit: "#fff3d6", glass: "url(#tsGold)", pool: "url(#tsPoolGold)", smoke: "#ffd79a" },
  pending: { hue: "#8ea6d6", lit: "#e8f0ff", glass: "url(#tsDim)",  pool: "url(#tsPoolDim)",  smoke: null },
};

export const STAGE_LABELS = ["Ideating", "Researching", "Prototyping", "Testing", "Finalizing"];

const statusFor = (i: number, active: number): Status =>
  i < active ? "done" : i === active ? "active" : "pending";

/* ── shapes ────────────────────────────────────────────────────────────── */
const roundedBody = (w: number, h: number, r: number, y: number) => {
  const x0 = -w / 2;
  return `M${x0 + r} ${y} H${x0 + w - r} A${r} ${r} 0 0 1 ${x0 + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x0 + w - r} ${y + h} H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x0 + r} ${y} Z`;
};

// tail car: rounded shoulder left, flat roof, aerodynamic sweep down on the right
const tailBody = (w: number, h: number, y: number, inset = 0) => {
  const L = -w / 2 + inset, R = w / 2 - inset, TY = y + inset, BY = y + h - inset;
  return `M${L} ${BY} V${TY + 46} A46 46 0 0 1 ${L + 46} ${TY} H${R - 74} C${R - 26} ${TY} ${R} ${TY + 30} ${R} ${TY + 62} V${BY} Z`;
};

/* ── neon tube: colour halo → tight colour → white-hot core ────────────── */
function Tube({ d, hue, lit, dim, scale = 1 }: { d: string; hue: string; lit: string; dim?: boolean; scale?: number }) {
  const k = dim ? 0.34 : 1;
  return (
    <g className="ts-add">
      <path d={d} fill="none" stroke={hue} strokeWidth={30 * scale} opacity={0.26 * k} filter="url(#tsB18)" />
      <path d={d} fill="none" stroke={hue} strokeWidth={14 * scale} opacity={0.5 * k} filter="url(#tsB9)" />
      <path d={d} fill="none" stroke={hue} strokeWidth={6.5 * scale} opacity={0.9 * k} filter="url(#tsB4)" />
      <path d={d} fill="none" stroke={hue} strokeWidth={3.6 * scale} opacity={k} />
      <path d={d} fill="none" stroke={lit} strokeWidth={1.4 * scale} opacity={dim ? 0.5 : 0.95} />
    </g>
  );
}

function Wheel({ x, hue }: { x: number; hue: string }) {
  return (
    <g>
      <circle cx={x} cy={-WR} r={WR} fill="url(#tsWheel)" />
      <circle cx={x} cy={-WR} r={WR} fill="none" stroke={hue} strokeWidth={1.3} strokeOpacity={0.5} />
      <circle cx={x - 3.6} cy={-WR - 3.6} r={3} fill="#c9d9f2" opacity={0.32} />
      <circle cx={x} cy={-WR} r={3} fill="#000" opacity={0.55} />
    </g>
  );
}

function Bogie({ x, hue }: { x: number; hue: string }) {
  return (
    <g>
      <rect x={x - 15} y={-WR - 3} width={30} height={6} rx={3} fill="#04080f" opacity={0.9} />
      <Wheel x={x - 13} hue={hue} />
      <Wheel x={x + 13} hue={hue} />
    </g>
  );
}

function Smoke({ colour, x }: { colour: string; x: number }) {
  return (
    <g className="ts-add" transform={`translate(${x} ${TOP + 4})`} filter="url(#tsSmoke)">
      {[0, 1, 2, 3].map((i) => {
        const begin = `${(i * 1.2).toFixed(2)}s`;
        const dur = "4.8s";
        return (
          <circle key={i} cx={0} cy={0} r={4} fill={colour} opacity={0}>
            <animate attributeName="cy" values="0;-58;-116;-168" dur={dur} begin={begin} repeatCount="indefinite" />
            <animate attributeName="cx" values="0;7;17;30" dur={dur} begin={begin} repeatCount="indefinite" />
            <animate attributeName="r" values="3;9;16;25" dur={dur} begin={begin} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;.5;.24;0" dur={dur} begin={begin} repeatCount="indefinite" />
          </circle>
        );
      })}
    </g>
  );
}

function StageIcon({ status, lit }: { status: Status; lit: string }) {
  if (status === "done")
    return (
      <g className="ts-add" stroke={lit} fill="none" strokeWidth={3.1} strokeLinecap="round" strokeLinejoin="round">
        <path d="M-6.6 .4 L-1.8 5.2 L7 -4.8" />
      </g>
    );
  if (status === "active")
    return (
      <g className="ts-add" stroke={lit} fill="none" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        <path d="M-3.5 -7.8 h7 M-3.5 -7.8 v6.1 L-7 5.2 a2 2 0 0 0 1.7 3 h10.6 A2 2 0 0 0 7 5.2 L3.5 -1.7 V-7.8" />
        <path d="M-4.4 3.9 h8.8" />
      </g>
    );
  return (
    <g className="ts-add" fill={lit}>
      {[-6, 0, 6].map((dx) => <circle key={dx} cx={dx} cy={0} r={1.8} />)}
    </g>
  );
}

/* ── a single carriage ─────────────────────────────────────────────────── */
function Car({ label, status, index }: { label: string; status: Status; index: number }) {
  const x = carX(index);
  const t = THEME[status];
  const dim = status === "pending";
  const outer = dim ? tailBody(CAR_W, CAR_H, TOP) : roundedBody(CAR_W, CAR_H, RX, TOP);
  const inner = dim ? tailBody(CAR_W, CAR_H, TOP, 9) : roundedBody(CAR_W - 18, CAR_H - 18, RX - 9, TOP + 9);
  const bx = -CAR_W / 2 + 46;

  return (
    <g transform={`translate(${x} ${rail(x)}) rotate(${tilt(x).toFixed(2)})`}>
      {status === "active" && (
        <>
          <ellipse className="ts-add" cx={0} cy={MID} rx={250} ry={155} fill="url(#tsAura)" opacity={0.5} />
          <g className="ts-add" fill="none" stroke="#ffb42c">
            {[96, 132, 168].map((r) => <circle key={r} cx={0} cy={MID} r={r} strokeWidth={1} opacity={0.22} />)}
            <circle cx={0} cy={MID} r={96} strokeWidth={1.4} opacity={0.5}>
              <animate attributeName="r" values="96;185" dur="3.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values=".5;0" dur="3.4s" repeatCount="indefinite" />
            </circle>
          </g>
          <rect className="ts-add" x={-360} y={MID - 2} width={720} height={4} fill="url(#tsFlare)" filter="url(#tsB4)" opacity={0.5}>
            <animate attributeName="opacity" values=".28;.75;.28" dur="2.6s" repeatCount="indefinite" />
          </rect>
        </>
      )}

      {t.smoke && <Smoke colour={t.smoke} x={-CAR_W / 4} />}

      {/* wheels first, so the body's bottom neon edge crosses in front of them */}
      <Bogie x={-CAR_W / 2 + 54} hue={t.hue} />
      <Bogie x={CAR_W / 2 - 54} hue={t.hue} />

      <path d={outer} fill={t.glass} />
      <path d={outer} fill="none" stroke={t.hue} strokeWidth={15} opacity={dim ? 0.07 : 0.18} filter="url(#tsB9)" />
      <Tube d={outer} hue={t.hue} lit={t.lit} dim={dim} />
      <path d={inner} fill="none" stroke={t.lit} strokeWidth={1.1} opacity={dim ? 0.3 : 0.42} />
      <rect x={-CAR_W / 2 + 20} y={TOP + 8} width={CAR_W - 40} height={15} rx={7.5} fill="url(#tsSheen)" opacity={dim ? 0.3 : 0.55} />

      {dim && (
        <path
          d={`M${CAR_W / 2 - 58} ${TOP + 6} C${CAR_W / 2 - 54} ${TOP + 34} ${CAR_W / 2 - 54} ${BOT - 22} ${CAR_W / 2 - 58} ${BOT}`}
          fill="none" stroke={t.lit} strokeWidth={1} opacity={0.3}
        />
      )}

      <circle cx={bx} cy={MID} r={18.5} fill="rgba(0,4,10,.4)" />
      {dim ? (
        <circle className="ts-add" cx={bx} cy={MID} r={18.5} fill="none" stroke={t.lit}
                strokeWidth={1.6} strokeDasharray="2 5" strokeLinecap="round" opacity={0.75} />
      ) : (
        <Tube d={`M${bx} ${MID - 18.5} A18.5 18.5 0 1 1 ${bx - 0.01} ${MID - 18.5} Z`} hue={t.hue} lit={t.lit} scale={0.62} />
      )}
      <g transform={`translate(${bx} ${MID})`}><StageIcon status={status} lit={t.lit} /></g>

      <text x={bx + 32} y={MID} dominantBaseline="central" fontSize={21} fontWeight={650}
            letterSpacing="-.3" fill={dim ? "#dbe6fb" : "#fff"}>
        {label}
      </text>
    </g>
  );
}

/* ── locomotive: wedge nose, right edge flush against car 1 ────────────── */
function Locomotive() {
  const x = START + LOCO / 2;
  const t = THEME.done;
  const h = CAR_H - 4;
  const top = BOT - h;
  const L = -LOCO / 2;
  const R = LOCO / 2;
  const shell = (o: number) =>
    `M${R} ${BOT - o} V${top + o} H${L + 34 + o} C${L + 13 + o} ${top + o} ${L + o} ${top + 26 + o} ${L + o} ${BOT - o} Z`;

  return (
    <g transform={`translate(${x} ${rail(x)}) rotate(${tilt(x).toFixed(2)})`}>
      <Bogie x={-20} hue={t.hue} />
      <Bogie x={22} hue={t.hue} />
      <path d={shell(0)} fill={t.glass} />
      <path d={shell(0)} fill="none" stroke={t.hue} strokeWidth={14} opacity={0.26} filter="url(#tsB9)" />
      <Tube d={shell(0)} hue={t.hue} lit={t.lit} />
      {/* nose ribs, generated from the same sweep so they stay parallel */}
      {[7, 14, 21].map((o, k) => (
        <path key={o} fill="none" stroke={t.lit} strokeWidth={1} opacity={0.38 - k * 0.1}
              d={`M${L + 34 + o} ${top + o} C${L + 13 + o} ${top + o} ${L + o} ${top + 26 + o} ${L + o} ${BOT - o}`} />
      ))}
      <g className="ts-add">
        <ellipse cx={L + 9} cy={BOT - 14} rx={15} ry={9} fill="#ffb0a0" opacity={0.28} filter="url(#tsB9)" />
        <circle cx={L + 9} cy={BOT - 14} r={2.6} fill="#ff8a7a" opacity={0.95} />
      </g>
    </g>
  );
}

function Coupler({ index, nextStatus }: { index: number; nextStatus: Status }) {
  const a = carX(index) + CAR_W / 2;
  const b = carX(index + 1) - CAR_W / 2;
  const m = (a + b) / 2;
  const wd = b - a;
  const t = THEME[nextStatus === "pending" ? "active" : nextStatus];
  const hot = nextStatus === "active" || nextStatus === "pending";

  return (
    <g transform={`translate(${m} ${rail(m)}) rotate(${tilt(m).toFixed(2)})`}>
      <Tube d={`M${-wd / 2} ${MID} H${wd / 2}`} hue={t.hue} lit={t.lit} scale={0.5} />
      <rect className="ts-add" x={-5} y={MID - 5} width={10} height={10} rx={2.5} fill="#060c17" stroke={t.hue} strokeWidth={1.2} />
      {hot &&
        [0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
          const begin = `${(k * 0.38).toFixed(2)}s`;
          return (
            <circle key={k} className="ts-add" cx={-wd / 2} cy={MID + ((k % 3) - 1) * 7}
                    r={(k % 3) * 0.8 + 1.4} fill="#fff3d4" opacity={0}>
              <animate attributeName="cx" values={`${-wd / 2};${wd / 2 + 30}`} dur="1.8s" begin={begin} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;1;0" dur="1.8s" begin={begin} repeatCount="indefinite" />
            </circle>
          );
        })}
    </g>
  );
}

/* ── scene ─────────────────────────────────────────────────────────────── */
export default function TrainScene({ activeStageIndex }: { activeStageIndex: number }) {
  const active = Math.max(0, Math.min(STAGE_LABELS.length - 1, activeStageIndex));

  return (
    <svg
      viewBox={`0 0 ${W} 330`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Analysis pipeline. Current stage: ${STAGE_LABELS[active]}.`}
      style={{ display: "block", width: "100%", height: "100%", minHeight: 120, overflow: "visible", isolation: "isolate" }}
    >
      <style>{`
        .ts-add { mix-blend-mode: plus-lighter; }
        @supports not (mix-blend-mode: plus-lighter) { .ts-add { mix-blend-mode: screen; } }
        @media (prefers-reduced-motion: reduce) { svg animate { display: none; } }
      `}</style>

      <defs>
        <linearGradient id="tsRib" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3ec9e0" stopOpacity="0" />
          <stop offset=".14" stopColor="#43d8ec" stopOpacity=".9" />
          <stop offset=".48" stopColor="#4da6ff" stopOpacity="1" />
          <stop offset=".8" stopColor="#8f7bff" stopOpacity="1" />
          <stop offset="1" stopColor="#b07bff" stopOpacity=".55" />
        </linearGradient>
        <linearGradient id="tsCore" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".05" />
          <stop offset=".34" stopColor="#fff" stopOpacity="1" />
          <stop offset=".8" stopColor="#eef4ff" stopOpacity=".95" />
          <stop offset="1" stopColor="#dcc9ff" stopOpacity=".25" />
        </linearGradient>
        <linearGradient id="tsGround" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f9dff" stopOpacity=".4" />
          <stop offset="1" stopColor="#4f9dff" stopOpacity="0" />
        </linearGradient>

        {/* glass shells stay genuinely translucent — the rail reads through them */}
        <linearGradient id="tsMint" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a6ffdd" stopOpacity=".22" />
          <stop offset=".45" stopColor="#0fbb80" stopOpacity=".12" />
          <stop offset="1" stopColor="#00120c" stopOpacity=".30" />
        </linearGradient>
        <linearGradient id="tsGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff0c6" stopOpacity=".30" />
          <stop offset=".45" stopColor="#e59a10" stopOpacity=".18" />
          <stop offset="1" stopColor="#1c0f00" stopOpacity=".34" />
        </linearGradient>
        <linearGradient id="tsDim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dfeaff" stopOpacity=".13" />
          <stop offset=".45" stopColor="#8fa6d8" stopOpacity=".05" />
          <stop offset="1" stopColor="#01050e" stopOpacity=".26" />
        </linearGradient>
        <linearGradient id="tsSheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tsFlare" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffc247" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff4dc" stopOpacity=".85" />
          <stop offset="1" stopColor="#ffc247" stopOpacity="0" />
        </linearGradient>

        <radialGradient id="tsWheel" cx=".34" cy=".28" r=".9">
          <stop offset="0" stopColor="#4d5f7d" />
          <stop offset=".4" stopColor="#131c2c" />
          <stop offset="1" stopColor="#01030a" />
        </radialGradient>
        <radialGradient id="tsPoolMint"><stop offset="0" stopColor="#4dffb4" stopOpacity=".75" /><stop offset="1" stopColor="#4dffb4" stopOpacity="0" /></radialGradient>
        <radialGradient id="tsPoolGold"><stop offset="0" stopColor="#ffc247" stopOpacity=".95" /><stop offset="1" stopColor="#ffc247" stopOpacity="0" /></radialGradient>
        <radialGradient id="tsPoolDim"><stop offset="0" stopColor="#93a9d6" stopOpacity=".3" /><stop offset="1" stopColor="#93a9d6" stopOpacity="0" /></radialGradient>
        <radialGradient id="tsAura">
          <stop offset="0" stopColor="#ffbb33" stopOpacity=".7" />
          <stop offset=".5" stopColor="#ff9500" stopOpacity=".16" />
          <stop offset="1" stopColor="#ff9500" stopOpacity="0" />
        </radialGradient>

        <filter id="tsB4" x="-160%" y="-160%" width="420%" height="420%"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="tsB9" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="9" /></filter>
        <filter id="tsB18" x="-260%" y="-260%" width="620%" height="620%"><feGaussianBlur stdDeviation="18" /></filter>
        <filter id="tsB34" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="34" /></filter>
        <filter id="tsSmoke" x="-400%" y="-400%" width="900%" height="900%"><feGaussianBlur stdDeviation="7" /></filter>
      </defs>

      {/* rail — deliberately light; additive layers sum, so heavy strokes blow out to a slab */}
      <path className="ts-add" fill="url(#tsGround)" opacity={0.16} filter="url(#tsB34)"
            d={`${railPath(6)} L${W + 70} ${rail(W + 70) + 130} L-50 ${rail(-50) + 130} Z`} />
      <g className="ts-add">
        <path d={railPath(0)} fill="none" stroke="url(#tsRib)" strokeWidth={26} opacity={0.1} filter="url(#tsB34)" />
        <path d={railPath(1)} fill="none" stroke="url(#tsRib)" strokeWidth={9} opacity={0.22} filter="url(#tsB9)" />
        <path d={railPath(0)} fill="none" stroke="url(#tsRib)" strokeWidth={2.6} opacity={0.55} />
        <path d={railPath(0)} fill="none" stroke="url(#tsCore)" strokeWidth={1.1} opacity={0.8} />
        <path d={railPath(22)} fill="none" stroke="url(#tsRib)" strokeWidth={1.1} opacity={0.26} />
        <path d={railPath(0)} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round"
              strokeDasharray="110 2700" opacity={0.7} filter="url(#tsB4)">
          <animate attributeName="stroke-dashoffset" from="2810" to="0" dur="6.2s" repeatCount="indefinite" />
        </path>
      </g>

      {/* light pooled on the rail beneath each carriage */}
      {STAGE_LABELS.map((_, i) => {
        const x = carX(i);
        return (
          <ellipse key={`pool-${i}`} className="ts-add" cx={x} cy={rail(x) + 3}
                   rx={CAR_W * 0.6} ry={14} fill={THEME[statusFor(i, active)].pool} filter="url(#tsB18)" />
        );
      })}

      <Locomotive />
      {STAGE_LABELS.map((label, i) => (
        <Fragment key={label}>
          <Car label={label} status={statusFor(i, active)} index={i} />
          {i < STAGE_LABELS.length - 1 && <Coupler index={i} nextStatus={statusFor(i + 1, active)} />}
        </Fragment>
      ))}
    </svg>
  );
}
