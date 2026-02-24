# AI Speech Coach

A full-stack real-time speech coaching app with a live call layout:

- Left panel: user webcam + MediaPipe face tracking
- Right panel: live Tavus conversation lane (embedded Daily room via Tavus `conversation_url`)
- Backend pipeline: ElevenLabs realtime STT -> speech/visual analyzers -> Claude coaching -> ElevenLabs TTS

## Tech Stack

- Frontend: Next.js 14 + TypeScript + Tailwind CSS
- Client vision: MediaPipe Face Landmarker
- Realtime transport: native WebSocket
- Backend: FastAPI orchestration with Pipecat dependency included for pipeline evolution
- STT: ElevenLabs realtime websocket (`scribe_v2_realtime`)
- LLM: Claude (`claude-sonnet-4-20250514`)
- TTS: ElevenLabs streaming endpoint
- Avatar: Tavus Conversations API (`/v2/conversations`)
- Persistence: SQLite (`Prisma` on frontend and SQLite event log on backend)

## Project Layout

```text
ai-speech-coach/
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── session/page.tsx
│   │   ├── history/page.tsx
│   │   └── api/
│   │       ├── session/route.ts
│   │       └── token/route.ts
│   ├── components/
│   ├── lib/
│   ├── prisma/schema.prisma
│   └── package.json
├── backend/
│   ├── main.py
│   ├── pipeline/
│   ├── prompts/coach_system.py
│   ├── models/session.py
│   └── requirements.txt
└── docker-compose.yml
```

## Environment Variables

### `/Users/felmonfekadu/Developer/ai-speech-coach/frontend/.env.local`

```bash
NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:8765/ws
NEXT_PUBLIC_SIMLI_API_KEY=your_simli_api_key
SIMLI_API_KEY=your_simli_api_key
SIMLI_FACE_ID=your_chosen_face_id
TAVUS_API_KEY=your_tavus_api_key
TAVUS_PERSONA_ID=your_tavus_persona_id
DATABASE_URL=file:./dev.db
```

### `/Users/felmonfekadu/Developer/ai-speech-coach/backend/.env`

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_STT_MODEL=scribe_v2_realtime
ELEVENLABS_STT_COMMIT_STRATEGY=manual
SIMLI_API_KEY=your_simli_api_key
SIMLI_FACE_ID=your_chosen_face_id
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

## Local Development

### 1. Backend

```bash
cd /Users/felmonfekadu/Developer/ai-speech-coach/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8765 --reload
```

### 2. Frontend

```bash
cd /Users/felmonfekadu/Developer/ai-speech-coach/frontend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then go to `/session`.

## Docker

```bash
cd /Users/felmonfekadu/Developer/ai-speech-coach
docker compose up --build
```

## Phase Status

### Phase 1 (implemented)

- Webcam + mic capture with echo cancellation
- WebSocket audio streaming to backend
- ElevenLabs live transcript relay
- Realtime WPM/filler/pause metrics

### Phase 2 (implemented)

- Claude coaching engine with session context + sliding history
- Timing logic (`should_coach_now`) for natural interjections
- ElevenLabs synthesized coaching responses sent back to browser audio

### Phase 3 (implemented)

- MediaPipe face landmarks in browser
- Eye contact estimation
- Head pose + expression + posture heuristics
- Visual signals streamed to backend and included in coaching payload

### Phase 4 (implemented)

- Simli token + ICE generation route (`/api/token`)
- Frontend Tavus conversation creation route (`/api/tavus/conversation`)
- Tavus conversation embedded directly in avatar panel via `conversation_url`

### Phase 5 (starter implementation)

- Exercise selector integrated into live session
- Session history page + progress visualization
- Session persistence API and Prisma models

## Realtime Message Contract

Client -> server:

- `start_session`
- `set_exercise`
- `audio_chunk`
- `visual_signal`
- `pause_session`
- `resume_session`
- `user_interrupt`
- `end_session`

Server -> client:

- `status`
- `transcript`
- `metrics`
- `coach_response`
- `session_summary`
- `error`

## Important Notes

- If `ELEVENLABS_API_KEY` is missing, transcript streaming is disabled and the UI shows an error state.
- If `ANTHROPIC_API_KEY` is missing, coaching falls back to deterministic local feedback.
- If `ELEVENLABS_API_KEY` is missing, responses are text-only.
- Tavus conversation stream requires a valid Tavus API key and persona ID:
  - [Tavus API docs](https://docs.tavus.io/api-reference/conversations/create-conversation)

## Core Documentation

- [Pipecat](https://github.com/pipecat-ai/pipecat)
- [Anthropic Messages API](https://docs.anthropic.com/en/docs)
- [ElevenLabs API](https://elevenlabs.io/docs)
- [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)
