// frontend/src/components/LoadingScreen.tsx
//
// This is the Figma-generated train visualization, converted from a static
// mockup into a real component:
// - STAGES and progress % now come from props (activeStageIndex, sourceCount)
//   instead of hardcoded constants (`status: "active"` on stage 4, `value={72}`).
// - Sidebar extracted to ./Sidebar.tsx (shared with HomeScreen).
// - Everything else (animations, TrainCar, StatsGrid, sparklines) preserved
//   exactly as designed - only the data feeding it is now real.

import { useState } from "react";
import {
  Lightbulb, BarChart2, Search, Globe, CheckCircle2, FlaskConical,
  MoreHorizontal, ChevronLeft, ChevronRight, Lock, Activity,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import Sidebar from "./Sidebar";

const Keyframes = () => (
  <style>{`
    @keyframes smokeUp {
      0%   { opacity: 0.8; transform: translateY(0)   translateX(0)   scale(0.4); }
      50%  { opacity: 0.4; transform: translateY(-18px) translateX(var(--dx,3px)) scale(1.1); }
      100% { opacity: 0;   transform: translateY(-36px) translateX(var(--dx,3px)) scale(1.6); }
    }
    .smoke-p { animation: smokeUp var(--d,2s) ease-out var(--dl,0s) infinite; }
    @keyframes amberPulse {
      0%,100% {
        box-shadow: 0 0 14px 2px rgba(245,158,11,0.95), 0 0 40px 8px rgba(245,158,11,0.55),
                    0 0 90px 20px rgba(245,158,11,0.25), inset 0 0 20px rgba(245,158,11,0.18);
      }
      50% {
        box-shadow: 0 0 22px 4px rgba(245,158,11,1), 0 0 60px 14px rgba(245,158,11,0.7),
                    0 0 130px 30px rgba(245,158,11,0.35), inset 0 0 30px rgba(245,158,11,0.28);
      }
    }
    .amber-pulse { animation: amberPulse 2.2s ease-in-out infinite; }
    @keyframes wheelTurn { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .wheel-spin { animation: wheelTurn 1.3s linear infinite; }
    @keyframes railShimmer { 0%,100% { opacity: 0.85; } 50% { opacity: 1; } }
    .rail-shimmer { animation: railShimmer 3s ease-in-out infinite; }
  `}</style>
);

type PipelineStatus = "done" | "active" | "pending";
interface PipelineStage { id: number; label: string; status: PipelineStatus; }
interface StatCardData {
  icon: React.ReactNode; iconBg: string; value: string;
  label: string; subtext?: string;
  sparkData?: { v: number }[]; sparkColor?: string;
}

const STAGE_LABELS = ["Ideating", "Researching", "Prototyping", "Testing", "Finalizing"];
const PRO_TIPS = [
  "TAM measures your total addressable market.",
  "SAM is your serviceable addressable market.",
  "SOM is your obtainable market share.",
  "Validate assumptions early with customer interviews.",
  "Unit economics drive long-term profitability.",
];

function buildStages(activeStageIndex: number): PipelineStage[] {
  return STAGE_LABELS.map((label, i) => ({
    id: i + 1,
    label,
    status: i < activeStageIndex ? "done" : i === activeStageIndex ? "active" : "pending",
  }));
}

function SmokeColumn({ active }: { active: boolean }) {
  const col = active ? "245,158,11" : "45,212,191";
  const wisps = [
    { d: "2.1s", dl: "0s", dx: "3px", sz: 9, l: "22%" },
    { d: "2.6s", dl: "0.55s", dx: "-4px", sz: 7, l: "45%" },
    { d: "1.9s", dl: "1.1s", dx: "5px", sz: 8, l: "62%" },
    { d: "2.4s", dl: "0.3s", dx: "-2px", sz: 6, l: "78%" },
  ];
  return (
    <div className="absolute w-full pointer-events-none" style={{ bottom: "100%", height: 48, left: 0 }}>
      {wisps.map((w, i) => (
        <div key={i} className="smoke-p absolute rounded-full"
          style={{ left: w.l, bottom: 0, width: w.sz, height: w.sz, background: `rgba(${col},0.55)`, filter: "blur(3px)",
            "--d": w.d, "--dl": w.dl, "--dx": w.dx } as React.CSSProperties} />
      ))}
    </div>
  );
}

function TrainWheel({ color, spin = false }: { color: string; spin?: boolean }) {
  return (
    <div className={`relative flex items-center justify-center rounded-full border-[2.5px] ${spin ? "wheel-spin" : ""}`}
      style={{ width: 22, height: 22, borderColor: color, background: "radial-gradient(circle, #0a1420 60%, #060e1a 100%)",
        boxShadow: `0 0 6px rgba(${color === "#f59e0b" ? "245,158,11" : "45,212,191"},0.6)` }}>
      <div className="absolute rounded-full" style={{ width: 7, height: 7, background: color, opacity: 0.8 }} />
      {[0, 60, 120].map((deg) => (
        <div key={deg} className="absolute" style={{ width: 1, height: "70%", background: color, opacity: 0.5,
          transform: `rotate(${deg}deg)`, transformOrigin: "center" }} />
      ))}
    </div>
  );
}

function TrainCar({ stage }: { stage: PipelineStage }) {
  const done = stage.status === "done";
  const active = stage.status === "active";
  const pending = stage.status === "pending";
  const tc = done ? { rgb: "45,212,191", hex: "#2dd4bf", label: "#2dd4bf" }
    : active ? { rgb: "245,158,11", hex: "#f59e0b", label: "#fbbf24" }
    : { rgb: "120,140,180", hex: "rgba(255,255,255,0.18)", label: "#3a4e6a" };
  const faceBg = done
    ? "linear-gradient(160deg, rgba(45,212,191,0.2) 0%, rgba(45,212,191,0.07) 60%, rgba(0,0,0,0.15) 100%)"
    : active
    ? "linear-gradient(160deg, rgba(245,158,11,0.22) 0%, rgba(245,158,11,0.08) 60%, rgba(0,0,0,0.2) 100%)"
    : "linear-gradient(160deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)";
  const outerGlow = done
    ? `0 0 12px 2px rgba(${tc.rgb},0.95), 0 0 30px 6px rgba(${tc.rgb},0.6), 0 0 70px 16px rgba(${tc.rgb},0.3), 0 0 130px 30px rgba(${tc.rgb},0.12), inset 0 0 18px rgba(${tc.rgb},0.12)`
    : pending ? "none" : undefined;

  return (
    <div className="relative flex flex-col items-center select-none">
      {!pending && <SmokeColumn active={active} />}
      <div className={`relative flex items-center gap-3 px-5 rounded-[18px] ${active ? "amber-pulse" : ""}`}
        style={{ width: 158, height: 80, background: faceBg, border: `2px solid ${tc.hex}`, boxShadow: active ? undefined : outerGlow ?? undefined }}>
        <div className="absolute top-0 left-6 right-6 h-px rounded-full" style={{ background: `rgba(${tc.rgb},0.5)` }} />
        <div className="absolute inset-0 rounded-[16px] pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.07) 0%, transparent 50%)" }} />
        <div className="relative z-10 flex items-center justify-center rounded-full border-2 shrink-0"
          style={{ width: 38, height: 38, borderColor: tc.hex, background: `rgba(${tc.rgb},0.12)`,
            boxShadow: pending ? "none" : `0 0 10px rgba(${tc.rgb},0.6)` }}>
          {done && <CheckCircle2 size={18} style={{ color: tc.hex }} strokeWidth={2.5} />}
          {active && <FlaskConical size={18} style={{ color: tc.hex }} strokeWidth={2} />}
          {pending && <MoreHorizontal size={18} style={{ color: tc.label }} />}
        </div>
        <span className="relative z-10 text-[14px] font-bold tracking-wide" style={{ color: tc.label }}>{stage.label}</span>
      </div>
      <div style={{ width: 140, height: 14, marginTop: -2,
        background: done ? "linear-gradient(180deg, rgba(45,212,191,0.18) 0%, rgba(0,0,0,0.5) 100%)"
          : active ? "linear-gradient(180deg, rgba(245,158,11,0.18) 0%, rgba(0,0,0,0.5) 100%)"
          : "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.5) 100%)",
        border: `2px solid ${tc.hex}`, borderTop: "none", borderRadius: "0 0 6px 6px" }} />
      <div style={{ width: 130, height: 4, marginTop: 1,
        background: pending ? "rgba(255,255,255,0.05)" : `linear-gradient(90deg, rgba(${tc.rgb},0.0) 0%, rgba(${tc.rgb},0.4) 30%, rgba(${tc.rgb},0.4) 70%, rgba(${tc.rgb},0.0) 100%)` }} />
      <div className="flex justify-between mt-[3px]" style={{ width: 134 }}>
        {[0, 1, 2, 3].map((i) => <TrainWheel key={i} color={tc.hex} spin={active} />)}
      </div>
    </div>
  );
}

