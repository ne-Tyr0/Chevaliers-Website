import { closeReview, openReview } from "@/lib/club/actions";
import { ReviewCountdown } from "./review-countdown";

/**
 * The passcode step in front of editing a round that has already been closed.
 *
 * Correcting a finished round rewrites the standings, because scores and both
 * tiebreaks are derived from games rather than stored. Asking for the passcode
 * again makes that a deliberate act instead of something an unattended laptop
 * allows, and the permission lapses on its own shortly afterwards.
 */
export function ReviewGate({
  returnTo,
  roundNumber,
}: {
  returnTo: string;
  roundNumber: number;
}) {
  return (
    <div
      className="mt-6 border-l-2 pl-4"
      style={{ borderColor: "var(--rule-strong)" }}
    >
      <h2 className="label">Round {roundNumber} is closed</h2>
      <p className="text-muted mt-2 max-w-prose text-sm leading-relaxed">
        You can read it as it stands. To correct anything, enter the officer
        passcode again — changing a finished round moves every score and tiebreak
        that follows it, so it is worth being sure.
      </p>

      <form
        action={openReview}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="returnTo" value={returnTo} />
        <div>
          <label className="label block" htmlFor="review-passcode">
            Officer passcode
          </label>
          <input
            id="review-passcode"
            name="passcode"
            type="password"
            autoComplete="current-password"
            required
            className="mt-2 border bg-transparent px-4 py-2.5 text-sm"
            style={{ borderColor: "var(--rule-strong)" }}
          />
        </div>
        <button
          type="submit"
          className="cursor-pointer border px-5 py-2.5 text-sm transition-colors hover:bg-ink hover:text-cream"
          style={{ borderColor: "var(--color-ink)" }}
        >
          Unlock for editing
        </button>
      </form>
    </div>
  );
}

/** Shown while the review window is open, wherever a closed round is editable. */
export function ReviewBanner({
  returnTo,
  expiresAt,
}: {
  returnTo: string;
  expiresAt: number;
}) {
  return (
    <div
      className="mt-6 flex flex-wrap items-center justify-between gap-3 border-l-2 pl-4"
      style={{ borderColor: "var(--color-ink)" }}
    >
      <p className="text-sm">
        Closed rounds are unlocked for editing.{" "}
        <ReviewCountdown expiresAt={expiresAt} />
      </p>
      <form action={closeReview}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          type="submit"
          className="text-faint cursor-pointer text-xs transition-colors hover:text-ink"
        >
          Lock again now
        </button>
      </form>
    </div>
  );
}
