"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createTavusConversation, endTavusConversation } from "@/lib/tavus";
import type { ExerciseType } from "@/lib/types";
import Link from "next/link";

type SessionState = "idle" | "connecting" | "running" | "ending" | "ended";

interface Exercise {
  id: ExerciseType;
  label: string;
  icon: string;
}

const EXERCISES: Exercise[] = [
  { id: "free_talk", label: "Free Talk", icon: "💬" },
  { id: "elevator_pitch", label: "Pitch", icon: "🎯" },
  { id: "storytelling", label: "Story", icon: "📖" },
  { id: "impromptu", label: "Improv", icon: "⚡" },
  { id: "eye_contact_drill", label: "Eye Contact", icon: "👁" },
  { id: "filler_word_elimination", label: "No Fillers", icon: "🚫" },
  { id: "power_pause", label: "Power Pause", icon: "⏸" },
];

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `s-${Date.now()}`;
}

function clock(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export function CoachingSession() {
  const stateRef = useRef<SessionState>("idle");
  const startingRef = useRef(false);
  const convIdRef = useRef<string | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [exerciseType, setExerciseType] = useState<ExerciseType>("free_talk");
  const [tavusUrl, setTavusUrl] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const setState = useCallback((v: SessionState) => {
    stateRef.current = v;
    setSessionState(v);
  }, []);

  const startSession = useCallback(async () => {
    if (startingRef.current) return;
    if (!(stateRef.current === "idle" || stateRef.current === "ended")) return;

    startingRef.current = true;
    setError(null);
    setIframeLoaded(false);
    setElapsed(0);
    setState("connecting");

    try {
      const conv = await createTavusConversation({ sessionId: uid(), exerciseType });
      convIdRef.current = conv.conversationId;
      setTavusUrl(conv.conversationUrl);
      setState("running");
    } catch (e) {
      convIdRef.current = null;
      setTavusUrl(null);
      setState("idle");
      setError(e instanceof Error ? e.message : "Unable to start session");
    } finally {
      startingRef.current = false;
    }
  }, [exerciseType, setState]);

  const endSession = useCallback(async (isUnmount = false) => {
    if (stateRef.current === "ending" || stateRef.current === "idle") return;
    setState("ending");
    setIframeLoaded(false);

    const id = convIdRef.current;
    convIdRef.current = null;
    setTavusUrl(null);

    if (id) {
      try { await endTavusConversation(id); } catch { /* ignore */ }
    }
    if (!isUnmount) setState("ended");
  }, [setState]);

  useEffect(() => {
    if (sessionState !== "running") return;
    const i = window.setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => window.clearInterval(i);
  }, [sessionState]);

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
          <span className={`status-pill ${sessionState === "running" && iframeLoaded ? "live" : "connecting"}`}>
            <span className={`dot ${sessionState === "running" && iframeLoaded ? "breathing" : "pulse"}`} />
            {sessionState === "connecting" ? "Connecting" : iframeLoaded ? "Live" : "Joining"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <span className="timer-display">{clock(elapsed)}</span>
          <span className="exercise-label hidden sm:inline">
            {EXERCISES.find((e) => e.id === exerciseType)?.label ?? "Free Talk"}
          </span>
        </div>
      </div>

      {/* ── Video ── */}
      <div className="session-video-area">
        {tavusUrl ? (
          <iframe
            src={tavusUrl}
            allow="camera; microphone; autoplay; fullscreen; clipboard-write"
            onLoad={() => setIframeLoaded(true)}
            title="Live Coaching Session"
          />
        ) : (
          <div className="connecting-overlay">
            <div className="connecting-spinner" />
            <p className="connecting-text">Preparing your session&hellip;</p>
          </div>
        )}

        {tavusUrl && !iframeLoaded && (
          <div className="connecting-overlay">
            <div className="connecting-spinner" />
            <p className="connecting-text">Connecting to Coach Alex&hellip;</p>
          </div>
        )}
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
