import type { AgentResult } from "@/types";

const ROLE_META: Record<
  AgentResult["agent"],
  { label: string; color: string; icon: string; description: string }
> = {
  causal_analyst: {
    label: "Causal Analyst",
    color: "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
    icon: "🔗",
    description: "Builds cause-and-effect chains",
  },
  skeptic: {
    label: "Skeptic",
    color: "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
    icon: "🤨",
    description: "Challenges assumptions and weak links",
  },
  pattern_matcher: {
    label: "Pattern Matcher",
    color: "border-green-500 bg-green-50 dark:bg-green-950/30",
    icon: "🔍",
    description: "Compares to known failure patterns",
  },
  impact_analyzer: {
    label: "Impact Analyzer",
    color: "border-red-500 bg-red-50 dark:bg-red-950/30",
    icon: "💥",
    description: "Forecasts consequences if unaddressed",
  },
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 75 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
        <div className={`${color} h-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function AgentCard({ result }: { result: AgentResult }) {
  const meta = ROLE_META[result.agent];

  return (
    <div
      className={`rounded-xl border-l-4 p-5 space-y-4 ${meta.color} border border-zinc-200 dark:border-zinc-700`}
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{meta.icon}</span>
          <span className="font-semibold text-zinc-800 dark:text-zinc-100">
            {meta.label}
          </span>
        </div>
        <p className="text-xs text-zinc-500">{meta.description}</p>
      </div>

      {/* Summary */}
      <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
        {result.agent_summary}
      </p>

      {/* Hypotheses */}
      <div className="space-y-3">
        {result.top_hypotheses.map((h, i) => (
          <div key={i} className="space-y-1">
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              {i + 1}. {h.title}
            </p>
            <ConfidenceBar value={h.confidence} />
            {h.next_checks.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {h.next_checks.slice(0, 2).map((c, ci) => (
                  <li
                    key={ci}
                    className="text-xs text-zinc-500 dark:text-zinc-400 pl-3 border-l-2 border-zinc-300 dark:border-zinc-600"
                  >
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
