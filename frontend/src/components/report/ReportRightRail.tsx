import { useState } from "react";
import {
  BookOpen,
  ExternalLink,
  GitCompare,
  MessageSquare,
  Send,
  Sparkles,
} from "lucide-react";
import type {
  AskResponse,
  GroundlyCitation,
  GroundlyReport,
} from "../../types/groundly";
import { FRAMEWORK_LABELS } from "./frameworkMeta";

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

interface CitationWithMeta extends GroundlyCitation {
  framework?: string;
}

interface ReportRightRailProps {
  idea: string;
  report: GroundlyReport;
  citations: CitationWithMeta[];
  highlightedCitation: { index: number; framework?: string } | null;
  onOpenCompare: () => void;
  compareAvailable: boolean;
}

const SUGGESTED_QUESTIONS = [
  "What is our sharpest risk and how do we mitigate it?",
  "Why is the SOM sized where it is?",
  "Which customer segment should we target first?",
];

export function ReportRightRail({
  idea,
  report,
  citations,
  highlightedCitation,
  onOpenCompare,
  compareAvailable,
}: ReportRightRailProps) {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [showAllCitations, setShowAllCitations] = useState(false);
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string; sources?: AskResponse["sources"] }[]
  >([]);

  async function handleAsk(promptText?: string) {
    const q = (promptText ?? question).trim();
    if (!q || asking) return;
    setQuestion("");
    setAskError(null);
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setAsking(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          question: q,
          results: report.results,
          frameworks_allowed: report.frameworks_allowed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to answer from report sources.");
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.answer,
          sources: data.sources || [],
        },
      ]);
    } catch (err) {
      setAskError(
        err instanceof Error ? err.message : "Ask AI request failed.",
      );
    } finally {
      setAsking(false);
    }
  }

  const visibleCitations = showAllCitations ? citations : citations.slice(0, 6);

  return (
    <aside className="flex flex-col gap-4">
      {/* Citations Panel */}
      <section className="surface-panel rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-sm font-bold text-white">
            <BookOpen className="h-4 w-4 text-[#60a5fa]" />
            Sources & Citations
          </h3>
          {citations.length > 6 ? (
            <button
              type="button"
              onClick={() => setShowAllCitations((v) => !v)}
              className="font-mono text-[11px] font-semibold text-[#60a5fa] hover:text-white"
            >
              {showAllCitations ? "Show top 6" : `View all (${citations.length})`}
            </button>
          ) : (
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {citations.length} verified
            </span>
          )}
        </div>

        {citations.length === 0 ? (
          <p className="text-xs text-slate-500">
            No external citations attached to this section.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {visibleCitations.map((c, idx) => {
              const isHighlighted =
                highlightedCitation &&
                highlightedCitation.index === c.index &&
                (!highlightedCitation.framework ||
                  !c.framework ||
                  highlightedCitation.framework === c.framework);
              const simPct =
                typeof c.similarity === "number" ? Math.round(c.similarity * 100) : null;
              return (
                <li
                  key={`${c.source_url}-${idx}`}
                  id={`citation-${c.framework || "all"}-${c.index}`}
                  className={`rounded-xl border p-3 transition-colors ${
                    isHighlighted
                      ? "border-[#4a8fff] bg-[#4a8fff]/15"
                      : "surface-subpanel"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#60a5fa]">
                        <span>[{c.index}]</span>
                        {c.framework && (
                          <span className="truncate text-slate-400">
                            · {FRAMEWORK_LABELS[c.framework] || c.framework}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs font-medium leading-snug text-slate-100">
                        {c.source_title}
                      </p>
                    </div>
                    {simPct != null && (
                      <span className="shrink-0 font-mono text-[11px] font-semibold text-[#22f59d] tabular-nums">
                        {simPct}%
                      </span>
                    )}
                  </div>
                  {c.snippet && (
                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-400">
                      {c.snippet}
                    </p>
                  )}
                  <a
                    href={c.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400 transition-colors hover:text-[#60a5fa]"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="max-w-[210px] truncate">
                      {c.source_url.replace(/^https?:\/\//, "")}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Ask Analyst Panel */}
      <section className="surface-panel rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-sm font-bold text-white">
            <MessageSquare className="h-4 w-4 text-[#22f59d]" />
            Ask Analyst
          </h3>
          <span className="font-mono text-[11px] text-slate-400">
            Report-grounded
          </span>
        </div>

        <p className="mb-3 text-xs text-slate-400">
          Interrogate any claim, assumption, or financial metric in this report.
        </p>

        {messages.length === 0 && (
          <div className="mb-3 flex flex-col gap-1.5">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleAsk(q)}
                className="surface-subpanel surface-interactive rounded-lg px-3 py-2 text-left text-[11px] text-slate-300 hover:text-white"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {messages.length > 0 && (
          <div className="mb-3 max-h-60 space-y-2.5 overflow-y-auto pr-1">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`rounded-xl p-2.5 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "ml-4 border border-[#4a8fff]/35 bg-[#4a8fff]/12 text-white"
                    : "surface-subpanel mr-2 text-slate-200"
                }`}
              >
                <p className="whitespace-pre-wrap">{m.text}</p>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-2 border-t border-slate-800 pt-1.5 font-mono text-[10px] text-[#60a5fa]">
                    {m.sources.map((s, sIdx) => (
                      <span key={sIdx}>
                        {s.framework}
                        {s.citation_index != null ? ` [${s.citation_index}]` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {asking && (
              <div className="surface-subpanel flex items-center gap-2 rounded-xl p-2.5 text-xs text-slate-400">
                <Sparkles className="h-3.5 w-3.5 text-[#4a8fff]" />
                Synthesizing answer from grounded frameworks…
              </div>
            )}
          </div>
        )}

        {askError && (
          <p className="mb-2 rounded-lg border border-[#f05252]/30 bg-[#f05252]/10 p-2 text-[11px] text-[#fca5a5]">
            {askError}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex items-center gap-2"
        >
          <label htmlFor="ask-analyst-input" className="sr-only">
            Ask a question about this report
          </label>
          <input
            id="ask-analyst-input"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about risks, TAM, pricing…"
            className="min-w-0 flex-1 rounded-lg border border-slate-700/80 bg-[#050a18] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-[#4a8fff] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!question.trim() || asking}
            aria-label="Send question"
            className="btn-primary-glow inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-all disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </section>

      {/* Compare Version Action Card */}
      <section className="surface-panel rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-display text-sm font-bold text-white">
            <GitCompare className="h-4 w-4 text-[#a5b4fc]" />
            Compare Versions
          </h3>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          Diff confidence, TAM/SAM/SOM sizing, and framework verification across
          saved analyses.
        </p>
        <button
          type="button"
          onClick={onOpenCompare}
          disabled={!compareAvailable}
          className="surface-subpanel surface-interactive mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:text-white disabled:opacity-40"
        >
          {compareAvailable
            ? "Compare With Another Report"
            : "Save 2+ Projects to Compare"}
        </button>
      </section>
    </aside>
  );
}
