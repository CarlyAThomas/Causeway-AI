# Causeway AI

> **Interactive Physical Task Assistant** - a multimodal AI guide that watches what you are doing and shows the next manual step with generated video, image overlays, and adaptive audio.

This project is pivoting from text-only analysis into a real-time, camera-first assistant for hands-on tasks (starting with: changing a car tire).

## Why The Pivot

Hackathon judging strongly favors non-text output and demo impact:

- Innovation and wow factor: 30%
- Technical execution and functionality: 30%
- Potential impact and utility: 20%
- Aesthetically impressive: 10%
- Presentation quality: 10%

To align with that rubric, Causeway will focus on multimodal, live guidance instead of text-in/text-out reasoning.

## Product Vision

User opens "Project Mode," points a live camera at a real-world task, and gets step-by-step guidance generated for their exact context.

Example:
- Task: change a car tire.
- User streams live video of their wheel/tools.
- App analyzes progress in real time.
- App generates short custom "do this next" media clips (video/image/audio).

## Model Integration Plan

| Component | Model/API | Planned Role |
|---|---|---|
| Live perception and safety checks | Gemini Live | Real-time camera reasoning, progress tracking, and immediate corrective feedback |
| Step demonstration video | Veo | Generate short custom video clips for the next step |
| Visual overlays / diagrams | Nano Banana | Generate high-detail diagrams, stills, and visual callouts |
| Audio guidance / ambience | Lyria | Generate adaptive instructional audio and supportive sound design |
| Orchestration LLM | Gemini Flash | Fast coordinator for step planning, prompt assembly, and state transitions |
| Optional external model (not hackathon stack) | Claude | Team-proposed fallback assistant for non-core tasks; not primary in judging path |
| Development workflow support | Antigravity + Gemini Flash | Iterative review-agent-led development inside AI-native IDE workflows |

## High-Level Runtime Architecture

Continuous loop:

1. Observe
- Ingest live camera frames.
- Detect tools, object states, and user progress.

2. Plan
- Determine next safest actionable step.
- Build prompts using scene context + task state.

3. Generate
- Veo creates a short step demo clip.
- Nano Banana creates optional still/overlay.
- Lyria creates synchronized instruction audio.

4. Instruct
- UI presents "next action" media packet.
- System speaks concise instructions.

5. Verify
- Live perception checks user execution.
- If incorrect/unsafe, trigger correction path immediately.

## Technical Reality And Guardrails

- API access is currently pending; architecture is designed to support mock endpoints first.
- Latency is expected for generated media; UX must include buffering messages and prefetching the next step.
- Safety is mandatory for physical tasks:
  - Always gate dangerous steps behind safety checks.
  - Require parking brake and stable jack confirmation before lift steps.
  - Escalate uncertainty to "stop and verify" instead of guessing.

## Build Plan (Phased)

### Phase 0 - API-Unblocked Prototype (Now)

- Build end-to-end state machine with mocked Veo/Lyria/Nano Banana outputs.
- Keep Gemini Flash as the orchestration brain in mock mode.
- Validate user flow, timing, and UI behavior before API keys arrive.

Deliverable:
- Reliable clickable demo that shows Observe -> Plan -> Generate -> Instruct -> Verify flow.

### Phase 1 - Live Perception Integration

- Integrate Gemini Live for camera understanding and progress verification.
- Add safety rule layer and confidence thresholds.

Deliverable:
- Real-time state transitions based on user actions.

### Phase 2 - Generative Media Integration

- Replace placeholders with Veo, Nano Banana, and Lyria calls.
- Add retries, fallbacks, and caching for generated assets.

Deliverable:
- True multimodal step guidance for at least one full task.

### Phase 3 - Demo Hardening

- Optimize visual polish and pacing.
- Add deterministic "demo mode" to avoid live failures.
- Prepare backup assets for network/API instability.

Deliverable:
- Competition-ready 3-5 minute demo flow.

## Current Proposed Task Scope

Primary demo scenario:
- Changing a car tire safely and correctly.

Stretch scenarios:
- Bike chain reset.
- Furniture assembly step verification.
- Basic home maintenance guided actions.

## Team Decision Notes

- Preferred orchestrator baseline: Gemini Flash.
- Add other models only where they clearly improve output quality or speed.
- Keep Claude out of the core judged stack unless explicitly needed for internal support tooling.

## Kaggle Video Plan (3-5 Minutes)

1. Problem and opportunity (30-45s)
- Why static text instructions fail during physical tasks.
- Why multimodal live guidance is different.

2. Product walkthrough (60-90s)
- Show camera-first experience.
- Show one full step cycle with feedback.

3. How it works technically (60-90s)
- Explain model orchestration pipeline.
- Explain safety and latency handling.

4. Build process and constraints (45-60s)
- API availability challenge and mock-first strategy.
- What was implemented now vs. post-access integrations.

5. Impact and closing (30-45s)
- Utility for hands-on learners and high-stress situations.
- Why this is scalable beyond tire changing.

## Immediate Next Actions

- [ ] Finalize app platform decision (web-first with mobile camera support vs React Native).
- [ ] Implement state machine for tire-change task with mocked media generation.
- [ ] Define strict system safety instructions for each critical step.
- [ ] Create deterministic demo script with fallback assets.
- [ ] Integrate real APIs as access is granted.

## Local Development

```bash
git clone https://github.com/CarlyAThomas/Causeway-AI.git
cd Causeway-AI
npm install
npm run dev
```

Open http://localhost:3000.

For now, keep development in mock mode until organizer API access is confirmed.
