from __future__ import annotations

import asyncio
import base64
import json
import os
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable
from urllib.parse import urlencode

import websockets
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from pipeline import AvatarManager, CoachingEngine, SessionManager, SpeechAnalyzer, VisualAnalyzer
from prompts.coach_system import COACH_SYSTEM_PROMPT

load_dotenv()


def pipecat_capabilities() -> dict[str, bool]:
    """Detect optional Pipecat modules without hard-failing startup."""
    try:
        from pipecat.pipeline.pipeline import Pipeline  # noqa: F401
        from pipecat.pipeline.runner import PipelineRunner  # noqa: F401
        from pipecat.pipeline.task import PipelineTask  # noqa: F401
        from pipecat.services.deepgram import DeepgramSTTService  # noqa: F401
        from pipecat.services.elevenlabs import ElevenLabsTTSService  # noqa: F401
    except Exception:
        return {"available": False}
    return {"available": True}


def has_real_key(value: str | None) -> bool:
    return bool(value) and not value.startswith("your_")


@dataclass
class AppConfig:
    anthropic_api_key: str | None = os.getenv("ANTHROPIC_API_KEY")
    elevenlabs_api_key: str | None = os.getenv("ELEVENLABS_API_KEY")
    simli_api_key: str | None = os.getenv("SIMLI_API_KEY")
    simli_face_id: str | None = os.getenv("SIMLI_FACE_ID")
    anthropic_model: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    elevenlabs_stt_model: str = os.getenv("ELEVENLABS_STT_MODEL", "scribe_v2_realtime")
    elevenlabs_stt_commit_strategy: str = os.getenv("ELEVENLABS_STT_COMMIT_STRATEGY", "manual")


class ElevenLabsRealtimeSTTClient:
    """Realtime STT client backed by ElevenLabs Scribe v2."""

    def __init__(
        self,
        api_key: str | None,
        on_transcript: Callable[[str, bool, float], Awaitable[None]],
        on_error: Callable[[str], Awaitable[None]] | None = None,
        model_id: str = "scribe_v2_realtime",
        commit_strategy: str = "vad",
        sample_rate: int = 16000,
    ) -> None:
        self.api_key = api_key
        self.on_transcript = on_transcript
        self.on_error = on_error
        self.model_id = model_id
        self.commit_strategy = commit_strategy if commit_strategy in {"manual", "vad"} else "vad"
        self.sample_rate = sample_rate
        self.ws = None
        self.audio_queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue(maxsize=96)
        self.sender_task: asyncio.Task | None = None
        self.receiver_task: asyncio.Task | None = None

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    async def connect(self) -> None:
        if not self.api_key:
            return

        endpoint = "wss://api.elevenlabs.io/v1/speech-to-text/realtime"
        query = urlencode(
            {
                "model_id": self.model_id,
                "audio_format": f"pcm_{self.sample_rate}",
                "language_code": "en",
                "include_timestamps": "true",
                "commit_strategy": self.commit_strategy,
                "vad_silence_threshold_secs": "1.0",
            }
        )

        self.ws = await websockets.connect(
            f"{endpoint}?{query}",
            additional_headers={"xi-api-key": self.api_key},
            ping_interval=20,
            ping_timeout=20,
            max_size=2_000_000,
        )

        self.sender_task = asyncio.create_task(self._sender())
        self.receiver_task = asyncio.create_task(self._receiver())

    async def send_audio(self, pcm_chunk: bytes, sample_rate: int | None = None) -> None:
        if not self.enabled:
            return

        packet = {
            "message_type": "input_audio_chunk",
            "audio_base_64": base64.b64encode(pcm_chunk).decode("ascii"),
            "commit": False,
            "sample_rate": sample_rate or self.sample_rate,
        }

        try:
            self.audio_queue.put_nowait(packet)
        except asyncio.QueueFull:
            # Drop oldest packet under pressure to keep latency low.
            _ = self.audio_queue.get_nowait()
            self.audio_queue.put_nowait(packet)

    async def commit(self, sample_rate: int | None = None) -> None:
        if not self.enabled:
            return

        packet = {
            "message_type": "input_audio_chunk",
            "audio_base_64": "",
            "commit": True,
            "sample_rate": sample_rate or self.sample_rate,
        }

        try:
            self.audio_queue.put_nowait(packet)
        except asyncio.QueueFull:
            _ = self.audio_queue.get_nowait()
            self.audio_queue.put_nowait(packet)

    async def _sender(self) -> None:
        if not self.ws:
            return

        while True:
            packet = await self.audio_queue.get()
            if packet is None:
                break
            await self.ws.send(json.dumps(packet))

    async def _receiver(self) -> None:
        if not self.ws:
            return

        async for payload in self.ws:
            if not isinstance(payload, str):
                continue

            try:
                message = json.loads(payload)
            except json.JSONDecodeError:
                continue

            message_type = message.get("message_type")

            if message_type in {"partial_transcript", "committed_transcript", "committed_transcript_with_timestamps"}:
                transcript = (message.get("text") or "").strip()
                if not transcript:
                    continue
                is_final = message_type != "partial_transcript"
                await self.on_transcript(transcript, is_final, time.time())
                continue

            if message_type == "session_started":
                continue

            if message_type in {
                "warning",
                "auth_error",
                "quota_exceeded_error",
                "transcriber_error",
                "input_error",
                "commit_throttled",
                "unaccepted_terms_error",
                "rate_limited",
                "queue_overflow",
                "resource_exhausted",
                "session_time_limit_exceeded",
                "chunk_size_exceeded",
                "insufficient_audio_activity",
                "error",
            } and self.on_error:
                detail = message.get("detail") or message.get("error") or message.get("message") or message
                await self.on_error(str(detail))
                continue

    async def close(self) -> None:
        if self.enabled:
            await self.audio_queue.put(None)

        if self.sender_task:
            with contextlib.suppress(Exception):
                await self.sender_task

        if self.receiver_task:
            self.receiver_task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await self.receiver_task

        if self.ws:
            with contextlib.suppress(Exception):
                await self.ws.close()
            self.ws = None


