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

## Progress & Completed Milestones

- **Phase 1: Real-time Multimodal Integration:** Successfully connected Gemini Live to the frontend via WebSockets (`BidiGenerateContent`), enabling live video feed processing from the user's camera (at ~1FPS sampling) alongside bi-directional audio instructions.
- **Phase 2: Agentic Tool Orchestration:** Wired Gemini Live with Function Declarations/Tool Calling giving the AI the ability to decide *when* a visual guide is necessary based on conversational context.
- **Phase 3: Veo 3.1 Integration:** Built asynchronous tool-handling endpoints (`/api/generate-video` and `/api/poll-video`) to interface with Google's long-running video generation REST API.
- **Phase 4: Dynamic UI:** Built an responsive streaming UI where active task views shift between live camera and high-fidelity Veo demonstrations seamlessly.
- **Phase 5: Asynchronous Media Gallery & Session History:** Shifted to a non-blocking UI queue paradigm. Videos now generate in the background and populate a responsive side gallery component. Users can toggle through their active session's generated media or cancel pending requests without losing their real-time camera connection to the AI.

## Immediate Tasks / Backlog

- [x] **App Platform Decision:** Finalized as a web-first application using Next.js with unified mobile/desktop camera support.
- [x] **Gemini Live Integration:** Connected BidiGenerateContent WebSockets for real-time video perception and multimodal instruction.
- [x] **Video Request Queueing:** Currently, if Gemini calls the video generation tool multiple times in succession, the first request is tracked while others may drop or overwrite the active player state. We need a request tracking queue.
- [x] **Media Gallery UI (Asynchronous UI):** Replace the blocking full-screen loading state for Veo video generation. Add a side gallery for pending, generating, and completed media. Allow users to select generated frames/videos from the gallery to view at their convenience without interrupting the live camera session.
- [x] **Media Session History:** Store a temporary cache of generated videos and images so users don't lose media once they transition back to the live camera view. Allow traversing past generated guides.
- [x] **Mute On/Off:** Mute on/off microphone.
- [ ] **State Synchronization (Completion Sync):** Send system events to Gemini when a video generation request completes so the model knows the media is available.
- [ ] **State Synchronization (Attention Sync):** Notify Gemini when the user changes their active view (e.g., switches between live camera and looking at a generated video).
- [ ] **State Synchronization (Memory/Tooling):** Add a `query_media_cache` tool for Gemini to check the user's media history and pull up videos to co-review with the user.
- [ ] **Sharing Capabilities:** Add the ability to share (export) generated images/videos externally, as well as an upload/share mechanism (import) for users to send existing images or videos *to* Gemini for context understanding if they can't point their live camera at it.
- [ ] **Task State Machine:** Implement robust workflow state logging for deterministic physical tasks (e.g., changing a tire).
- [ ] **Safety Guidelines:** Define strict system safety instructions for each critical step in the AI orchestration prompts.
- [ ] **Demo Mode & Fallbacks:** Create a deterministic demo script with local fallback assets to handle potential network or API instability during hackathon judging.
- [ ] **Interactive Framed Edit Mode:** Allow a user to pause on a frame of a video or a static image, enter an editing mode, and point/annotate/draw on it to get clarification on specific components (e.g., "What is *this* particular lug nut?").

## Technical Reality And Guardrails

- Latency is expected for generated media; UX includes buffering and polling visualizations. Wait times for Veo 3.1 video generation are currently around 1-3 minutes.
- Real-time models limit WebSocket outputs exclusively to `gemini-3.1-flash-live-preview`.
- Safety is mandatory for physical tasks:
  - Always gate dangerous steps behind safety checks.
  - Require parking brake and stable jack confirmation before lift steps.
  - Escalate uncertainty to "stop and verify" instead of guessing.

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

## Local Development

```bash
git clone https://github.com/CarlyAThomas/Causeway-AI.git
cd Causeway-AI
npm install
npm run dev
```

Open http://localhost:3000.

For now, keep development in mock mode until organizer API access is confirmed.
