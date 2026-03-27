import type { DecisionSignal } from "@/types";

export default function DecisionSignalsPanel({
  signals,
}: {
  signals: DecisionSignal[];
}) {
  if (!signals.length) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          Decision Signals
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Statistically-grounded action guidance derived from the analysis
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {signals.map((s, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-1"
          >
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              {s.label}
            </p>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
              {typeof s.value === "number" ? s.value : s.value}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {s.interpretation}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
