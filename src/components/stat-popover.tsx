"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GAP = 8;
const EDGE = 8;
/** Grace period so moving the mouse toward the card does not dismiss it. */
const CLOSE_DELAY_MS = 120;

/**
 * A detail card shown on hover, tap or keyboard focus.
 *
 * Rendered through a portal because the tables it is used in scroll
 * horizontally, and an absolutely positioned child would be clipped by that
 * container.
 *
 * Touch has no hover, so a tap opens it; that also makes it reachable by
 * keyboard, where it opens on focus. Keep the contents read-only — the card
 * closes when the trigger loses focus, so anything clickable inside would be
 * dismissed before the click landed.
 */
export function StatPopover({
  label,
  children,
  className = "",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * How the trigger was last activated. A mouse has already opened the card on
   * hover by the time the click arrives, so letting that click toggle would
   * shut it again the instant anyone clicked a name.
   */
  const pointerKind = useRef<string>("");

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  useEffect(() => cancelClose, []);

  // Place under the trigger, then nudge back inside the viewport once the card
  // has been measured. Flips above when there is no room below.
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current?.getBoundingClientRect();
    if (!trigger) return;
    setCoords({ top: trigger.bottom + GAP, left: trigger.left });

    const frame = requestAnimationFrame(() => {
      const card = cardRef.current?.getBoundingClientRect();
      const anchor = triggerRef.current?.getBoundingClientRect();
      if (!card || !anchor) return;

      let left = anchor.left;
      if (left + card.width > window.innerWidth - EDGE) {
        left = window.innerWidth - card.width - EDGE;
      }
      left = Math.max(EDGE, left);

      let top = anchor.bottom + GAP;
      if (top + card.height > window.innerHeight - EDGE) {
        top = Math.max(EDGE, anchor.top - card.height - GAP);
      }
      setCoords({ top, left });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const dismiss = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !cardRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    // Capture, so scrolling any ancestor closes it rather than leaving the card
    // stranded away from its row.
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onPointerDown={(event) => {
          pointerKind.current = event.pointerType;
        }}
        onKeyDown={() => {
          pointerKind.current = "keyboard";
        }}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return;
          cancelClose();
          setOpen(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse") return;
          closeSoon();
        }}
        onFocus={() => setOpen(true)}
        onBlur={closeSoon}
        onClick={() => {
          // Hover already governs the mouse; only touch and keyboard toggle.
          if (pointerKind.current === "mouse") {
            cancelClose();
            setOpen(true);
            return;
          }
          setOpen((value) => !value);
        }}
        className={`cursor-help text-left underline decoration-dotted underline-offset-4 ${className}`}
        style={{ textDecorationColor: "var(--rule-strong)" }}
      >
        {label}
      </button>

      {open && coords
        ? createPortal(
            <div
              ref={cardRef}
              role="dialog"
              onPointerEnter={cancelClose}
              onPointerLeave={closeSoon}
              className="z-50 w-72 border p-4 text-sm shadow-sm"
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                borderColor: "var(--color-ink)",
                backgroundColor: "var(--color-cream)",
                color: "var(--color-ink)",
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
