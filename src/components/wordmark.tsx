/**
 * The "Chevaliers" wordmark as live text in the display serif.
 *
 * The logo's pawn-for-the-dot-on-the-i is left to the logo itself; reproducing
 * it in HTML means absolutely positioning a glyph over a dotless "i", which
 * breaks at different sizes and in different fonts. The pawn earns its keep as
 * a standalone mark instead — see `Pawn`.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-semibold tracking-tight ${className}`}>
      Chevaliers
    </span>
  );
}
