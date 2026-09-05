import Link from "next/link";
import { lockOfficer } from "@/lib/club/actions";
import { Wordmark } from "./wordmark";

export function SiteHeader({
  isOfficer,
  currentPath,
}: {
  isOfficer: boolean;
  currentPath: string;
}) {
  const links = [
    { href: "/standings", label: "Standings" },
    { href: "/results", label: "Results" },
    { href: "/officer", label: isOfficer ? "Run a round" : "Officers" },
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

        {isOfficer ? (
          <form action={lockOfficer} className="ml-auto">
            <button
              type="submit"
              className="text-faint text-sm transition-colors hover:text-ink"
            >
              Lock officer tools
            </button>
          </form>
        ) : null}
      </div>
    </header>
  );
}
