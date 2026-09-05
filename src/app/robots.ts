import type { MetadataRoute } from "next";

/**
 * Kept out of search engines on purpose.
 *
 * The standings are public to anyone with the link, but they pair the names of
 * school students with their results, and being indexed means those names
 * surface when somebody searches for the student rather than for the club.
 * That is a decision for the club, not a default worth inheriting.
 *
 * To allow indexing: change `disallow` to only the officer paths below, and set
 * `robots.index` in src/app/layout.tsx to true.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