function Coupler({ fromDone }: { fromDone: boolean }) {
  return (
    <div className="flex items-center self-end mb-[28px] mx-[-3px]" style={{ width: 18 }}>
      <div className="w-full h-px" style={{ background: fromDone ? "rgba(45,212,191,0.55)" : "rgba(255,255,255,0.12)" }} />
    </div>
  );
}

function TrackSection() {
  return (
    <div className="relative w-full" style={{ marginTop: 4 }}>
      <div className="relative flex justify-evenly px-2" style={{ height: 12 }}>
        {Array.from({ length: 22 }).map((_, i) => (
          <div key={i} className="rounded-sm" style={{ width: 3, height: 12, background: "rgba(80,110,160,0.25)" }} />
        ))}
      </div>
      <div className="rail-shimmer w-full rounded-full" style={{ height: 4, marginTop: -2,
        background: "linear-gradient(90deg, rgba(45,212,191,1) 0%, rgba(74,143,255,0.8) 58%, rgba(255,255,255,0.1) 100%)",
        boxShadow: "0 0 10px 2px rgba(45,212,191,0.75), 0 0 24px 4px rgba(45,212,191,0.35)" }} />
      <div style={{ height: 6 }} />
      <div className="w-full rounded-full" style={{ height: 2.5,
        background: "linear-gradient(90deg, rgba(45,212,191,0.65) 0%, rgba(74,143,255,0.45) 58%, rgba(255,255,255,0.05) 100%)",
        boxShadow: "0 0 6px rgba(45,212,191,0.4)" }} />
      <div style={{ height: 50, marginTop: 2,
        background: "linear-gradient(180deg, rgba(45,212,191,0.18) 0%, rgba(45,212,191,0.07) 35%, transparent 100%)", filter: "blur(2px)" }} />
    </div>
  );
}

