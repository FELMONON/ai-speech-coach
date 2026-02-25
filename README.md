# AI Speech Coach

Tavus-first speaking practice app.

Users start a coaching session, select an exercise, and join a live Tavus conversation embedded in the app. Session history is stored with Prisma and shown on the History page.

## Active Architecture

- Frontend (Next.js 14 + TypeScript + Tailwind) is the production path.
- Live session flow is Tavus conversation creation and embed:
  - `POST /api/tavus/conversation`
  - `DELETE /api/tavus/conversation/[conversationId]`
- Session persistence is handled by `POST /api/session` and read on `/history`.
- Backend Python pipeline is kept in the repo for future experimentation, but is not required for the current Tavus-first session flow.

## Project Layout

```text
ai-speech-coach/
├── frontend/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── session/page.tsx
│   │   ├── history/page.tsx
│   │   └── api/
│   │       ├── tavus/conversation/route.ts
│   │       ├── tavus/conversation/[conversationId]/route.ts
│   │       └── session/route.ts
│   ├── components/
│   ├── prisma/schema.prisma
│   └── package.json
├── backend/
└── docker-compose.yml
```

## Environment Variables

### `frontend/.env.local`

```bash
TAVUS_API_KEY=your_tavus_api_key
TAVUS_PERSONA_ID=your_tavus_persona_id
DATABASE_URL=file:./dev.db
```

## Local Development

```bash
cd frontend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open `http://localhost:3000`, then visit `/session`.

## Vercel Production Notes

- Tavus API key and persona id must be configured as Vercel project env vars.
- For durable production history, use a hosted database for `DATABASE_URL`.
- SQLite (`file:./dev.db`) is for local development only.

## References

- Tavus Conversations API: https://docs.tavus.io/api-reference/conversations/create-conversation
