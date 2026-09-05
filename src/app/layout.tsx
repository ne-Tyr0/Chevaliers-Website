import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { PawnBackdrop } from "@/components/pawn-backdrop";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Where the site lives, for absolute URLs in link previews.
 *
 * Vercel sets VERCEL_PROJECT_PRODUCTION_URL for you, so this is correct on a
 * deployment without configuring anything. Set NEXT_PUBLIC_SITE_URL to override
 * it once the club has its own domain.
 */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Chevaliers Chess Club",
    template: "%s · Chevaliers",
  },
  description:
    "Standings and Swiss pairings for the Chevaliers chess club at Philippine Science High School, Central Visayas Campus.",
  applicationName: "Chevaliers Chess Club",
  openGraph: {
    type: "website",
    siteName: "Chevaliers Chess Club",
    title: "Chevaliers Chess Club",
    description:
      "Standings and Swiss pairings for the school chess club. One season is one continuous event, and one club meeting is one round.",
    url: siteUrl,
  },
  twitter: { card: "summary_large_image" },
  /*
   * The site is public, but it lists the names of school students alongside
   * their results. Being reachable by a shared link is a different thing from
   * turning up when someone searches a member's name, so it stays out of search
   * engines by default. If the club decides otherwise, set index and follow to
   * true here and mirror the change in src/app/robots.ts.
   */
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <PawnBackdrop />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
