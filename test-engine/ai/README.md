# AI / Voice Tests

Owner: `feature/ai-websocket`

Controlled, scenario-based behavioral evaluation of a live CATI agent:
greeting, intent recognition, context/memory, RAG grounding,
multilingual handling, and guardrails.

Full scenario matrix, prerequisites and pass/fail criteria:
**[AI_TEST_SCENARIOS.md](./AI_TEST_SCENARIOS.md)**.

| Scenario | Spec file |
|---|---|
| Greeting | `greeting.spec.js` |
| Intent recognition | `intent.spec.js` |
| Context / memory | `context.spec.js` |
| RAG grounding | `rag.spec.js` |
| Language (English/Hindi/Hinglish/regional) | `language.spec.js` |
| Guardrails (off-topic, sensitive, injection, abusive, unknown) | `guardrails.spec.js` |

These tests focus on **observable behavior** (what the agent said, in
response to what) - never on inspecting or asserting how the LLM
internally reasoned to get there.

## Prerequisites

Set in `.env` (see `.env.example`):

- `TEST_AGENT_ID` - required. An agent in the target environment whose
  configuration (greeting, knowledge base, guardrail policy) is known to
  the QA team. Every test in this folder is skipped, not failed, if this
  is unset.
- `TEST_KB_KEYWORD` - optional, required only for `rag.spec.js`. A phrase
  known to exist in that agent's knowledge base.
- `TEST_GREETING_FRAGMENT` - optional. A fragment of the agent's
  configured greeting, for an exact-ish check in `greeting.spec.js`.

## Running

```bash
npx playwright test test-engine/ai
# or, via the dedicated project:
npx playwright test --project=ai
```

## How these are graded

LLM replies are non-deterministic free text, so these specs use
keyword/pattern heuristics (`helpers/aiAssertions.helper.js`) rather than
exact-match assertions. A failure here means "needs human review of the
attached evidence" more than it means "definitely a bug" - see
AI_TEST_SCENARIOS.md for how to read each scenario's result.
