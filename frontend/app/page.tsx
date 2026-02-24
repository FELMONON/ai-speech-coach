import Link from "next/link";

const features = [
  {
    icon: "🎙",
    title: "Real-Time Feedback",
    desc: "Get instant coaching on pace, clarity, and filler words as you speak naturally.",
  },
  {
    icon: "👁",
    title: "Eye Contact Training",
    desc: "Dedicated drills that train you to maintain confident camera presence.",
  },
  {
    icon: "⚡",
    title: "7 Exercise Modes",
    desc: "Elevator pitches, impromptu speaking, storytelling — practice what matters to you.",
  },
  {
    icon: "🎯",
    title: "AI Video Coach",
    desc: "Coach Alex sees you, hears you, and responds in real time — like a private coaching call.",
  },
];

export default function LandingPage() {
  return (
    <main className="hero-section">
      {/* Background mesh gradients */}
      <div
        className="hero-mesh"
        style={{
          width: 700, height: 500, top: "-10%", left: "-15%",
          background: "rgba(226, 164, 69, 0.07)",
        }}
      />
      <div
        className="hero-mesh"
        style={{
          width: 500, height: 400, top: "5%", right: "-10%",
          background: "rgba(52, 211, 153, 0.04)",
          animationDelay: "3s",
        }}
      />

      {/* Badge */}
      <div className="hero-badge">
        <span className="badge-dot" />
        AI Speech Training
      </div>

      {/* Hero */}
      <h1 className="hero-title">
        Speak with confidence.{" "}
        <span className="accent-gradient">Get coached live.</span>
      </h1>

      <p className="hero-description">
        Practice speaking on camera with an AI coach who watches, listens, and gives you real-time feedback on delivery, pace, and presence — just like a private coaching session.
      </p>

      {/* CTAs */}
      <div className="hero-actions">
        <Link href={"/session" as const} className="btn-primary" style={{ padding: "0 2rem", fontSize: "var(--font-size-base)" }}>
          Start Coaching Session
        </Link>
        <Link href={"/history" as const} className="btn-ghost">
          View History
        </Link>
      </div>

      {/* Features */}
      <div className="feature-grid">
        {features.map((f) => (
          <div key={f.title} className="feature-card">
            <div className="feature-icon">{f.icon}</div>
            <h3 className="feature-title">{f.title}</h3>
            <p className="feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>

      <p className="hero-footer">
        Built with Tavus CVI, Claude, and Next.js
      </p>
    </main>
  );
}
