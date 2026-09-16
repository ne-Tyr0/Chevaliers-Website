"use client";

import { useLayoutEffect, useRef } from "react";
import { Knight, Pawn, Queen } from "./pawn";

/*
 * The two chess touches that need to remember something between page views.
 * Both are decorative and hidden from assistive technology: the text beside
 * them ("1st", "Step 2 of 4") carries the meaning.
 */

/**
 * Whether to sit still: either the device asks for reduced motion, or the
 * layout marked it as one of the slower ones (see globals.css).
 */
function skipMotion(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  return document.documentElement.dataset.motion === "lite";
}

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Private browsing or storage disabled: the animation just replays.
  }
}

const PROMOTED_KEY = "chevaliers:leader-promoted";

/**
 * The leader's marker: a pawn that promotes to a queen.
 *
 * It plays once per visit, the first time a leader is shown, and after that
 * the queen simply sits there — seeing it every time the home page loads would
 * turn a nice moment into noise. Starts empty and fades in whichever state
 * applies, so a repeat visit never shows a pawn snapping into a queen.
 *
 * The choice is written straight onto the element rather than kept in React
 * state: it is a one-off decision about the DOM, and setting it before paint
 * avoids an extra render.
 */
export function LeaderMark({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const mark = ref.current;
    if (!mark) return;
    if (skipMotion() || readSession(PROMOTED_KEY)) {
      mark.dataset.state = "queen";
      return;
    }
    writeSession(PROMOTED_KEY, "1");
    mark.dataset.state = "promote";
  }, []);

  return (
    <span
      ref={ref}
      aria-hidden
      title="Top of the table"
      className={`leader-mark relative inline-block h-4 w-3 shrink-0 align-[-2px] ${className}`}
      data-state="pending"
    >
      <Pawn className="leader-pawn absolute inset-0 h-full w-full" />
      <Queen className="leader-queen absolute inset-0 h-full w-full" />
    </span>
  );
}

/**
 * The knight on the four steps of running a round.
 *
 * It stands on the current step. When a step is completed and the page comes
 * back one step further on, it hops from the old step to the new one. The last
 * step it stood on is remembered per round for the visit, so reloading the
 * same step leaves it still.
 */
export function StepKnight({
  roundKey,
  step,
}: {
  /** Identifies the round, so a new round starts the knight fresh. */
  roundKey: string;
  /** Zero-based index of the current step. */
  step: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const storageKey = `chevaliers:knight:${roundKey}`;

  useLayoutEffect(() => {
    const knight = ref.current;
    const stored = readSession(storageKey);
    writeSession(storageKey, String(step));
    // Nothing stored means this is the first look at this round: stand still.
    if (!knight || stored === null || skipMotion()) return;

    const previous = Number(stored);
    if (!Number.isInteger(previous) || previous < 0 || previous >= step) return;

    knight.style.setProperty("--from", String(previous));
    knight.classList.add("is-hopping");
    const settle = () => knight.classList.remove("is-hopping");
    knight.addEventListener("animationend", settle, { once: true });
    return () => knight.removeEventListener("animationend", settle);
  }, [storageKey, step]);

  return (
    <span
      ref={ref}
      aria-hidden
      className="step-knight"
      style={{ "--step": step, "--from": step } as React.CSSProperties}
    >
      <Knight className="h-5 w-auto" />
    </span>
  );
}
