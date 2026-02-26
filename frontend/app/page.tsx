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

const quickStats = [
  { value: "7", label: "Practice modes" },
  { value: "Live", label: "AI coaching calls" },
  { value: "~2 min", label: "To run a drill" },
];

const flow = [
  { title: "Pick a drill", desc: "Choose your exercise based on what you want to improve today." },
  { title: "Join live coaching", desc: "Coach Alex joins instantly in a real conversation experience." },
  { title: "Track your growth", desc: "Review your sessions in History and spot your speaking trends." },
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

      <div className="hero-stats" aria-label="Quick platform highlights">
        {quickStats.map((stat) => (
          <div key={stat.label} className="hero-stat-card">
            <p className="hero-stat-value">{stat.value}</p>
            <p className="hero-stat-label">{stat.label}</p>
          </div>
        ))}
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

      <div className="flow-grid" aria-label="How it works">
        {flow.map((item, index) => (
          <article key={item.title} className="flow-card">
            <span className="flow-step">0{index + 1}</span>
            <h3 className="flow-title">{item.title}</h3>
            <p className="flow-desc">{item.desc}</p>
          </article>
        ))}
      </div>

      <p className="hero-footer">
        Built with Tavus CVI, Claude, and Next.js
      </p>
    </main>
  );
}
