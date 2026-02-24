import type { ExerciseType } from "@/lib/types";

export interface TavusConversationResponse {
  conversationId: string;
  conversationUrl: string;
  status: string;
}

interface CreateConversationPayload {
  sessionId: string;
  exerciseType: ExerciseType;
}

function parseJson<T>(text: string): T | null {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function createTavusConversation(payload: CreateConversationPayload): Promise<TavusConversationResponse> {
  const response = await fetch("/api/tavus/conversation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  const raw = await response.text();
  const parsed = parseJson<{ error?: string } & TavusConversationResponse>(raw);

  if (!response.ok || !parsed) {
    throw new Error(parsed?.error ?? "Unable to create Tavus conversation");
  }

  return {
    conversationId: parsed.conversationId,
    conversationUrl: parsed.conversationUrl,
    status: parsed.status
  };
}

export async function endTavusConversation(conversationId: string): Promise<void> {
  const response = await fetch(`/api/tavus/conversation/${encodeURIComponent(conversationId)}`, {
    method: "DELETE",
    cache: "no-store"
  });

  if (response.ok || response.status === 404) {
    return;
  }

  const raw = await response.text();
  const parsed = parseJson<{ error?: string }>(raw);
  throw new Error(parsed?.error ?? "Unable to end Tavus conversation");
}
