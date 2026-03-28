export interface TaskPlan {
  current_goal: string;
  next_step: string;
  safety_checks: string[];
  estimated_effort: "low" | "medium" | "high";
  progress_pct: number;
}

export const INITIAL_PLAN: TaskPlan = {
  current_goal: "Awaiting Scene Context...",
  next_step: "Observe the environment",
  safety_checks: ["Ensure safety goggles (if applicable)", "Check for stable ground"],
  estimated_effort: "low",
  progress_pct: 0,
};
