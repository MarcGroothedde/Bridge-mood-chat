# Bridge Mood-Aware Chat (Next.js + Claude)

Small prototype that detects user mood, routes to a supportive or exploratory mode, and streams Claude responses to the UI.

## Running the app

1. Install dependencies

```bash
npm install
```

2. Set your Claude key (keep it in `.env` file)

```
It is not deployed to GitHub.
```

3. Start the dev server

```bash
npm run dev
```

4. Open `http://localhost:3000`

## How it works

- Mood detection lives in `lib/mood.ts` (lexicon + simple heuristics).
- API route `app/api/chat/route.ts` runs detection, picks a mode, and streams Claude (`claude-sonnet-4-20250514`) token-by-token.
- UI in `app/page.tsx` shows chat, the selected mode, and rationale as soon as streaming begins.

## Test data (required cases)

| #   | Test Message                        | Expected Mood           | Expected Mode | Why This Case Matters                     |
| --- | ----------------------------------- | ----------------------- | ------------- | ----------------------------------------- |
| 1   | I'm so stressed about work          | Negative                | Supportive    | Clear negative signal                     |
| 2   | That's interesting, tell me more    | Positive                | Exploratory   | Engaged + curious                         |
| 3   | I'm fine                            | Neutral                 | Exploratory   | Masked emotion / neutral phrasing         |
| 4   | Great, just great.                  | Negative (sarcasm risk) | Supportive    | Sarcasm / ambiguous tone                  |
| 5   | I'm excited but also nervous        | Mixed                   | Exploratory   | Mixed signals push to neutral/exploratory |
| 6   | Ok                                  | Neutral                 | Exploratory   | Very short, low-signal                    |
| 7   | I'm exhausted and overwhelmed       | Negative                | Supportive    | Strong distress cues                      |
| 8   | This could be good, not sure yet    | Neutral                 | Exploratory   | Soft positive + uncertainty               |
| 9   | I'm curious how this works          | Positive                | Exploratory   | Curious, inviting detail                  |
| 10  | I'm frustrated things keep breaking | Negative                | Supportive    | Frustration and repetition                |

## Edge cases (at least 3)

- Sarcasm: "Great, just great."
  - Hard because wording is positive but tone is negative.
  - Heuristic marks it negative if no positive matches beyond "great" and presence of repetition; routes Supportive.
  - In production: add sentiment from a small model or prosody/emoji cues.
- Masked emotions: "I'm fine."
  - Minimal cues; defaults neutral -> Exploratory.
  - In production: track user history, cadence, and follow-up probes to reveal hidden distress.
- Mixed signals: "I'm excited but also nervous."
  - Positive + negative terms. Heuristic nets to neutral and chooses Exploratory with a careful follow-up.
  - In production: use a classifier that supports multi-label intensities; keep both threads active.
- Very short responses: "ok" / "sure"
  - Almost no signal; stays neutral -> Exploratory.
  - In production: consider recent context, latency, and brevity patterns to detect disengagement.

## Accuracy reflection

- Rough accuracy on the 10 cases: 8/10 (miss risk on sarcasm; borderline on "fine").
- Struggles most with sarcasm, masked negativity, and ultra-short replies.
- Prefer false negatives over false positives: missing some negativity is safer than overreacting, but add a quick clarifying question when confidence is low.

## Decision log

- Mood detection approach: Hand-built lexicon with weights, intensifier + negation modifiers, and a neutral fallback for low-signal messages. Considered calling Claude for classification but avoided extra latency and kept determinism for the prototype.
- Streaming implementation: Next.js app route + Claude streaming SDK; first chunk carries `META:{...}` with mood/mode so the UI can surface the decision immediately.
- Project structure: Lean App Router setup. `lib/mood.ts` for logic, `app/api/chat/route.ts` for server-side routing + streaming, `app/page.tsx` for UI. With more time: add shared message types, persistence, and trace logging.
- Time allocation: ~40 min planning + mood heuristic, ~35 min API + streaming, ~25 min UI wiring, ~15 min docs/tests, buffer for polish.
