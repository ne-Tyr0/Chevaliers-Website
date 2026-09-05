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
      <div className="mx-auto flex max-w-5xl items-baseline gap-8 px-6 py-6">
        <Link href="/" className="text-xl">
          <Wordmark />
        </Link>

        <nav className="flex items-baseline gap-6 text-sm">
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
                    ? "border-b pb-0.5 text-ink"
                    : "text-muted transition-colors hover:text-ink"
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
