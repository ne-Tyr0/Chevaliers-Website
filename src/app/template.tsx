import { ViewTransition } from "react";

/**
 * Wraps every page so moving between them is a short handoff — the old page
 * steps back, the new one rises into place — instead of an instant swap.
 *
 * A template rather than the layout because a template remounts on each
 * navigation, which is what gives the transition an old page to leave and a
 * new one to arrive. The header lives in the layout and holds still.
 *
 * Browsers without the View Transitions API simply swap pages as before, and
 * reduced-motion users get the swap with no animation (see globals.css).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}
