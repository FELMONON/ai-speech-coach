"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavBar() {
  const pathname = usePathname();

  if (pathname === "/session") return null;

  return (
    <nav className="main-nav" aria-label="Main navigation">
      <div className="main-nav-inner">
        <Link href={"/" as const} className="nav-brand">
          <span className="nav-brand-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--amber-400)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </span>
          SpeakLab
        </Link>

        <div className="nav-links">
          {([
            { href: "/" as const, label: "Home" },
            { href: "/session" as const, label: "Practice" },
            { href: "/history" as const, label: "History" },
          ]).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
