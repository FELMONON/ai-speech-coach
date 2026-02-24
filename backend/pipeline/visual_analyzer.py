from __future__ import annotations

from collections import Counter, deque
from dataclasses import dataclass, field


@dataclass
class VisualAnalyzer:
    """Aggregates visual samples from MediaPipe into stable session signals."""

    samples: deque[dict] = field(default_factory=lambda: deque(maxlen=240))

    def ingest_signal(self, payload: dict, timestamp: float) -> dict:
        sample = {
            "timestamp": timestamp,
            "eye_contact": bool(payload.get("eyeContact", False)),
            "head_pose": payload.get("headPose", {"pitch": 0.0, "yaw": 0.0, "roll": 0.0}),
            "expression": payload.get("expression", "neutral"),
            "posture_score": float(payload.get("postureScore", 0.0)),
        }
        self.samples.append(sample)
        return self.get_current_signals()

    def get_current_signals(self) -> dict:
        if not self.samples:
            return {
                "eye_contact_percentage": 0.0,
                "head_movement_level": "low",
                "facial_expression": "neutral",
                "posture_score": 0.0,
            }

        eye_contact_hits = sum(1 for sample in self.samples if sample["eye_contact"])
        eye_contact_percentage = (eye_contact_hits / len(self.samples)) * 100

        movement_values = []
        posture_values = []
        expression_counter: Counter[str] = Counter()

        for sample in self.samples:
            pose = sample["head_pose"]
            pitch = abs(float(pose.get("pitch", 0.0)))
            yaw = abs(float(pose.get("yaw", 0.0)))
            roll = abs(float(pose.get("roll", 0.0)))
            movement_values.append((pitch + yaw + roll) / 3)
            posture_values.append(sample["posture_score"])
            expression_counter.update([sample["expression"]])

        average_movement = sum(movement_values) / len(movement_values)
        if average_movement < 8:
            movement_level = "low"
        elif average_movement < 16:
            movement_level = "moderate"
        else:
            movement_level = "high"

        dominant_expression = expression_counter.most_common(1)[0][0]
        posture_score = sum(posture_values) / len(posture_values)

        return {
            "eye_contact_percentage": round(eye_contact_percentage, 1),
            "head_movement_level": movement_level,
            "facial_expression": dominant_expression,
            "posture_score": round(max(0.0, min(1.0, posture_score)), 2),
        }
