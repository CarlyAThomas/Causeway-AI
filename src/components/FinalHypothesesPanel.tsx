import type { FinalHypothesis } from "@/types";

const BLAST_COLOR = {
  high: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  low: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
};

const REVERSIBILITY_COLOR = {
  easy: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  moderate: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  hard: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

const TIME_COLOR = {
  minutes: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  hours: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  days: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
};

export default function FinalHypothesesPanel({
  hypotheses,
}: {
  hypotheses: FinalHypothesis[];
}) {
  if (!hypotheses.length) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          Ranked Hypotheses
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Synthesized across all agents · sorted by decision priority
        </p>
      </div>

      <div className="space-y-3">
        {hypotheses.map((h, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 space-y-4"
          >
            {/* Title + priority */}
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {h.title}
                </p>
                <p className="text-xs text-zinc-500">
                  Priority score: <span className="font-mono font-medium">{h.decision_priority}</span>
                  {" · "}Confidence: <span className="font-mono font-medium">{Math.round(h.confidence_mean * 100)}%</span>
                  {" · "}Supporting agents: {h.supporting_agents.map(a => a.replace("_", " ")).join(", ")}
                </p>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className={`rounded-full px-2.5 py-0.5 ${BLAST_COLOR[h.blast_radius]}`}>
                blast: {h.blast_radius}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 ${REVERSIBILITY_COLOR[h.reversibility]}`}>
                reversibility: {h.reversibility}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 ${TIME_COLOR[h.time_criticality]}`}>
                act within: {h.time_criticality}
              </span>
              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-zinc-600 dark:text-zinc-400">
                {h.evidence_count} signals · {h.source_diversity} source types
              </span>
            </div>

            {/* Causal chain */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Causal chain
              </p>
              <ol className="space-y-1">
                {h.causal_chain.map((step, si) => (
                  <li key={si} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-400 font-mono text-[10px]">
                      {si + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
