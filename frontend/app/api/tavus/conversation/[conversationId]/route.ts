import { NextResponse } from "next/server";

export const runtime = "nodejs";

function hasValue(value: string | undefined): value is string {
  return Boolean(value && value.trim());
}

export async function DELETE(
  _request: Request,
  context: { params: { conversationId: string } }
) {
  const apiKey = process.env.TAVUS_API_KEY;
  const conversationId = context.params.conversationId;

  if (!hasValue(apiKey)) {
    return NextResponse.json({ error: "TAVUS_API_KEY is not configured" }, { status: 503 });
  }

  if (!hasValue(conversationId)) {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
  }

  try {
    const response = await fetch(`https://tavusapi.com/v2/conversations/${encodeURIComponent(conversationId)}`, {
      method: "DELETE",
      headers: {
        "x-api-key": apiKey
      },
      cache: "no-store"
    });

    if (response.status === 404) {
      return NextResponse.json({ ok: true, status: "not_found" });
    }

    if (!response.ok) {
      const details = await response.text();
      return NextResponse.json({ error: details || "Unable to end Tavus conversation" }, { status: response.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to end Tavus conversation" },
      { status: 500 }
    );
  }
}
