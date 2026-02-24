import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_PERSONA_ID = "p3ef12851854";

interface TavusCreateResponse {
  conversation_id?: string;
  conversation_url?: string;
  status?: string;
}

interface TavusConversationRecord {
  conversation_id?: string;
  conversation_name?: string;
  status?: string;
  created_at?: string;
}

interface TavusListResponse {
  data?: TavusConversationRecord[];
}

function hasValue(v: string | undefined): v is string {
  return Boolean(v && v.trim());
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function buildGreeting(exerciseType: string) {
  switch (exerciseType) {
    case "elevator_pitch":
      return "Hey there! I'm Coach Alex. Today we're working on your elevator pitch. Give me your best 60-second pitch whenever you're ready, and I'll give you feedback on delivery, clarity, and impact. Go for it!";
    case "storytelling":
      return "Hey! Coach Alex here. Let's work on storytelling today. I want you to tell me a short story — something personal or professional, with a clear beginning, middle, and end. Focus on pacing and emotion. Start whenever you're ready.";
    case "eye_contact_drill":
      return "Hey! I'm Coach Alex. We're doing an eye contact drill today. I want you to look right at the camera — pretend it's a person you're speaking to. Talk about anything, and I'll coach you on maintaining that connection. Ready? Go.";
    case "filler_word_elimination":
      return "Hey there! Coach Alex here. Today we're eliminating filler words. Every time you want to say um, uh, or like, I want you to pause instead. It'll feel strange at first, but pauses are powerful. Start talking and I'll flag the fillers.";
    case "power_pause":
      return "Hey! I'm Coach Alex. Today is all about the power pause. Before your key points, I want you to pause for 2 full seconds. It builds tension and makes your words land harder. Give me a short talk on anything and practice those pauses.";
    case "impromptu":
      return "Hey! Coach Alex here. Impromptu speaking time! Here's your topic: describe a moment that changed how you think about something. You have 2 minutes. Don't overthink it — just start talking and we'll refine from there.";
    default:
      return "Hey! I'm Coach Alex, and I'm here to help you become a more confident speaker. Let's warm up — tell me about something you're working on right now. Speak naturally, and I'll give you real-time feedback on pace, clarity, and delivery. Whenever you're ready!";
  }
}

function buildContext(exerciseType: string) {
  const label = exerciseType.replaceAll("_", " ");
  return `Current exercise mode: ${label}. Lead the session proactively. After the user speaks, immediately give short feedback (1-2 sentences) then tell them what to try next. If they are quiet for more than 5 seconds, prompt them. Keep momentum high.`;
}

async function callTavus(apiKey: string, body: Record<string, unknown>) {
  const response = await fetch("https://tavusapi.com/v2/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const raw = await response.text();
  return { response, raw, parsed: parseJson<TavusCreateResponse & { error?: string }>(raw) };
}

async function cleanupOldConversation(apiKey: string) {
  try {
    const res = await fetch("https://tavusapi.com/v2/conversations?status=active", {
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = parseJson<TavusListResponse>(await res.text());
    const active = (data?.data ?? []).filter(
      (c): c is TavusConversationRecord & { conversation_id: string } => Boolean(c.conversation_id)
    );
    if (active.length === 0) return;

    const target =
      active.find((c) => c.conversation_name?.startsWith("speech-coach-")) ??
      active.sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())[0];

    await fetch(`https://tavusapi.com/v2/conversations/${encodeURIComponent(target.conversation_id)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      cache: "no-store",
    });
  } catch {
    // best-effort cleanup
  }
}

function isConcurrentLimit(status: number, raw: string) {
  return status === 429 || raw.toLowerCase().includes("maximum concurrent conversations");
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.TAVUS_API_KEY;
  const personaId = process.env.TAVUS_PERSONA_ID ?? DEFAULT_PERSONA_ID;

  if (!hasValue(apiKey)) {
    return NextResponse.json({ error: "TAVUS_API_KEY is not configured" }, { status: 503 });
  }

  let body: { sessionId?: string; exerciseType?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // defaults
  }

  const sessionId = body.sessionId ?? `session-${Date.now()}`;
  const exerciseType = body.exerciseType ?? "free_talk";

  const tavusBody = {
    persona_id: personaId,
    conversation_name: `speech-coach-${sessionId}`.slice(0, 120),
    custom_greeting: buildGreeting(exerciseType),
    conversational_context: buildContext(exerciseType),
  };

  try {
    let attempt = await callTavus(apiKey, tavusBody);

    if (!attempt.response.ok && isConcurrentLimit(attempt.response.status, attempt.raw)) {
      await cleanupOldConversation(apiKey);
      attempt = await callTavus(apiKey, tavusBody);
    }

    if (!attempt.response.ok) {
      const msg = attempt.parsed?.error || attempt.raw || "Unable to create Tavus conversation";
      return NextResponse.json({ error: msg }, { status: attempt.response.status });
    }

    const id = attempt.parsed?.conversation_id;
    const url = attempt.parsed?.conversation_url;

    if (!id || !url) {
      return NextResponse.json({ error: "Tavus response missing conversation details" }, { status: 502 });
    }

    return NextResponse.json({ conversationId: id, conversationUrl: url, status: attempt.parsed?.status ?? "active" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create conversation" },
      { status: 500 }
    );
  }
}
