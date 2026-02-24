export type ExerciseType =
  | "free_talk"
  | "elevator_pitch"
  | "storytelling"
  | "debate"
  | "eye_contact_drill"
  | "filler_word_elimination"
  | "power_pause"
  | "impromptu";

export interface SpeechMetrics {
  words_per_minute: number;
  filler_words: Record<string, number>;
  filler_word_rate: number;
  pause_count: number;
  longest_pause_seconds: number;
  volume_consistency?: number;
  elapsed_minutes: number;
  total_words: number;
}

export interface VisualSignals {
  eye_contact_percentage: number;
  head_movement_level: "low" | "moderate" | "high";
  facial_expression: "neutral" | "smiling" | "tense" | "animated";
  posture_score: number;
}

export interface SessionContext {
  duration_minutes: number;
  exercise_type: ExerciseType;
  improvement_trend: "positive" | "neutral" | "negative";
}

export interface RealtimeMetrics {
  speech_metrics: SpeechMetrics;
  visual_signals: VisualSignals;
  session_context: SessionContext;
}

export interface CoachPayload {
  response_text: string;
  audio_base64?: string;
  audio_mime_type?: string;
  avatar_stream_url?: string;
}

export interface LiveVisualSignalInput {
  eyeContact: boolean;
  headPose: {
    pitch: number;
    yaw: number;
    roll: number;
  };
  expression: "neutral" | "smiling" | "tense" | "animated";
  postureScore: number;
}

export interface SessionSummary {
  id: string;
  exerciseType: ExerciseType;
  startedAt: string;
  endedAt?: string | null;
  averageWpm?: number | null;
  fillerWordRate?: number | null;
  eyeContactAverage?: number | null;
  notes?: string | null;
}
