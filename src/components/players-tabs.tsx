import Link from "next/link";
import { ViewTransition } from "react";

const TABS = [
  { id: "all", href: "/players", label: "All players" },
  { id: "officers", href: "/players/officers", label: "Officers & adviser" },
] as const;

/**
 * The two views of the Players page. Each is its own URL, so either can be
 * linked to directly, and the marker slides between them as you switch.
 */
export function PlayersTabs({ current }: { current: (typeof TABS)[number]["id"] }) {
  return (
    <nav
      aria-label="Players"
      className="mt-6 border-b"
      style={{ borderColor: "var(--rule-strong)" }}
    >
      <ul className="-ml-3 flex flex-wrap gap-x-1">
        {TABS.map((tab) => {
          const active = tab.id === current;
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-12 items-center rounded-t-md px-3 text-[0.9375rem] transition-colors ${
                  active
                    ? "text-ink font-semibold"
                    : "text-muted hover:bg-cream-deep hover:text-ink"
                }`}
              >
                {tab.label}
                {active ? (
                  <ViewTransition name="players-tab-marker" share="marker" default="none">
                    <span
                      aria-hidden
                      className="bg-ink absolute inset-x-2 bottom-0 h-[3px] rounded-t"
                    />
                  </ViewTransition>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
