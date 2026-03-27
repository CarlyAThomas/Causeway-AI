import type { DisagreementEntry } from "@/types";

function DisagreementMeter({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70 ? "bg-red-500" : pct >= 45 ? "bg-amber-500" : "bg-yellow-400";
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
        <div className={`${color} h-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 w-8 text-right font-medium">{pct}</span>
    </div>
  );
}

export default function DisagreementPanel({
  disagreements,
}: {
  disagreements: DisagreementEntry[];
}) {
  if (!disagreements.length) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          Disagreement Zones
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Where agents conflict — highest uncertainty, highest insight value
        </p>
      </div>
      <div className="space-y-3">
        {disagreements.map((d, i) => (
          <div
            key={i}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">
                {d.topic}
              </p>
              <div className="flex gap-1 shrink-0">
                {d.agents_in_conflict.map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-600 dark:text-zinc-400"
                  >
                    {a.replace("_", " ")}
                  </span>
                ))}
              </div>
            </div>
            <DisagreementMeter score={d.disagreement_score} />
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {d.conflict_description}
            </p>
            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 px-4 py-3">
              <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                Resolution path
              </p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                {d.resolution_suggestion}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
