import type { RealtimeMetrics } from "@/lib/types";

export interface LocalSessionStats {
  fillerWordTotal: number;
  eyeContact: number;
  wpm: number;
  durationLabel: string;
}

export const DEFAULT_METRICS: RealtimeMetrics = {
  speech_metrics: {
    words_per_minute: 0,
    filler_words: {},
    filler_word_rate: 0,
    pause_count: 0,
    longest_pause_seconds: 0,
    elapsed_minutes: 0,
    total_words: 0
  },
  visual_signals: {
    eye_contact_percentage: 0,
    head_movement_level: "low",
    facial_expression: "neutral",
    posture_score: 0
  },
  session_context: {
    duration_minutes: 0,
    exercise_type: "free_talk",
    improvement_trend: "neutral"
  }
};

export function getTotalFillers(fillerWords: Record<string, number>) {
  return Object.values(fillerWords).reduce((sum, count) => sum + count, 0);
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${remainder}`;
}

export function toSessionStats(metrics: RealtimeMetrics, elapsedSeconds: number): LocalSessionStats {
  return {
    fillerWordTotal: getTotalFillers(metrics.speech_metrics.filler_words),
    eyeContact: Math.round(metrics.visual_signals.eye_contact_percentage),
    wpm: Math.round(metrics.speech_metrics.words_per_minute),
    durationLabel: formatDuration(elapsedSeconds)
  };
}

export function estimateTrend(previous: RealtimeMetrics, current: RealtimeMetrics): "positive" | "neutral" | "negative" {
  const previousFiller = previous.speech_metrics.filler_word_rate;
  const currentFiller = current.speech_metrics.filler_word_rate;
  const previousEye = previous.visual_signals.eye_contact_percentage;
  const currentEye = current.visual_signals.eye_contact_percentage;

  const positive = currentFiller <= previousFiller && currentEye >= previousEye;
  const negative = currentFiller > previousFiller + 1.2 || currentEye + 8 < previousEye;

  if (positive) {
    return "positive";
  }

  if (negative) {
    return "negative";
  }

  return "neutral";
}
