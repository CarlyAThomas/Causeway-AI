"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/types";
import { SAMPLE_INCIDENT } from "@/data/sample-incident";
import AgentCard from "@/components/AgentCard";
import DisagreementPanel from "@/components/DisagreementPanel";
import FinalHypothesesPanel from "@/components/FinalHypothesesPanel";
import DecisionSignalsPanel from "@/components/DecisionSignalsPanel";

export default function AnalyzerForm() {
  const [incident, setIncident] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    const text = incident.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incident_text: text }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Unknown error");
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-10 space-y-10">
      {/* Input */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            Incident Input
          </h2>
          <button
            onClick={() => setIncident(SAMPLE_INCIDENT)}
            className="text-sm text-indigo-500 hover:text-indigo-400 underline transition-colors"
          >
            Load sample incident
          </button>
        </div>
        <textarea
          value={incident}
          onChange={(e) => setIncident(e.target.value)}
          placeholder="Paste your logs, incident notes, or any messy text here…"
          rows={10}
          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 font-mono text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || !incident.trim()}
          className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Analyzing…" : "Run Analysis"}
        </button>
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </section>

      {/* Results */}
      {result && (
        <>
          {result.mock && (
            <p className="text-xs text-amber-500 font-medium uppercase tracking-wide">
              ⚠ Mock mode — add GEMINI_API_KEY to .env.local for live analysis
            </p>
          )}

          {/* Agent Cards */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
              Agent Perspectives
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {result.agent_results.map((agent) => (
                <AgentCard key={agent.agent} result={agent} />
              ))}
            </div>
          </section>

          {/* Disagreement Panel */}
          <DisagreementPanel disagreements={result.disagreements} />

          {/* Final Hypotheses */}
          <FinalHypothesesPanel hypotheses={result.final_hypotheses} />

          {/* Decision Signals */}
          <DecisionSignalsPanel signals={result.decision_signals} />
        </>
      )}
    </div>
  );
}
