from __future__ import annotations

import re
from collections import Counter, deque
from dataclasses import dataclass, field
from statistics import mean, pstdev


WORD_PATTERN = re.compile(r"[A-Za-z']+")


@dataclass
class SpeechAnalyzer:
    """Analyzes transcript chunks to produce live coaching metrics."""

    filler_terms: tuple[str, ...] = (
        "um",
        "uh",
        "uhh",
        "umm",
        "hmm",
        "hm",
        "like",
        "you know",
        "basically",
        "actually",
        "literally",
        "right",
        "so",
        "well",
        "i mean",
        "kind of",
        "sort of",
        "stuff like that",
    )
    session_start: float | None = None
    last_word_time: float | None = None
    total_words: int = 0
    filler_counts: Counter[str] = field(default_factory=Counter)
    pause_durations: list[float] = field(default_factory=list)
    volume_samples: deque[float] = field(default_factory=lambda: deque(maxlen=240))
    recent_word_events: deque[tuple[float, int]] = field(default_factory=lambda: deque(maxlen=720))
    latest_interim_text: str = ""
    latest_interim_word_count: int = 0

    def __post_init__(self) -> None:
        self._patterns = {
            term: re.compile(rf"\b{re.escape(term)}\b", flags=re.IGNORECASE) for term in self.filler_terms
        }

    def process_transcription(
        self,
        text: str,
        timestamp: float,
        is_final: bool,
        rms: float | None = None,
    ) -> dict:
        if self.session_start is None:
            self.session_start = timestamp

        if rms is not None:
            self.volume_samples.append(max(0.0, min(1.0, rms)))

        normalized = text.strip().lower()

        if not is_final:
            self.latest_interim_text = normalized
            self.latest_interim_word_count = len(WORD_PATTERN.findall(normalized))
            return self.get_current_metrics(timestamp)

        if not normalized:
            self.latest_interim_text = ""
            self.latest_interim_word_count = 0
            return self.get_current_metrics(timestamp)

        word_count = len(WORD_PATTERN.findall(normalized))
        self.total_words += word_count
        self.recent_word_events.append((timestamp, word_count))

        for filler, pattern in self._patterns.items():
            matches = pattern.findall(normalized)
            if matches:
                self.filler_counts[filler] += len(matches)

        if self.last_word_time is not None:
            pause = timestamp - self.last_word_time
            if pause > 1.5:
                self.pause_durations.append(pause)

        self.last_word_time = timestamp
        self.latest_interim_text = ""
        self.latest_interim_word_count = 0
        return self.get_current_metrics(timestamp)

    def get_current_metrics(self, timestamp: float | None = None) -> dict:
        if self.session_start is None:
            self.session_start = timestamp or 0.0

        now = timestamp if timestamp is not None else self.last_word_time or self.session_start
        elapsed_minutes = max((now - self.session_start) / 60, 0.1)

        effective_fillers = Counter(self.filler_counts)
        if self.latest_interim_text:
            for filler, pattern in self._patterns.items():
                matches = pattern.findall(self.latest_interim_text)
                if matches:
                    effective_fillers[filler] += len(matches)

        total_fillers = sum(effective_fillers.values())
        effective_total_words = self.total_words + self.latest_interim_word_count

        volume_consistency = 0.0
        if len(self.volume_samples) > 3:
            average = mean(self.volume_samples)
            deviation = pstdev(self.volume_samples)
            if average > 0:
                volume_consistency = max(0.0, min(1.0, 1 - (deviation / average)))

        return {
            "words_per_minute": round(effective_total_words / elapsed_minutes),
            "filler_words": dict(effective_fillers),
            "filler_word_rate": round(total_fillers / elapsed_minutes, 1),
            "pause_count": len(self.pause_durations),
            "longest_pause_seconds": round(max(self.pause_durations, default=0.0), 1),
            "volume_consistency": round(volume_consistency, 2),
            "total_words": effective_total_words,
            "elapsed_minutes": round(elapsed_minutes, 2),
        }
