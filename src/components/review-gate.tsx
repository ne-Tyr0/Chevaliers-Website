import { closeReview, openReview } from "@/lib/club/actions";
import { LockIcon } from "./icons";
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
    <div className="card mt-6 p-5">
      <h2 className="flex items-center gap-2 text-lg">
        <LockIcon className="size-5" />
        Round {roundNumber} is finished
      </h2>
      <p className="text-muted mt-2 max-w-prose leading-relaxed">
        You can look at it as it stands. To correct a result, enter the officer
        passcode again. Changing a finished round can move everyone&rsquo;s
        place in the standings, so it is worth being sure.
      </p>

      <form action={openReview} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="returnTo" value={returnTo} />
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label className="label block" htmlFor="review-passcode">
            Officer passcode
          </label>
          <input
            id="review-passcode"
            name="passcode"
            type="password"
            autoComplete="current-password"
            required
            className="field mt-1.5"
          />
        </div>
        <button type="submit" className="btn-primary">
          Unlock to correct
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
      className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 px-5 py-4"
      style={{ borderColor: "var(--color-ink)" }}
    >
      <p>
        <strong className="font-semibold">Finished rounds are unlocked.</strong>{" "}
        <ReviewCountdown expiresAt={expiresAt} />
      </p>
      <form action={closeReview}>
        <input type="hidden" name="returnTo" value={returnTo} />
        <button type="submit" className="btn btn-sm">
          <LockIcon className="size-4" />
          Lock again now
        </button>
      </form>
    </div>
  );
}
