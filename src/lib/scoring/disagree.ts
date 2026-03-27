import type { AgentResult, DisagreementEntry, FinalHypothesis, DecisionSignal } from "@/types";

/**
 * Disagreement score formula:
 *   0.5 × (1 - cause_overlap) + 0.3 × confidence_spread + 0.2 × contradiction_rate
 *
 * Returns 0.0 (full agreement) → 1.0 (maximum disagreement)
 */
function hypothesisOverlap(titlesA: string[], titlesB: string[]): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const wordsA = new Set(titlesA.flatMap((t) => normalize(t).split(" ")));
  const wordsB = new Set(titlesB.flatMap((t) => normalize(t).split(" ")));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 1 : intersection / union;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export function computeDisagreements(agents: AgentResult[]): DisagreementEntry[] {
  const disagreements: DisagreementEntry[] = [];

  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i];
      const b = agents[j];

      const titlesA = a.top_hypotheses.map((h) => h.title);
      const titlesB = b.top_hypotheses.map((h) => h.title);
      const overlap = hypothesisOverlap(titlesA, titlesB);

      const confsA = a.top_hypotheses.map((h) => h.confidence);
      const confsB = b.top_hypotheses.map((h) => h.confidence);
      const spread = stddev([...confsA, ...confsB]);

      // Simple contradiction rate: proportion of evidences that appear in one but not both
      const evidenceA = new Set(a.top_hypotheses.flatMap((h) => h.evidence));
      const evidenceB = new Set(b.top_hypotheses.flatMap((h) => h.evidence));
      const totalE = new Set([...evidenceA, ...evidenceB]).size;
      const sharedE = [...evidenceA].filter((e) => evidenceB.has(e)).length;
      const contradictionRate = totalE === 0 ? 0 : 1 - sharedE / totalE;

      const score =
        0.5 * (1 - overlap) + 0.3 * Math.min(spread, 1) + 0.2 * contradictionRate;

      if (score > 0.3) {
        disagreements.push({
          topic: `${a.agent} vs ${b.agent}`,
          agents_in_conflict: [a.agent, b.agent],
          conflict_description: `${a.agent} and ${b.agent} diverge on root cause framing.`,
          disagreement_score: Math.round(score * 100) / 100,
          resolution_suggestion:
            "Gather additional evidence targeted at the highest-confidence claims from each agent.",
        });
      }
    }
  }

  return disagreements.sort((a, b) => b.disagreement_score - a.disagreement_score);
}

export function computeFinalHypotheses(agents: AgentResult[]): FinalHypothesis[] {
  // Group hypotheses by normalized title similarity, then score
  const allHypotheses = agents.flatMap((a) =>
    a.top_hypotheses.map((h) => ({ ...h, agent: a.agent }))
  );

  // For the API-driven version this will cluster properly;
  // for mock mode we just synthesize from the highest-confidence items
  const byTitle = new Map<string, typeof allHypotheses>();
  for (const h of allHypotheses) {
    const key = h.title.toLowerCase().slice(0, 40);
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(h);
  }

  const finals: FinalHypothesis[] = [];

  for (const [, group] of byTitle) {
    const confs = group.map((h) => h.confidence);
    const mean = confs.reduce((a, b) => a + b, 0) / confs.length;
    const variance =
      confs.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / confs.length;
    const supportingAgents = [...new Set(group.map((h) => h.agent))] as FinalHypothesis["supporting_agents"];
    const evidenceCount = new Set(group.flatMap((h) => h.evidence)).size;
    const sourceTypes = new Set(
      group
        .flatMap((h) => h.evidence)
        .map((e) => e.split(" ")[0])
    ).size;

    // Decision priority: impact × time_criticality × confidence × (1 + disagreement_if_high_risk)
    // We use heuristics here; refined in real mode
    const blastRadius: FinalHypothesis["blast_radius"] =
      mean > 0.75 ? "high" : mean > 0.5 ? "medium" : "low";
    const reversibility: FinalHypothesis["reversibility"] =
      variance < 0.03 ? "easy" : variance < 0.07 ? "moderate" : "hard";
    const timeCriticality: FinalHypothesis["time_criticality"] =
      mean > 0.75 ? "minutes" : mean > 0.5 ? "hours" : "days";

    const impactWeight = blastRadius === "high" ? 1.0 : blastRadius === "medium" ? 0.6 : 0.3;
    const timeWeight = timeCriticality === "minutes" ? 1.0 : timeCriticality === "hours" ? 0.6 : 0.3;
    const priority = Math.round(impactWeight * timeWeight * mean * (1 + variance) * 100) / 100;

    const representative = group.reduce((best, h) =>
      h.confidence > best.confidence ? h : best
    );

    finals.push({
      title: representative.title,
      confidence_mean: Math.round(mean * 100) / 100,
      confidence_variance: Math.round(variance * 1000) / 1000,
      supporting_agents: supportingAgents,
      evidence_count: evidenceCount,
      source_diversity: sourceTypes,
      contradiction_rate: Math.round(variance * 2 * 100) / 100,
      blast_radius: blastRadius,
      reversibility,
      time_criticality: timeCriticality,
      decision_priority: priority,
      causal_chain: representative.causal_chain,
    });
  }

  return finals.sort((a, b) => b.decision_priority - a.decision_priority).slice(0, 5);
}

export function computeDecisionSignals(finals: FinalHypothesis[], disagreements: DisagreementEntry[]): DecisionSignal[] {
  const top = finals[0];
  const topDisagreement = disagreements[0];

  return [
    {
      label: "Highest-priority hypothesis",
      value: top?.title ?? "—",
      interpretation: `Decision priority score: ${top?.decision_priority ?? 0}. Act on this first.`,
    },
    {
      label: "Blast radius",
      value: top?.blast_radius ?? "—",
      interpretation:
        top?.blast_radius === "high"
          ? "Escalate immediately."
          : "Contained — monitor closely.",
    },
    {
      label: "Time criticality",
      value: top?.time_criticality ?? "—",
      interpretation:
        top?.time_criticality === "minutes"
          ? "Requires immediate action."
          : "Has some runway but do not delay.",
    },
    {
      label: "Reversibility",
      value: top?.reversibility ?? "—",
      interpretation:
        top?.reversibility === "hard"
          ? "Act carefully — hard to undo."
          : "Relatively safe to try and roll back.",
    },
    {
      label: "Top disagreement zone",
      value: topDisagreement
        ? `${topDisagreement.topic} (score ${topDisagreement.disagreement_score})`
        : "No significant disagreement",
      interpretation: topDisagreement
        ? topDisagreement.resolution_suggestion
        : "Agents are broadly aligned.",
    },
    {
      label: "Evidence coverage",
      value: `${top?.evidence_count ?? 0} signals across ${top?.source_diversity ?? 0} source types`,
      interpretation:
        (top?.evidence_count ?? 0) >= 5
          ? "Good signal strength."
          : "Limited evidence — gather more before acting.",
    },
  ];
}
