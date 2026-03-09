"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTavusConversation, endTavusConversation } from "@/lib/tavus";
import type { ExerciseType } from "@/lib/types";
import Link from "next/link";

type SessionState = "idle" | "connecting" | "running" | "ending" | "ended";

interface Exercise {
  id: ExerciseType;
  label: string;
  icon: string;
  goal: string;
  cue: string;
}

const EXERCISES: Exercise[] = [
  { id: "free_talk", label: "Free Talk", icon: "💬", goal: "Warm up your natural speaking style with live feedback.", cue: "Tell Coach Alex what you are building this week." },
  { id: "elevator_pitch", label: "Pitch", icon: "🎯", goal: "Deliver a concise and high-impact 60-second pitch.", cue: "Start with problem, solution, and one clear outcome." },
  { id: "storytelling", label: "Story", icon: "📖", goal: "Improve pacing, structure, and emotional delivery.", cue: "Use a beginning, turning point, and ending." },
  { id: "impromptu", label: "Improv", icon: "⚡", goal: "Build confidence under pressure with instant prompts.", cue: "Answer without overthinking. Keep momentum high." },
  { id: "eye_contact_drill", label: "Eye Contact", icon: "👁", goal: "Train a confident camera presence while speaking.", cue: "Hold eye contact through each full sentence." },
  { id: "filler_word_elimination", label: "No Fillers", icon: "🚫", goal: "Reduce filler words by replacing them with pauses.", cue: "Pause for one beat before key points." },
  { id: "power_pause", label: "Power Pause", icon: "⏸", goal: "Use strategic silence to make ideas land stronger.", cue: "Insert a 2-second pause before key statements." },
];

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `s-${Date.now()}`;
}

function clock(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

async function persistSessionEvent(payload: Record<string, unknown>) {
  try {
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store"
    });
  } catch {
    // Best-effort persistence.
  }
}

