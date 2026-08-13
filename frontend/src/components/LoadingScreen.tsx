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
  Lightbulb, BarChart2, Search, Globe, ChevronLeft, ChevronRight, Lock, Activity,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import Sidebar from "./Sidebar";
import TrainScene from "./TrainScene";

interface StatCardData {
  icon: React.ReactNode; iconBg: string; value: React.ReactNode;
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

function ShortViewportStyles() {
  return (
    <style>{`
      .ls-hero-h1 { font-size: 2.6rem; }
      .ls-card { min-height: 128px; }
      @media (max-height: 700px) {
        .ls-hero-h1 { font-size: 1.85rem; }
        .ls-card { min-height: 88px; }
      }
    `}</style>
  );
}

function TopBar() {
  return (
    <header className="flex items-center justify-between px-6 py-2 shrink-0" style={{ borderBottom: "1px solid rgba(99,140,255,0.08)" }}>
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
    <div className="flex-none px-8 pt-5 pb-1">
      <h1 className="ls-hero-h1 font-extrabold leading-[1.15] text-white" style={{ letterSpacing: "-0.025em" }}>
        Analyzing your business{" "}
        <span style={{ background: "linear-gradient(90deg,#4a8fff,#2dd4bf)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>idea</span>{" "}
        <span style={{ color: "#4a8fff" }}>✦✦</span>
      </h1>
      <p className="mt-1 text-[#7a8aaa] text-sm font-medium">Our AI is working its magic ✨</p>
    </div>
  );
}

function OverallProgress({ value }: { value: number }) {
  return (
    <div className="flex-none px-8 py-3">
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
    <div className="ls-card flex-1 min-w-[185px] flex flex-col gap-3 p-2.5 rounded-2xl"
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
    <div className="ls-card flex-1 min-w-[185px] flex flex-col gap-3 p-2.5 rounded-2xl"
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

// docs/PHASE_4_SPEC.md A1(b): /api/analyze is a single blocking call with no
// streaming, so `report` (and therefore any real source count) is null for
// the entire time this screen is mounted -- "N sources scanned" could
// mathematically never show anything but 0. Rather than fake a number that
// isn't real (option (a) would need real backend streaming to fix
// honestly), these two tiles now show an animated "in progress" indicator
// and make no numeric claim at all.
function LoadingDots({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-1.5" style={{ height: 26 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="rounded-full animate-pulse" style={{ width: 8, height: 8, background: color, animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

function StatsGrid() {
  const cards: StatCardData[] = [
    { icon: <Search size={18} className="text-[#4a8fff]" strokeWidth={1.8} />, iconBg: "rgba(74,143,255,0.18)",
      value: <LoadingDots color="#4a8fff" />, label: "Gathering sources", subtext: "Retrieving grounded data…" },
    { icon: <Globe size={18} className="text-[#2dd4bf]" strokeWidth={1.8} />, iconBg: "rgba(45,212,191,0.15)",
      value: "4", label: "frameworks analyzed", subtext: "PESTEL, SWOT, TAM, BMC" },
    { icon: <BarChart2 size={18} className="text-[#a78bfa]" strokeWidth={1.8} />, iconBg: "rgba(167,139,250,0.18)",
      value: <LoadingDots color="#a78bfa" />, label: "Synthesizing analysis", subtext: "Crunching numbers for deeper insights" },
  ];
  return (
    <div className="flex-none px-8 pb-2.5">
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

// sourceCount stays in the prop contract (App.tsx passes real data,
// untouched here per that constraint) but is intentionally no longer
// displayed -- see StatsGrid/LoadingDots above for why.
export default function LoadingScreen({ activeStageIndex, sourceCount: _sourceCount }: LoadingScreenProps) {
  const [activeNav, setActiveNav] = useState("Analyze");
  const progressPct = Math.min(100, Math.round(((activeStageIndex + 1) / STAGE_LABELS.length) * 100));

  return (
    <div className="flex w-full overflow-hidden"
      style={{ height: "100dvh", background: "radial-gradient(ellipse 80% 60% at 75% 5%, rgba(90,60,180,0.18) 0%, #050c1a 55%)", fontFamily: "'Inter', sans-serif" }}>
      <ShortViewportStyles />
      <Sidebar activeNav={activeNav} onNavChange={setActiveNav} />
      <div className="flex flex-col flex-1 min-h-screen overflow-y-auto">
        <TopBar />
        <main className="flex-1 flex flex-col min-h-0">
          <HeroSection />
          <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center" }}>
            <TrainScene activeStageIndex={activeStageIndex} />
          </div>
          <OverallProgress value={progressPct} />
          <StatsGrid />
          <div className="flex flex-none items-center justify-center gap-2 py-2 text-[#5a6a8a] text-xs">
            <Lock size={12} strokeWidth={2} />
            <span>Your data is encrypted and secure</span>
          </div>
        </main>
      </div>
    </div>
  );
}
