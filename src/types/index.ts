export type AgentRole =
  | "causal_analyst"
  | "skeptic"
  | "pattern_matcher"
  | "impact_analyzer";

export interface Hypothesis {
  title: string;
  causal_chain: string[];
  evidence: string[];
  confidence: number; // 0.0 – 1.0
  assumptions: string[];
  next_checks: string[];
}

export interface AgentResult {
  agent: AgentRole;
  top_hypotheses: Hypothesis[];
  agent_summary: string;
}

export interface DisagreementEntry {
  topic: string;
  agents_in_conflict: AgentRole[];
  conflict_description: string;
  disagreement_score: number; // 0.0 – 1.0
  resolution_suggestion: string;
}

export interface DecisionSignal {
  label: string;
  value: number | string;
  interpretation: string;
}

export interface FinalHypothesis {
  title: string;
  confidence_mean: number;
  confidence_variance: number;
  supporting_agents: AgentRole[];
  evidence_count: number;
  source_diversity: number;
  contradiction_rate: number;
  blast_radius: "low" | "medium" | "high";
  reversibility: "easy" | "moderate" | "hard";
  time_criticality: "minutes" | "hours" | "days";
  decision_priority: number; // computed score
  causal_chain: string[];
}

export interface AnalysisResult {
  incident_text: string;
  agent_results: AgentResult[];
  disagreements: DisagreementEntry[];
  final_hypotheses: FinalHypothesis[];
  decision_signals: DecisionSignal[];
  mock: boolean;
}

export interface AnalyzeRequest {
  incident_text: string;
  mock?: boolean;
}

export interface MediaRequest {
  id: string;
  type: 'video' | 'image';
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled';
  prompt: string;
  url?: string;
  thumbnail?: string; // [UX BRIDGE]: Blurred camera frame for processing state
  timestamp: number;
}

export interface VeoVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  stepNumber: number;
}
