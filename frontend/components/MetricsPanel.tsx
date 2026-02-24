"use client";

import type { RealtimeMetrics } from "@/lib/types";
import { getTotalFillers } from "@/lib/speechMetrics";

interface MetricsPanelProps {
  metrics: RealtimeMetrics;
  timerLabel: string;
  connected: boolean;
  showDetails: boolean;
  onToggleDetails: () => void;
}

function badgeTone(value: number, thresholds: { strong: number; medium: number }) {
  if (value >= thresholds.strong) {
    return "text-success border-success/60 bg-emerald-400/10";
  }

  if (value >= thresholds.medium) {
    return "text-warning border-warning/60 bg-amber-400/10";
  }

  return "text-rose-200 border-rose-300/70 bg-rose-400/10";
}

export function MetricsPanel({ metrics, timerLabel, connected, showDetails, onToggleDetails }: MetricsPanelProps) {
  const totalFillers = getTotalFillers(metrics.speech_metrics.filler_words);
  const eyeContact = Math.round(metrics.visual_signals.eye_contact_percentage);
  const wpm = Math.round(metrics.speech_metrics.words_per_minute);

  return (
    <section className="panel-shell p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full border px-3 py-1 ${badgeTone(wpm, { strong: 130, medium: 110 })}`}>WPM: {wpm || "--"}</span>
          <span className="rounded-full border border-borderStrong px-3 py-1 text-textPrimary">Fillers: {totalFillers}</span>
          <span className={`rounded-full border px-3 py-1 ${badgeTone(eyeContact, { strong: 70, medium: 45 })}`}>Eye Contact: {eyeContact}%</span>
          <span className="rounded-full border border-borderStrong px-3 py-1 text-textMuted">Session: {timerLabel}</span>
          <span className="rounded-full border border-borderStrong px-3 py-1 text-textMuted">
            Exercise: {metrics.session_context.exercise_type.replaceAll("_", " ")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs ${connected ? "text-success" : "text-rose-300"}`}>
            {connected ? "Connected" : "Reconnecting"}
          </span>
          <button
            type="button"
            onClick={onToggleDetails}
            className="min-h-11 rounded-lg border border-borderStrong px-4 py-2 text-xs font-semibold uppercase tracking-wide text-textMuted hover:border-cyan-300 hover:text-cyan-100"
          >
            {showDetails ? "Hide Metrics" : "Show Metrics"}
          </button>
        </div>
      </div>

      {showDetails ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <article className="rounded-lg border border-borderStrong bg-slate-950/35 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-textMuted">Speech</p>
            <p className="mt-2 text-sm text-textPrimary">Filler rate: {metrics.speech_metrics.filler_word_rate}/min</p>
            <p className="text-sm text-textPrimary">Longest pause: {metrics.speech_metrics.longest_pause_seconds}s</p>
            <p className="text-sm text-textPrimary">Total words: {metrics.speech_metrics.total_words}</p>
          </article>

          <article className="rounded-lg border border-borderStrong bg-slate-950/35 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-textMuted">Visual</p>
            <p className="mt-2 text-sm text-textPrimary">Expression: {metrics.visual_signals.facial_expression}</p>
            <p className="text-sm text-textPrimary">Head movement: {metrics.visual_signals.head_movement_level}</p>
            <p className="text-sm text-textPrimary">Posture score: {metrics.visual_signals.posture_score.toFixed(2)}</p>
          </article>

          <article className="rounded-lg border border-borderStrong bg-slate-950/35 p-3">
            <p className="text-[10px] uppercase tracking-[0.2em] text-textMuted">Trend</p>
            <p className="mt-2 text-sm text-textPrimary">Improvement: {metrics.session_context.improvement_trend}</p>
            <p className="text-sm text-textPrimary">Duration: {metrics.session_context.duration_minutes.toFixed(1)} min</p>
            <p className="text-sm text-textPrimary">Pause count: {metrics.speech_metrics.pause_count}</p>
          </article>
        </div>
      ) : null}
    </section>
  );
}
