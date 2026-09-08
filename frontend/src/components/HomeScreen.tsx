import { useState } from "react";
import Sidebar from "./Sidebar";
import TrainScene from "./TrainScene";

interface HomeScreenProps {
  idea: string;
  setIdea: (v: string) => void;
  onLaunch: () => void;
  error: string | null;
}

const SAMPLES = [
  "NightShift — chef-grade meal kits for people who work 7pm to 7am.",
  "Halo Ledger — a financial OS that forecasts founder runway from the books.",
  "PeerCharge — a neighborhood network for sharing home EV chargers.",
];

export default function HomeScreen({ idea, setIdea, onLaunch, error }: HomeScreenProps) {
  const [activeNav, setActiveNav] = useState("Analyze");
  const ready = idea.trim().length >= 12;

  return (
    <div className="flex min-h-screen w-full overflow-hidden"
      style={{
        background: "radial-gradient(ellipse 80% 60% at 75% 5%, rgba(90,60,180,0.18) 0%, #050c1a 55%)",
        fontFamily: "'Inter', sans-serif",
      }}>
      <Sidebar activeNav={activeNav} onNavChange={setActiveNav} />

      <div className="flex flex-col flex-1 min-h-screen overflow-y-auto">
        <header className="flex items-center justify-between px-6 py-3 shrink-0"
          style={{ borderBottom: "1px solid rgba(99,140,255,0.08)" }}>
          <div className="flex items-center gap-2">
            <span className="text-[#4a8fff] text-base">✦</span>
            <span className="text-sm font-semibold text-[#c0cce8] tracking-wide">AI Business Analyst</span>
          </div>
        </header>

        <main className="flex-1 flex flex-col px-8 pt-10 pb-8">
          <h1 className="text-[2.6rem] font-extrabold leading-[1.15] text-white max-w-2xl" style={{ letterSpacing: "-0.025em" }}>
            What’s the{" "}
            <span style={{ background: "linear-gradient(90deg,#4a8fff,#2dd4bf)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              business idea
            </span>{" "}
            we should pressure-test?
          </h1>
          <p className="mt-3 text-[#7a8aaa] text-sm font-medium max-w-xl">
            One or two sentences is enough. Groundly runs PESTEL, Porter, SWOT, TAM/SAM/SOM,
            STP, BCG, Ansoff, Value Chain, BMC and Balanced Scorecard — with citations, not guesses.
          </p>

          <div className="mt-8 max-w-2xl w-full rounded-2xl p-6"
            style={{ background: "rgba(10,20,40,0.92)", border: "1px solid rgba(99,140,255,0.13)", boxShadow: "0 4px 28px rgba(0,0,0,0.35)" }}>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Describe the product, who it’s for, and why now…"
              rows={5}
              maxLength={600}
              className="w-full rounded-xl p-4 text-sm text-white resize-y"
              style={{ background: "#080f1e", border: "1px solid rgba(99,140,255,0.13)" }}
            />
            <div className="flex items-center justify-between mt-3 text-xs" style={{ color: "#5a6a8a" }}>
              <span>Private until you launch the analysis.</span>
              <span>{idea.trim().length}/600</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {SAMPLES.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setIdea(sample)}
                  className="rounded-full px-3 py-1.5 text-xs transition-colors hover:text-white"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,140,255,0.16)", color: "#7a8aaa" }}
                >
                  {sample.split("—")[0]?.trim()}
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-5">
              <button
                onClick={onLaunch}
                disabled={!ready}
                className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110"
                style={{
                  background: "linear-gradient(90deg,#4a8fff 0%,#7c3aed 100%)",
                  boxShadow: "0 0 20px rgba(74,143,255,0.4)",
                }}
              >
                Launch Analysis
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-5 max-w-2xl w-full rounded-xl p-4 text-sm"
              style={{ background: "rgba(255,92,92,0.08)", border: "1px solid rgba(255,92,92,0.3)", color: "#ff8080" }}>
              {error}
            </div>
          )}

          <div className="mt-10 w-full max-w-4xl opacity-90">
            <TrainScene activeStageIndex={-1} />
          </div>
        </main>
      </div>
    </div>
  );
}
