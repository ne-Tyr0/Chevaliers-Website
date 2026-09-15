/**
 * Shown while a page fetches its data: the rough shape of a page, drawn as
 * faint checkerboard placeholders.
 *
 * It fades in only after 0.6 seconds, so fast loads never flash it.
 * The header stays live above it, so navigation keeps working meanwhile.
 */
export default function Loading() {
  return (
    <main
      className="skeleton-page mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14"
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        Loading…
      </p>
      <div aria-hidden>
        <div className="skeleton h-4 w-32 rounded-full" />
        <div className="skeleton mt-4 h-10 w-64 max-w-full rounded-lg" />
        <div className="skeleton mt-4 h-4 w-full max-w-lg rounded-full" />
        <div className="skeleton mt-2 h-4 w-3/4 max-w-md rounded-full" />

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="skeleton h-32" />
          ))}
        </div>
      </div>
    </main>
  );
}
