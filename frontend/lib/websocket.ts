import type { ExerciseType, LiveVisualSignalInput, RealtimeMetrics } from "@/lib/types";

export interface SocketCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (message: string) => void;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onMetrics?: (payload: RealtimeMetrics) => void;
  onCoachResponse?: (payload: {
    responseText: string;
    audioBase64?: string;
    audioMimeType?: string;
    avatarStreamUrl?: string;
  }) => void;
  onStatus?: (status: string) => void;
  onSessionSummary?: (summary: Record<string, unknown>) => void;
}

interface BaseMessage {
  type: string;
}

function parseJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export class RealtimeSocketClient {
  private socket: WebSocket | null = null;
  private callbacks: SocketCallbacks;

  constructor(private readonly url: string, callbacks: SocketCallbacks) {
    this.callbacks = callbacks;
  }

  get isConnected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  connect(sessionId: string) {
    const separator = this.url.endsWith("/") ? "" : "/";
    this.socket = new WebSocket(`${this.url}${separator}session/${sessionId}`);

    this.socket.onopen = () => {
      this.callbacks.onOpen?.();
    };

    this.socket.onclose = () => {
      this.callbacks.onClose?.();
    };

    this.socket.onerror = () => {
      this.callbacks.onError?.("WebSocket error");
    };

    this.socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      const parsed = parseJson(event.data);
      if (!parsed) {
        return;
      }

      const type = parsed.type;

      if (type === "error") {
        this.callbacks.onError?.(String(parsed.message ?? "Unknown error"));
        return;
      }

      if (type === "transcript") {
        this.callbacks.onTranscript?.(String(parsed.transcription ?? ""), Boolean(parsed.is_final));
        return;
      }

      if (type === "metrics") {
        this.callbacks.onMetrics?.(parsed.data as RealtimeMetrics);
        return;
      }

      if (type === "coach_response") {
        this.callbacks.onCoachResponse?.({
          responseText: String(parsed.response_text ?? ""),
          audioBase64: parsed.audio_base64 ? String(parsed.audio_base64) : undefined,
          audioMimeType: parsed.audio_mime_type ? String(parsed.audio_mime_type) : undefined,
          avatarStreamUrl: parsed.avatar_stream_url ? String(parsed.avatar_stream_url) : undefined
        });
        return;
      }

      if (type === "status") {
        this.callbacks.onStatus?.(String(parsed.state ?? ""));
        return;
      }

      if (type === "session_summary") {
        this.callbacks.onSessionSummary?.(parsed.summary as Record<string, unknown>);
      }
    };
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
  }

  send(message: BaseMessage & Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  startSession(exerciseType: ExerciseType) {
    this.send({ type: "start_session", exercise_type: exerciseType });
  }

  setExercise(exerciseType: ExerciseType) {
    this.send({ type: "set_exercise", exercise_type: exerciseType });
  }

  pauseSession() {
    this.send({ type: "pause_session" });
  }

  resumeSession() {
    this.send({ type: "resume_session" });
  }

  endSession() {
    this.send({ type: "end_session" });
  }

  sendVisualSignal(signal: LiveVisualSignalInput) {
    this.send({
      type: "visual_signal",
      payload: signal
    });
  }

  sendAudioChunk(chunkBase64: string, sampleRate: number, channels: number, rms: number) {
    this.send({
      type: "audio_chunk",
      chunk: chunkBase64,
      sample_rate: sampleRate,
      channels,
      rms
    });
  }

  userInterrupt() {
    this.send({ type: "user_interrupt" });
  }
}
