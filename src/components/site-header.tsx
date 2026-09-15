"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition } from "react";
import { lockRole } from "@/lib/club/actions";
import type { ClubRole } from "@/lib/officer/session";
import {
  HomeIcon,
  InfoIcon,
  LockIcon,
  PlayersIcon,
  ResultsIcon,
  StandingsIcon,
} from "./icons";
import { Wordmark } from "./wordmark";

/**
 * The public destinations, in the order people look for them.
 *
 * Kept to five so they fit a phone's tab bar without shrinking or truncating
 * the labels, which is the limit Material Design sets for a bottom bar.
 * Officer and arbiter tools are not in this list: most visitors never need
 * them, so they sit in the footer until a passcode is held.
 */
const DESTINATIONS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/standings", label: "Standings", Icon: StandingsIcon },
  { href: "/results", label: "Results", Icon: ResultsIcon },
  { href: "/players", label: "Players", Icon: PlayersIcon },
  { href: "/about", label: "About", Icon: InfoIcon },
] as const;

function isCurrent(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Site navigation: a header on every screen, plus a tab bar on phones.
 *
 * Rendered once in the root layout, so it stays put while pages change beneath
 * it. That is what lets the "you are here" marker slide from one link to the
 * next instead of vanishing and reappearing, and gives the eye one fixed
 * point while the content moves.
 *
 * Navigation is always visible rather than behind a menu button. NN/g's
 * testing found hiding it roughly halved how often people found it, and a
 * bottom bar keeps it where a thumb reaches.
 */
export function SiteHeader({ role }: { role: ClubRole | null }) {
  const pathname = usePathname();

  const staffLink =
    role === "officer"
      ? { href: "/officer", label: "Officer tools" }
      : role === "arbiter"
        ? { href: "/arbiter", label: "Report results" }
        : null;
  const inStaffArea =
    staffLink !== null &&
    (isCurrent(staffLink.href, pathname) || pathname.startsWith("/matchup"));

  return (
    <>
      <header
        className="relative z-30 border-b"
        style={{
          borderColor: "var(--rule)",
          backgroundColor: "var(--color-cream)",
          viewTransitionName: "site-header",
        }}
      >
        <div className="mx-auto flex min-h-16 max-w-5xl items-center gap-x-6 px-4 py-2 sm:px-6">
          <Link
            href="/"
            className="group -ml-1 flex min-h-11 items-center rounded-md px-1 text-xl sm:text-2xl"
          >
            <Wordmark />
            <span className="sr-only"> — home</span>
          </Link>

          <nav aria-label="Main" className="hidden sm:block">
            <ul className="flex items-center gap-1">
              {DESTINATIONS.filter((d) => d.href !== "/").map((item) => {
                const current = isCurrent(item.href, pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={current ? "page" : undefined}
                      className={`relative flex min-h-11 items-center rounded-md px-3 text-[0.9375rem] transition-colors ${
                        current
                          ? "text-ink font-semibold"
                          : "text-muted hover:bg-cream-deep hover:text-ink"
                      }`}
                    >
                      {item.label}
                      {current ? (
                        <ViewTransition name="nav-marker" share="marker" default="none">
                          <span
                            aria-hidden
                            className="bg-ink absolute inset-x-3 -bottom-2 h-0.5 rounded-full"
                          />
                        </ViewTransition>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {staffLink ? (
            <div className="ml-auto flex items-center gap-2">
              <Link
                href={staffLink.href}
                aria-current={inStaffArea ? "page" : undefined}
                className={inStaffArea ? "btn-primary btn-sm" : "btn btn-sm"}
              >
                {staffLink.label}
              </Link>
              <form action={lockRole}>
                <button
                  type="submit"
                  className="btn-quiet"
                  title={`Lock ${role} tools on this device`}
                >
                  <LockIcon className="size-4" />
                  <span className="hidden md:inline">Lock</span>
                  <span className="sr-only md:hidden">Lock {role} tools</span>
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </header>

      <TabBar pathname={pathname} />
    </>
  );
}

/** Phones only. Fixed to the bottom, clear of the home indicator. */
function TabBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t sm:hidden"
      style={{
        borderColor: "var(--rule-strong)",
        backgroundColor: "var(--color-cream-light)",
        paddingBottom: "env(safe-area-inset-bottom)",
        viewTransitionName: "tab-bar",
      }}
    >
      <ul className="grid h-[var(--tabbar-height)] grid-cols-5">
        {DESTINATIONS.map(({ href, label, Icon }) => {
          const current = isCurrent(href, pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`press flex h-full flex-col items-center justify-center gap-1 text-[0.6875rem] leading-none ${
                  current ? "text-ink font-semibold" : "text-muted"
                }`}
              >
                <span className="relative flex h-7 w-12 items-center justify-center">
                  {current ? (
                    <ViewTransition name="tab-marker" share="marker" default="none">
                      <span aria-hidden className="bg-ink absolute inset-0 rounded-full" />
                    </ViewTransition>
                  ) : null}
                  <Icon className={`relative size-5 ${current ? "text-cream" : ""}`} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
