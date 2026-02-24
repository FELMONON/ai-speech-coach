from __future__ import annotations

import asyncio
import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class LiveSession:
    session_id: str
    started_at: float
    exercise_type: str = "free_talk"
    paused: bool = False
    transcripts: list[str] = field(default_factory=list)
    feedback: list[str] = field(default_factory=list)
    last_metrics: dict = field(default_factory=dict)
    improvement_trend: str = "neutral"
    active_response_task: asyncio.Task | None = None


class SessionManager:
    def __init__(self, db_path: str) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.sessions: dict[str, LiveSession] = {}
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _init_db(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    started_at REAL NOT NULL,
                    ended_at REAL,
                    exercise_type TEXT,
                    summary TEXT,
                    avg_wpm REAL,
                    filler_rate REAL,
                    eye_contact REAL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS session_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    payload TEXT
                )
                """
            )

    def create(self, session_id: str, exercise_type: str) -> LiveSession:
        now = time.time()
        session = LiveSession(session_id=session_id, started_at=now, exercise_type=exercise_type)
        self.sessions[session_id] = session

        with self._connect() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO sessions (
                    session_id,
                    started_at,
                    exercise_type
                ) VALUES (?, ?, ?)
                """,
                (session_id, now, exercise_type),
            )

        return session

    def get(self, session_id: str) -> LiveSession | None:
        return self.sessions.get(session_id)

    def ensure(self, session_id: str, exercise_type: str = "free_talk") -> LiveSession:
        existing = self.get(session_id)
        if existing:
            return existing
        return self.create(session_id, exercise_type)

    def set_exercise(self, session_id: str, exercise_type: str) -> None:
        session = self.ensure(session_id, exercise_type)
        session.exercise_type = exercise_type
        with self._connect() as connection:
            connection.execute(
                "UPDATE sessions SET exercise_type = ? WHERE session_id = ?",
                (exercise_type, session_id),
            )

    def pause(self, session_id: str) -> None:
        session = self.get(session_id)
        if session:
            session.paused = True

    def resume(self, session_id: str) -> None:
        session = self.get(session_id)
        if session:
            session.paused = False

    def append_transcript(self, session_id: str, transcript: str) -> None:
        session = self.get(session_id)
        if not session or not transcript.strip():
            return
        session.transcripts.append(transcript.strip())

    def record_feedback(self, session_id: str, response: str) -> None:
        session = self.get(session_id)
        if not session:
            return

        snippet = response[:180]
        session.feedback.append(snippet)

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO session_events (session_id, event_type, created_at, payload)
                VALUES (?, ?, ?, ?)
                """,
                (session_id, "feedback", time.time(), snippet),
            )

    def record_metrics(self, session_id: str, metrics: dict) -> None:
        session = self.get(session_id)
        if not session:
            return
        session.last_metrics = metrics

    def update_trend(self, session_id: str, trend: str) -> None:
        session = self.get(session_id)
        if session:
            session.improvement_trend = trend

    def session_context(self, session_id: str) -> dict:
        session = self.get(session_id)
        if not session:
            return {
                "duration_minutes": 0,
                "exercise_type": "free_talk",
                "previous_feedback_given": [],
                "improvement_trend": "neutral",
            }

        return {
            "duration_minutes": round((time.time() - session.started_at) / 60, 2),
            "exercise_type": session.exercise_type,
            "previous_feedback_given": session.feedback[-5:],
            "improvement_trend": session.improvement_trend,
        }

    async def cancel_active_response(self, session_id: str) -> bool:
        session = self.get(session_id)
        if not session or not session.active_response_task:
            return False

        task = session.active_response_task
        if task.done():
            return False

        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        except Exception:
            pass

        return True

    def set_active_response_task(self, session_id: str, task: asyncio.Task | None) -> None:
        session = self.get(session_id)
        if not session:
            return
        session.active_response_task = task

    def finish(self, session_id: str, summary: str = "") -> dict:
        now = time.time()
        session = self.sessions.pop(session_id, None)

        if not session:
            return {
                "session_id": session_id,
                "duration_minutes": 0,
                "exercise_type": "free_talk",
                "summary": summary,
            }

        metrics = session.last_metrics or {}
        speech_metrics = metrics.get("speech_metrics", {})
        visual_signals = metrics.get("visual_signals", {})

        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sessions
                SET ended_at = ?, summary = ?, avg_wpm = ?, filler_rate = ?, eye_contact = ?
                WHERE session_id = ?
                """,
                (
                    now,
                    summary,
                    speech_metrics.get("words_per_minute"),
                    speech_metrics.get("filler_word_rate"),
                    visual_signals.get("eye_contact_percentage"),
                    session_id,
                ),
            )

        return {
            "session_id": session_id,
            "duration_minutes": round((now - session.started_at) / 60, 2),
            "exercise_type": session.exercise_type,
            "summary": summary,
            "avg_wpm": speech_metrics.get("words_per_minute", 0),
            "filler_word_rate": speech_metrics.get("filler_word_rate", 0),
            "eye_contact_percentage": visual_signals.get("eye_contact_percentage", 0),
        }
