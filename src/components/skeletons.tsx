/*
 * Placeholders shown while a page's data is on its way.
 *
 * Each one is shaped like the thing it stands in for — a table looks like a
 * table, matches look like cards — so the wait reads as "this is coming" rather
 * than as something missing. They fade in only after 0.6s, so a fast load never
 * flashes them (see `.skeleton-page` in globals.css).
 *
 * Hidden from assistive technology: each page announces its own loading state.
 */

function Bar({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton h-4 rounded-full ${className}`} style={style} />;
}

/** Title, and the line of explanation under it. */
export function PageHeaderSkeleton({ eyebrow = false }: { eyebrow?: boolean }) {
  return (
    <div aria-hidden>
      {eyebrow ? <Bar className="h-3.5 w-32" /> : null}
      <div className="skeleton mt-3 h-9 w-56 max-w-full rounded-lg sm:h-10" />
      <Bar className="mt-4 w-full max-w-lg" />
      <Bar className="mt-2 w-2/3 max-w-sm" />
    </div>
  );
}

/** The standings table: a head rule, then rows of name and figures. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card mt-6 p-4 sm:p-5" aria-hidden>
      <div className="flex items-center gap-4 border-b pb-3" style={{ borderColor: "var(--rule-strong)" }}>
        <Bar className="h-3 w-6" />
        <Bar className="h-3 w-24 flex-1" />
        <Bar className="h-3 w-12" />
        <Bar className="h-3 w-12" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b py-4 last:border-b-0"
          style={{ borderColor: "var(--rule)" }}
        >
          <Bar className="w-5" />
          <Bar className="flex-1" style={{ maxWidth: `${60 - index * 5}%` }} />
          <Bar className="w-8" />
          <Bar className="w-8" />
        </div>
      ))}
    </div>
  );
}

/** Matches, as cards in the same grid the results page uses. */
export function MatchCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-2" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card p-4 sm:p-5">
          <div className="flex justify-between gap-3">
            <Bar className="h-3.5 w-16" />
            <Bar className="h-3.5 w-24" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-4">
            <Bar className="h-5 w-40 max-w-[60%]" />
            <Bar className="h-5 w-5" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-4">
            <Bar className="h-5 w-36 max-w-[55%]" />
            <Bar className="h-5 w-5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A list of people: name, a line under it, and a figure on the right. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="card mt-6 p-2" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-3 py-4 last:border-b-0"
          style={{ borderColor: "var(--rule)" }}
        >
          <div className="min-w-0 flex-1">
            <Bar style={{ width: `${70 - (index % 4) * 8}%` }} />
            <Bar className="mt-2 h-3 w-24" />
          </div>
          <Bar className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

/** The four figures at the top of a player's page. */
export function StatTilesSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="card p-4">
          <Bar className="h-3 w-16" />
          <div className="skeleton mt-3 h-7 w-12 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Cards of people, as the officers page lays them out. */
export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="card p-5">
          <Bar className="h-3.5 w-24" />
          <div className="skeleton mt-3 h-6 w-40 max-w-full rounded-md" />
          <Bar className="mt-3 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** A block of text, for pages that are mostly prose. */
export function ProseSkeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="card mt-6 space-y-3 p-5" aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <Bar key={index} style={{ width: `${95 - (index % 3) * 15}%` }} />
      ))}
    </div>
  );
}

/** Wraps a page's placeholders so they fade in only after a short wait. */
export function LoadingShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <main
      className={`skeleton-page mx-auto w-full px-4 py-8 sm:px-6 sm:py-14 ${
        wide ? "max-w-5xl" : "max-w-3xl"
      }`}
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        Loading…
      </p>
      {children}
    </main>
  );
}
