import Link from "next/link";
import { lockRole } from "@/lib/club/actions";
import type { ClubRole } from "@/lib/officer/session";
import { Wordmark } from "./wordmark";

export function SiteHeader({
  role,
  currentPath,
}: {
  role: ClubRole | null;
  currentPath: string;
}) {
  const links = [
    { href: "/standings", label: "Standings" },
    { href: "/results", label: "Results" },
    role === "arbiter"
      ? { href: "/arbiter", label: "Report results" }
      : { href: "/officer", label: role === "officer" ? "Run a round" : "Officers" },
  ];

  return (
    <header className="border-b" style={{ borderColor: "var(--rule)" }}>
      {/* Wraps because the bar does not fit a phone on one line: wordmark plus
          three links needs ~400px, and an officer's or arbiter's extra "Lock
          tools" button pushes it past 600px, against a 390px handset. Without
          wrapping that overflow widens the document on every page of the site,
          not just this bar. */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-6 gap-y-3 px-6 py-6 sm:gap-x-8">
        <Link href="/" className="text-xl">
          <Wordmark />
        </Link>

        <nav className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-sm sm:gap-x-6">
          {links.map((link) => {
            const active =
              currentPath === link.href || currentPath.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "border-b pt-1 pb-1 text-ink"
                    : "text-muted py-1 transition-colors hover:text-ink"
                }
                style={active ? { borderColor: "var(--color-ink)" } : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {role ? (
          <form action={lockRole} className="ml-auto">
            <button
              type="submit"
              className="text-faint text-sm transition-colors hover:text-ink"
            >
              Lock {role} tools
            </button>
          </form>
        ) : null}
      </div>
    </header>
  );
}
