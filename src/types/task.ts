export interface WorldState {
  tools_detected: string[];
  object_states: Record<string, string>; // e.g., {"wheel": "bolted", "jack": "not_positioned"}
  current_step: string;
  progress_pct: number;
}

export const INITIAL_WORLD_STATE: WorldState = {
  tools_detected: [],
  object_states: {},
  current_step: "Initializing Observation...",
  progress_pct: 0,
};