function PipelineTrack({ activeStageIndex }: { activeStageIndex: number }) {
  const stages = buildStages(activeStageIndex);
  return (
    <div className="relative overflow-hidden" style={{ minHeight: 280, padding: "44px 32px 0",
      background: ["radial-gradient(ellipse 65% 55% at 32% 58%, rgba(45,212,191,0.07) 0%, transparent 65%)",
        "radial-gradient(ellipse 35% 40% at 64% 52%, rgba(245,158,11,0.06) 0%, transparent 60%)"].join(", ") }}>
      <div className="absolute pointer-events-none" style={{ bottom: 30, left: "5%", right: "25%", height: 80,
        background: "radial-gradient(ellipse 80% 100% at 40% 100%, rgba(45,212,191,0.14) 0%, transparent 70%)", filter: "blur(12px)" }} />
      <div className="absolute pointer-events-none" style={{ bottom: 30, left: "48%", right: "5%", height: 80,
        background: "radial-gradient(ellipse 60% 100% at 55% 100%, rgba(245,158,11,0.1) 0%, transparent 70%)", filter: "blur(16px)" }} />
      <div className="relative z-10 flex items-end">
        {stages.map((stage, i) => (
          <div key={stage.id} className="flex items-end">
            <TrainCar stage={stage} />
            {i < stages.length - 1 && <Coupler fromDone={stage.status === "done"} />}
          </div>
        ))}
      </div>
      <div className="relative z-10"><TrackSection /></div>
    </div>
  );
}

