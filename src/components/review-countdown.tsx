"use client";

import { useEffect, useState } from "react";

/**
 * How long the review window has left.
 *
 * Client-side because the server's clock and the reader's may sit in different
 * timezones, so rendering a wall-clock time there could show the wrong hour.
 * Counting down from a timestamp avoids the question entirely.
 */
export function ReviewCountdown({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(() => expiresAt - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(expiresAt - Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (remaining <= 0) {
    return (
      <span className="text-faint">
        The window has lapsed — reload to enter the passcode again.
      </span>
    );
  }

  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <span className="text-faint tabular-nums">
      {minutes > 0
        ? `${minutes} min ${String(seconds).padStart(2, "0")}s left`
        : `${seconds}s left`}
    </span>
  );
}
