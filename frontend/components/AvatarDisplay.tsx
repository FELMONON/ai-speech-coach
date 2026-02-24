"use client";

import type { RefObject } from "react";

interface AvatarDisplayProps {
  videoRef: RefObject<HTMLVideoElement>;
  audioRef: RefObject<HTMLAudioElement>;
  avatarConnected: boolean;
  tavusConversationUrl?: string | null;
  onTavusLoad?: () => void;
}

export function AvatarDisplay({
  videoRef,
  audioRef,
  avatarConnected,
  tavusConversationUrl,
  onTavusLoad
}: AvatarDisplayProps) {
  const usingTavus = Boolean(tavusConversationUrl);

  return (
    <section className="call-tile">
      {usingTavus ? (
        <>
          <iframe
            src={tavusConversationUrl ?? undefined}
            allow="camera; microphone; autoplay; fullscreen; clipboard-write"
            allowFullScreen
            onLoad={onTavusLoad}
            className="call-media"
            title="Coach Call"
          />
          <div className="tavus-self-mask" aria-hidden />
        </>
      ) : (
        <video ref={videoRef} autoPlay playsInline className="call-media" />
      )}

      {!avatarConnected ? (
        <div className="call-overlay">
          <span>Connecting Coach</span>
        </div>
      ) : null}

      <div className="tile-label">
        <span className={`tile-dot ${avatarConnected ? "live" : ""}`} />
        Coach Alex
      </div>
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
    </section>
  );
}