# contextlib is imported late to keep top-level imports minimal.
import contextlib  # noqa: E402


def compute_improvement_trend(previous: dict | None, current: dict) -> str:
    if not previous:
        return "neutral"

    prev_filler = previous.get("speech_metrics", {}).get("filler_word_rate", 0)
    curr_filler = current.get("speech_metrics", {}).get("filler_word_rate", 0)

    prev_eye = previous.get("visual_signals", {}).get("eye_contact_percentage", 0)
    curr_eye = current.get("visual_signals", {}).get("eye_contact_percentage", 0)

    if curr_filler <= prev_filler and curr_eye >= prev_eye:
        return "positive"

    if curr_filler > prev_filler + 1.0 or curr_eye + 8 < prev_eye:
        return "negative"

    return "neutral"


def create_app() -> FastAPI:
    config = AppConfig()
    app = FastAPI(title="AI Speech Coach Backend", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    data_path = os.path.join(os.path.dirname(__file__), "data", "sessions.db")
    session_manager = SessionManager(db_path=data_path)

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {
            "ok": True,
            "services": {
                "anthropic": has_real_key(config.anthropic_api_key),
                "elevenlabs_stt": has_real_key(config.elevenlabs_api_key),
                "elevenlabs_tts": has_real_key(config.elevenlabs_api_key),
                "simli": has_real_key(config.simli_api_key),
                "pipecat": pipecat_capabilities()["available"],
            },
        }

    @app.websocket("/ws/session/{session_id}")
    async def websocket_session(websocket: WebSocket, session_id: str) -> None:
        await websocket.accept()

        speech_analyzer = SpeechAnalyzer()
        visual_analyzer = VisualAnalyzer()
        coaching_engine = CoachingEngine(
            api_key=config.anthropic_api_key,
            model=config.anthropic_model,
            system_prompt=COACH_SYSTEM_PROMPT,
        )
        avatar_manager = AvatarManager(
            elevenlabs_api_key=config.elevenlabs_api_key,
            simli_api_key=config.simli_api_key,
            simli_face_id=config.simli_face_id,
        )

        send_lock = asyncio.Lock()
        session_manager.ensure(session_id)
        avatar_stream_url: str | None = None
        last_final_transcript = ""
        last_final_timestamp = 0.0

        async def send(payload: dict[str, Any]) -> None:
            async with send_lock:
                await websocket.send_json(payload)

        async def run_coach_response(transcript: str, metrics_payload: dict) -> None:
            nonlocal avatar_stream_url
            try:
                await send({"type": "status", "state": "coach_thinking"})
                session_context = session_manager.session_context(session_id)

                response_text = await coaching_engine.generate_coaching(
                    transcription=transcript,
                    speech_metrics=metrics_payload["speech_metrics"],
                    visual_signals=metrics_payload["visual_signals"],
                    session_context=session_context,
                )

                session_manager.record_feedback(session_id, response_text)

                audio_base64, audio_mime = await avatar_manager.synthesize_speech(response_text)
                if not avatar_stream_url:
                    avatar_stream_url = await avatar_manager.prepare_avatar_stream(session_id)

                await send(
                    {
                        "type": "coach_response",
                        "response_text": response_text,
                        "audio_base64": audio_base64,
                        "audio_mime_type": audio_mime,
                        "avatar_stream_url": avatar_stream_url,
                    }
                )
                await send({"type": "status", "state": "coach_ready"})
            except asyncio.CancelledError:
                await send({"type": "status", "state": "coach_interrupted"})
                raise
            except Exception as error:
                await send({"type": "error", "message": f"Coach response failed: {error}"})

        async def on_transcript(transcription: str, is_final: bool, timestamp: float) -> None:
            nonlocal last_final_transcript, last_final_timestamp
            session = session_manager.get(session_id)
            if not session or session.paused:
                return

            normalized = transcription.strip().lower()
            if is_final and normalized:
                if normalized == last_final_transcript and timestamp - last_final_timestamp < 5.0:
                    return
                last_final_transcript = normalized
                last_final_timestamp = timestamp

            speech_metrics = speech_analyzer.process_transcription(transcription, timestamp, is_final)
            visual_signals = visual_analyzer.get_current_signals()

            await send(
                {
                    "type": "transcript",
                    "transcription": transcription,
                    "is_final": is_final,
                }
            )

            metrics_payload = {
                "speech_metrics": speech_metrics,
                "visual_signals": visual_signals,
                "session_context": session_manager.session_context(session_id),
            }

            previous_metrics = session_manager.get(session_id).last_metrics if session_manager.get(session_id) else None
            trend = compute_improvement_trend(previous_metrics, metrics_payload)
            metrics_payload["session_context"]["improvement_trend"] = trend
            session_manager.update_trend(session_id, trend)
            session_manager.record_metrics(session_id, metrics_payload)

            await send(
                {
                    "type": "metrics",
                    "data": metrics_payload,
                }
            )

            if is_final:
                session_manager.append_transcript(session_id, transcription)

            should_coach = coaching_engine.should_coach_now(
                current_time=timestamp,
                speech_metrics=speech_metrics,
                visual_signals=visual_signals,
                is_final_transcript=is_final,
            )

            if should_coach and transcription.strip():
                await session_manager.cancel_active_response(session_id)
                task = asyncio.create_task(run_coach_response(transcription, metrics_payload))
                session_manager.set_active_response_task(session_id, task)

        async def on_stt_error(message: str) -> None:
            await send({"type": "error", "message": f"STT error: {message}"})

        stt_client = ElevenLabsRealtimeSTTClient(
            api_key=config.elevenlabs_api_key,
            on_transcript=on_transcript,
            on_error=on_stt_error,
            model_id=config.elevenlabs_stt_model,
            commit_strategy=config.elevenlabs_stt_commit_strategy,
        )
        stt_speaking = False
        stt_last_voice_at = 0.0
        stt_speech_rms_threshold = 0.035
        stt_silence_commit_delay = 0.8

        try:
            await stt_client.connect()
            await send({"type": "status", "state": "connected"})
            if not stt_client.enabled:
                await send(
                    {
                        "type": "error",
                        "message": "ElevenLabs STT is not configured. Add ELEVENLABS_API_KEY for live transcription.",
                    }
                )

            while True:
                raw = await websocket.receive_text()
                message = json.loads(raw)
                message_type = message.get("type")

                if message_type == "start_session":
                    exercise = message.get("exercise_type", "free_talk")
                    session_manager.set_exercise(session_id, str(exercise))
                    await send({"type": "status", "state": "session_started"})
                    continue

                if message_type == "set_exercise":
                    exercise = message.get("exercise_type", "free_talk")
                    session_manager.set_exercise(session_id, str(exercise))
                    await send({"type": "status", "state": f"exercise:{exercise}"})
                    continue

                if message_type == "pause_session":
                    session_manager.pause(session_id)
                    await send({"type": "status", "state": "paused"})
                    continue

                if message_type == "resume_session":
                    session_manager.resume(session_id)
                    await send({"type": "status", "state": "running"})
                    continue

                if message_type == "user_interrupt":
                    interrupted = await session_manager.cancel_active_response(session_id)
                    if interrupted:
                        await send({"type": "status", "state": "coach_interrupted"})
                    continue

                if message_type == "visual_signal":
                    payload = message.get("payload", {})
                    visual_analyzer.ingest_signal(payload, time.time())
                    continue

                if message_type == "audio_chunk":
                    chunk_b64 = message.get("chunk")
                    rms = float(message.get("rms", 0))
                    sample_rate = int(message.get("sample_rate", 16000) or 16000)
                    now = time.time()
                    speech_analyzer.process_transcription("", time.time(), False, rms=rms)

                    if not chunk_b64 or not stt_client.enabled:
                        continue

                    try:
                        audio_bytes = base64.b64decode(chunk_b64)
                    except Exception:
                        continue

                    await stt_client.send_audio(audio_bytes, sample_rate=sample_rate)

                    if rms >= stt_speech_rms_threshold:
                        stt_speaking = True
                        stt_last_voice_at = now
                    elif stt_speaking and now - stt_last_voice_at >= stt_silence_commit_delay:
                        await stt_client.commit(sample_rate=sample_rate)
                        stt_speaking = False
                    continue

                if message_type == "end_session":
                    with contextlib.suppress(Exception):
                        await stt_client.commit()
                    break

        except WebSocketDisconnect:
            pass
        except Exception as error:
            with contextlib.suppress(Exception):
                await send({"type": "error", "message": str(error)})
        finally:
            with contextlib.suppress(Exception):
                await session_manager.cancel_active_response(session_id)
            with contextlib.suppress(Exception):
                await stt_client.close()

            summary = session_manager.finish(session_id, summary="Session ended")
            with contextlib.suppress(Exception):
                await send({"type": "session_summary", "summary": summary})
            with contextlib.suppress(Exception):
                await websocket.close()

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8765, reload=True)