export function CoachingSession() {
  const stateRef = useRef<SessionState>("idle");
  const startingRef = useRef(false);
  const convIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);
  const sessionWindowRef = useRef<Window | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [exerciseType, setExerciseType] = useState<ExerciseType>("free_talk");
  const [tavusUrl, setTavusUrl] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const activeExercise = useMemo(
    () => EXERCISES.find((exercise) => exercise.id === exerciseType) ?? EXERCISES[0],
    [exerciseType]
  );

  const setState = useCallback((v: SessionState) => {
    stateRef.current = v;
    setSessionState(v);
  }, []);

  const startSession = useCallback(async () => {
    if (startingRef.current) return;
    if (!(stateRef.current === "idle" || stateRef.current === "ended")) return;

    startingRef.current = true;
    setError(null);
    setElapsed(0);
    setState("connecting");
    const sessionWindow = typeof window !== "undefined" ? window.open("", "_blank") : null;
    sessionWindowRef.current = sessionWindow;

    if (sessionWindow) {
      try {
        sessionWindow.document.write(`
          <title>Launching Coach Alex</title>
          <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#050810;color:#e8edf4;font:16px Georgia,serif;">
            <div style="text-align:center;padding:24px;">
              <p style="margin:0 0 12px;font:600 12px system-ui,sans-serif;letter-spacing:0.14em;text-transform:uppercase;color:#f0bc5e;">AI Speech Coach</p>
              <p style="margin:0;font-size:18px;">Launching Coach Alex...</p>
            </div>
          </body>
        `);
        sessionWindow.document.close();
      } catch {
        // Ignore cross-window write issues and use the blank tab as-is.
      }
    }

    try {
      const sessionId = uid();
      const conv = await createTavusConversation({ sessionId, exerciseType });
      sessionIdRef.current = sessionId;
      convIdRef.current = conv.conversationId;
      setTavusUrl(conv.conversationUrl);
      await persistSessionEvent({
        action: "start",
        sessionId,
        exerciseType,
        startedAt: new Date().toISOString()
      });

      if (sessionWindow && !sessionWindow.closed) {
        sessionWindow.location.replace(conv.conversationUrl);
      } else {
        window.location.assign(conv.conversationUrl);
        return;
      }

      setState("running");
    } catch (e) {
      sessionIdRef.current = null;
      convIdRef.current = null;
      setTavusUrl(null);
      if (sessionWindowRef.current && !sessionWindowRef.current.closed) {
        sessionWindowRef.current.close();
      }
      sessionWindowRef.current = null;
      setState("idle");
      setError(e instanceof Error ? e.message : "Unable to start session");
    } finally {
      startingRef.current = false;
    }
  }, [exerciseType, setState]);

  const endSession = useCallback(async (isUnmount = false) => {
    if (stateRef.current === "ending" || stateRef.current === "idle") return;
    setState("ending");

    const id = convIdRef.current;
    const sessionId = sessionIdRef.current;
    convIdRef.current = null;
    sessionIdRef.current = null;
    setTavusUrl(null);
    if (sessionWindowRef.current && !sessionWindowRef.current.closed) {
      sessionWindowRef.current.close();
    }
    sessionWindowRef.current = null;

    if (id) {
      try { await endTavusConversation(id); } catch { /* ignore */ }
    }

    if (sessionId) {
      await persistSessionEvent({
        action: "end",
        sessionId,
        endedAt: new Date().toISOString(),
        notes: `Tavus session duration ${clock(elapsedRef.current)}`
      });
    }

    if (!isUnmount) setState("ended");
  }, [setState]);

  useEffect(() => {
    if (sessionState !== "running") return;
    const i = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(i);
  }, [sessionState]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    if (sessionState !== "running") return;

    const intervalId = window.setInterval(() => {
      const sessionWindow = sessionWindowRef.current;
      if (!sessionWindow || !sessionWindow.closed) return;
      sessionWindowRef.current = null;
      void endSession();
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [endSession, sessionState]);

  useEffect(() => {
    if (sessionState !== "running") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void endSession();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [endSession, sessionState]);

  useEffect(() => {
    return () => { void endSession(true); };
  }, [endSession]);

  /* ────────────────────────────────────
     IDLE — Launch Pad
     ──────────────────────────────────── */
  if (sessionState === "idle") {
    return (
      <div className="setup-root">
        <div className="setup-glow" />
        <div className="panel-shell setup-card">
          {/* Icon */}
          <div style={{
            width: 52, height: 52, borderRadius: "var(--radius-lg)",
            background: "var(--color-interactive-muted)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-5)",
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--amber-400)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </div>

          <h1>Start a Session</h1>
          <p className="setup-subtitle">Pick an exercise. Coach Alex will guide you live.</p>

          <div className="exercise-grid">
            {EXERCISES.map((ex) => (
              <button
                key={ex.id}
                type="button"
                className={`exercise-chip${exerciseType === ex.id ? " selected" : ""}`}
                onClick={() => setExerciseType(ex.id)}
              >
                <span className="chip-icon">{ex.icon}</span>
                {ex.label}
              </button>
            ))}
          </div>

          <div className="exercise-preview" aria-live="polite">
            <p className="exercise-preview-label">Selected Focus</p>
            <p className="exercise-preview-title">{activeExercise.icon} {activeExercise.label}</p>
            <p className="exercise-preview-goal">{activeExercise.goal}</p>
            <p className="exercise-preview-cue">Try this opener: {activeExercise.cue}</p>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => void startSession()}
            style={{ width: "100%", marginTop: "var(--space-6)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.3 2.8A1.5 1.5 0 004 4.1v15.8a1.5 1.5 0 002.3 1.3l12.5-7.9a1.5 1.5 0 000-2.6L6.3 2.8z" />
            </svg>
            Begin Session
          </button>

          {error && (
            <div className="error-toast" style={{ marginTop: "var(--space-4)", textAlign: "left" }}>
              {error}
            </div>
          )}
        </div>

        <Link
          href={"/" as const}
          style={{
            marginTop: "var(--space-6)",
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-tertiary)",
          }}
        >
          &larr; Back to home
        </Link>
      </div>
    );
  }

  /* ────────────────────────────────────
     COMPLETED — Debrief
     ──────────────────────────────────── */
  if (sessionState === "ended") {
    return (
      <div className="setup-root">
        <div className="setup-glow" />
        <div className="panel-shell completed-card">
          <div className="check-circle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--emerald-400)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <p className="duration-stat">{clock(elapsed)}</p>
          <p className="duration-label">Session Duration</p>
          <p className="debrief-text">
            Session complete. Coach Alex has logged your performance.
          </p>

          <div style={{ marginTop: "var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => { setState("idle"); setError(null); }}
              style={{ width: "100%" }}
            >
              New Session
            </button>
            <Link href={"/history" as const} className="btn-ghost" style={{ width: "100%", justifyContent: "center" }}>
              View History
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ────────────────────────────────────
     LIVE — Full-Screen Session
     ──────────────────────────────────── */
  return (
    <div className="session-root">
      {/* ── Top Bar ── */}
      <div className="session-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <span className="coach-label">Coach Alex</span>
          <span className={`status-pill ${sessionState === "running" ? "live" : "connecting"}`}>
            <span className={`dot ${sessionState === "running" ? "breathing" : "pulse"}`} />
            {sessionState === "connecting" ? "Connecting" : "Live"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <span className="timer-display">{clock(elapsed)}</span>
          <span className="exercise-label hidden sm:inline">
            {activeExercise.label}
          </span>
        </div>
      </div>

      {/* ── Video ── */}
      <div className="session-video-area">
        {!tavusUrl ? (
          <div className="connecting-overlay">
            <div className="connecting-spinner" />
            <p className="connecting-text">Preparing your session&hellip;</p>
          </div>
        ) : (
          <div style={{ height: "100%", display: "grid", placeItems: "center", padding: "var(--space-6)" }}>
            <div
              className="panel-shell"
              style={{
                width: "min(560px, 100%)",
                padding: "var(--space-8)",
                textAlign: "center",
                display: "grid",
                gap: "var(--space-4)"
              }}
            >
              <p className="session-hud-title" style={{ margin: 0 }}>Session Opened</p>
              <h2 style={{ margin: 0, fontSize: "var(--font-size-2xl)" }}>
                Coach Alex is running in a separate tab
              </h2>
              <p style={{ margin: 0, color: "var(--color-text-secondary)" }}>
                Finish the name and camera prompts in the Tavus tab. If it did not open, use the button below.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "var(--space-3)" }}>
                <a href={tavusUrl} target="_blank" rel="noreferrer" className="btn-primary">
                  Open Coach Alex
                </a>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    const sessionWindow = sessionWindowRef.current;
                    if (sessionWindow && !sessionWindow.closed) {
                      sessionWindow.focus();
                      return;
                    }
                    window.open(tavusUrl, "_blank");
                  }}
                >
                  Focus Session Tab
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="session-hud" aria-hidden={sessionState !== "running"}>
          <p className="session-hud-title">Live Prompt</p>
          <p className="session-hud-text">{activeExercise.cue}</p>
          <p className="session-hud-shortcut">Press Esc to end session</p>
        </div>
      </div>

      {/* ── Bottom Bar ── */}
      <div className="session-bottombar">
        <button
          type="button"
          className="btn-danger"
          onClick={() => void endSession()}
          disabled={sessionState === "ending"}
        >
          {sessionState === "ending" ? (
            <>
              <span style={{
                width: 14, height: 14, borderRadius: "50%",
                border: "2px solid rgba(252,165,165,0.3)",
                borderTopColor: "var(--red-300)",
                animation: "spin 0.8s linear infinite", display: "inline-block",
              }} />
              Ending&hellip;
            </>
          ) : (
            "End Session"
          )}
        </button>
      </div>

      {error && (
        <div className="error-toast" style={{
          position: "absolute", bottom: 72, left: "50%", transform: "translateX(-50%)",
          zIndex: 30, boxShadow: "var(--shadow-lg)",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
