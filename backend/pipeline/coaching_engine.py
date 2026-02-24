from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any

try:
    from anthropic import AsyncAnthropic
except ImportError:  # pragma: no cover - optional dependency during bootstrap
    AsyncAnthropic = None  # type: ignore


@dataclass
class CoachingEngine:
    """Generates contextual live coaching responses."""

    api_key: str | None
    model: str
    system_prompt: str
    coaching_interval: float = 15.0
    last_coaching_time: float = 0.0
    conversation_history: list[dict[str, str]] = field(default_factory=list)
    feedback_given: list[str] = field(default_factory=list)
    running_summary: str = ""

    def __post_init__(self) -> None:
        self.client = AsyncAnthropic(api_key=self.api_key) if (AsyncAnthropic and self.api_key) else None

    def should_coach_now(
        self,
        current_time: float,
        speech_metrics: dict,
        visual_signals: dict,
        is_final_transcript: bool,
    ) -> bool:
        time_since_last = current_time - self.last_coaching_time
        total_words = speech_metrics.get("total_words", 0)

        if is_final_transcript and time_since_last > self.coaching_interval:
            return True

        # Fallback for streams where final transcript chunks are delayed.
        if (not is_final_transcript) and time_since_last > self.coaching_interval and total_words >= 8:
            return True

        urgent_signal = False
        if speech_metrics.get("filler_word_rate", 0) > 6:
            urgent_signal = True

        if visual_signals.get("eye_contact_percentage", 100) < 30:
            urgent_signal = True

        wpm = speech_metrics.get("words_per_minute", 130)
        if wpm > 180 or (0 < wpm < 100):
            urgent_signal = True

        if speech_metrics.get("longest_pause_seconds", 0) > 5:
            urgent_signal = True

        if urgent_signal and time_since_last > 4:
            return True

        return False

    def _trim_history(self) -> None:
        if len(self.conversation_history) <= 40:
            return

        older = self.conversation_history[:-20]
        older_text = " ".join(item.get("content", "")[:200] for item in older)

        snippet = older_text.strip()
        if snippet:
            merged = f"{self.running_summary} {snippet}".strip()
            self.running_summary = merged[-6000:]

        summary_message = {
            "role": "user",
            "content": (
                "Session summary so far (carry this context forward): "
                f"{self.running_summary[-1200:]}"
            ),
        }

        self.conversation_history = [summary_message, *self.conversation_history[-20:]]

    @staticmethod
    def _response_text(blocks: list[Any]) -> str:
        texts = []
        for block in blocks:
            block_type = getattr(block, "type", None)
            if block_type == "text":
                texts.append(getattr(block, "text", ""))
        return " ".join(item.strip() for item in texts if item).strip()

    def _fallback_response(self, speech_metrics: dict, visual_signals: dict) -> str:
        wpm = speech_metrics.get("words_per_minute", 0)
        filler_rate = speech_metrics.get("filler_word_rate", 0)
        eye_contact = visual_signals.get("eye_contact_percentage", 0)

        if filler_rate > 6:
            return "Good momentum. Slow down slightly and replace each um with a one-second pause before your next key point."
        if eye_contact < 35:
            return "Your ideas are strong. Keep your gaze on the camera for your next two sentences to project more confidence."
        if wpm > 180:
            return "Nice energy. Drop your pace by about 15 percent and land each sentence ending before the next thought."
        if 0 < wpm < 100:
            return "You sound thoughtful. Add a little more pace and connect your points with shorter transitions to keep momentum."

        return "Great control so far. Now raise the bar by using one deliberate pause before your main message."

    async def generate_coaching(
        self,
        transcription: str,
        speech_metrics: dict,
        visual_signals: dict,
        session_context: dict,
    ) -> str:
        payload = {
            "transcription": transcription,
            "speech_metrics": speech_metrics,
            "visual_signals": visual_signals,
            "session_context": {
                "duration_minutes": session_context.get("duration_minutes", 0),
                "exercise_type": session_context.get("exercise_type", "free_talk"),
                "previous_feedback_given": self.feedback_given[-5:],
                "improvement_trend": session_context.get("improvement_trend", "neutral"),
            },
        }

        user_message = (
            "CURRENT SESSION DATA:\n"
            f"{json.dumps(payload, ensure_ascii=True)}\n\n"
            "Provide the next coaching response as live spoken guidance."
        )

        self.conversation_history.append({"role": "user", "content": user_message})
        self._trim_history()

        if not self.client:
            coach_response = self._fallback_response(speech_metrics, visual_signals)
            self.conversation_history.append({"role": "assistant", "content": coach_response})
            self.feedback_given.append(coach_response[:120])
            self.last_coaching_time = time.time()
            return coach_response

        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=220,
                system=self.system_prompt,
                messages=self.conversation_history,
            )
            coach_response = self._response_text(response.content) or self._fallback_response(
                speech_metrics, visual_signals
            )
        except Exception:
            coach_response = self._fallback_response(speech_metrics, visual_signals)

        self.conversation_history.append({"role": "assistant", "content": coach_response})
        self.feedback_given.append(coach_response[:120])
        self.feedback_given = self.feedback_given[-50:]
        self.last_coaching_time = time.time()

        return coach_response
