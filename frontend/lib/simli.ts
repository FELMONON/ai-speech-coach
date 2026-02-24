export interface SimliSessionTokenResponse {
  token: string;
  roomUrl?: string;
  expiresAt?: string;
  iceServers?: RTCIceServer[];
}

export async function fetchSimliSessionToken(sessionId: string): Promise<SimliSessionTokenResponse | null> {
  const response = await fetch(`/api/token?sessionId=${encodeURIComponent(sessionId)}`, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as SimliSessionTokenResponse;
}

export function inferAvatarConnectionState(tokenResponse: SimliSessionTokenResponse | null) {
  if (!tokenResponse) {
    return "unavailable";
  }

  if (tokenResponse.token) {
    return "ready";
  }

  return "token_only";
}

export function normalizeIceServers(servers: RTCIceServer[] | undefined): RTCIceServer[] | null {
  if (!servers || servers.length === 0) {
    return null;
  }

  return servers
    .map((server) => ({
      urls: server.urls,
      username: server.username,
      credential: server.credential
    }))
    .filter((server) => Boolean(server.urls));
}
