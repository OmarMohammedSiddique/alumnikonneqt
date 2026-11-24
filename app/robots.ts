import type { MetadataRoute } from "next";

// Public pages may be indexed. Signed-in areas, sign-in steps and the API are
// kept out of search results; they are protected by sign-in regardless (#147).
export const ROBOTS_DISALLOW = [
  "/api/",
  "/auth/",
  "/admin",
  "/discover",
  "/profile",
  "/requests",
  "/demo",
  "/arrival",
  "/verify-email",
  "/login/code",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ROBOTS_DISALLOW },
  };
}
