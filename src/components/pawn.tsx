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

/*
 * Two more pieces for the chess touches, drawn on the pawn's grid so the three
 * share a base and a stroke-free silhouette.
 */

/** The queen a leading pawn promotes to. */
export function Queen({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 32" className={className} fill="currentColor" aria-hidden>
      <circle cx="4.6" cy="5.2" r="1.7" />
      <circle cx="12" cy="3" r="1.9" />
      <circle cx="19.4" cy="5.2" r="1.7" />
      <path d="M5.9 11.2 4.7 6.6l3.9 3 3.4-5.1 3.4 5.1 3.9-3-1.2 4.6Z" />
      <path d="M6.9 12.2h10.2a.8.8 0 0 1 .7 1.2l-.7 1.2a.9.9 0 0 1-.8.4H7.7a.9.9 0 0 1-.8-.4l-.7-1.2a.8.8 0 0 1 .7-1.2Z" />
      <path d="M8.7 16.1h6.6c.2 3.2 1 6 2.6 8.6H6.1c1.6-2.6 2.4-5.4 2.6-8.6Z" />
      <path d="M4.6 25.6h14.8c.7 0 1.2.5 1.2 1.2v2.6c0 .7-.5 1.2-1.2 1.2H4.6c-.7 0-1.2-.5-1.2-1.2v-2.6c0-.7.5-1.2 1.2-1.2Z" />
    </svg>
  );
}

/** The knight that marks the current step of running a round. */
export function Knight({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 32" className={className} fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M6.4 24.7c.3-3.3 1.7-5.8 3.8-8-1.6.4-3 1-4.2 1.9-.8.6-1.9.2-2.1-.8l-.4-1.9c-.2-.8.1-1.6.7-2.2l5.1-5c.3-1.4 1-2.5 2.1-3.3l.3-2 1.8 1.5c3.6.7 6.3 3.9 6.3 7.7v12.1Zm7-15.9a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
      />
      <path d="M4.6 25.6h14.8c.7 0 1.2.5 1.2 1.2v2.6c0 .7-.5 1.2-1.2 1.2H4.6c-.7 0-1.2-.5-1.2-1.2v-2.6c0-.7.5-1.2 1.2-1.2Z" />
    </svg>
  );
}
