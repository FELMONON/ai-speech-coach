import Link from "next/link";
import { ProgressChart } from "@/components/ProgressChart";
import { prisma } from "@/lib/prisma";
import type { SessionSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

async function loadSessions(): Promise<SessionSummary[]> {
  try {
    const sessions = await prisma.sessionRecord.findMany({
      orderBy: { startedAt: "desc" },
      take: 30,
    });
    return sessions.map((s) => ({
      id: s.id,
      exerciseType: s.exerciseType as SessionSummary["exerciseType"],
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString(),
      averageWpm: s.averageWpm,
      fillerWordRate: s.fillerWordRate,
      eyeContactAverage: s.eyeContactAverage,
      notes: s.notes,
    }));
  } catch {
    return [];
  }
}

export default async function HistoryPage() {
  const sessions = await loadSessions();

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", minHeight: "100vh", padding: "var(--space-8) var(--space-5)" }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--font-size-2xl)", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--slate-50)" }}>
            Session History
          </h1>
          <p style={{ marginTop: "var(--space-1)", fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
            Track your progress over time
          </p>
        </div>
        <Link href={"/session" as const} className="btn-primary">
          New Session
        </Link>
      </header>

      <ProgressChart sessions={sessions} />

      <section className="panel-shell" style={{ overflow: "hidden", marginTop: "var(--space-5)" }}>
        <div style={{ borderBottom: "1px solid var(--color-border-subtle)", padding: "var(--space-4) var(--space-5)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--slate-200)" }}>
            Recent Sessions
          </h2>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 560, textAlign: "left", fontSize: "var(--font-size-sm)", borderCollapse: "collapse" }} aria-label="Session history">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                {["Date", "Exercise", "Avg WPM", "Fillers/min", "Eye Contact"].map((h) => (
                  <th key={h} style={{
                    padding: "var(--space-3) var(--space-5)",
                    fontFamily: "var(--font-display)",
                    fontSize: "var(--font-size-xs)",
                    fontWeight: 600,
                    color: "var(--color-text-tertiary)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "var(--space-16) var(--space-5)" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: "var(--radius-lg)",
                        background: "var(--color-interactive-muted)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        marginBottom: "var(--space-4)",
                      }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--amber-400)" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--font-size-sm)", fontWeight: 600, color: "var(--slate-200)" }}>
                        No sessions yet
                      </p>
                      <p style={{ marginTop: "var(--space-2)", maxWidth: 280, fontSize: "var(--font-size-sm)", color: "var(--color-text-tertiary)" }}>
                        Complete your first coaching session to start tracking progress.
                      </p>
                      <Link href={"/session" as const} className="btn-primary" style={{ marginTop: "var(--space-5)" }}>
                        Start First Session
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--color-border-subtle)", transition: "background 0.15s ease" }}>
                    <td style={{ padding: "var(--space-3) var(--space-5)", color: "var(--color-text-secondary)" }}>
                      {new Date(s.startedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "var(--space-3) var(--space-5)", color: "var(--slate-200)", textTransform: "capitalize" }}>
                      {s.exerciseType.replaceAll("_", " ")}
                    </td>
                    <td style={{ padding: "var(--space-3) var(--space-5)", color: "var(--slate-200)" }}>
                      {s.averageWpm?.toFixed(0) ?? "—"}
                    </td>
                    <td style={{ padding: "var(--space-3) var(--space-5)", color: "var(--slate-200)" }}>
                      {s.fillerWordRate?.toFixed(1) ?? "—"}
                    </td>
                    <td style={{ padding: "var(--space-3) var(--space-5)", color: "var(--slate-200)" }}>
                      {s.eyeContactAverage != null ? `${s.eyeContactAverage.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
