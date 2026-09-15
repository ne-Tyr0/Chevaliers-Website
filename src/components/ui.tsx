import Link from "next/link";
import { setWording } from "@/lib/club/actions";
import type { Terms } from "@/lib/terms";
import { ChevronLeft, ChevronRight } from "./icons";
import { Pawn } from "./pawn";

/*
 * Building blocks shared by every page, so that the same thing always looks
 * the same: where you are, what you can do, and what went wrong.
 */

export type Crumb = { href: string; label: string };

/**
 * The top of a page: a trail back up the site, the title, and one sentence on
 * what the page is for.
 *
 * Deep pages get a trail rather than a bare "Back" link, because a player page
 * reached from the home page has no single "back" — the trail says where it
 * sits instead.
 */
export function PageHeader({
  title,
  description,
  crumbs,
  eyebrow,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  crumbs?: Crumb[];
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div>
      {crumbs && crumbs.length > 0 ? <Breadcrumbs crumbs={crumbs} /> : null}
      {eyebrow ? (
        <p className="text-muted mt-6 text-sm first:mt-0">{eyebrow}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 first:mt-0">
        <h1 className="text-3xl text-balance sm:text-4xl">{title}</h1>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {description ? (
        <p className="text-muted mt-3 max-w-prose text-base leading-relaxed">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const parent = crumbs.at(-1)!;
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      {/* A phone has room for one step up, not the whole trail. */}
      <Link
        href={parent.href}
        className="text-muted -ml-1 inline-flex min-h-11 items-center gap-1 pr-2 hover:text-ink sm:hidden"
      >
        <ChevronLeft className="size-4" />
        <span className="link">{parent.label}</span>
      </Link>
      <ol className="text-muted hidden flex-wrap items-center gap-x-2 sm:flex">
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-2">
            <Link href={crumb.href} className="link hover:text-ink">
              {crumb.label}
            </Link>
            <span aria-hidden className="text-faint">
              /
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** A heading for a block of content within a page, with an optional aside. */
export function SectionHeading({
  children,
  aside,
  id,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="text-xl sm:text-2xl">
        {children}
      </h2>
      {aside ? <div className="text-muted text-sm">{aside}</div> : null}
    </div>
  );
}

/**
 * Nothing to show yet. Says why, and where it helps, what to do next — an empty
 * area with no explanation reads as a broken page.
 */
export function EmptyState({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="card mt-8 flex items-start gap-4 p-5 sm:p-6">
      <Pawn className="text-faint mt-1 h-6 w-auto shrink-0" />
      <div>
        <p className="text-muted max-w-prose text-base leading-relaxed">
          {children}
        </p>
        {action ? <div className="mt-4 flex flex-wrap gap-3">{action}</div> : null}
      </div>
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-6 rounded-lg border-2 px-4 py-3 text-sm leading-relaxed"
      style={{
        borderColor: "var(--color-ink)",
        backgroundColor: "var(--color-cream-light)",
      }}
    >
      <strong className="font-semibold">Something went wrong. </strong>
      {children}
    </p>
  );
}

/** A quiet aside: context that helps but is not needed to use the page. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-3">
      <Pawn className="text-faint mt-0.5 h-4 w-auto shrink-0" />
      <p className="text-muted max-w-prose text-sm leading-relaxed">{children}</p>
    </div>
  );
}

/**
 * Switch between everyday words and chess terms.
 *
 * Two labelled buttons rather than a bare switch, so both choices are visible
 * and it is obvious which one is on. A plain form, so it works without
 * JavaScript; the page reloads in the chosen wording.
 */
export function WordingToggle({
  terms,
  returnTo,
  className = "",
}: {
  terms: Terms;
  returnTo: string;
  className?: string;
}) {
  const options = [
    { value: "plain", label: "Everyday words" },
    { value: "chess", label: "Chess terms" },
  ] as const;

  return (
    <form
      action={setWording}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${className}`}
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <span className="text-muted text-sm" id="wording-label">
        Show
      </span>
      <div
        role="group"
        aria-labelledby="wording-label"
        className="inline-flex rounded-lg border p-0.5"
        style={{ borderColor: "var(--rule-strong)" }}
      >
        {options.map((option) => {
          const on = terms.wording === option.value;
          return (
            <button
              key={option.value}
              type="submit"
              name="wording"
              value={option.value}
              aria-pressed={on}
              disabled={on}
              className={`min-h-9 rounded-md px-3 text-sm transition-colors ${
                on
                  ? "bg-ink text-cream font-medium"
                  : "text-muted cursor-pointer hover:bg-cream-deep hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </form>
  );
}

/** A round's status, as a tag rather than anything that looks pressable. */
export function RoundStatusTag({ status }: { status: string }) {
  if (status === "completed") return <span className="tag">Finished</span>;
  if (status === "in_progress") return <span className="tag tag-strong">In progress</span>;
  return <span className="tag">Being set up</span>;
}

export function formatDate(value: string, month: "long" | "short" = "long"): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month,
    year: "numeric",
  });
}

/**
 * "See all of this" at the end of a preview. A link, not a button — it goes
 * somewhere rather than doing something — but with a chevron and a full-size
 * touch target so it is easy to hit.
 */
export function MoreLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group mt-3 inline-flex min-h-11 items-center gap-1 font-medium ${className}`}
    >
      <span className="link">{children}</span>
      <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/**
 * A number that counts up from zero as the page appears.
 *
 * Whole numbers count; a trailing half is written after them, so "6½" counts
 * 0…6 and then shows the half. The visible figure is a CSS counter (see
 * `.count-up` in globals.css) and hidden from screen readers, which get the
 * real value instead.
 */
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const whole = Math.floor(value);
  const half = value - whole === 0.5;
  if (whole === 0) {
    return <span className={`tabular-nums ${className}`}>{half ? "½" : "0"}</span>;
  }
  return (
    <span className={`tabular-nums ${className}`}>
      <span className="sr-only">{half ? `${whole}½` : whole}</span>
      <span
        aria-hidden
        className="count-up"
        style={{ "--count": whole } as React.CSSProperties}
      >
        {half ? "½" : null}
      </span>
    </span>
  );
}
