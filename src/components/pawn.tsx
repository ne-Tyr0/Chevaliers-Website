/**
 * The pawn from the logo, where it replaces the dot on the "i".
 *
 * Used on its own as the club's recurring mark — favicon, list bullets, the
 * empty and loading states — rather than repeating the full wordmark.
 */
export function Pawn({
  className = "",
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 32"
      className={className}
      fill="currentColor"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="6.4" r="4.9" />
      <path d="M7.4 12.2h9.2a.7.7 0 0 1 .6 1.1l-.9 1.5a.9.9 0 0 1-.8.4H8.5a.9.9 0 0 1-.8-.4l-.9-1.5a.7.7 0 0 1 .6-1.1Z" />
      <path d="M9.1 16.1h5.8c.1 3.1.9 6 2.4 8.6H6.7c1.5-2.6 2.3-5.5 2.4-8.6Z" />
      <path d="M4.6 25.6h14.8c.7 0 1.2.5 1.2 1.2v2.6c0 .7-.5 1.2-1.2 1.2H4.6c-.7 0-1.2-.5-1.2-1.2v-2.6c0-.7.5-1.2 1.2-1.2Z" />
    </svg>
  );
}
