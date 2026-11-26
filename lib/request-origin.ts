// Cross-site request check for the cookie-authenticated POST route handlers
// (#147). Session cookies are SameSite=Lax, which already stops most forged
// requests; this adds the same Origin check Next.js applies to Server Actions:
// the Origin host must equal the app's own host from X-Forwarded-Host or Host.

interface HeaderSource {
  get(name: string): string | null;
}

export const CROSS_ORIGIN_ERROR = "This request must come from the AlumniKonneQt site.";

function ownHost(headers: HeaderSource): string {
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  return (forwarded || headers.get("host") || "").trim().toLowerCase();
}

/**
 * True when the request came from this site, or from a client that is not a
 * browser. Browsers send Origin on every POST; when it is missing, the
 * browser-set Sec-Fetch-Site header decides, and a request with neither (a
 * script or server test) is allowed, as Next.js does for Server Actions.
 * An opaque origin ("null"), for example from a sandboxed frame, is rejected.
 */
export function isSameOriginRequest(headers: HeaderSource): boolean {
  const origin = headers.get("origin");
  if (origin === null) {
    const site = headers.get("sec-fetch-site");
    return site === null || site === "same-origin" || site === "none";
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const host = ownHost(headers);
  return host !== "" && originHost === host;
}

/** A 403 response for a cross-site request, or null when the request may continue. */
export function rejectCrossOrigin(headers: HeaderSource): Response | null {
  if (isSameOriginRequest(headers)) return null;
  return Response.json(
    { error: CROSS_ORIGIN_ERROR },
    { status: 403, headers: { "Cache-Control": "private, no-store" } },
  );
}
