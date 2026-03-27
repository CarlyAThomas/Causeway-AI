# Causeway AI

> **Multi-Perspective Reasoning Engine** — bridges different lines of reasoning to analyze complex problems.

Causeway analyzes messy incidents, logs, or decisions by running four specialized AI agents in parallel. Each agent takes a different perspective, challenges the others, and the system synthesizes their outputs into ranked root-cause hypotheses, disagreement zones, and actionable decision signals.

---

## The Problem

Single-answer AI misses uncertainty. Real understanding of complex failures comes from **conflicting perspectives** — that tension is where insight lives.

## The Solution

Four specialist agents analyze the same input simultaneously:

| Agent | Role |
|---|---|
| 🔗 **Causal Analyst** | Builds cause-and-effect chains |
| 🤨 **Skeptic** | Challenges assumptions and finds weak links |
| 🔍 **Pattern Matcher** | Compares signals to known failure patterns |
| 💥 **Impact Analyzer** | Forecasts consequences if unaddressed |

The system then computes:
- **Disagreement zones** — where agents conflict most (highest uncertainty = highest insight value)
- **Ranked hypotheses** — synthesized across agents, sorted by decision priority
- **Decision signals** — statistically-grounded action guidance

---

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4**
- **Gemini API** (Google AI Studio) — mock mode available for local dev
- No database, no auth — single-page demo

---

## Local Development

```bash
git clone https://github.com/CarlyAThomas/Causeway-AI.git
cd Causeway-AI
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Mock mode** is on by default (no API key needed). To use real Gemini:

```bash
# .env.local
MOCK_MODE=false
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash   # confirm model ID with organizers
```

---

## Project Structure

```
src/
  app/
    api/analyze/route.ts    ← API route (mock + real mode)
    page.tsx                ← Main UI entry
  components/
    AnalyzerForm.tsx         ← Input + results orchestration
    AgentCard.tsx            ← Per-agent perspective card
    DisagreementPanel.tsx    ← Conflict zones
    FinalHypothesesPanel.tsx ← Ranked synthesis
    DecisionSignalsPanel.tsx ← Action guidance
  lib/
    agents/prompts.ts        ← System prompts for all four agents
    scoring/disagree.ts      ← Disagreement + decision priority scoring
  data/
    sample-incident.ts       ← Demo incident log
    mock-result.ts           ← Full mock analysis payload
  types/index.ts             ← All shared TypeScript types
```

---

## MVP Scope (Hackathon)

**Must have:**
- [ ] Incident input + sample load
- [ ] Four agent perspective cards
- [ ] Disagreement zones panel
- [ ] Ranked hypotheses with decision priority
- [ ] Decision signals panel

**Nice to have (if time allows):**
- [ ] TTS playback per agent summary
- [ ] Copy-to-clipboard report

**Out of scope:**
- Auth, user accounts, database, multi-user collaboration, streaming

---

## Demo Script (60 seconds)

1. **Hook** — "Debugging complex systems is hard because we rely on a single perspective."
2. **What it does** — "Causeway runs four specialized AI agents on the same incident. They disagree, challenge each other, and the system shows you exactly where the uncertainty lives."
3. **Demo** — load sample → run analysis → point to disagreement zones → show ranked root causes
4. **Close** — "Instead of one answer, you see how reasoning emerges from competing perspectives — and where you need more evidence before acting."
