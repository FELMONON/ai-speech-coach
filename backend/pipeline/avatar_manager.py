from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class AvatarManager:
    """Bridges TTS output with Simli avatar session metadata."""

    elevenlabs_api_key: str | None
    simli_api_key: str | None
    simli_face_id: str | None
    eleven_voice_id: str = "pNInz6obpgDQGcFmaJgB"
    eleven_model: str = "eleven_turbo_v2"

    async def synthesize_speech(self, text: str) -> tuple[str | None, str | None]:
        if not text.strip() or not self.elevenlabs_api_key:
            return None, None

        endpoint = f"https://api.elevenlabs.io/v1/text-to-speech/{self.eleven_voice_id}/stream"
        payload = {
            "text": text,
            "model_id": self.eleven_model,
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.7},
        }

        headers = {
            "xi-api-key": self.elevenlabs_api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }

        try:
            async with httpx.AsyncClient(timeout=40) as client:
                response = await client.post(endpoint, headers=headers, json=payload)
                response.raise_for_status()
                audio_bytes = response.content
        except Exception:
            return None, None

        return base64.b64encode(audio_bytes).decode("ascii"), "audio/mpeg"

    async def create_simli_token(self, session_id: str) -> dict[str, Any] | None:
        if not self.simli_api_key:
            return None

        headers = {
            "Content-Type": "application/json",
            "api-key": self.simli_api_key,
        }

        payload = {
            "simliAPIKey": self.simli_api_key,
            "metadata": {
                "sessionId": session_id,
                "faceId": self.simli_face_id,
            },
        }

        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(
                    "https://api.simli.ai/compose/token",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                return response.json()
        except Exception:
            return None

    async def prepare_avatar_stream(self, session_id: str) -> str | None:
        token_payload = await self.create_simli_token(session_id)
        if not token_payload:
            return None
        room_url = token_payload.get("roomUrl")
        if isinstance(room_url, str):
            return room_url
        return None
