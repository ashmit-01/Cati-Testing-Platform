# WebSocket Tests

Owner: `feature/ai-websocket`

Protocol-level tests for CATI's three real-time sockets:

| Socket | Purpose | Spec file |
|---|---|---|
| `/ws/vobiz` | Telephony bridge (caller audio/events in and out) | `vobiz.spec.js` |
| `/api/ws/ai-engine` | Real-time LLM turn exchange used mid-call | `ai-engine.spec.js` |
| `/ws/audio` (Python engine) | Raw audio in, VAD/STT/RAG/LLM/TTS pipeline entry point | `audio.spec.js` |

`connection.spec.js` runs the same generic lifecycle matrix (handshake,
authentication, session creation, message send/receive, disconnect,
reconnect, client-side timeout, invalid messages) against all three
sockets, so a protocol difference between them shows up as a single
failing row instead of being missed in one endpoint's bespoke tests.

## Running

```bash
npx playwright test test-engine/websocket
# or, via the dedicated project:
npx playwright test --project=websocket
```

## Configuration

Endpoint URLs and protocol field/event names are centralized in
`data/ws.config.js` - read the header comment there first. Backend
sockets are derived from `BACKEND_URL` (http→ws, https→wss); the audio
socket uses `AI_ENGINE_WS_URL` if set, else falls back to
`AI_ENGINE_URL`, else the backend host.

**The exact wire protocol (event names, field names, auth handshake
mechanism) is an assumption**, documented in `data/ws.config.js`,
because this repo doesn't ship CATI's server source. If real tests
disagree with that assumption, update `data/ws.config.js` rather than
individual spec files - everything reads from it.

## Safety

Connection/handshake/message tests here open real sockets against the
configured environment but never place a real call or move real money.
The `/ws/vobiz` audio-chunk test sends a tiny silent WAV, not real audio.
Do not run destructive or expensive production scenarios without
authorization.
