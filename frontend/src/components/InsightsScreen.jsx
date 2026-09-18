// frontend/src/components/InsightsScreen.jsx
//
// GitHub visual-port task: aurelo-ui's actual insights.tsx renders a
// glass-card grid of "insight" cards + "Pro Tip" cards. Its actual
// content is Aurelo's own fabricated-brief text (deriveBrief() in that
// branch's lib/groundly/brief.ts) -- generic AI-written takes, not
// derived from any real citation. That content is NOT ported. Instead:
// each insight card here is the real first grounded sentence of an
// actual framework's real output (with whatever [N] citation marker it
// carries), straight from the latest real report -- same discipline as
// everywhere else in this app. Pro Tip cards reuse the same real,
// accurate product-education tips LoadingScreen already shows.
import { Sparkles, Lightbulb } from "lucide-react";
import Sidebar from "./Sidebar";
import { FRAMEWORK_LABELS, firstSentence, stripMarketTags, renderBoldText } from "./ReportView";
import { PRO_TIPS } from "./LoadingScreen";

function InsightCard({ frameworkKey, text }) {
  const sentence = stripMarketTags(firstSentence(text));
  return (
    <article className="glass-card rounded-[22px] p-6">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a78bfa" }}>
        {FRAMEWORK_LABELS[frameworkKey] || frameworkKey.toUpperCase()}
      </p>
      <p className="mt-3 text-[15px] font-semibold leading-snug text-white">{renderBoldText(sentence)}</p>
    </article>
  );
}

function ProTipCard({ tip }) {
  return (
    <article className="glass-card rounded-[22px] p-6">
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#5a6a8a" }}>Pro Tip</p>
      <p className="mt-3 text-[15px] leading-relaxed text-white">{tip}</p>
    </article>
  );
}

function EmptyState({ onNewAnalysis }) {
  return (
    <div className="glass-card mt-10 flex flex-col items-center rounded-[28px] px-6 py-16 text-center">
      <Lightbulb size={32} style={{ color: "#5a6a8a" }} />
      <p className="mt-4 text-lg font-semibold text-white">Nothing to show yet</p>
      <p className="mt-2 max-w-sm text-sm" style={{ color: "#7a8aaa" }}>
        Finish an analysis and real, cited highlights will land here.
      </p>
      <button onClick={onNewAnalysis} className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(90deg,#4a8fff 0%,#7c3aed 100%)", boxShadow: "0 0 20px rgba(74,143,255,0.4)" }}>
        Analyze an idea
      </button>
    </div>
  );
}

export default function InsightsScreen({ report, onNewAnalysis, onNavigate }) {
  const frameworkEntries = report
    ? Object.entries(report.results || {}).filter(([, r]) => r?.text).slice(0, 6)
    : [];

  return (
    <div className="flex min-h-screen w-full overflow-hidden"
      style={{ background: "radial-gradient(ellipse 80% 60% at 75% 5%, rgba(90,60,180,0.18) 0%, #050c1a 55%)", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar activeNav="Insights" onNavChange={onNavigate} />
      <div className="flex flex-col flex-1 min-h-screen overflow-y-auto">
        <header className="flex items-center justify-between px-6 py-3 shrink-0" style={{ borderBottom: "1px solid rgba(99,140,255,0.08)" }}>
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-[#4a8fff]" strokeWidth={2} />
            <span className="text-sm font-semibold text-[#c0cce8] tracking-wide">AI Business Analyst</span>
          </div>
        </header>
        <main className="flex-1 px-8 pt-8 pb-8">
          <h1 className="text-3xl font-extrabold text-white leading-tight">Insights</h1>
          <p className="mt-2 text-sm" style={{ color: "#7a8aaa" }}>The sharpest real, cited takes from your latest analysis.</p>

          {!report ? (
            <EmptyState onNewAnalysis={onNewAnalysis} />
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
              {frameworkEntries.map(([fw, r]) => (
                <InsightCard key={fw} frameworkKey={fw} text={r.text} />
              ))}
              {PRO_TIPS.slice(0, 4).map((tip) => (
                <ProTipCard key={tip} tip={tip} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
