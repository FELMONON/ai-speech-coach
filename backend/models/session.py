from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ExerciseType = Literal[
    "free_talk",
    "elevator_pitch",
    "storytelling",
    "debate",
    "eye_contact_drill",
    "filler_word_elimination",
    "power_pause",
    "impromptu",
]


class SpeechMetrics(BaseModel):
    words_per_minute: float = 0
    filler_words: dict[str, int] = Field(default_factory=dict)
    filler_word_rate: float = 0
    pause_count: int = 0
    longest_pause_seconds: float = 0
    volume_consistency: float = 0
    total_words: int = 0
    elapsed_minutes: float = 0


class VisualSignals(BaseModel):
    eye_contact_percentage: float = 0
    head_movement_level: Literal["low", "moderate", "high"] = "low"
    facial_expression: Literal["neutral", "smiling", "tense", "animated"] = "neutral"
    posture_score: float = 0


class SessionContext(BaseModel):
    duration_minutes: float = 0
    exercise_type: ExerciseType = "free_talk"
    previous_feedback_given: list[str] = Field(default_factory=list)
    improvement_trend: Literal["positive", "neutral", "negative"] = "neutral"


class CoachingPayload(BaseModel):
    transcription: str
    speech_metrics: SpeechMetrics
    visual_signals: VisualSignals
    session_context: SessionContext


class SessionSnapshot(BaseModel):
    session_id: str
    started_at: datetime
    updated_at: datetime
    transcript_count: int
    feedback_count: int
