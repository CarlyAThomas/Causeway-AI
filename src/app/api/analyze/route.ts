import { NextRequest, NextResponse } from "next/server";
import type { AnalyzeRequest, AnalysisResult, AgentResult } from "@/types";
import { MOCK_RESULT } from "@/data/mock-result";
import { AGENT_SYSTEM_PROMPTS, buildUserMessage } from "@/lib/agents/prompts";
import {
  computeDisagreements,
  computeFinalHypotheses,
  computeDecisionSignals,
} from "@/lib/scoring/disagree";

// ---------------------------------------------------------------------------
// Toggle: set NEXT_PUBLIC_MOCK_MODE=true in .env.local to skip real API calls
// ---------------------------------------------------------------------------
const MOCK_MODE = process.env.MOCK_MODE === "true" || (!process.env.GEMINI_API_KEY && !process.env.NEXT_PUBLIC_GEMINI_API_KEY);

// ---------------------------------------------------------------------------
// Real agent call (stubbed — fill in model ID and endpoint on hackathon day)
// ---------------------------------------------------------------------------
async function callAgent(
  role: keyof typeof AGENT_SYSTEM_PROMPTS,
  incidentText: string
): Promise<AgentResult> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
  // TODO: confirm exact model ID with organizers (Nano Banana / Gemini Live / etc.)
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: AGENT_SYSTEM_PROMPTS[role] }] },
    contents: [{ role: "user", parts: [{ text: buildUserMessage(incidentText) }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error for ${role}: ${res.status} ${err}`);
  }

  const json = await res.json();
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(raw) as AgentResult;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  let body: AnalyzeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { incident_text, mock } = body;

  if (!incident_text?.trim()) {
    return NextResponse.json({ error: "incident_text is required" }, { status: 400 });
  }

  // Return mock data immediately if mock mode is active
  if (MOCK_MODE || mock) {
    return NextResponse.json({ ...MOCK_RESULT, incident_text, mock: true });
  }

  // Real path — run all four agents in parallel
  try {
    const [causal_analyst, skeptic, pattern_matcher, impact_analyzer] =
      await Promise.all([
        callAgent("causal_analyst", incident_text),
        callAgent("skeptic", incident_text),
        callAgent("pattern_matcher", incident_text),
        callAgent("impact_analyzer", incident_text),
      ]);

    const agent_results: AgentResult[] = [
      causal_analyst,
      skeptic,
      pattern_matcher,
      impact_analyzer,
    ];

    const disagreements = computeDisagreements(agent_results);
    const final_hypotheses = computeFinalHypotheses(agent_results);
    const decision_signals = computeDecisionSignals(final_hypotheses, disagreements);

    const result: AnalysisResult = {
      incident_text,
      agent_results,
      disagreements,
      final_hypotheses,
      decision_signals,
      mock: false,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: "Analysis failed. Check server logs." },
      { status: 500 }
    );
  }
}
