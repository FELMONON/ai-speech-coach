"use client";

import type { SessionSummary } from "@/lib/types";

interface ProgressChartProps {
  sessions: SessionSummary[];
}

function scaled(value: number, max: number) {
  if (max === 0) return 8;
  return Math.max(8, (value / max) * 100);
}

export function ProgressChart({ sessions }: ProgressChartProps) {
  if (sessions.length === 0) {
    return (
      <section className="panel-shell" style={{ padding: "var(--space-6)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--slate-200)" }}>
          Progress Overview
        </h2>
        <p style={{ marginTop: "var(--space-2)", fontSize: "var(--font-size-sm)", color: "var(--color-text-tertiary)" }}>
          Complete sessions to see your improvement trend here.
        </p>
      </section>
    );
  }

  const recent = sessions.slice(0, 10).reverse();
  const maxWpm = Math.max(...recent.map((s) => s.averageWpm ?? 0), 1);
  const maxEye = Math.max(...recent.map((s) => s.eyeContactAverage ?? 0), 1);

  return (
    <section className="panel-shell" style={{ padding: "var(--space-6)" }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--slate-200)" }}>
        Progress Overview
      </h2>
      <p style={{ marginTop: "var(--space-1)", fontSize: "var(--font-size-xs)", color: "var(--color-text-tertiary)" }}>
        Last {recent.length} sessions
      </p>

      <div style={{ marginTop: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {recent.map((s) => {
          const wpm = s.averageWpm ?? 0;
          const eye = s.eyeContactAverage ?? 0;
          return (
            <div key={s.id} style={{
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border-subtle)",
              background: "rgba(15, 20, 31, 0.3)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--font-size-xs)", color: "var(--color-text-tertiary)" }}>
                <span style={{ textTransform: "capitalize", fontFamily: "var(--font-display)", fontWeight: 500 }}>
                  {s.exerciseType.replaceAll("_", " ")}
                </span>
                <span>{new Date(s.startedAt).toLocaleDateString()}</span>
              </div>
              <div style={{ marginTop: "var(--space-3)", display: "grid", gap: "var(--space-2)", gridTemplateColumns: "1fr 1fr" }}>
                {/* WPM */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", marginBottom: 4, fontFamily: "var(--font-display)" }}>
                    <span>WPM</span>
                    <span>{wpm.toFixed(0)}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: "var(--radius-full)", background: "var(--black-700)" }}>
                    <div style={{
                      height: 5, borderRadius: "var(--radius-full)",
                      background: "linear-gradient(90deg, var(--amber-600), var(--amber-400))",
                      width: `${scaled(wpm, maxWpm)}%`,
                      transition: "width 0.4s var(--ease-out)",
                    }} />
                  </div>
                </div>
                {/* Eye Contact */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--font-size-xs)", color: "var(--color-text-secondary)", marginBottom: 4, fontFamily: "var(--font-display)" }}>
                    <span>Eye Contact</span>
                    <span>{eye.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: "var(--radius-full)", background: "var(--black-700)" }}>
                    <div style={{
                      height: 5, borderRadius: "var(--radius-full)",
                      background: "linear-gradient(90deg, rgba(52,211,153,0.6), var(--emerald-400))",
                      width: `${scaled(eye, maxEye)}%`,
                      transition: "width 0.4s var(--ease-out)",
                    }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
