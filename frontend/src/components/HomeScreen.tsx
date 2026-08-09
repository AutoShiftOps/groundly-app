// frontend/src/components/HomeScreen.tsx
//
// Restored home/idle screen - this was completely missing after the Figma
// import replaced App.tsx with just the loading-screen mockup. Styled to
// match the same dark palette/typography as the Figma TrainProgress screen
// so the three screens (Home -> Loading -> Report) feel like one product.

import { useState } from "react";
import Sidebar from "./Sidebar";

interface HomeScreenProps {
  idea: string;
  setIdea: (v: string) => void;
  onLaunch: () => void;
  error: string | null;
}

export default function HomeScreen({ idea, setIdea, onLaunch, error }: HomeScreenProps) {
  const [activeNav, setActiveNav] = useState("Analyze");

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

        <main className="flex-1 flex flex-col px-8 pt-10">
          <h1 className="text-[2.6rem] font-extrabold leading-[1.15] text-white max-w-2xl" style={{ letterSpacing: "-0.025em" }}>
            Describe your business{" "}
            <span style={{ background: "linear-gradient(90deg,#4a8fff,#2dd4bf)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              idea
            </span>
          </h1>
          <p className="mt-2 text-[#7a8aaa] text-sm font-medium max-w-xl">
            Generate a grounded, multi-framework decision report backed by real sources.
          </p>

          <div className="mt-8 max-w-xl w-full rounded-2xl p-6"
            style={{ background: "rgba(10,20,40,0.92)", border: "1px solid rgba(99,140,255,0.13)", boxShadow: "0 4px 28px rgba(0,0,0,0.35)" }}>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g., A subscription box for eco-friendly packaging aimed at small e-commerce brands..."
              rows={5}
              className="w-full rounded-xl p-4 text-sm text-white resize-y"
              style={{ background: "#080f1e", border: "1px solid rgba(99,140,255,0.13)" }}
            />
            <div className="flex justify-end mt-4">
              <button
                onClick={onLaunch}
                disabled={!idea.trim()}
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
            <div className="mt-5 max-w-xl w-full rounded-xl p-4 text-sm"
              style={{ background: "rgba(255,92,92,0.08)", border: "1px solid rgba(255,92,92,0.3)", color: "#ff8080" }}>
              {error}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
