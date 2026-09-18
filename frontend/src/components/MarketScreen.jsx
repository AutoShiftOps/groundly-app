// frontend/src/components/MarketScreen.jsx
//
// GitHub visual-port task: aurelo-ui's actual market.tsx pairs 3 stat
// cards (TAM/SAM/SOM headline numbers) with a "Opportunity by market"
// glass-card list of gradient bars. That bar list's actual content
// (latest.markets) is 100% fabricated -- a hardcoded per-country score
// array (US 88, UK 76, ...) that exists regardless of the idea
// analyzed. Not ported. Instead: the same stat-card treatment for the
// real TAM/SAM/SOM headline numbers, plus the REAL nested-circle
// diagram (TamSizingCard, reused directly from ReportView.jsx -- not a
// duplicated, simplified redraw) so this doesn't collapse the real
// market-sizing component down to three bare numbers.
import { Sparkles, PieChart } from "lucide-react";
import Sidebar from "./Sidebar";
import { TamSizingCard } from "./ReportView";

function StatCard({ label, value }) {
  return (
    <article className="glass-card rounded-[22px] p-5">
      <p className="text-xs uppercase tracking-[0.16em]" style={{ color: "#5a6a8a" }}>{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-white">{value}</p>
    </article>
  );
}

function EmptyState({ onNewAnalysis }) {
  return (
    <div className="glass-card mt-10 flex flex-col items-center rounded-[28px] px-6 py-16 text-center">
      <PieChart size={32} style={{ color: "#5a6a8a" }} />
      <p className="mt-4 text-lg font-semibold text-white">No market sizing yet</p>
      <p className="mt-2 max-w-sm text-sm" style={{ color: "#7a8aaa" }}>
        Run a real analysis and its grounded TAM/SAM/SOM sizing will land here.
      </p>
      <button onClick={onNewAnalysis} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(90deg,#4a8fff 0%,#7c3aed 100%)", boxShadow: "0 0 20px rgba(74,143,255,0.4)" }}>
        Analyze an idea
      </button>
    </div>
  );
}

export default function MarketScreen({ report, idea, onNewAnalysis, onNavigate }) {
  const tamResult = report?.results?.tam;
  const marketSizing = tamResult?.market_sizing;
  const tamVerification = report?.verification?.tam;
  const title = idea ? (idea.length > 52 ? idea.slice(0, 52) + "…" : idea) : "your latest analysis";

  return (
    <div className="flex min-h-screen w-full overflow-hidden"
      style={{ background: "radial-gradient(ellipse 80% 60% at 75% 5%, rgba(90,60,180,0.18) 0%, #050c1a 55%)", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar activeNav="Market" onNavChange={onNavigate} />
      <div className="flex flex-col flex-1 min-h-screen overflow-y-auto">
        <header className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(99,140,255,0.08)" }}>
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-[#4a8fff]" strokeWidth={2} />
            <span className="text-sm font-semibold text-[#c0cce8] tracking-wide">AI Business Analyst</span>
          </div>
        </header>
        <main className="flex-1 px-8 pt-8 pb-8">
          <h1 className="text-3xl font-extrabold text-white leading-tight">Market</h1>
          <p className="mt-2 text-sm" style={{ color: "#7a8aaa" }}>Grounded market sizing for {title}.</p>

          {!marketSizing ? (
            <EmptyState onNewAnalysis={onNewAnalysis} />
          ) : (
            <>
              <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
                <StatCard label="TAM" value={marketSizing.tam?.label || "No data found"} />
                <StatCard label="SAM" value={marketSizing.sam?.label || "No data found"} />
                <StatCard label="SOM" value={marketSizing.som?.label || "No data found"} />
              </div>
              {/* TamSizingCard is already a complete, self-styled card
                  (its own background/border/header) -- not wrapped in
                  another glass-card, which would just nest one card
                  inside another. */}
              <div className="mt-4">
                <TamSizingCard result={tamResult} verification={tamVerification} ideaTitle={title} forceExpanded />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
