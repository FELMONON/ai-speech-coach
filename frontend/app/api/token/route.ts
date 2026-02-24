import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function isPlaceholder(value: string | undefined) {
  return !value || value.startsWith("your_");
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "local-session";
  const apiKey = process.env.SIMLI_API_KEY ?? process.env.NEXT_PUBLIC_SIMLI_API_KEY;
  const faceId = process.env.SIMLI_FACE_ID;

  if (isPlaceholder(apiKey)) {
    return NextResponse.json(
      {
        error: "SIMLI_API_KEY is missing or still set to a placeholder value"
      },
      { status: 503 }
    );
  }

  if (isPlaceholder(faceId)) {
    return NextResponse.json(
      {
        error: "SIMLI_FACE_ID is missing or still set to a placeholder value"
      },
      { status: 503 }
    );
  }

  const simliApiKey = apiKey as string;
  const simliFaceId = faceId as string;

  try {
    const tokenResponse = await fetch("https://api.simli.ai/compose/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-simli-api-key": simliApiKey
      },
      body: JSON.stringify({
        faceId: simliFaceId,
        handleSilence: true,
        maxSessionLength: 3600,
        maxIdleTime: 600,
        model: "fasttalk",
        metadata: {
          sessionId
        },
        apiVersion: "v2"
      })
    });

    if (!tokenResponse.ok) {
      const details = await tokenResponse.text();
      return NextResponse.json({ error: details || "Unable to generate Simli token" }, { status: 502 });
    }

    const tokenPayload = (await tokenResponse.json()) as Record<string, unknown>;

    const iceResponse = await fetch("https://api.simli.ai/compose/ice", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-simli-api-key": simliApiKey
      }
    });

    let iceServers: unknown = undefined;
    if (iceResponse.ok) {
      iceServers = await iceResponse.json();
    }

    return NextResponse.json({
      token: tokenPayload.session_token ?? tokenPayload.token,
      roomUrl: tokenPayload.roomUrl,
      expiresAt: tokenPayload.expiresAt,
      iceServers
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Token generation failed"
      },
      { status: 500 }
    );
  }
}
