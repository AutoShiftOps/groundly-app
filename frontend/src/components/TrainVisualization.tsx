import { Activity } from "lucide-react";
import PipelineTrack from "./PipelineTrack";
import StatsGrid from "./StatsGrid";

const GlobalAnimations = () => (
    <style>{`
    @keyframes smokeUp {
      0%   { opacity: 0.8; transform: translateY(0)   translateX(0)   scale(0.4); }
      50%  { opacity: 0.4; transform: translateY(-18px) translateX(var(--dx,3px)) scale(1.1); }
      100% { opacity: 0;   transform: translateY(-36px) translateX(var(--dx,3px)) scale(1.6); }
    }
    .smoke-p { animation: smokeUp var(--d,2s) ease-out var(--dl,0s) infinite; }

    @keyframes amberPulse {
      0%,100% { box-shadow: 0 0 14px 2px rgba(245,158,11,0.95), 0 0 40px 8px rgba(245,158,11,0.55), 0 0 90px 20px rgba(245,158,11,0.25), inset 0 0 20px rgba(245,158,11,0.18); }
      50% { box-shadow: 0 0 22px 4px rgba(245,158,11,1), 0 0 60px 14px rgba(245,158,11,0.7), 0 0 130px 30px rgba(245,158,11,0.35), inset 0 0 30px rgba(245,158,11,0.28); }
    }
    .amber-pulse { animation: amberPulse 2.2s ease-in-out infinite; }

    @keyframes wheelTurn { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .wheel-spin { animation: wheelTurn 1.3s linear infinite; }
    
    @keyframes railShimmer { 0%,100% { opacity: 0.85; } 50% { opacity: 1; } }
    .rail-shimmer { animation: railShimmer 3s ease-in-out infinite; }
  `}</style>
);

export default function TrainVisualization({ activeIndex = 0, sourceCount = 0 }: { activeIndex?: number, sourceCount?: number }) {
    const overallProgress = Math.min(100, Math.round(((activeIndex + 1) / 5) * 100));

    return (
        <div className="flex flex-col flex-1 min-h-screen overflow-y-auto bg-[#050c1a]">
            <GlobalAnimations />

            <header className="flex items-center justify-between px-6 py-3 shrink-0 border-b border-[rgba(99,140,255,0.08)]">
                <div className="flex items-center gap-2">
                    <span className="text-[#4a8fff] text-base">✦</span>
                    <span className="text-sm font-semibold text-[#c0cce8] tracking-wide">AI Business Analyst</span>
                </div>
                <button className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-all hover:brightness-125 border-[1.5px] border-[#2dd4bf] text-[#2dd4bf]" style={{ boxShadow: "0 0 14px rgba(45,212,191,0.22)" }}>
                    <Activity size={14} />
                    Live analysis
                </button>
            </header>

            <main className="flex-1 flex flex-col">
                <div className="px-8 pt-8 pb-2">
                    <h1 className="text-[2.6rem] font-extrabold leading-[1.15] text-white tracking-tight">
                        Analyzing your business{" "}
                        <span className="bg-gradient-to-r from-[#4a8fff] to-[#2dd4bf] bg-clip-text text-transparent">idea</span>{" "}
                        <span style={{ color: "#4a8fff" }}>✦✦</span>
                    </h1>
                    <p className="mt-2 text-[#7a8aaa] text-sm font-medium">Our AI is working its magic ✨</p>
                </div>

                <PipelineTrack activeIndex={activeIndex} />

                <div className="px-8 py-5">
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-xs font-medium text-[#7a8aaa]">Overall progress</span>
                        <span className="text-3xl font-bold bg-gradient-to-r from-[#4a8fff] to-[#a78bfa] bg-clip-text text-transparent">
                            {overallProgress}%
                        </span>
                        <div className="w-full max-w-2xl h-2 rounded-full bg-[rgba(255,255,255,0.06)]">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#4a8fff] via-[#7c3aed] to-[#a78bfa]" style={{ width: `${overallProgress}%`, boxShadow: "0 0 12px rgba(74,143,255,0.55)" }} />
                        </div>
                        <span className="text-xs text-[#7a8aaa] mt-1">Sit tight — great insights take time.</span>
                    </div>
                </div>

                <StatsGrid activeIndex={activeIndex} sourceCount={sourceCount} />
            </main>
        </div>
    );
}