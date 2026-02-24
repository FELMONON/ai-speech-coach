"use client";

import clsx from "clsx";
import type { ExerciseType } from "@/lib/types";

interface SessionControlsProps {
  sessionState: "idle" | "connecting" | "running" | "paused" | "ending";
  exerciseType: ExerciseType;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onExerciseChange: (exerciseType: ExerciseType) => void;
}

const exercises: Array<{ id: ExerciseType; label: string }> = [
  { id: "free_talk", label: "Free Talk" },
  { id: "elevator_pitch", label: "Pitch" },
  { id: "storytelling", label: "Story" },
  { id: "impromptu", label: "Improv" },
  { id: "eye_contact_drill", label: "Eye Contact" },
  { id: "filler_word_elimination", label: "No Fillers" },
  { id: "power_pause", label: "Power Pause" }
];

export function SessionControls({
  sessionState,
  exerciseType,
  onStart,
  onPause,
  onResume,
  onEnd,
  onExerciseChange
}: SessionControlsProps) {
  const running = sessionState === "running";
  const paused = sessionState === "paused";
  const connecting = sessionState === "connecting";
  const canChangeExercise = sessionState === "idle";

  return (
    <section className="panel-shell p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-3">
        {sessionState === "idle" && (
          <button
            type="button"
            onClick={onStart}
            className="min-h-11 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-slate-950 hover:-translate-y-0.5 hover:bg-cyan-300"
          >
            Start Session
          </button>
        )}

        {connecting && (
          <button
            type="button"
            disabled
            className="flex min-h-11 cursor-not-allowed items-center gap-2 rounded-lg bg-accent/60 px-5 py-2.5 text-sm font-semibold text-slate-950"
          >
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
            Connecting...
          </button>
        )}

        {running && (
          <button
            type="button"
            onClick={onPause}
            className="min-h-11 rounded-lg border border-borderStrong bg-slate-950/40 px-5 py-2.5 text-sm font-semibold text-textPrimary hover:border-cyan-200"
          >
            Pause
          </button>
        )}

        {paused && (
          <button
            type="button"
            onClick={onResume}
            className="min-h-11 rounded-lg border border-success bg-slate-950/40 px-5 py-2.5 text-sm font-semibold text-success hover:-translate-y-0.5"
          >
            Resume
          </button>
        )}

        {(running || paused || connecting) && (
          <button
            type="button"
            onClick={onEnd}
            className="min-h-11 rounded-lg border border-rose-300/70 bg-rose-500/10 px-5 py-2.5 text-sm font-semibold text-rose-200 hover:-translate-y-0.5 hover:bg-rose-500/20"
          >
            End Session
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {exercises.map((exercise) => {
          const selected = exerciseType === exercise.id;
          return (
            <button
              key={exercise.id}
              type="button"
              disabled={!canChangeExercise}
              onClick={() => onExerciseChange(exercise.id)}
              className={clsx(
                "min-h-11 rounded-lg border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors",
                !canChangeExercise && "cursor-not-allowed opacity-50",
                selected
                  ? "border-cyan-200 bg-cyan-300/15 text-cyan-100"
                  : "border-borderStrong bg-slate-950/30 text-textMuted hover:border-cyan-300 hover:text-cyan-100",
                !canChangeExercise && !selected && "hover:border-borderStrong hover:text-textMuted"
              )}
            >
              {exercise.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