function TopBar() {
  return (
    <header className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(99,140,255,0.08)" }}>
      <div className="flex items-center gap-2">
        <span className="text-[#4a8fff] text-base">✦</span>
        <span className="text-sm font-semibold text-[#c0cce8] tracking-wide">AI Business Analyst</span>
      </div>
      <button className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-all hover:brightness-125"
        style={{ border: "1.5px solid #2dd4bf", color: "#2dd4bf", boxShadow: "0 0 14px rgba(45,212,191,0.22)" }}>
        <Activity size={14} />
        Live analysis
      </button>
    </header>
  );
}

function HeroSection() {
  return (
    <div className="px-8 pt-8 pb-2">
      <h1 className="text-[2.6rem] font-extrabold leading-[1.15] text-white" style={{ letterSpacing: "-0.025em" }}>
        Analyzing your business{" "}
        <span style={{ background: "linear-gradient(90deg,#4a8fff,#2dd4bf)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>idea</span>{" "}
        <span style={{ color: "#4a8fff" }}>✦✦</span>
      </h1>
      <p className="mt-2 text-[#7a8aaa] text-sm font-medium">Our AI is working its magic ✨</p>
    </div>
  );
}

function OverallProgress({ value }: { value: number }) {
  return (
    <div className="px-8 py-5">
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-medium text-[#7a8aaa]">Overall progress</span>
        <span className="text-3xl font-bold" style={{ background: "linear-gradient(90deg,#4a8fff,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {value}%
        </span>
        <div className="w-full max-w-2xl h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${value}%`,
            background: "linear-gradient(90deg,#4a8fff 0%,#7c3aed 60%,#a78bfa 100%)", boxShadow: "0 0 12px rgba(74,143,255,0.55)" }} />
        </div>
        <span className="text-xs text-[#7a8aaa] mt-1">Sit tight — great insights take time.</span>
      </div>
    </div>
  );
}

function Sparkline({ data, color }: { data: { v: number }[]; color: string }) {
  const id = color.replace(/[^a-z0-9]/gi, "");
  return (
    <div style={{ width: 96, height: 40 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`sg${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#sg${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({ card }: { card: StatCardData }) {
  return (
    <div className="flex-1 min-w-[185px] flex flex-col gap-3 p-4 rounded-2xl"
      style={{ background: "rgba(10,20,40,0.92)", border: "1px solid rgba(99,140,255,0.13)", boxShadow: "0 4px 28px rgba(0,0,0,0.35)" }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: card.iconBg }}>{card.icon}</div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[26px] font-bold text-white leading-none">{card.value}</span>
          <span className="text-xs font-medium text-[#7a8aaa]">{card.label}</span>
          {card.subtext && <span className="text-[11px] text-[#4a8fff] mt-0.5 leading-tight">{card.subtext}</span>}
        </div>
      </div>
      {card.sparkData && <div className="flex justify-end"><Sparkline data={card.sparkData} color={card.sparkColor ?? "#4a8fff"} /></div>}
    </div>
  );
}

function ProTipCard() {
  const [idx, setIdx] = useState(0);
  return (
    <div className="flex-1 min-w-[185px] flex flex-col gap-3 p-4 rounded-2xl"
      style={{ background: "rgba(10,20,40,0.92)", border: "1px solid rgba(99,140,255,0.13)", boxShadow: "0 4px 28px rgba(0,0,0,0.35)" }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(124,58,237,0.25)" }}>
          <Lightbulb size={18} className="text-[#a78bfa]" strokeWidth={1.8} />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#a78bfa]">Pro Tip</span>
          <p className="text-sm font-medium text-white leading-snug">{PRO_TIPS[idx]}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-auto">
        <button onClick={() => setIdx((i) => (i - 1 + PRO_TIPS.length) % PRO_TIPS.length)} className="text-[#7a8aaa] hover:text-white transition-colors p-1">
          <ChevronLeft size={16} />
        </button>
        <div className="flex gap-1.5">
          {PRO_TIPS.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} className="rounded-full transition-all duration-200"
              style={{ width: i === idx ? 16 : 6, height: 6, background: i === idx ? "#4a8fff" : "rgba(255,255,255,0.2)" }} />
          ))}
        </div>
        <button onClick={() => setIdx((i) => (i + 1) % PRO_TIPS.length)} className="text-[#7a8aaa] hover:text-white transition-colors p-1">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function StatsGrid({ sourceCount }: { sourceCount: number }) {
  const sparkUp = [2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, Math.max(8, sourceCount)].map((v) => ({ v }));
  const sparkFlat = [5, 6, 5, 7, 6, 7, 6, 8, 7, 8, 7, 9].map((v) => ({ v }));
  const cards: StatCardData[] = [
    { icon: <Search size={18} className="text-[#4a8fff]" strokeWidth={1.8} />, iconBg: "rgba(74,143,255,0.18)",
      value: String(sourceCount), label: "sources scanned", subtext: sourceCount > 0 ? "Live from this analysis" : "Waiting for sources", sparkData: sparkUp, sparkColor: "#4a8fff" },
    { icon: <Globe size={18} className="text-[#2dd4bf]" strokeWidth={1.8} />, iconBg: "rgba(45,212,191,0.15)",
      value: "4", label: "frameworks analyzed", subtext: "PESTEL, SWOT, TAM, BMC" },
    { icon: <BarChart2 size={18} className="text-[#a78bfa]" strokeWidth={1.8} />, iconBg: "rgba(167,139,250,0.18)",
      value: String(sourceCount * 40), label: "data points processed", subtext: "Crunching numbers for deeper insights", sparkData: sparkFlat, sparkColor: "#a78bfa" },
  ];
  return (
    <div className="px-8 pb-4">
      <div className="flex gap-3 flex-wrap">
        {cards.map((c) => <StatCard key={c.label} card={c} />)}
        <ProTipCard />
      </div>
    </div>
  );
}

interface LoadingScreenProps {
  activeStageIndex: number;
  sourceCount: number;
}

export default function LoadingScreen({ activeStageIndex, sourceCount }: LoadingScreenProps) {
  const [activeNav, setActiveNav] = useState("Analyze");
  const progressPct = Math.min(100, Math.round(((activeStageIndex + 1) / STAGE_LABELS.length) * 100));

  return (
    <div className="flex min-h-screen w-full overflow-hidden"
      style={{ background: "radial-gradient(ellipse 80% 60% at 75% 5%, rgba(90,60,180,0.18) 0%, #050c1a 55%)", fontFamily: "'Inter', sans-serif" }}>
      <Keyframes />
      <Sidebar activeNav={activeNav} onNavChange={setActiveNav} />
      <div className="flex flex-col flex-1 min-h-screen overflow-y-auto">
        <TopBar />
        <main className="flex-1 flex flex-col">
          <HeroSection />
          <PipelineTrack activeStageIndex={activeStageIndex} />
          <OverallProgress value={progressPct} />
          <StatsGrid sourceCount={sourceCount} />
          <div className="flex items-center justify-center gap-2 py-3 text-[#5a6a8a] text-xs">
            <Lock size={12} strokeWidth={2} />
            <span>Your data is encrypted and secure</span>
          </div>
        </main>
      </div>
    </div>
  );
}
