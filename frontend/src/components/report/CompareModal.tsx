import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { computeProjectComparison, computeReportStats } from "../../lib/reportStats";
import type { SavedProject } from "../../types/groundly";
import { FRAMEWORK_LABELS } from "./frameworkMeta";

export function CompareModal({
  currentProject,
  projects,
  onClose,
}: {
  currentProject: SavedProject;
  projects: SavedProject[];
  onClose: () => void;
}) {
  const candidates = projects.filter((p) => p.id !== currentProject.id);
  const [otherId, setOtherId] = useState(candidates[0]?.id ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const otherProject =
    candidates.find((p) => p.id === otherId) || candidates[0];

  if (!otherProject) return null;

  const statsA = computeReportStats(currentProject.report);
  const statsB = computeReportStats(otherProject.report);
  const cmp = computeProjectComparison(otherProject, currentProject);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="compare-modal-title"
    >
      <div
        className="surface-panel max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
              Scenario & Version Comparison
            </p>
            <h2
              id="compare-modal-title"
              className="mt-0.5 font-display text-lg font-bold text-white"
            >
              Side-by-Side Strategic Diff
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close version comparison"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-[#080f1f] text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Selector row */}
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-11 md:items-center">
          <div className="rounded-xl border border-slate-800 bg-[#080f1f] p-3 md:col-span-5">
            <label
              htmlFor="compare-baseline-select"
              className="block font-mono text-[10px] uppercase text-slate-400"
            >
              Baseline Report
            </label>
            <select
              id="compare-baseline-select"
              value={otherProject.id}
              onChange={(e) => setOtherId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0c1426] px-2.5 py-1.5 text-xs font-medium text-white focus:border-[#4a8fff] focus:outline-none"
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.versionLabel})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center md:col-span-1">
            <ArrowRight className="h-4 w-4 text-slate-500" />
          </div>

          <div className="rounded-xl border border-[#4a8fff]/40 bg-[#4a8fff]/10 p-3 md:col-span-5">
            <span className="block font-mono text-[10px] uppercase text-[#60a5fa]">
              Active Report
            </span>
            <p className="mt-1 truncate text-sm font-semibold text-white">
              {currentProject.title} ({currentProject.versionLabel})
            </p>
          </div>
        </div>

        {/* Key Metric Diff Row */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-[#080f1f] p-3">
            <p className="text-[11px] text-slate-400">Confidence</p>
            <p className="mt-1 font-mono text-base font-bold text-white tabular-nums">
              {statsB.confidencePct}% → {statsA.confidencePct}%
            </p>
            <p
              className={`mt-0.5 font-mono text-[11px] tabular-nums ${
                cmp.confidenceDelta >= 0 ? "text-[#14d8a3]" : "text-[#f5b041]"
              }`}
            >
              {cmp.confidenceDelta >= 0 ? "+" : ""}
              {cmp.confidenceDelta}% delta
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#080f1f] p-3">
            <p className="text-[11px] text-slate-400">Citations</p>
            <p className="mt-1 font-mono text-base font-bold text-white tabular-nums">
              {statsB.totalCitations} → {statsA.totalCitations}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400 tabular-nums">
              {cmp.citationDelta >= 0 ? "+" : ""}
              {cmp.citationDelta} sources
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#080f1f] p-3">
            <p className="text-[11px] text-slate-400">TAM Sizing</p>
            <p className="mt-1 font-mono text-sm font-bold text-white tabular-nums">
              {cmp.tamA} → {cmp.tamB}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">Total market</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#080f1f] p-3">
            <p className="text-[11px] text-slate-400">SOM Wedge</p>
            <p className="mt-1 font-mono text-sm font-bold text-[#14d8a3] tabular-nums">
              {cmp.somA} → {cmp.somB}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">Obtainable target</p>
          </div>
        </div>

        {/* Framework Verification Matrix */}
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#080f1f]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-[#0c1426] font-mono text-[11px] uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2.5">Framework</th>
                <th className="px-4 py-2.5">{otherProject.title}</th>
                <th className="px-4 py-2.5">{currentProject.title}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {cmp.frameworkDiffs.map((row) => (
                <tr key={row.key} className="hover:bg-slate-900/50">
                  <td className="px-4 py-2.5 font-medium text-slate-200">
                    {FRAMEWORK_LABELS[row.key] || row.key}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                      {row.verifiedA ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#14d8a3]" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-[#f5b041]" />
                      )}
                      {row.verifiedA ? "Verified" : "Needs sourcing"} ·{" "}
                      {row.citationsA} src
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                      {row.verifiedB ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#14d8a3]" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-[#f5b041]" />
                      )}
                      {row.verifiedB ? "Verified" : "Needs sourcing"} ·{" "}
                      {row.citationsB} src
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
