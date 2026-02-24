"use client";

import type { RefObject } from "react";

interface UserVideoFeedProps {
  videoRef: RefObject<HTMLVideoElement>;
  isLive: boolean;
}

export function UserVideoFeed({ videoRef, isLive }: UserVideoFeedProps) {
  return (
    <section className="call-tile">
      <video ref={videoRef} autoPlay muted playsInline className="call-media scale-x-[-1]" />
      <div className="tile-label">
        <span className={`tile-dot ${isLive ? "live" : ""}`} />
        You
      </div>
    </section>
  );
}
